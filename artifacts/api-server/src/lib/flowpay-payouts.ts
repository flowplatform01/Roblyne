import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  financialTransactionsTable,
  payoutDestinationsTable,
  settlementAllocationsTable,
  settlementsTable,
} from "@workspace/db";
import { createFlowPayPayout, getFlowPayPayout, type FlowPayPayoutStatus } from "./flowpay";
import { isFullySettled } from "./settlement-allocation";

const POLL_DELAY_MS = 30_000;

export async function processFlowPaySettlementPayout(settlementId: number): Promise<{
  status: FlowPayPayoutStatus | "skipped";
  shouldPoll: boolean;
}> {
  const [settlement] = await db.select().from(settlementsTable)
    .where(eq(settlementsTable.id, settlementId)).limit(1);
  if (!settlement || settlement.payoutProvider !== "flowpay" || settlement.status === "completed") {
    return { status: "skipped", shouldPoll: false };
  }
  if (!settlement.payoutDestinationId || !settlement.payoutIdempotencyKey) {
    await markPayoutFailure(settlementId, "FlowPay payout configuration is incomplete");
    return { status: "failed", shouldPoll: false };
  }

  const [destination] = await db.select().from(payoutDestinationsTable)
    .where(and(
      eq(payoutDestinationsTable.id, settlement.payoutDestinationId),
      eq(payoutDestinationsTable.orgId, settlement.orgId),
    )).limit(1);
  if (!destination || destination.verificationStatus !== "verified") {
    await markPayoutFailure(settlementId, "The saved payout recipient is not verified");
    return { status: "failed", shouldPoll: false };
  }

  try {
    const payout = settlement.providerPayoutId
      ? await getFlowPayPayout(settlement.providerPayoutId)
      : await createFlowPayPayout({
          amount: Number(settlement.amount),
          currency: settlement.currency,
          reference: `roblyne-settlement-${settlement.id}`,
          externalRecipientId: destination.externalRecipientId,
          idempotencyKey: settlement.payoutIdempotencyKey,
          metadata: { roblyneSettlementId: settlement.id, organizationId: settlement.orgId },
        });

    await db.update(settlementsTable).set({
      providerPayoutId: payout.id,
      providerPayoutStatus: payout.status,
      payoutFailureReason: payout.status === "failed" ? "FlowPay reported a failed payout" : null,
      payoutAttemptedAt: new Date(),
    }).where(eq(settlementsTable.id, settlementId));

    if (payout.status === "success") {
      await completeProviderConfirmedSettlement(settlementId);
      return { status: payout.status, shouldPoll: false };
    }
    return { status: payout.status, shouldPoll: payout.status !== "failed" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "FlowPay payout request failed";
    await markPayoutFailure(settlementId, message);
    return { status: "failed", shouldPoll: false };
  }
}

export async function completeProviderConfirmedSettlement(settlementId: number): Promise<void> {
  await db.transaction(async (tx) => {
    const [updated] = await tx.update(settlementsTable).set({
      status: "completed",
      providerPayoutStatus: "success",
      payoutFailureReason: null,
      completedAt: new Date(),
    }).where(and(
      eq(settlementsTable.id, settlementId),
      inArray(settlementsTable.status, ["pending_settlement", "ready", "released"]),
    )).returning({ id: settlementsTable.id });
    if (!updated) return;

    const allocatedRows = await tx.execute(sql`
      SELECT
        ft.id,
        ft.org_earnings::text AS org_earnings,
        COALESCE(SUM(all_allocations.amount) FILTER (WHERE completed_settlements.status = 'completed'), 0)::text AS completed_amount
      FROM settlement_allocations target_allocations
      INNER JOIN financial_transactions ft ON ft.id = target_allocations.financial_transaction_id
      LEFT JOIN settlement_allocations all_allocations ON all_allocations.financial_transaction_id = ft.id
      LEFT JOIN settlements completed_settlements ON completed_settlements.id = all_allocations.settlement_id
      WHERE target_allocations.settlement_id = ${settlementId}
      GROUP BY ft.id, ft.org_earnings
    `);
    const rows = allocatedRows.rows as Array<{ id: number | string; org_earnings: string; completed_amount: string }>;
    const completedIds = rows.filter((row) => isFullySettled(row.org_earnings, row.completed_amount)).map((row) => Number(row.id));
    const pendingIds = rows.filter((row) => !isFullySettled(row.org_earnings, row.completed_amount)).map((row) => Number(row.id));
    if (completedIds.length) await tx.update(financialTransactionsTable).set({ settlementStatus: "completed" }).where(inArray(financialTransactionsTable.id, completedIds));
    if (pendingIds.length) await tx.update(financialTransactionsTable).set({ settlementStatus: "pending" }).where(inArray(financialTransactionsTable.id, pendingIds));
  });
}

async function markPayoutFailure(settlementId: number, reason: string): Promise<void> {
  await db.update(settlementsTable).set({
    providerPayoutStatus: "failed",
    payoutFailureReason: reason.slice(0, 500),
    payoutAttemptedAt: new Date(),
  }).where(eq(settlementsTable.id, settlementId));
}

export { POLL_DELAY_MS };
