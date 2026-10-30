import { pgTable, serial, text, integer, timestamp, decimal, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

// Commission configuration — one row per pillar, plus a "global" fallback
export const commissionConfigsTable = pgTable("commission_configs", {
  id: serial("id").primaryKey(),
  // pillar: global | event | election | campaign
  pillar: text("pillar").notNull().unique(),
  // Percentage rate stored as decimal fraction, e.g. 0.0500 = 5%
  rate: decimal("rate", { precision: 5, scale: 4 }).notNull().default("0.0500"),
  currency: text("currency").notNull().default("XAF"),
  isActive: integer("is_active").notNull().default(1), // 1 | 0
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Financial ledger — permanent record of every revenue-generating transaction
export const financialTransactionsTable = pgTable("financial_transactions", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  // pillar: event | election | campaign
  pillar: text("pillar").notNull(),
  entityId: integer("entity_id").notNull(),
  entityTitle: text("entity_title"),
  // transactionType: ticket | vote | campaign_response
  transactionType: text("transaction_type").notNull(),
  grossAmount: decimal("gross_amount", { precision: 12, scale: 2 }).notNull(),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 4 }).notNull(),
  commissionAmount: decimal("commission_amount", { precision: 12, scale: 2 }).notNull(),
  orgEarnings: decimal("org_earnings", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("XAF"),
  // status: completed | refunded | disputed
  status: text("status").notNull().default("completed"),
  // status: pending | completed | failed | refunded | disputed
  // paymentProvider: platform (legacy simulated) | flowpay | etc.
  paymentProvider: text("payment_provider").notNull().default("platform"),
  paymentStatus: text("payment_status").notNull().default("not_required"),
  flowpayTransactionId: text("flowpay_transaction_id"),
  idempotencyKey: text("idempotency_key"),
  // settlementStatus: pending | ready | released | completed
  settlementStatus: text("settlement_status").notNull().default("pending"),
  settlementId: integer("settlement_id"),
  payerName: text("payer_name"),
  payerEmail: text("payer_email"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  orgIdIdx: index("financial_transactions_org_id_idx").on(table.orgId),
  entityIdx: index("financial_transactions_entity_idx").on(table.pillar, table.entityId),
  flowpayTransactionIdx: index("financial_transactions_flowpay_transaction_idx").on(table.flowpayTransactionId),
  idempotencyKeyIdx: index("financial_transactions_idempotency_key_idx").on(table.idempotencyKey),
  settlementIdIdx: index("financial_transactions_settlement_id_idx").on(table.settlementId),
  settlementStatusIdx: index("financial_transactions_settlement_status_idx").on(table.settlementStatus),
  createdAtIdx: index("financial_transactions_created_at_idx").on(table.createdAt),
}));

// Settlement records — groups pending transactions for payout
export const settlementsTable = pgTable("settlements", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("XAF"),
  // status: pending_settlement | ready | released | completed
  status: text("status").notNull().default("pending_settlement"),
  transactionCount: integer("transaction_count").notNull().default(0),
  payoutMethod: text("payout_method"),
  payoutAccount: text("payout_account"),
  // FlowPay Mode 1 payout metadata. The actual payout target stays with FlowPay;
  // ROBLYNE persists only its saved-recipient reference and a masked display value.
  payoutDestinationId: integer("payout_destination_id"),
  payoutProvider: text("payout_provider"),
  providerPayoutId: text("provider_payout_id"),
  providerPayoutStatus: text("provider_payout_status"),
  payoutIdempotencyKey: text("payout_idempotency_key"),
  payoutFailureReason: text("payout_failure_reason"),
  payoutAttemptedAt: timestamp("payout_attempted_at"),
  notes: text("notes"),
  releasedAt: timestamp("released_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  orgIdIdx: index("settlements_org_id_idx").on(table.orgId),
  statusIdx: index("settlements_status_idx").on(table.status),
  providerPayoutIdIdx: index("settlements_provider_payout_id_idx").on(table.providerPayoutId),
}));

// A reusable organization-owned payout target. Raw account/phone details are sent
// directly to FlowPay during provisioning and are not retained in ROBLYNE.
export const payoutDestinationsTable = pgTable("payout_destinations", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("flowpay"),
  externalRecipientId: text("external_recipient_id").notNull(),
  displayName: text("display_name").notNull(),
  payoutMethod: text("payout_method").notNull(),
  maskedTarget: text("masked_target").notNull(),
  currency: text("currency").notNull().default("XAF"),
  verificationStatus: text("verification_status").notNull().default("pending"),
  confirmationUrl: text("confirmation_url"),
  lastVerifiedAt: timestamp("last_verified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgIdIdx: index("payout_destinations_org_id_idx").on(table.orgId),
  externalRecipientIdx: uniqueIndex("payout_destinations_provider_recipient_uq")
    .on(table.provider, table.externalRecipientId),
}));

// A settlement may claim only part of one or more ledger transactions. Keep
// each claim explicit so later withdrawals can use the unallocated remainder.
export const settlementAllocationsTable = pgTable("settlement_allocations", {
  id: serial("id").primaryKey(),
  settlementId: integer("settlement_id").notNull().references(() => settlementsTable.id, { onDelete: "cascade" }),
  financialTransactionId: integer("financial_transaction_id").notNull().references(() => financialTransactionsTable.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  settlementIdx: index("settlement_allocations_settlement_id_idx").on(table.settlementId),
  transactionIdx: index("settlement_allocations_financial_transaction_id_idx").on(table.financialTransactionId),
  settlementTransactionUnique: uniqueIndex("settlement_allocations_settlement_transaction_uq")
    .on(table.settlementId, table.financialTransactionId),
}));

export const platformPayoutDestinationsTable = pgTable("platform_payout_destinations", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().default("flowpay"),
  externalRecipientId: text("external_recipient_id").notNull(),
  displayName: text("display_name").notNull(),
  payoutMethod: text("payout_method").notNull(),
  maskedTarget: text("masked_target").notNull(),
  currency: text("currency").notNull().default("XAF"),
  verificationStatus: text("verification_status").notNull().default("pending"),
  confirmationUrl: text("confirmation_url"),
  lastVerifiedAt: timestamp("last_verified_at"),
  createdByUserId: integer("created_by_user_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  externalRecipientIdx: uniqueIndex("platform_payout_destinations_provider_recipient_uq")
    .on(table.provider, table.externalRecipientId),
}));

export const platformWithdrawalsTable = pgTable("platform_withdrawals", {
  id: serial("id").primaryKey(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("XAF"),
  status: text("status").notNull().default("queued"),
  payoutDestinationId: integer("payout_destination_id").notNull().references(() => platformPayoutDestinationsTable.id),
  payoutProvider: text("payout_provider").notNull().default("flowpay"),
  providerPayoutId: text("provider_payout_id"),
  providerPayoutStatus: text("provider_payout_status"),
  payoutIdempotencyKey: text("payout_idempotency_key").notNull(),
  failureReason: text("failure_reason"),
  requestedByUserId: integer("requested_by_user_id").notNull().references(() => usersTable.id),
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  statusIdx: index("platform_withdrawals_status_idx").on(table.status),
  payoutDestinationIdx: index("platform_withdrawals_destination_idx").on(table.payoutDestinationId),
  providerPayoutIdx: index("platform_withdrawals_provider_payout_idx").on(table.providerPayoutId),
  idempotencyIdx: uniqueIndex("platform_withdrawals_idempotency_uq").on(table.payoutIdempotencyKey),
}));

export const platformWithdrawalAllocationsTable = pgTable("platform_withdrawal_allocations", {
  id: serial("id").primaryKey(),
  platformWithdrawalId: integer("platform_withdrawal_id").notNull().references(() => platformWithdrawalsTable.id, { onDelete: "cascade" }),
  financialTransactionId: integer("financial_transaction_id").notNull().references(() => financialTransactionsTable.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  withdrawalIdx: index("platform_withdrawal_allocations_withdrawal_idx").on(table.platformWithdrawalId),
  transactionIdx: index("platform_withdrawal_allocations_transaction_idx").on(table.financialTransactionId),
  withdrawalTransactionUnique: uniqueIndex("platform_withdrawal_allocations_withdrawal_transaction_uq")
    .on(table.platformWithdrawalId, table.financialTransactionId),
}));

export const insertCommissionConfigSchema = createInsertSchema(commissionConfigsTable).omit({ id: true, updatedAt: true });
export type InsertCommissionConfig = z.infer<typeof insertCommissionConfigSchema>;
export type CommissionConfig = typeof commissionConfigsTable.$inferSelect;

export const insertFinancialTransactionSchema = createInsertSchema(financialTransactionsTable).omit({ id: true, createdAt: true });
export type InsertFinancialTransaction = z.infer<typeof insertFinancialTransactionSchema>;
export type FinancialTransaction = typeof financialTransactionsTable.$inferSelect;

export const insertSettlementSchema = createInsertSchema(settlementsTable).omit({ id: true, createdAt: true });
export type InsertSettlement = z.infer<typeof insertSettlementSchema>;
export type Settlement = typeof settlementsTable.$inferSelect;
