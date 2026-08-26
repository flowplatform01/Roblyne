/**
 * Financial routes — organization financial workspace & admin business operations.
 */

import { Router, type IRouter } from "express";
import { eq, sql, and, desc } from "drizzle-orm";
import {
  db, financialTransactionsTable, settlementsTable, commissionConfigsTable, organizationsTable,
  electionsTable, votesTable, voteSelectionsTable, eventsTable, ticketsTable, ticketTypesTable, campaignsTable, campaignResponsesTable,
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
 * Request a payout of all currently available organization earnings.
 * Row locks make simultaneous requests safe: only one request can claim the
 * pending ledger rows.
 */
router.post("/organizations/:orgId/finance/settlements",
  requireAuth,
  requireOrgRole(["owner", "admin"]),
  async (req, res): Promise<void> => {
    const orgId = parseInt(String(req.params.orgId), 10);
    if (isNaN(orgId)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const payoutMethod = req.body?.payoutMethod;
    const payoutAccount = typeof req.body?.payoutAccount === "string"
      ? req.body.payoutAccount.trim()
      : "";
    const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : null;

    if (!["bank_transfer", "mobile_money"].includes(payoutMethod)) {
      res.status(400).json({ error: "Choose a valid payout method" }); return;
    }
    if (payoutAccount.length < 3 || payoutAccount.length > 160) {
      res.status(400).json({ error: "Payout account must be between 3 and 160 characters" }); return;
    }
    if (notes && notes.length > 500) {
      res.status(400).json({ error: "Notes must be 500 characters or fewer" }); return;
    }

    try {
      const settlement = await db.transaction(async (tx) => {
        const pendingRows = await tx.execute(sql`
          SELECT id, org_earnings, currency
          FROM financial_transactions
          WHERE org_id = ${orgId}
            AND status = 'completed'
            AND settlement_status = 'pending'
          FOR UPDATE
        `);
        const pending = pendingRows.rows as Array<{ id: number; org_earnings: string; currency: string }>;
        if (pending.length === 0) {
          throw new Error("There is no available balance to withdraw");
        }

        const currency = pending[0].currency;
        if (pending.some((row) => row.currency !== currency)) {
          throw new Error("Withdrawals must be requested separately for each currency");
        }
        const amount = Math.round(
          pending.reduce((sum, row) => sum + parseFloat(String(row.org_earnings)), 0) * 100,
        ) / 100;
        if (amount <= 0) throw new Error("There is no available balance to withdraw");

        const [created] = await tx
          .insert(settlementsTable)
          .values({
            orgId,
            amount: String(amount),
            currency,
            status: "pending_settlement",
            transactionCount: pending.length,
            payoutMethod,
            payoutAccount,
            notes: notes || null,
          })
          .returning();

        await tx
          .update(financialTransactionsTable)
          .set({ settlementId: created.id, settlementStatus: "ready" })
          .where(and(
            eq(financialTransactionsTable.orgId, orgId),
            eq(financialTransactionsTable.settlementStatus, "pending"),
            eq(financialTransactionsTable.status, "completed"),
          ));

        return created;
      });

      res.status(201).json(formatSettlement(settlement));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create withdrawal request";
      res.status(400).json({ error: message });
    }
  }
);

/**
 * GET /api/organizations/:orgId/finance
 * Summary of org's financial position.
 */
router.get("/organizations/:orgId/finance",
  requireAuth,
  requireOrgRole(["owner", "admin"]),
  async (req, res): Promise<void> => {
    const orgId = parseInt(String(req.params.orgId), 10);
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
    const orgId = parseInt(String(req.params.orgId), 10);
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
    const orgId = parseInt(String(req.params.orgId), 10);
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
    const orgId = parseInt(String(req.params.orgId), 10);
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

  const validStatuses = ["pending_settlement", "ready", "released", "completed"] as const;
  const status = req.body?.status;
  if (typeof status !== "string" || !validStatuses.includes(status as typeof validStatuses[number])) {
    res.status(400).json({ error: "Invalid or missing status" }); return;
  }

  const nextStatus = status as typeof validStatuses[number];
  try {
    const settlement = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ id: settlementsTable.id, status: settlementsTable.status })
      .from(settlementsTable)
      .where(eq(settlementsTable.id, id))
      .limit(1);
    if (!current) return null;

    const allowedNext: Record<string, string[]> = {
      pending_settlement: ["ready"],
      ready: ["released"],
      released: ["completed"],
      completed: [],
    };
    if (current.status !== nextStatus && !allowedNext[current.status]?.includes(nextStatus)) {
      throw Object.assign(new Error("Invalid settlement status transition"), { code: "INVALID_SETTLEMENT_TRANSITION" });
    }

    const updateData: any = { status: nextStatus };
    if (nextStatus === "released" && current.status !== "released") updateData.releasedAt = new Date();
    if (nextStatus === "completed" && current.status !== "completed") updateData.completedAt = new Date();
    const [updated] = await tx
      .update(settlementsTable)
      .set(updateData)
      .where(and(eq(settlementsTable.id, id), eq(settlementsTable.status, current.status)))
      .returning();
    if (nextStatus === "completed") {
      await tx
        .update(financialTransactionsTable)
        .set({ settlementStatus: "completed" })
        .where(eq(financialTransactionsTable.settlementId, id));
    }
    return updated;
    });
    if (!settlement) { res.status(404).json({ error: "Not found" }); return; }
    res.json(formatSettlement(settlement));
  } catch (err: any) {
    if (err?.code === "INVALID_SETTLEMENT_TRANSITION") {
      res.status(409).json({ error: "Settlement status cannot move backward or skip a stage" });
      return;
    }
    throw err;
  }
});

/**
 * POST /api/admin/finance/settlements
 * Create a settlement batch for an organization.
 */
router.post("/admin/finance/settlements", async (req, res): Promise<void> => {
  const orgId = typeof req.body?.orgId === "number" ? req.body.orgId : parseInt(String(req.body?.orgId), 10);
  if (!orgId || isNaN(orgId)) { res.status(400).json({ error: "orgId is required and must be a valid integer" }); return; }

  try {
    const settlement = await db.transaction(async (tx) => {
    const pendingResult = await tx.execute(sql`
      SELECT id, org_earnings, currency
      FROM financial_transactions
      WHERE org_id = ${orgId}
        AND settlement_status = 'pending'
        AND status = 'completed'
      FOR UPDATE
    `);
    const pending = pendingResult.rows as Array<{ id: number; org_earnings: string; currency: string }>;
    if (pending.length === 0) {
      throw Object.assign(new Error("No pending transactions to settle"), { code: "NO_PENDING_TRANSACTIONS" });
    }
    const currency = pending[0].currency;
    if (pending.some((row) => row.currency !== currency)) {
      throw Object.assign(new Error("Withdrawals must be requested separately for each currency"), { code: "MIXED_CURRENCIES" });
    }
    const totalAmount = pending.reduce((sum, t) => sum + parseFloat(String(t.org_earnings)), 0);
    const [created] = await tx.insert(settlementsTable).values({
      orgId,
      amount: String(Math.round(totalAmount * 100) / 100),
      currency,
      status: "pending_settlement",
      transactionCount: pending.length,
    }).returning();
    await tx.execute(sql`
      UPDATE financial_transactions
      SET settlement_id = ${created.id}, settlement_status = 'ready'
      WHERE org_id = ${orgId}
        AND settlement_status = 'pending'
        AND status = 'completed'
    `);
    return created;
    });
    res.status(201).json(formatSettlement(settlement));
  } catch (err: any) {
    if (err?.code === "NO_PENDING_TRANSACTIONS") {
      res.status(400).json({ error: "No pending transactions to settle" });
      return;
    }
    if (err?.code === "MIXED_CURRENCIES") {
      res.status(400).json({ error: "Withdrawals must be requested separately for each currency" });
      return;
    }
    throw err;
  }
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
 * Uses bulk GROUP BY queries to avoid N+1 per election/event/campaign.
 */
router.get("/organizations/:orgId/analytics",
  requireAuth,
  requireOrgRole(["owner", "admin"]),
  async (req, res): Promise<void> => {
    const orgId = parseInt(String(req.params.orgId), 10);
    if (isNaN(orgId)) { res.status(400).json({ error: "Invalid ID" }); return; }

    // Run all three pillar analytics in parallel, each as a single aggregated query
    const [electionsResult, eventsResult, campaignsResult] = await Promise.all([

      // ── Elections: one query aggregates votes + financial per election ──────
      db.execute(sql`
        SELECT
          e.id,
          e.title,
          e.status,
          e.starts_at    AS "startsAt",
          e.ends_at      AS "endsAt",
          e.requires_payment AS "requiresPayment",
          e.currency,
          COALESCE(vote_agg.total_votes, 0)    AS total_votes,
          COALESCE(fin_agg.paid_votes, 0)      AS paid_votes,
          COALESCE(fin_agg.revenue, 0)         AS revenue
        FROM elections e
        LEFT JOIN (
          SELECT v.election_id, COUNT(vs.id)::int AS total_votes
          FROM vote_selections vs
          INNER JOIN votes v ON v.id = vs.vote_id
          GROUP BY v.election_id
        ) vote_agg ON vote_agg.election_id = e.id
        LEFT JOIN (
          SELECT
            entity_id,
            COUNT(*) FILTER (WHERE transaction_type = 'vote')::int AS paid_votes,
            COALESCE(SUM(gross_amount), 0)::float                  AS revenue
          FROM financial_transactions
          WHERE org_id = ${orgId} AND pillar = 'election' AND status = 'completed'
          GROUP BY entity_id
        ) fin_agg ON fin_agg.entity_id = e.id
        WHERE e.org_id = ${orgId}
        ORDER BY e.created_at DESC
      `),

      // ── Events: one query aggregates tickets + check-ins + financial ────────
      db.execute(sql`
        SELECT
          e.id,
          e.title,
          e.status,
          e.starts_at  AS "startsAt",
          e.ends_at    AS "endsAt",
          e.capacity,
          COALESCE(t_agg.tickets_sold, 0)   AS tickets_sold,
          COALESCE(t_agg.checked_in, 0)     AS checked_in,
          COALESCE(fin_agg.revenue, 0)      AS revenue
        FROM events e
        LEFT JOIN (
          SELECT
            event_id,
            COUNT(*) FILTER (WHERE status != 'cancelled')::int AS tickets_sold,
            COUNT(*) FILTER (WHERE status = 'used')::int       AS checked_in
          FROM tickets
          GROUP BY event_id
        ) t_agg ON t_agg.event_id = e.id
        LEFT JOIN (
          SELECT entity_id, COALESCE(SUM(gross_amount), 0)::float AS revenue
          FROM financial_transactions
          WHERE org_id = ${orgId} AND pillar = 'event' AND status = 'completed'
          GROUP BY entity_id
        ) fin_agg ON fin_agg.entity_id = e.id
        WHERE e.org_id = ${orgId}
        ORDER BY e.created_at DESC
      `),

      // ── Campaigns: one query aggregates submissions + financial ─────────────
      db.execute(sql`
        SELECT
          c.id,
          c.title,
          c.status,
          c.type,
          c.starts_at    AS "startsAt",
          c.ends_at      AS "endsAt",
          c.goal_amount  AS "goalAmount",
          c.current_amount AS "currentAmount",
          COALESCE(sub_agg.submissions_count, 0) AS submissions_count,
          COALESCE(fin_agg.revenue, 0)           AS revenue,
          COALESCE(fin_agg.avg_contribution, 0)  AS avg_contribution,
          COALESCE(fin_agg.paid_contributors, 0) AS paid_contributors
        FROM campaigns c
        LEFT JOIN (
          SELECT campaign_id, COUNT(*)::int AS submissions_count
          FROM campaign_responses
          GROUP BY campaign_id
        ) sub_agg ON sub_agg.campaign_id = c.id
        LEFT JOIN (
          SELECT
            entity_id,
            COALESCE(SUM(gross_amount), 0)::float  AS revenue,
            COALESCE(AVG(gross_amount), 0)::float  AS avg_contribution,
            COUNT(*)::int                           AS paid_contributors
          FROM financial_transactions
          WHERE org_id = ${orgId} AND pillar = 'campaign' AND status = 'completed'
          GROUP BY entity_id
        ) fin_agg ON fin_agg.entity_id = c.id
        WHERE c.org_id = ${orgId}
        ORDER BY c.created_at DESC
      `),
    ]);

    const electionAnalytics = (electionsResult.rows as any[]).map(row => {
      const total = row.total_votes ?? 0;
      const paidVotes = row.paid_votes ?? 0;
      return {
        id: row.id,
        title: row.title,
        status: row.status,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        requiresPayment: row.requiresPayment,
        currency: row.currency ?? "XAF",
        totalVotes: total,
        paidVotes,
        freeVotes: total - paidVotes,
        revenue: row.revenue ?? 0,
      };
    });

    const eventAnalytics = (eventsResult.rows as any[]).map(row => {
      const sold = row.tickets_sold ?? 0;
      const checkInsCount = row.checked_in ?? 0;
      const capacity = row.capacity ?? null;
      return {
        id: row.id,
        title: row.title,
        status: row.status,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        capacity,
        ticketsSold: sold,
        checkedIn: checkInsCount,
        checkInRate: sold > 0 ? Math.round((checkInsCount / sold) * 1000) / 10 : 0,
        capacityUtilization: capacity && capacity > 0 ? Math.round((sold / capacity) * 1000) / 10 : null,
        revenue: row.revenue ?? 0,
      };
    });

    const campaignAnalytics = (campaignsResult.rows as any[]).map(row => {
      const goalAmount = row.goalAmount ? parseFloat(row.goalAmount) : null;
      const amountRaised = parseFloat(String(row.currentAmount ?? "0"));
      const contributors = row.paid_contributors ?? 0;
      return {
        id: row.id,
        title: row.title,
        status: row.status,
        type: row.type,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        goalAmount,
        amountRaised,
        revenue: row.revenue ?? 0,
        goalCompletion: goalAmount && goalAmount > 0 ? Math.round((amountRaised / goalAmount) * 1000) / 10 : null,
        submissionsCount: row.submissions_count ?? 0,
        paidContributors: contributors,
        avgContribution: contributors > 0 ? Math.round((row.avg_contribution ?? 0) * 100) / 100 : 0,
      };
    });

    res.json({
      elections: electionAnalytics,
      events: eventAnalytics,
      campaigns: campaignAnalytics,
    });
  }
);

export default router;
