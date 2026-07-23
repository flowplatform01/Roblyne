import { pgTable, serial, text, integer, timestamp, decimal, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

// Commission configuration — one row per pillar, plus a "global" fallback
export const commissionConfigsTable = pgTable("commission_configs", {
  id: serial("id").primaryKey(),
  // pillar: global | event | election | campaign
  pillar: text("pillar").notNull().unique(),
  // Percentage rate stored as decimal fraction, e.g. 0.0500 = 5%
  rate: decimal("rate", { precision: 5, scale: 4 }).notNull().default("0.0500"),
  currency: text("currency").notNull().default("USD"),
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
  currency: text("currency").notNull().default("USD"),
  // status: completed | refunded | disputed
  status: text("status").notNull().default("completed"),
  // paymentProvider: platform (simulated) | stripe | etc.
  paymentProvider: text("payment_provider").notNull().default("platform"),
  // settlementStatus: pending | ready | released | completed
  settlementStatus: text("settlement_status").notNull().default("pending"),
  settlementId: integer("settlement_id"),
  payerName: text("payer_name"),
  payerEmail: text("payer_email"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  orgIdIdx: index("financial_transactions_org_id_idx").on(table.orgId),
  entityIdx: index("financial_transactions_entity_idx").on(table.pillar, table.entityId),
  settlementIdIdx: index("financial_transactions_settlement_id_idx").on(table.settlementId),
  settlementStatusIdx: index("financial_transactions_settlement_status_idx").on(table.settlementStatus),
  createdAtIdx: index("financial_transactions_created_at_idx").on(table.createdAt),
}));

// Settlement records — groups pending transactions for payout
export const settlementsTable = pgTable("settlements", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  // status: pending_settlement | ready | released | completed
  status: text("status").notNull().default("pending_settlement"),
  transactionCount: integer("transaction_count").notNull().default(0),
  notes: text("notes"),
  releasedAt: timestamp("released_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  orgIdIdx: index("settlements_org_id_idx").on(table.orgId),
  statusIdx: index("settlements_status_idx").on(table.status),
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
