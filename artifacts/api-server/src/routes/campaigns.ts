import { Router, type IRouter } from "express";
import { eq, sql, and } from "drizzle-orm";
import { db, campaignsTable, campaignResponsesTable, organizationsTable } from "@workspace/db";
import {
  CreateCampaignBody, UpdateCampaignBody, GetCampaignParams, UpdateCampaignParams, DeleteCampaignParams, ListCampaignsQueryParams,
  SubmitCampaignResponseParams, SubmitCampaignResponseBody,
  ListCampaignSubmissionsParams,
  GetCampaignAnalyticsParams, ExportCampaignSubmissionsParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { requireBodyOrgRole, requireResourceOrgRole } from "../middlewares/orgAccess";

const router: IRouter = Router();

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

// List campaigns — uses a single aggregated query to avoid N+1 count lookups
router.get("/campaigns", async (req, res): Promise<void> => {
  const queryParsed = ListCampaignsQueryParams.safeParse(req.query);
  const filters: any[] = [];
  if (queryParsed.success) {
    const { orgId, type, status, visibility } = queryParsed.data;
    if (orgId) filters.push(eq(campaignsTable.orgId, orgId));
    if (type) filters.push(eq(campaignsTable.type, type));
    if (status) filters.push(eq(campaignsTable.status, status));
    if (visibility) {
      filters.push(eq(campaignsTable.visibility, visibility));
    } else if (!req.session?.userId) {
      filters.push(eq(campaignsTable.visibility, "public"));
    }
  } else {
    filters.push(eq(campaignsTable.visibility, "public"));
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
    campaignRow(campaign, orgName ?? null, submissionsCount ?? 0, orgLogoUrl)
  ));
});

// Create campaign
router.post("/campaigns", requireAuth, requireBodyOrgRole(["owner", "admin"]), async (req, res): Promise<void> => {
  const parsed = CreateCampaignBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { orgId, title, description, coverImageUrl, heroImageUrl, accentColor, theme, type, visibility, goalAmount, requiresPayment, paymentAmount, currency, fields, startsAt, endsAt } = parsed.data;
  const [campaign] = await db.insert(campaignsTable).values({
    orgId, title, description, coverImageUrl, heroImageUrl, accentColor, theme: theme ?? "evenum", type, visibility: visibility ?? "public",
    goalAmount: goalAmount ? String(goalAmount) : null,
    requiresPayment: requiresPayment ?? false,
    paymentAmount: paymentAmount ? String(paymentAmount) : null,
    currency: currency ?? "USD",
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
  if (row.campaign.visibility !== "public" && !req.session?.userId) {
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
  const updateData: any = { ...bodyParsed.data };
  if (updateData.goalAmount !== undefined) updateData.goalAmount = updateData.goalAmount ? String(updateData.goalAmount) : null;
  if (updateData.paymentAmount !== undefined) updateData.paymentAmount = updateData.paymentAmount ? String(updateData.paymentAmount) : null;
  const [campaign] = await db.update(campaignsTable).set(updateData).where(eq(campaignsTable.id, paramParsed.data.campaignId)).returning();
  if (!campaign) { res.status(404).json({ error: "Not found" }); return; }
  res.json(campaignRow(campaign, null, 0));
});

// Delete campaign — must be org owner/admin
router.delete("/campaigns/:campaignId", requireAuth, requireResourceOrgRole(campaignsTable, "campaignId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.campaignId) ? req.params.campaignId[0] : req.params.campaignId;
  const parsed = DeleteCampaignParams.safeParse({ campaignId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(campaignsTable).where(eq(campaignsTable.id, parsed.data.campaignId));
  res.json({ message: "Deleted" });
});

// ── SUBMISSIONS ────────────────────────────────────────────────────────────

router.post("/campaigns/:campaignId/submit", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.campaignId) ? req.params.campaignId[0] : req.params.campaignId;
  const paramParsed = SubmitCampaignResponseParams.safeParse({ campaignId: parseInt(rawId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = SubmitCampaignResponseBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }

  const { submitterName, submitterEmail, data } = bodyParsed.data;
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, paramParsed.data.campaignId)).limit(1);
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

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

  // ── Atomic: insert response + update current_amount in one transaction ──
  const response = await db.transaction(async (tx) => {
    const [inserted] = await tx.insert(campaignResponsesTable).values({
      campaignId: paramParsed.data.campaignId, submitterName, submitterEmail, data,
    }).returning();

    if (campaign.requiresPayment && campaign.paymentAmount) {
      await tx.execute(
        sql`UPDATE campaigns SET current_amount = current_amount + ${campaign.paymentAmount} WHERE id = ${campaign.id}`
      );
    }

    return inserted;
  });

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
