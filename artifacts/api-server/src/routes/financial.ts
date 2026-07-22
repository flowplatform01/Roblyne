/**
 * Financial routes — organization financial workspace & admin business operations.
 */

import { Router, type IRouter } from "express";
import { eq, sql, and, desc } from "drizzle-orm";
import {
  db, financialTransactionsTable, settlementsTable, commissionConfigsTable, organizationsTable,
  electionsTable, votesTable, eventsTable, ticketsTable, ticketTypesTable, campaignsTable, campaignResponsesTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { requireOrgRole } from "../middlewares/orgAccess";
import { requirePlatformAdmin } from "../middlewares/platformAdmin";
import { getOrgFinanceSummary, seedDefaultCommissionConfigs } from "../lib/commission-engine";

const router: IRouter = Router();

function toCsvValue(value: unknown): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function formatTxn(row: any) {
  return {
    ...row,
    grossAmount: parseFloat(row.grossAmount ?? "0"),
    commissionRate: parseFloat(row.commissionRate ?? "0"),
    commissionAmount: parseFloat(row.commissionAmount ?? "0"),
    orgEarnings: parseFloat(row.orgEarnings ?? "0"),
  };
}

function formatSettlement(row: any) {
  return {
    ...row,
    amount: parseFloat(row.amount ?? "0"),
  };
}

// ── ORG FINANCIAL WORKSPACE ────────────────────────────────────────────────

/**
 * GET /api/organizations/:orgId/finance
 * Summary of org's financial position.
 */
router.get("/organizations/:orgId/finance",
  requireAuth,
  requireOrgRole(["owner", "admin"]),
  async (req, res): Promise<void> => {
    const orgId = parseInt(req.params.orgId, 10);
    if (isNaN(orgId)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const { summary, byPillar } = await getOrgFinanceSummary(orgId);

    const settlements = await db
      .select()
      .from(settlementsTable)
      .where(eq(settlementsTable.orgId, orgId))
      .orderBy(desc(settlementsTable.createdAt))
      .limit(10);

    res.json({
      orgId,
      totalRevenue: parseFloat((summary as any)?.total_revenue ?? "0"),
      totalCommissionPaid: parseFloat((summary as any)?.total_commission_paid ?? "0"),
      totalOrgEarnings: parseFloat((summary as any)?.total_org_earnings ?? "0"),
      pendingBalance: parseFloat((summary as any)?.pending_balance ?? "0"),
      releasedBalance: parseFloat((summary as any)?.released_balance ?? "0"),
      transactionCount: parseInt((summary as any)?.transaction_count ?? "0"),
      byPillar: (byPillar as any[]).map((p: any) => ({
        pillar: p.pillar,
        revenue: parseFloat(p.revenue ?? "0"),
        earnings: parseFloat(p.earnings ?? "0"),
        count: parseInt(p.count ?? "0"),
      })),
      recentSettlements: settlements.map(formatSettlement),
    });
  }
);

/**
 * GET /api/organizations/:orgId/finance/transactions
 * Paginated transaction history for an org.
 */
router.get("/organizations/:orgId/finance/transactions",
  requireAuth,
  requireOrgRole(["owner", "admin"]),
  async (req, res): Promise<void> => {
    const orgId = parseInt(req.params.orgId, 10);
    if (isNaN(orgId)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 200);
    const offset = parseInt(String(req.query.offset ?? "0"));
    const pillar = req.query.pillar as string | undefined;

    const filters = [eq(financialTransactionsTable.orgId, orgId)];
    if (pillar && ["event", "election", "campaign"].includes(pillar)) {
      filters.push(eq(financialTransactionsTable.pillar, pillar));
    }

    const txns = await db
      .select()
      .from(financialTransactionsTable)
      .where(and(...filters))
      .orderBy(desc(financialTransactionsTable.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(financialTransactionsTable)
      .where(and(...filters));

    res.json({ total: total ?? 0, transactions: txns.map(formatTxn) });
  }
);

/**
 * GET /api/organizations/:orgId/finance/settlements
 * Settlement history for an org.
 */
router.get("/organizations/:orgId/finance/settlements",
  requireAuth,
  requireOrgRole(["owner", "admin"]),
  async (req, res): Promise<void> => {
    const orgId = parseInt(req.params.orgId, 10);
    if (isNaN(orgId)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const settlements = await db
      .select()
      .from(settlementsTable)
      .where(eq(settlementsTable.orgId, orgId))
      .orderBy(desc(settlementsTable.createdAt));

    res.json(settlements.map(formatSettlement));
  }
);

/**
 * GET /api/organizations/:orgId/finance/export
 * Export org financial transactions as CSV.
 */
router.get("/organizations/:orgId/finance/export",
  requireAuth,
  requireOrgRole(["owner", "admin"]),
  async (req, res): Promise<void> => {
    const orgId = parseInt(req.params.orgId, 10);
    if (isNaN(orgId)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const txns = await db
      .select()
      .from(financialTransactionsTable)
      .where(eq(financialTransactionsTable.orgId, orgId))
      .orderBy(desc(financialTransactionsTable.createdAt));

    const header = [
      "ID", "Pillar", "Entity", "Type", "Gross Amount", "Commission Rate",
      "Commission", "Org Earnings", "Currency", "Status", "Settlement Status",
      "Payer Name", "Payer Email", "Date",
    ];
    const rows = [header, ...txns.map(t => [
      t.id, t.pillar, t.entityTitle ?? t.entityId, t.transactionType,
      t.grossAmount, t.commissionRate, t.commissionAmount, t.orgEarnings,
      t.currency, t.status, t.settlementStatus,
      t.payerName ?? "", t.payerEmail ?? "",
      new Date(t.createdAt).toISOString(),
    ])];

    const csv = rows.map(r => r.map(toCsvValue).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="org-${orgId}-transactions.csv"`);
    res.send(csv);
  }
);

// ── ADMIN FINANCIAL ENDPOINTS ──────────────────────────────────────────────

router.use("/admin/finance", requirePlatformAdmin);

/**
 * GET /api/admin/finance/stats
 * Platform-wide financial overview.
 */
router.get("/admin/finance/stats", async (_req, res): Promise<void> => {
  const { rows: [stats] } = await db.execute(sql`
    SELECT
      COALESCE(SUM(gross_amount), 0)::float                                              AS total_platform_revenue,
      COALESCE(SUM(commission_amount), 0)::float                                         AS total_commission_collected,
      COALESCE(SUM(org_earnings), 0)::float                                              AS total_org_earnings,
      COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '1 day'  THEN gross_amount ELSE 0 END), 0)::float  AS revenue_today,
      COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN gross_amount ELSE 0 END), 0)::float  AS revenue_this_week,
      COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN gross_amount ELSE 0 END), 0)::float AS revenue_this_month,
      COUNT(*)::int                                                                       AS total_transactions,
      COUNT(DISTINCT org_id)::int                                                         AS orgs_with_revenue
    FROM financial_transactions
    WHERE status = 'completed'
  `);

  const { rows: byPillar } = await db.execute(sql`
    SELECT
      pillar,
      COALESCE(SUM(gross_amount), 0)::float       AS revenue,
      COALESCE(SUM(commission_amount), 0)::float  AS commission,
      COUNT(*)::int                                AS count
    FROM financial_transactions
    WHERE status = 'completed'
    GROUP BY pillar
  `);

  const { rows: pendingSettlements } = await db.execute(sql`
    SELECT
      COUNT(*)::int                                        AS count,
      COALESCE(SUM(amount), 0)::float                      AS total_amount
    FROM settlements
    WHERE status IN ('pending_settlement', 'ready')
  `);

  const { rows: revenueByDay } = await db.execute(sql`
    SELECT
      date_trunc('day', created_at)::date::text AS date,
      COALESCE(SUM(gross_amount), 0)::float     AS revenue,
      COUNT(*)::int                              AS count
    FROM financial_transactions
    WHERE status = 'completed' AND created_at >= NOW() - INTERVAL '30 days'
    GROUP BY 1 ORDER BY 1
  `);

  res.json({
    ...(stats as any),
    byPillar,
    pendingSettlements: pendingSettlements[0] ?? { count: 0, total_amount: 0 },
    revenueByDay,
  });
});

/**
 * GET /api/admin/finance/transactions
 * All platform transactions with pagination.
 */
router.get("/admin/finance/transactions", async (req, res): Promise<void> => {
  const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 200);
  const offset = parseInt(String(req.query.offset ?? "0"));
  const pillar = req.query.pillar as string | undefined;
  const orgId = req.query.orgId ? parseInt(String(req.query.orgId)) : undefined;

  const filters: any[] = [];
  if (pillar && ["event", "election", "campaign"].includes(pillar)) {
    filters.push(eq(financialTransactionsTable.pillar, pillar));
  }
  if (orgId) filters.push(eq(financialTransactionsTable.orgId, orgId));

  const txns = await db
    .select({
      txn: financialTransactionsTable,
      orgName: organizationsTable.name,
    })
    .from(financialTransactionsTable)
    .leftJoin(organizationsTable, eq(financialTransactionsTable.orgId, organizationsTable.id))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(financialTransactionsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(financialTransactionsTable)
    .where(filters.length > 0 ? and(...filters) : undefined);

  res.json({
    total: total ?? 0,
    transactions: txns.map(({ txn, orgName }) => ({
      ...formatTxn(txn),
      organizationName: orgName ?? null,
    })),
  });
});

/**
 * GET /api/admin/finance/settlements
 * All settlement records.
 */
router.get("/admin/finance/settlements", async (req, res): Promise<void> => {
  const status = req.query.status as string | undefined;
  const orgId = req.query.orgId ? parseInt(String(req.query.orgId)) : undefined;

  const filters: any[] = [];
  if (status) filters.push(eq(settlementsTable.status, status));
  if (orgId) filters.push(eq(settlementsTable.orgId, orgId));

  const settlements = await db
    .select({
      settlement: settlementsTable,
      orgName: organizationsTable.name,
    })
    .from(settlementsTable)
    .leftJoin(organizationsTable, eq(settlementsTable.orgId, organizationsTable.id))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(settlementsTable.createdAt));

  res.json(settlements.map(({ settlement, orgName }) => ({
    ...formatSettlement(settlement),
    organizationName: orgName ?? null,
  })));
});

/**
 * PATCH /api/admin/finance/settlements/:id
 * Advance a settlement through the lifecycle.
 */
router.patch("/admin/finance/settlements/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { status } = req.body as { status: string };
  const validStatuses = ["pending_settlement", "ready", "released", "completed"];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: "Invalid status" }); return;
  }

  const updateData: any = { status };
  if (status === "released") updateData.releasedAt = new Date();
  if (status === "completed") updateData.completedAt = new Date();

  const [settlement] = await db
    .update(settlementsTable)
    .set(updateData)
    .where(eq(settlementsTable.id, id))
    .returning();
  if (!settlement) { res.status(404).json({ error: "Not found" }); return; }

  // Update linked transactions
  if (status === "completed") {
    await db
      .update(financialTransactionsTable)
      .set({ settlementStatus: "completed" })
      .where(eq(financialTransactionsTable.settlementId, id));
  }

  res.json(formatSettlement(settlement));
});

/**
 * POST /api/admin/finance/settlements
 * Create a settlement batch for an organization.
 */
router.post("/admin/finance/settlements", async (req, res): Promise<void> => {
  const { orgId } = req.body as { orgId: number };
  if (!orgId) { res.status(400).json({ error: "orgId required" }); return; }

  // Find pending transactions for this org
  const pending = await db
    .select()
    .from(financialTransactionsTable)
    .where(and(
      eq(financialTransactionsTable.orgId, orgId),
      eq(financialTransactionsTable.settlementStatus, "pending"),
      eq(financialTransactionsTable.status, "completed"),
    ));

  if (pending.length === 0) {
    res.status(400).json({ error: "No pending transactions to settle" }); return;
  }

  const totalAmount = pending.reduce((sum, t) => sum + parseFloat(t.orgEarnings), 0);
  const currency = pending[0].currency;

  const [settlement] = await db
    .insert(settlementsTable)
    .values({
      orgId,
      amount: String(Math.round(totalAmount * 100) / 100),
      currency,
      status: "pending_settlement",
      transactionCount: pending.length,
    })
    .returning();

  // Link transactions to settlement
  await db
    .update(financialTransactionsTable)
    .set({ settlementId: settlement.id, settlementStatus: "ready" })
    .where(and(
      eq(financialTransactionsTable.orgId, orgId),
      eq(financialTransactionsTable.settlementStatus, "pending"),
      eq(financialTransactionsTable.status, "completed"),
    ));

  res.status(201).json(formatSettlement(settlement));
});

/**
 * GET /api/admin/finance/org-balances
 * Summary of all orgs' financial positions.
 */
router.get("/admin/finance/org-balances", async (_req, res): Promise<void> => {
  const { rows } = await db.execute(sql`
    SELECT
      o.id                                                                                AS org_id,
      o.name                                                                              AS org_name,
      COALESCE(SUM(ft.gross_amount), 0)::float                                            AS total_revenue,
      COALESCE(SUM(ft.commission_amount), 0)::float                                       AS total_commission,
      COALESCE(SUM(ft.org_earnings), 0)::float                                            AS total_earnings,
      COALESCE(SUM(CASE WHEN ft.settlement_status = 'pending' THEN ft.org_earnings ELSE 0 END), 0)::float   AS pending_balance,
      COALESCE(SUM(CASE WHEN ft.settlement_status = 'completed' THEN ft.org_earnings ELSE 0 END), 0)::float AS released_balance,
      COUNT(ft.id)::int                                                                   AS transaction_count
    FROM organizations o
    LEFT JOIN financial_transactions ft ON ft.org_id = o.id AND ft.status = 'completed'
    GROUP BY o.id, o.name
    ORDER BY total_revenue DESC
  `);
  res.json(rows);
});

/**
 * GET /api/admin/finance/commission-config
 * Get all commission configurations.
 */
router.get("/admin/finance/commission-config", async (_req, res): Promise<void> => {
  await seedDefaultCommissionConfigs();
  const configs = await db.select().from(commissionConfigsTable);
  res.json(configs.map(c => ({ ...c, rate: parseFloat(c.rate) })));
});

/**
 * PATCH /api/admin/finance/commission-config/:pillar
 * Update a commission rate.
 */
router.patch("/admin/finance/commission-config/:pillar", async (req, res): Promise<void> => {
  const { pillar } = req.params;
  const validPillars = ["global", "event", "election", "campaign"];
  if (!validPillars.includes(pillar)) {
    res.status(400).json({ error: "Invalid pillar" }); return;
  }

  const { rate, isActive } = req.body as { rate?: number; isActive?: boolean };
  if (rate !== undefined && (rate < 0 || rate > 1)) {
    res.status(400).json({ error: "Rate must be between 0 and 1" }); return;
  }

  const updateData: any = { updatedAt: new Date() };
  if (rate !== undefined) updateData.rate = String(rate);
  if (isActive !== undefined) updateData.isActive = isActive ? 1 : 0;

  const [config] = await db
    .update(commissionConfigsTable)
    .set(updateData)
    .where(eq(commissionConfigsTable.pillar, pillar))
    .returning();

  if (!config) { res.status(404).json({ error: "Config not found" }); return; }
  res.json({ ...config, rate: parseFloat(config.rate) });
});

/**
 * GET /api/admin/finance/export
 * Export all platform transactions as CSV.
 */
router.get("/admin/finance/export", async (_req, res): Promise<void> => {
  const txns = await db
    .select({
      txn: financialTransactionsTable,
      orgName: organizationsTable.name,
    })
    .from(financialTransactionsTable)
    .leftJoin(organizationsTable, eq(financialTransactionsTable.orgId, organizationsTable.id))
    .orderBy(desc(financialTransactionsTable.createdAt));

  const header = [
    "ID", "Organization", "Pillar", "Entity", "Type", "Gross Amount",
    "Commission Rate", "Commission", "Org Earnings", "Currency", "Status",
    "Settlement Status", "Payer Name", "Payer Email", "Date",
  ];
  const rows = [header, ...txns.map(({ txn, orgName }) => [
    txn.id, orgName ?? txn.orgId, txn.pillar, txn.entityTitle ?? txn.entityId,
    txn.transactionType, txn.grossAmount, txn.commissionRate, txn.commissionAmount,
    txn.orgEarnings, txn.currency, txn.status, txn.settlementStatus,
    txn.payerName ?? "", txn.payerEmail ?? "",
    new Date(txn.createdAt).toISOString(),
  ])];

  const csv = rows.map(r => r.map(toCsvValue).join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="platform-transactions.csv"`);
  res.send(csv);
});

// ── ORG ANALYTICS ────────────────────────────────────────────────────────────

/**
 * GET /api/organizations/:orgId/analytics
 * Per-pillar performance analytics for an organization.
 */
router.get("/organizations/:orgId/analytics",
  requireAuth,
  requireOrgRole(["owner", "admin"]),
  async (req, res): Promise<void> => {
    const orgId = parseInt(req.params.orgId, 10);
    if (isNaN(orgId)) { res.status(400).json({ error: "Invalid ID" }); return; }

    // ── Elections analytics ──────────────────────────────────────────────────
    const elections = await db
      .select()
      .from(electionsTable)
      .where(eq(electionsTable.orgId, orgId))
      .orderBy(desc(electionsTable.createdAt));

    const electionAnalytics = await Promise.all(elections.map(async (election) => {
      const [{ totalVotes }] = await db
        .select({ totalVotes: sql<number>`count(*)::int` })
        .from(votesTable)
        .where(eq(votesTable.electionId, election.id));

      const { rows: [financialRow] } = await db.execute(sql`
        SELECT
          COALESCE(SUM(CASE WHEN transaction_type = 'vote' THEN 1 ELSE 0 END), 0)::int AS paid_votes,
          COALESCE(SUM(gross_amount), 0)::float AS revenue
        FROM financial_transactions
        WHERE org_id = ${orgId} AND entity_id = ${election.id} AND pillar = 'election' AND status = 'completed'
      `);

      const total = totalVotes ?? 0;
      const paidVotes = parseInt(String((financialRow as any)?.paid_votes ?? 0));
      const revenue = parseFloat(String((financialRow as any)?.revenue ?? 0));

      return {
        id: election.id,
        title: election.title,
        status: election.status,
        startsAt: election.startsAt,
        endsAt: election.endsAt,
        requiresPayment: election.requiresPayment,
        totalVotes: total,
        paidVotes,
        freeVotes: total - paidVotes,
        revenue,
      };
    }));

    // ── Events analytics ─────────────────────────────────────────────────────
    const events = await db
      .select()
      .from(eventsTable)
      .where(eq(eventsTable.orgId, orgId))
      .orderBy(desc(eventsTable.createdAt));

    const eventAnalytics = await Promise.all(events.map(async (event) => {
      const [{ ticketsSold }] = await db
        .select({ ticketsSold: sql<number>`count(*)::int` })
        .from(ticketsTable)
        .where(and(eq(ticketsTable.eventId, event.id), sql`${ticketsTable.status} != 'cancelled'`));

      const [{ checkedIn }] = await db
        .select({ checkedIn: sql<number>`count(*)::int` })
        .from(ticketsTable)
        .where(and(eq(ticketsTable.eventId, event.id), eq(ticketsTable.status, "used")));

      const { rows: [financialRow] } = await db.execute(sql`
        SELECT COALESCE(SUM(gross_amount), 0)::float AS revenue
        FROM financial_transactions
        WHERE org_id = ${orgId} AND entity_id = ${event.id} AND pillar = 'event' AND status = 'completed'
      `);

      const sold = ticketsSold ?? 0;
      const capacity = event.capacity;
      const revenue = parseFloat(String((financialRow as any)?.revenue ?? 0));
      const checkInsCount = checkedIn ?? 0;

      return {
        id: event.id,
        title: event.title,
        status: event.status,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        capacity,
        ticketsSold: sold,
        checkedIn: checkInsCount,
        checkInRate: sold > 0 ? Math.round((checkInsCount / sold) * 1000) / 10 : 0,
        capacityUtilization: capacity && capacity > 0 ? Math.round((sold / capacity) * 1000) / 10 : null,
        revenue,
      };
    }));

    // ── Campaigns analytics ──────────────────────────────────────────────────
    const campaigns = await db
      .select()
      .from(campaignsTable)
      .where(eq(campaignsTable.orgId, orgId))
      .orderBy(desc(campaignsTable.createdAt));

    const campaignAnalytics = await Promise.all(campaigns.map(async (campaign) => {
      const [{ submissionsCount }] = await db
        .select({ submissionsCount: sql<number>`count(*)::int` })
        .from(campaignResponsesTable)
        .where(eq(campaignResponsesTable.campaignId, campaign.id));

      const { rows: [financialRow] } = await db.execute(sql`
        SELECT
          COALESCE(SUM(gross_amount), 0)::float       AS revenue,
          COALESCE(AVG(gross_amount), 0)::float        AS avg_contribution,
          COUNT(*)::int                                AS paid_contributors
        FROM financial_transactions
        WHERE org_id = ${orgId} AND entity_id = ${campaign.id} AND pillar = 'campaign' AND status = 'completed'
      `);

      const goalAmount = campaign.goalAmount ? parseFloat(campaign.goalAmount) : null;
      const amountRaised = parseFloat(String(campaign.currentAmount ?? "0"));
      const revenue = parseFloat(String((financialRow as any)?.revenue ?? 0));
      const avgContribution = parseFloat(String((financialRow as any)?.avg_contribution ?? 0));
      const contributors = parseInt(String((financialRow as any)?.paid_contributors ?? 0));

      return {
        id: campaign.id,
        title: campaign.title,
        status: campaign.status,
        type: campaign.type,
        startsAt: campaign.startsAt,
        endsAt: campaign.endsAt,
        goalAmount,
        amountRaised,
        revenue,
        goalCompletion: goalAmount && goalAmount > 0 ? Math.round((amountRaised / goalAmount) * 1000) / 10 : null,
        submissionsCount: submissionsCount ?? 0,
        paidContributors: contributors,
        avgContribution: contributors > 0 ? Math.round(avgContribution * 100) / 100 : 0,
      };
    }));

    res.json({
      elections: electionAnalytics,
      events: eventAnalytics,
      campaigns: campaignAnalytics,
    });
  }
);

export default router;
