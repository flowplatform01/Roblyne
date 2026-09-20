import { pgTable, serial, text, integer, timestamp, decimal, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { financialTransactionsTable } from "./financial";

// A durable local payment attempt. The payload is the validated business input
// needed to finalize the owning Evenum record after FlowPay calls the webhook.
export const paymentIntentsTable = pgTable("payment_intents", {
  id: serial("id").primaryKey(),
  externalReference: text("external_reference").notNull().unique(),
  pillar: text("pillar").notNull(),
  entityId: integer("entity_id").notNull(),
  transactionType: text("transaction_type").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("XAF"),
  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  payload: jsonb("payload").notNull().default({}),
  // initializing | pending | processing | succeeded | failed
  status: text("status").notNull().default("initializing"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  flowpayTransactionId: text("flowpay_transaction_id"),
  checkoutUrl: text("checkout_url"),
  financialTransactionId: integer("financial_transaction_id").references(() => financialTransactionsTable.id, { onDelete: "set null" }),
  errorMessage: text("error_message"),
  finalizedAt: timestamp("finalized_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  flowpayTransactionIdx: index("payment_intents_flowpay_transaction_idx").on(table.flowpayTransactionId),
  pillarEntityIdx: index("payment_intents_pillar_entity_idx").on(table.pillar, table.entityId),
  statusIdx: index("payment_intents_status_idx").on(table.status),
}));

// Every FlowPay event is stored once before it mutates the local state. A
// duplicate delivery becomes a successful no-op.
export const paymentWebhookEventsTable = pgTable("payment_webhook_events", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").notNull(),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull().default({}),
  processedAt: timestamp("processed_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  eventIdUnique: uniqueIndex("payment_webhook_events_event_id_unique").on(table.eventId),
}));

export const insertPaymentIntentSchema = createInsertSchema(paymentIntentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPaymentIntent = z.infer<typeof insertPaymentIntentSchema>;
export type PaymentIntent = typeof paymentIntentsTable.$inferSelect;

export const insertPaymentWebhookEventSchema = createInsertSchema(paymentWebhookEventsTable).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});
export type InsertPaymentWebhookEvent = z.infer<typeof insertPaymentWebhookEventSchema>;
export type PaymentWebhookEvent = typeof paymentWebhookEventsTable.$inferSelect;