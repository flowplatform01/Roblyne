import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  platformPayoutDestinationsTable,
  platformWithdrawalsTable,
  platformWithdrawalAllocationsTable,
} from "@workspace/db";
import { createFlowPayPayout, getFlowPayPayout, type FlowPayPayoutStatus } from "./flowpay";

export const PLATFORM_PAYOUT_POLL_DELAY_MS = 30_000;

export async function processPlatformWithdrawal(withdrawalId: number): Promise<{
  status: FlowPayPayoutStatus | "skipped";
  shouldPoll: boolean;
}> {
  const [withdrawal] = await db.select().from(platformWithdrawalsTable)
    .where(eq(platformWithdrawalsTable.id, withdrawalId)).limit(1);
  if (!withdrawal || withdrawal.status === "completed" || withdrawal.status === "failed") {
    return { status: "skipped", shouldPoll: false };
  }

  const [destination] = await db.select().from(platformPayoutDestinationsTable)
    .where(and(
      eq(platformPayoutDestinationsTable.id, withdrawal.payoutDestinationId),
      eq(platformPayoutDestinationsTable.provider, "flowpay"),
    )).limit(1);
  if (!destination || destination.verificationStatus !== "verified") {
    await markFailure(withdrawalId, "The platform payout recipient is not verified");
    return { status: "failed", shouldPoll: false };
  }

  try {
    const payout = withdrawal.providerPayoutId
      ? await getFlowPayPayout(withdrawal.providerPayoutId)
      : await createFlowPayPayout({
          amount: Number(withdrawal.amount),
          currency: withdrawal.currency,
          reference: `roblyne-platform-withdrawal-${withdrawal.id}`,
          externalRecipientId: destination.externalRecipientId,
          idempotencyKey: withdrawal.payoutIdempotencyKey,
          metadata: { roblynePlatformWithdrawalId: withdrawal.id, purpose: "platform_commission_withdrawal" },
        });
    await db.update(platformWithdrawalsTable).set({
      providerPayoutId: payout.id,
      providerPayoutStatus: payout.status,
      status: payout.status === "failed" ? "failed" : "processing",
      failureReason: payout.status === "failed" ? "FlowPay reported a failed payout" : null,
      updatedAt: new Date(),
    }).where(eq(platformWithdrawalsTable.id, withdrawalId));
    if (payout.status === "success") {
      await db.update(platformWithdrawalsTable).set({
        status: "completed", providerPayoutStatus: "success", failureReason: null, completedAt: new Date(), updatedAt: new Date(),
      }).where(and(eq(platformWithdrawalsTable.id, withdrawalId), inArray(platformWithdrawalsTable.status, ["queued", "processing"])));
      return { status: "success", shouldPoll: false };
    }
    return { status: payout.status, shouldPoll: payout.status !== "failed" };
  } catch (error) {
    await db.update(platformWithdrawalsTable).set({
      status: "processing",
      failureReason: (error instanceof Error ? error.message : "FlowPay payout request could not be confirmed").slice(0, 500),
      updatedAt: new Date(),
    }).where(eq(platformWithdrawalsTable.id, withdrawalId));
    return { status: "processing", shouldPoll: true };
  }
}

async function markFailure(withdrawalId: number, reason: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(platformWithdrawalsTable).set({
      status: "failed", providerPayoutStatus: "failed", failureReason: reason.slice(0, 500), updatedAt: new Date(),
    }).where(eq(platformWithdrawalsTable.id, withdrawalId));
    // A failed provider payout did not move money, so release every commission
    // reservation for a future, explicitly requested withdrawal.
    await tx.delete(platformWithdrawalAllocationsTable)
      .where(eq(platformWithdrawalAllocationsTable.platformWithdrawalId, withdrawalId));
  });
}

export function formatPlatformWithdrawal(row: any, destination?: any) {
  return {
    ...row,
    amount: Number(row.amount ?? 0),
    currency: String(row.currency ?? "XAF").toUpperCase(),
    destination: destination ? {
      id: destination.id,
      displayName: destination.displayName,
      payoutMethod: destination.payoutMethod,
      maskedTarget: destination.maskedTarget,
      currency: destination.currency,
    } : null,
  };
}
