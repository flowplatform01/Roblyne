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
  const { rows: [summary] } = await db.execute(sql`
    SELECT
      COALESCE(SUM(gross_amount), 0)::float            AS total_revenue,
      COALESCE(SUM(commission_amount), 0)::float       AS total_commission_paid,
      COALESCE(SUM(org_earnings), 0)::float            AS total_org_earnings,
      COALESCE(SUM(CASE WHEN settlement_status IN ('pending', 'ready') THEN org_earnings ELSE 0 END), 0)::float  AS pending_balance,
      COALESCE(SUM(CASE WHEN settlement_status = 'completed' THEN org_earnings ELSE 0 END), 0)::float AS released_balance,
      COUNT(*)::int                                    AS transaction_count
    FROM financial_transactions
    WHERE org_id = ${orgId} AND status = 'completed'
  `);

  const { rows: byPillar } = await db.execute(sql`
    SELECT
      pillar,
      COALESCE(SUM(gross_amount), 0)::float        AS revenue,
      COALESCE(SUM(org_earnings), 0)::float        AS earnings,
      COUNT(*)::int                                 AS count
    FROM financial_transactions
    WHERE org_id = ${orgId} AND status = 'completed'
    GROUP BY pillar
  `);

  return { summary, byPillar };
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
