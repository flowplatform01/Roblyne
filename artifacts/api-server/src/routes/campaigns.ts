import { Router, type IRouter } from "express";
import { eq, sql, and } from "drizzle-orm";
import { db, campaignsTable, campaignResponsesTable, organizationsTable } from "@workspace/db";
import {
  CreateCampaignBody, UpdateCampaignBody, GetCampaignParams, UpdateCampaignParams, DeleteCampaignParams, ListCampaignsQueryParams,
  SubmitCampaignResponseParams, SubmitCampaignResponseBody,
  ListCampaignSubmissionsParams,
  GetCampaignAnalyticsParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function campaignRow(campaign: any, orgName: string | null, submissionsCount: number) {
  return {
    ...campaign,
    organizationName: orgName,
    currentAmount: parseFloat(campaign.currentAmount ?? "0"),
    goalAmount: campaign.goalAmount ? parseFloat(campaign.goalAmount) : null,
    paymentAmount: campaign.paymentAmount ? parseFloat(campaign.paymentAmount) : null,
    submissionsCount,
  };
}

// List campaigns
router.get("/campaigns", async (req, res): Promise<void> => {
  const queryParsed = ListCampaignsQueryParams.safeParse(req.query);
  const filters: any[] = [];
  if (queryParsed.success) {
    const { orgId, type, status, visibility } = queryParsed.data;
    if (orgId) filters.push(eq(campaignsTable.orgId, orgId));
    if (type) filters.push(eq(campaignsTable.type, type));
    if (status) filters.push(eq(campaignsTable.status, status));
    if (visibility) filters.push(eq(campaignsTable.visibility, visibility));
  }

  const rows = await db.select({ campaign: campaignsTable, orgName: organizationsTable.name })
    .from(campaignsTable).leftJoin(organizationsTable, eq(campaignsTable.orgId, organizationsTable.id))
    .where(filters.length > 0 ? and(...filters) : undefined);

  const campaigns = await Promise.all(rows.map(async ({ campaign, orgName }) => {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(campaignResponsesTable).where(eq(campaignResponsesTable.campaignId, campaign.id));
    return campaignRow(campaign, orgName ?? null, count ?? 0);
  }));
  res.json(campaigns);
});

// Create campaign
router.post("/campaigns", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateCampaignBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { orgId, title, description, coverImageUrl, type, visibility, goalAmount, requiresPayment, paymentAmount, currency, fields, startsAt, endsAt } = parsed.data;
  const [campaign] = await db.insert(campaignsTable).values({
    orgId, title, description, coverImageUrl, type, visibility: visibility ?? "public",
    goalAmount: goalAmount ? String(goalAmount) : null,
    requiresPayment: requiresPayment ?? false,
    paymentAmount: paymentAmount ? String(paymentAmount) : null,
    currency: currency ?? "USD",
    fields: fields ?? [],
    startsAt, endsAt,
  }).returning();
  res.status(201).json(campaignRow(campaign, null, 0));
});

// Get campaign
router.get("/campaigns/:campaignId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.campaignId) ? req.params.campaignId[0] : req.params.campaignId;
  const parsed = GetCampaignParams.safeParse({ campaignId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [row] = await db.select({ campaign: campaignsTable, orgName: organizationsTable.name })
    .from(campaignsTable).leftJoin(organizationsTable, eq(campaignsTable.orgId, organizationsTable.id))
    .where(eq(campaignsTable.id, parsed.data.campaignId)).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(campaignResponsesTable).where(eq(campaignResponsesTable.campaignId, row.campaign.id));
  res.json(campaignRow(row.campaign, row.orgName ?? null, count ?? 0));
});

// Update campaign
router.patch("/campaigns/:campaignId", requireAuth, async (req, res): Promise<void> => {
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

// Delete campaign
router.delete("/campaigns/:campaignId", requireAuth, async (req, res): Promise<void> => {
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

  const [response] = await db.insert(campaignResponsesTable).values({
    campaignId: paramParsed.data.campaignId, submitterName, submitterEmail, data,
  }).returning();

  if (campaign.requiresPayment && campaign.paymentAmount) {
    await db.execute(sql`UPDATE campaigns SET current_amount = current_amount + ${campaign.paymentAmount} WHERE id = ${campaign.id}`);
  }

  res.status(201).json({
    ...response,
    amountPaid: response.amountPaid ? parseFloat(response.amountPaid) : null,
  });
});

router.get("/campaigns/:campaignId/submissions", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.campaignId) ? req.params.campaignId[0] : req.params.campaignId;
  const parsed = ListCampaignSubmissionsParams.safeParse({ campaignId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const submissions = await db.select().from(campaignResponsesTable).where(eq(campaignResponsesTable.campaignId, parsed.data.campaignId));
  res.json(submissions.map(s => ({ ...s, amountPaid: s.amountPaid ? parseFloat(s.amountPaid) : null })));
});

// ── ANALYTICS ──────────────────────────────────────────────────────────────

router.get("/campaigns/:campaignId/analytics", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.campaignId) ? req.params.campaignId[0] : req.params.campaignId;
  const parsed = GetCampaignAnalyticsParams.safeParse({ campaignId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const campaignId = parsed.data.campaignId;

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(campaignResponsesTable).where(eq(campaignResponsesTable.campaignId, campaignId));
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, campaignId)).limit(1);
  const currentAmount = parseFloat(campaign?.currentAmount ?? "0");
  const goalAmount = campaign?.goalAmount ? parseFloat(campaign.goalAmount) : null;

  const byDay = await db.execute(
    sql`SELECT date_trunc('day', submitted_at)::date::text as date, count(*)::int as count FROM campaign_responses WHERE campaign_id = ${campaignId} GROUP BY 1 ORDER BY 1`
  );

  res.json({
    campaignId,
    submissionsCount: count ?? 0,
    totalRevenue: currentAmount,
    goalProgress: goalAmount && goalAmount > 0 ? Math.round((currentAmount / goalAmount) * 1000) / 10 : null,
    submissionsByDay: (byDay.rows ?? []).map((r: any) => ({ date: r.date, count: r.count })),
  });
});

export default router;
