import { Router, type IRouter } from "express";
import { eq, sql, and } from "drizzle-orm";
import { db, campaignsTable, campaignResponsesTable, organizationsTable, paymentIntentsTable } from "@workspace/db";
import {
  CreateCampaignBody, UpdateCampaignBody, GetCampaignParams, UpdateCampaignParams, DeleteCampaignParams, ListCampaignsQueryParams,
  SubmitCampaignResponseParams, SubmitCampaignResponseBody,
  ListCampaignSubmissionsParams,
  GetCampaignAnalyticsParams, ExportCampaignSubmissionsParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { getOrgRole, requireBodyOrgRole, requireResourceOrgRole } from "../middlewares/orgAccess";
import { getPlatformCurrency, isPlatformCurrencySupported, recordTransaction } from "../lib/commission-engine";
import { createPaymentIntent, failPaymentIntent, initializePaymentIntent } from "../lib/payment-intents";
import { compactListMedia } from "../lib/compact-list-media";

const router: IRouter = Router();

function hasValidTimeWindow(startsAt: Date | null | undefined, endsAt: Date | null | undefined): boolean {
  if (!startsAt || !endsAt) return true;
  return startsAt.getTime() < endsAt.getTime();
}

function toCsvValue(value: unknown): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function campaignRow(campaign: any, orgName: string | null, submissionsCount: number, orgLogoUrl?: string | null) {
  return {
    ...campaign,
    organizationName: orgName,
    organizationLogoUrl: orgLogoUrl ?? null,
    currentAmount: parseFloat(campaign.currentAmount ?? "0"),
    goalAmount: campaign.goalAmount ? parseFloat(campaign.goalAmount) : null,
    paymentAmount: campaign.paymentAmount ? parseFloat(campaign.paymentAmount) : null,
    submissionsCount,
  };
}

type CampaignFieldConfig = {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
};

const LEGACY_PLATFORM_IDENTITY_FIELD_IDS = new Set(["field_name", "field_email", "field_phone"]);

function isLegacyPlatformIdentityField(field: CampaignFieldConfig): boolean {
  return LEGACY_PLATFORM_IDENTITY_FIELD_IDS.has(field.id);
}

function validateCampaignResponseFields(
  configuredFields: unknown,
  data: Record<string, unknown>,
): string | null {
  if (!Array.isArray(configuredFields)) return null;

  for (const field of configuredFields as CampaignFieldConfig[]) {
    if (!field || typeof field.id !== "string" || !field.id || typeof field.label !== "string") {
      return "This campaign form is not configured correctly";
    }
    // Keep legacy campaign definitions and existing responses intact, but don't
    // require platform-owned identity fields a second time on new submissions.
    if (isLegacyPlatformIdentityField(field)) continue;

    const value = data[field.id];
    const empty = value === undefined || value === null
      || (typeof value === "string" && value.trim() === "");
    if (field.required && (field.type === "checkbox" ? value !== true : empty)) {
      return field.type === "checkbox"
        ? `${field.label} must be checked`
        : `${field.label} is required`;
    }
    if (empty) continue;

    switch (field.type) {
      case "text":
      case "textarea":
      case "phone":
        if (typeof value !== "string") return `${field.label} must be text`;
        break;
      case "email":
        if (typeof value !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
          return `${field.label} must be a valid email address`;
        }
        break;
      case "number":
        if (!(typeof value === "number" && Number.isFinite(value))
          && !(typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)))) {
          return `${field.label} must be a valid number`;
        }
        break;
      case "date":
        if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
          return `${field.label} must be a valid date`;
        }
        break;
      case "select":
        if (typeof value !== "string" || !Array.isArray(field.options) || !field.options.includes(value)) {
          return `${field.label} has an invalid selection`;
        }
        break;
      case "checkbox":
        if (typeof value !== "boolean") return `${field.label} must be checked or unchecked`;
        break;
      default:
        return "This campaign form contains an unsupported field";
    }
  }

  return null;
}

// List campaigns — uses a single aggregated query to avoid N+1 count lookups
router.get("/campaigns", async (req, res): Promise<void> => {
  const queryParsed = ListCampaignsQueryParams.safeParse(req.query);
  const filters: any[] = [];
  const requestedOrgId = queryParsed.success ? queryParsed.data.orgId : undefined;
  const orgRole = requestedOrgId && req.session?.userId
    ? await getOrgRole(requestedOrgId, req.session.userId)
    : null;
  const canSeePrivate = Boolean(orgRole);
  if (queryParsed.success) {
    const { orgId, type, status, visibility } = queryParsed.data;
    if (orgId) filters.push(eq(campaignsTable.orgId, orgId));
    if (type) filters.push(eq(campaignsTable.type, type));
    if (status) filters.push(eq(campaignsTable.status, status));
    if (visibility && (visibility === "public" || canSeePrivate)) {
      filters.push(eq(campaignsTable.visibility, visibility));
    } else if (!canSeePrivate) {
      filters.push(eq(campaignsTable.visibility, "public"));
    }
  } else {
    filters.push(eq(campaignsTable.visibility, "public"));
  }
  if (!canSeePrivate) {
    filters.push(sql`${campaignsTable.status} <> 'draft'`);
  }

  // Single query: LEFT JOIN organizations + subquery count — no N+1
  const rows = await db
    .select({
      campaign: campaignsTable,
      orgName: organizationsTable.name,
      orgLogoUrl: organizationsTable.logoUrl,
      submissionsCount: sql<number>`(SELECT COUNT(*)::int FROM campaign_responses cr WHERE cr.campaign_id = ${campaignsTable.id})`,
    })
    .from(campaignsTable)
    .leftJoin(organizationsTable, eq(campaignsTable.orgId, organizationsTable.id))
    .where(filters.length > 0 ? and(...filters) : undefined);

  res.json(rows.map(({ campaign, orgName, orgLogoUrl, submissionsCount }) =>
    compactListMedia(campaignRow(campaign, orgName ?? null, submissionsCount ?? 0, orgLogoUrl))
  ));
});

// Create campaign
router.post("/campaigns", requireAuth, requireBodyOrgRole(["owner", "admin"]), async (req, res): Promise<void> => {
  const parsed = CreateCampaignBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { orgId, title, description, coverImageUrl, heroImageUrl, accentColor, theme, type, visibility, goalAmount, requiresPayment, paymentAmount, currency, fields, startsAt, endsAt } = parsed.data;
  const normalizedCurrency = (currency ?? await getPlatformCurrency()).trim().toUpperCase();
  if (!await isPlatformCurrencySupported(normalizedCurrency)) {
    res.status(400).json({ error: `Currency ${normalizedCurrency} is not enabled for this platform` });
    return;
  }
  if (!hasValidTimeWindow(startsAt, endsAt)) {
    res.status(400).json({ error: "The campaign closing time must be after its opening time" });
    return;
  }
  if (requiresPayment && (!paymentAmount || paymentAmount <= 0)) {
    res.status(400).json({ error: "A positive payment amount is required when paid submissions are enabled" });
    return;
  }
  const [campaign] = await db.insert(campaignsTable).values({
    orgId, title, description, coverImageUrl, heroImageUrl, accentColor, theme: theme ?? "evenum", type, visibility: visibility ?? "public",
    goalAmount: goalAmount ? String(goalAmount) : null,
    requiresPayment: requiresPayment ?? false,
    paymentAmount: paymentAmount ? String(paymentAmount) : null,
    currency: normalizedCurrency,
    fields: fields ?? [],
    startsAt, endsAt,
  }).returning();
  res.status(201).json(campaignRow(campaign, null, 0));
});

// Get campaign — with subquery count to avoid a separate round-trip
router.get("/campaigns/:campaignId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.campaignId) ? req.params.campaignId[0] : req.params.campaignId;
  const parsed = GetCampaignParams.safeParse({ campaignId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [row] = await db
    .select({
      campaign: campaignsTable,
      orgName: organizationsTable.name,
      orgLogoUrl: organizationsTable.logoUrl,
      submissionsCount: sql<number>`(SELECT COUNT(*)::int FROM campaign_responses cr WHERE cr.campaign_id = ${campaignsTable.id})`,
    })
    .from(campaignsTable)
    .leftJoin(organizationsTable, eq(campaignsTable.orgId, organizationsTable.id))
    .where(eq(campaignsTable.id, parsed.data.campaignId))
    .limit(1);

  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const viewerRole = req.session?.userId ? await getOrgRole(row.campaign.orgId, req.session.userId) : null;
  if ((row.campaign.visibility !== "public" || row.campaign.status === "draft") && !viewerRole) {
    res.status(404).json({ error: "Not found" }); return;
  }

  res.json(campaignRow(row.campaign, row.orgName ?? null, row.submissionsCount ?? 0, row.orgLogoUrl));
});

// Update campaign — must be org owner/admin
router.patch("/campaigns/:campaignId", requireAuth, requireResourceOrgRole(campaignsTable, "campaignId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.campaignId) ? req.params.campaignId[0] : req.params.campaignId;
  const paramParsed = UpdateCampaignParams.safeParse({ campaignId: parseInt(rawId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = UpdateCampaignBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  if (
    bodyParsed.data.currency !== undefined
    && !await isPlatformCurrencySupported(bodyParsed.data.currency.trim().toUpperCase())
  ) {
    res.status(400).json({ error: `Currency ${bodyParsed.data.currency.toUpperCase()} is not enabled for this platform` });
    return;
  }
  const updateData: any = { ...bodyParsed.data };
  if (updateData.currency !== undefined) updateData.currency = updateData.currency.trim().toUpperCase();
  if (updateData.goalAmount !== undefined) updateData.goalAmount = updateData.goalAmount ? String(updateData.goalAmount) : null;
  if (updateData.paymentAmount !== undefined) updateData.paymentAmount = updateData.paymentAmount ? String(updateData.paymentAmount) : null;
  const outcome = await db.transaction(async (tx) => {
    const [current] = await tx.select({
      status: campaignsTable.status,
      startsAt: campaignsTable.startsAt,
      endsAt: campaignsTable.endsAt,
      requiresPayment: campaignsTable.requiresPayment,
      paymentAmount: campaignsTable.paymentAmount,
    })
      .from(campaignsTable)
      .where(eq(campaignsTable.id, paramParsed.data.campaignId))
      .for("update");
    if (!current) return { kind: "missing" as const };

    const startsAt = bodyParsed.data.startsAt === undefined ? current.startsAt : bodyParsed.data.startsAt;
    const endsAt = bodyParsed.data.endsAt === undefined ? current.endsAt : bodyParsed.data.endsAt;
    const requiresPayment = bodyParsed.data.requiresPayment === undefined ? current.requiresPayment : bodyParsed.data.requiresPayment;
    const paymentAmount = bodyParsed.data.paymentAmount === undefined ? current.paymentAmount : bodyParsed.data.paymentAmount;
    if (!hasValidTimeWindow(startsAt, endsAt)) {
      return { kind: "invalid_window" as const };
    }
    if (requiresPayment && (!paymentAmount || Number(paymentAmount) <= 0)) {
      return { kind: "invalid_payment" as const };
    }

    const protectedFields = [
      "requiresPayment", "paymentAmount", "currency", "fields", "goalAmount", "startsAt", "endsAt",
    ] as const;
    const changesLiveConfiguration = protectedFields.some((field) =>
      Object.prototype.hasOwnProperty.call(bodyParsed.data, field)
    );
    if (
      current.status === "ended" && bodyParsed.data.status && bodyParsed.data.status !== "ended"
      || current.status === "active" && bodyParsed.data.status === "draft"
      || current.status !== "draft" && changesLiveConfiguration
    ) {
      return { kind: "locked" as const };
    }
    if (Object.prototype.hasOwnProperty.call(bodyParsed.data, "fields")) {
      const [existingResponse] = await tx.select({ id: campaignResponsesTable.id })
        .from(campaignResponsesTable)
        .where(eq(campaignResponsesTable.campaignId, paramParsed.data.campaignId))
        .limit(1);
      if (existingResponse) return { kind: "fields_locked" as const };
    }

    const [campaign] = await tx.update(campaignsTable)
      .set(updateData)
      .where(eq(campaignsTable.id, paramParsed.data.campaignId))
      .returning();
    return campaign ? { kind: "updated" as const, campaign } : { kind: "missing" as const };
  });

  if (outcome.kind === "missing") { res.status(404).json({ error: "Not found" }); return; }
  if (outcome.kind === "invalid_window") {
    res.status(400).json({ error: "The campaign closing time must be after its opening time" });
    return;
  }
  if (outcome.kind === "invalid_payment") {
    res.status(400).json({ error: "A positive payment amount is required when paid submissions are enabled" });
    return;
  }
  if (outcome.kind === "locked") {
    res.status(409).json({
      error: "A live campaign's payment, response fields, goal, and schedule are protected. End the campaign before changing its configuration.",
    });
    return;
  }
  if (outcome.kind === "fields_locked") {
    res.status(409).json({ error: "Campaign form fields cannot change after the first submission has been received." });
    return;
  }
  res.json(campaignRow(outcome.campaign, null, 0));
});

// Delete campaign — must be org owner/admin
router.delete("/campaigns/:campaignId", requireAuth, requireResourceOrgRole(campaignsTable, "campaignId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.campaignId) ? req.params.campaignId[0] : req.params.campaignId;
  const parsed = DeleteCampaignParams.safeParse({ campaignId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const outcome = await db.transaction(async (tx) => {
    const [campaign] = await tx.select({ status: campaignsTable.status })
      .from(campaignsTable)
      .where(eq(campaignsTable.id, parsed.data.campaignId))
      .for("update");
    if (!campaign) return "not_found" as const;
    const [response] = await tx.select({ id: campaignResponsesTable.id })
      .from(campaignResponsesTable)
      .where(eq(campaignResponsesTable.campaignId, parsed.data.campaignId))
      .limit(1);
    const [payment] = await tx.select({ id: paymentIntentsTable.id })
      .from(paymentIntentsTable)
      .where(and(
        eq(paymentIntentsTable.pillar, "campaign"),
        eq(paymentIntentsTable.entityId, parsed.data.campaignId),
      ))
      .limit(1);
    if (campaign.status !== "draft" || response || payment) return "protected" as const;
    await tx.delete(campaignsTable).where(eq(campaignsTable.id, parsed.data.campaignId));
    return "deleted" as const;
  });
  if (outcome === "not_found") { res.status(404).json({ error: "Not found" }); return; }
  if (outcome === "protected") {
    res.status(409).json({ error: "Only draft campaigns with no submissions or payment history can be permanently deleted. End the campaign to preserve its history." });
    return;
  }
  res.json({ message: "Deleted" });
});

// ── SUBMISSIONS ────────────────────────────────────────────────────────────

router.post("/campaigns/:campaignId/submit", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.campaignId) ? req.params.campaignId[0] : req.params.campaignId;
  const paramParsed = SubmitCampaignResponseParams.safeParse({ campaignId: parseInt(rawId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = SubmitCampaignResponseBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }

  const { submitterName, submitterEmail, customerPhone, data } = bodyParsed.data;
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, paramParsed.data.campaignId)).limit(1);
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
  const viewerRole = req.session?.userId ? await getOrgRole(campaign.orgId, req.session.userId) : null;
  if (campaign.visibility === "private" && !viewerRole) {
    res.status(403).json({ error: "This campaign is private and is not open to public submissions" });
    return;
  }

  // ── Lifecycle enforcement ───────────────────────────────────────────────
  if (campaign.status !== "active") {
    const reason =
      campaign.status === "ended" ? "This campaign has ended and is no longer accepting submissions" :
      "This campaign is not currently open for submissions";
    res.status(403).json({ error: reason });
    return;
  }

  const now = new Date();
  if (campaign.endsAt && new Date(campaign.endsAt) <= now) {
    res.status(403).json({ error: "This campaign's submission deadline has passed" });
    return;
  }
  if (campaign.startsAt && new Date(campaign.startsAt) > now) {
    res.status(403).json({ error: "This campaign has not opened for submissions yet" });
    return;
  }

  const fieldError = validateCampaignResponseFields(campaign.fields, data);
  if (fieldError) {
    res.status(400).json({ error: fieldError });
    return;
  }

  // ── Atomic: insert response + update current_amount in one transaction ──
  const paymentAmount = campaign.requiresPayment ? Number(campaign.paymentAmount ?? 0) : 0;
  if (paymentAmount > 0 && !customerPhone?.trim()) {
    res.status(400).json({ error: "A customer phone number is required for paid campaign participation" });
    return;
  }

  const responseOrPayment = await db.transaction(async (tx) => {
    if (paymentAmount > 0) {
      const { intent } = await createPaymentIntent({
        orgId: campaign.orgId,
        pillar: "campaign",
        entityId: campaign.id,
        entityTitle: campaign.title,
        transactionType: "campaign_response",
        amount: paymentAmount,
        currency: campaign.currency || await getPlatformCurrency(),
        customerName: submitterName,
        customerEmail: submitterEmail,
        customerPhone: customerPhone!,
        payload: { campaign: { submitterName, submitterEmail, data } },
        database: tx,
      });
      return { paymentIntent: intent };
    }

    const [inserted] = await tx.insert(campaignResponsesTable).values({
      campaignId: paramParsed.data.campaignId,
      submitterName,
      submitterEmail,
      data,
      amountPaid: paymentAmount > 0 ? String(paymentAmount) : null,
      status: paymentAmount > 0 ? "confirmed" : "pending",
      paymentStatus: "not_required",
    }).returning();

    if (paymentAmount > 0) {
      await tx.execute(
        sql`UPDATE campaigns SET current_amount = current_amount + ${paymentAmount} WHERE id = ${campaign.id}`
      );
      await recordTransaction({
        orgId: campaign.orgId,
        pillar: "campaign",
        entityId: campaign.id,
        entityTitle: campaign.title,
        transactionType: "campaign_response",
        grossAmount: paymentAmount,
        currency: campaign.currency || await getPlatformCurrency(),
        payerName: submitterName,
        payerEmail: submitterEmail,
      }, tx);
    }

    return { response: inserted };
  });

  if (responseOrPayment.paymentIntent) {
    try {
      const intent = await initializePaymentIntent(responseOrPayment.paymentIntent);
      res.status(201).json({
        paymentRequired: true,
        paymentId: intent.id,
        paymentStatus: intent.paymentStatus,
        statusToken: intent.statusToken,
        checkoutUrl: intent.checkoutUrl,
      });
    } catch (error: any) {
      await failPaymentIntent(responseOrPayment.paymentIntent.id, error?.message || "Payment initialization failed");
      res.status(502).json({ error: "Unable to start the payment. Please try again." });
    }
    return;
  }

  const response = responseOrPayment.response;
  if (!response) {
    res.status(500).json({ error: "Campaign response was not created" });
    return;
  }
  res.status(201).json({
    ...response,
    amountPaid: response.amountPaid ? parseFloat(response.amountPaid) : null,
  });
});

// Submissions list — org admin only
router.get("/campaigns/:campaignId/submissions", requireAuth, requireResourceOrgRole(campaignsTable, "campaignId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.campaignId) ? req.params.campaignId[0] : req.params.campaignId;
  const parsed = ListCampaignSubmissionsParams.safeParse({ campaignId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const submissions = await db.select().from(campaignResponsesTable).where(eq(campaignResponsesTable.campaignId, parsed.data.campaignId));
  res.json(submissions.map(s => ({ ...s, amountPaid: s.amountPaid ? parseFloat(s.amountPaid) : null })));
});

// ── ANALYTICS — org admin only ─────────────────────────────────────────────

router.get("/campaigns/:campaignId/analytics", requireAuth, requireResourceOrgRole(campaignsTable, "campaignId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.campaignId) ? req.params.campaignId[0] : req.params.campaignId;
  const parsed = GetCampaignAnalyticsParams.safeParse({ campaignId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const campaignId = parsed.data.campaignId;

  // Fetch campaign + count in parallel
  const [[campaign], countResult, byDayResult] = await Promise.all([
    db.select().from(campaignsTable).where(eq(campaignsTable.id, campaignId)).limit(1),
    db.select({ count: sql<number>`count(*)::int` }).from(campaignResponsesTable).where(eq(campaignResponsesTable.campaignId, campaignId)),
    db.execute(
      sql`SELECT date_trunc('day', submitted_at)::date::text as date, count(*)::int as count FROM campaign_responses WHERE campaign_id = ${campaignId} GROUP BY 1 ORDER BY 1`
    ),
  ]);

  const count = countResult[0]?.count ?? 0;
  const currentAmount = parseFloat(campaign?.currentAmount ?? "0");
  const goalAmount = campaign?.goalAmount ? parseFloat(campaign.goalAmount) : null;

  res.json({
    campaignId,
    submissionsCount: count,
    totalRevenue: currentAmount,
    goalProgress: goalAmount && goalAmount > 0 ? Math.round((currentAmount / goalAmount) * 1000) / 10 : null,
    submissionsByDay: (byDayResult.rows ?? []).map((r: any) => ({ date: r.date, count: r.count })),
  });
});

// ── EXPORT ─────────────────────────────────────────────────────────────────

router.get("/campaigns/:campaignId/export", requireAuth, requireResourceOrgRole(campaignsTable, "campaignId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.campaignId) ? req.params.campaignId[0] : req.params.campaignId;
  const parsed = ExportCampaignSubmissionsParams.safeParse({ campaignId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [[campaign], submissions] = await Promise.all([
    db.select().from(campaignsTable).where(eq(campaignsTable.id, parsed.data.campaignId)).limit(1),
    db.select().from(campaignResponsesTable).where(eq(campaignResponsesTable.campaignId, parsed.data.campaignId)),
  ]);

  const fieldIds = (campaign?.fields as { id: string; label: string }[] | null) ?? [];
  const header = ["Name", "Email", "Amount Paid", "Status", "Submitted At", ...fieldIds.map(f => f.label)];
  const rows = [header];
  for (const s of submissions) {
    const data = (s.data as Record<string, unknown>) ?? {};
    rows.push([
      s.submitterName, s.submitterEmail, s.amountPaid ? String(parseFloat(s.amountPaid)) : "",
      s.status, new Date(s.submittedAt).toISOString(),
      ...fieldIds.map(f => String(data[f.id] ?? "")),
    ]);
  }
  const csv = rows.map(r => r.map(toCsvValue).join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="campaign-${parsed.data.campaignId}-submissions.csv"`);
  res.send(csv);
});

export default router;
