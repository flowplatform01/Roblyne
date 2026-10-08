/**
 * Commission Engine — single source of truth for all financial calculations.
 * Every revenue-generating pillar must pass through here.
 */

import { db, commissionConfigsTable, financialTransactionsTable, settlementsTable, platformSettingsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";

export type Pillar = "event" | "election" | "campaign";
export type TransactionType = "ticket" | "vote" | "campaign_response";

export interface CommissionResult {
  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;
  orgEarnings: number;
  currency: string;
}

export interface RecordTransactionInput {
  orgId: number;
  pillar: Pillar;
  entityId: number;
  entityTitle?: string;
  transactionType: TransactionType;
  grossAmount: number;
  currency?: string;
  payerName?: string;
  payerEmail?: string;
  paymentProvider?: string;
  paymentStatus?: string;
  flowpayTransactionId?: string;
  idempotencyKey?: string;
  status?: string;
}

export async function getPlatformCurrency(database: any = db): Promise<string> {
  const [settings] = await database
    .select({ defaultCurrency: platformSettingsTable.defaultCurrency })
    .from(platformSettingsTable)
    .limit(1);
  return settings?.defaultCurrency || "XAF";
}

export async function isPlatformCurrencySupported(currency: string, database: any = db): Promise<boolean> {
  const [settings] = await database
    .select({
      defaultCurrency: platformSettingsTable.defaultCurrency,
      supportedCurrencies: platformSettingsTable.supportedCurrencies,
    })
    .from(platformSettingsTable)
    .limit(1);
  const configured = settings?.supportedCurrencies || settings?.defaultCurrency || "XAF";
  const allowed = configured
    .replace(/[\[\]"']/g, "")
    .split(/[,\s;|]+/)
    .map((value: string) => value.trim().toUpperCase())
    .filter(Boolean);
  return allowed.includes(currency.trim().toUpperCase());
}

/**
 * Get the effective commission rate for a pillar.
 * Falls back to global rate if no pillar-specific config exists.
 */
export async function getCommissionRate(pillar: Pillar, database: any = db): Promise<number> {
  const [pillarConfig] = await database
    .select()
    .from(commissionConfigsTable)
    .where(eq(commissionConfigsTable.pillar, pillar))
    .limit(1);

  if (pillarConfig && pillarConfig.isActive === 1) {
    return parseFloat(pillarConfig.rate);
  }

  const [globalConfig] = await database
    .select()
    .from(commissionConfigsTable)
    .where(eq(commissionConfigsTable.pillar, "global"))
    .limit(1);

  if (globalConfig) {
    return parseFloat(globalConfig.rate);
  }

  // Hard fallback: 5%
  return 0.05;
}

/**
 * Calculate commission breakdown for a gross amount.
 */
export function calculateCommission(
  grossAmount: number,
  commissionRate: number,
  currency = "XAF"
): CommissionResult {
  const commissionAmount = Math.round(grossAmount * commissionRate * 100) / 100;
  const orgEarnings = Math.round((grossAmount - commissionAmount) * 100) / 100;
  return {
    grossAmount,
    commissionRate,
    commissionAmount,
    orgEarnings,
    currency,
  };
}

/**
 * Record a financial transaction in the ledger and create a pending settlement entry.
 * This is the main entry point for all paid participation flows.
 */
export async function recordTransaction(input: RecordTransactionInput, database: any = db): Promise<{
  transactionId: number;
  breakdown: CommissionResult;
}> {
  const {
    orgId, pillar, entityId, entityTitle, transactionType,
    grossAmount, currency = "XAF", payerName, payerEmail,
    paymentProvider = "platform", paymentStatus = "not_required",
    flowpayTransactionId, idempotencyKey, status = "completed",
  } = input;

  if (grossAmount <= 0) {
    throw new Error("Cannot record a financial transaction with zero or negative gross amount");
  }

  const commissionRate = await getCommissionRate(pillar, database);
  const breakdown = calculateCommission(grossAmount, commissionRate, currency);

  const [txn] = await database
    .insert(financialTransactionsTable)
    .values({
      orgId,
      pillar,
      entityId,
      entityTitle: entityTitle ?? null,
      transactionType,
      grossAmount: String(breakdown.grossAmount),
      commissionRate: String(breakdown.commissionRate),
      commissionAmount: String(breakdown.commissionAmount),
      orgEarnings: String(breakdown.orgEarnings),
      currency,
       status,
       paymentProvider,
       paymentStatus,
       flowpayTransactionId: flowpayTransactionId ?? null,
       idempotencyKey: idempotencyKey ?? null,
      settlementStatus: "pending",
      payerName: payerName ?? null,
      payerEmail: payerEmail ?? null,
    })
    .returning();

  logger.info({ transactionId: txn.id, orgId, pillar, grossAmount }, "Financial transaction recorded");

  return { transactionId: txn.id, breakdown };
}

/**
 * Get aggregated financial summary for an organization.
 */
export async function getOrgFinanceSummary(orgId: number) {
  const { rows: balancesByCurrency } = await db.execute(sql`
    WITH allocation_totals AS (
      SELECT financial_transaction_id, SUM(amount) AS allocated_amount
      FROM settlement_allocations
      GROUP BY financial_transaction_id
    ),
    transaction_balances AS (
      SELECT
        ft.currency,
        COALESCE(SUM(ft.gross_amount), 0)::float AS total_revenue,
        COALESCE(SUM(ft.commission_amount), 0)::float AS total_commission_paid,
        COALESCE(SUM(ft.org_earnings), 0)::float AS total_org_earnings,
        COALESCE(SUM(
          CASE
            WHEN ft.settlement_status = 'pending' AND ft.settlement_id IS NULL
              THEN GREATEST(ft.org_earnings - COALESCE(at.allocated_amount, 0), 0)
            ELSE 0
          END
        ), 0)::float AS available_balance,
        COUNT(*)::int AS transaction_count
      FROM financial_transactions ft
      LEFT JOIN allocation_totals at ON at.financial_transaction_id = ft.id
      WHERE ft.org_id = ${orgId} AND ft.status = 'completed'
      GROUP BY ft.currency
    ),
    settlement_balances AS (
      SELECT
        currency,
        COALESCE(SUM(amount) FILTER (WHERE status IN ('pending_settlement', 'ready')), 0)::float
          AS pending_settlement_balance,
        COALESCE(SUM(amount) FILTER (WHERE status IN ('released', 'completed')), 0)::float
          AS released_balance
      FROM settlements
      WHERE org_id = ${orgId}
      GROUP BY currency
    )
    SELECT
      tb.currency,
      tb.total_revenue,
      tb.total_commission_paid,
      tb.total_org_earnings,
      tb.available_balance,
      COALESCE(sb.pending_settlement_balance, 0)::float AS pending_settlement_balance,
      COALESCE(sb.released_balance, 0)::float AS released_balance,
      tb.transaction_count
    FROM transaction_balances tb
    LEFT JOIN settlement_balances sb ON sb.currency = tb.currency
    ORDER BY tb.currency
  `);

  const { rows: byPillar } = await db.execute(sql`
    SELECT
      pillar,
      currency,
      COALESCE(SUM(gross_amount), 0)::float        AS revenue,
      COALESCE(SUM(org_earnings), 0)::float        AS earnings,
      COUNT(*)::int                                 AS count
    FROM financial_transactions
    WHERE org_id = ${orgId} AND status = 'completed'
    GROUP BY pillar, currency
    ORDER BY pillar, currency
  `);

  return { balancesByCurrency, byPillar };
}

/**
 * Seed default commission configurations if they don't already exist.
 */
export async function seedDefaultCommissionConfigs() {
  const pillars = [
    { pillar: "global", rate: "0.0500" },
    { pillar: "event", rate: "0.0500" },
    { pillar: "election", rate: "0.0500" },
    { pillar: "campaign", rate: "0.0500" },
  ];

  for (const config of pillars) {
    await db
      .insert(commissionConfigsTable)
      .values({ ...config, isActive: 1 })
      .onConflictDoNothing();
  }
}
