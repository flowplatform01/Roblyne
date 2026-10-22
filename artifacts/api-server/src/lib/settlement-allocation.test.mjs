import assert from "node:assert/strict";
import { test } from "node:test";
import { isFullySettled, planSettlementAllocations } from "./settlement-allocation.ts";

test("allocates partial withdrawals oldest-first and preserves unclaimed earnings", () => {
  const allocations = planSettlementAllocations([
    { transactionId: 11, orgEarnings: "50.00", allocatedAmount: "10.00" },
    { transactionId: 12, orgEarnings: "40.00", allocatedAmount: "0.00" },
  ], 55);

  assert.deepEqual(allocations, [
    { transactionId: 11, amount: "40.00" },
    { transactionId: 12, amount: "15.00" },
  ]);
});

test("a later request can allocate the remaining cents without reusing reserved amounts", () => {
  const allocations = planSettlementAllocations([
    { transactionId: 11, orgEarnings: "50.00", allocatedAmount: "40.00" },
    { transactionId: 12, orgEarnings: "40.00", allocatedAmount: "15.00" },
  ], 35);

  assert.deepEqual(allocations, [
    { transactionId: 11, amount: "10.00" },
    { transactionId: 12, amount: "25.00" },
  ]);
});

test("rejects withdrawals above the unallocated balance", () => {
  assert.throws(
    () => planSettlementAllocations([
      { transactionId: 11, orgEarnings: "20.00", allocatedAmount: "5.00" },
    ], 15.01),
    /exceeds the available balance/,
  );
});

test("rejects zero, negative, non-finite, and fractional-cent requests", () => {
  for (const amount of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.001]) {
    assert.throws(() => planSettlementAllocations([
      { transactionId: 11, orgEarnings: "20.00", allocatedAmount: "0.00" },
    ], amount));
  }
});

test("a partial completed payout leaves the remaining transaction earnings unsettled", () => {
  assert.equal(isFullySettled("100.00", "40.00"), false);
  assert.equal(isFullySettled("100.00", "100.00"), true);
  assert.equal(isFullySettled("100.00", "100.01"), true);
});
