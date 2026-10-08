export type SettlementEarningRow = {
  transactionId: number;
  orgEarnings: string | number;
  allocatedAmount: string | number;
};

export type SettlementAllocationPlanItem = {
  transactionId: number;
  amount: string;
};

function toMinorUnits(value: string | number): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    throw new RangeError("Settlement amounts must be finite numbers");
  }

  const minorUnits = Math.round(amount * 100);
  if (Math.abs(amount * 100 - minorUnits) > 0.000001) {
    throw new RangeError("Settlement amounts must use no more than two decimal places");
  }
  return minorUnits;
}

export function getAvailableSettlementAmount(rows: SettlementEarningRow[]): number {
  const availableMinorUnits = rows.reduce((sum, row) => (
    sum + Math.max(
      0,
      toMinorUnits(row.orgEarnings) - toMinorUnits(row.allocatedAmount),
    )
  ), 0);
  return availableMinorUnits / 100;
}

/**
 * Allocates a requested payout across ledger transactions in their input order.
 * Input rows should be ordered oldest-first to keep allocations deterministic.
 */
export function planSettlementAllocations(
  rows: SettlementEarningRow[],
  requestedAmount: string | number,
): SettlementAllocationPlanItem[] {
  const requestedMinorUnits = toMinorUnits(requestedAmount);
  if (requestedMinorUnits <= 0) {
    throw new RangeError("Withdrawal amount must be greater than zero");
  }

  const availableRows = rows.map((row) => ({
    transactionId: row.transactionId,
    availableMinorUnits: Math.max(
      0,
      toMinorUnits(row.orgEarnings) - toMinorUnits(row.allocatedAmount),
    ),
  }));
  const availableMinorUnits = availableRows.reduce((sum, row) => sum + row.availableMinorUnits, 0);
  if (requestedMinorUnits > availableMinorUnits) {
    throw new RangeError("Requested amount exceeds the available balance");
  }

  let remainingMinorUnits = requestedMinorUnits;
  const allocations: SettlementAllocationPlanItem[] = [];
  for (const row of availableRows) {
    if (remainingMinorUnits === 0) break;
    if (row.availableMinorUnits <= 0) continue;

    const amountMinorUnits = Math.min(row.availableMinorUnits, remainingMinorUnits);
    allocations.push({
      transactionId: row.transactionId,
      amount: (amountMinorUnits / 100).toFixed(2),
    });
    remainingMinorUnits -= amountMinorUnits;
  }

  if (remainingMinorUnits !== 0) {
    throw new Error("Could not allocate the full requested amount");
  }
  return allocations;
}
