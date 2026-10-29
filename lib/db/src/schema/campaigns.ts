import { pgTable, serial, text, integer, timestamp, boolean, decimal, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const campaignsTable = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  heroImageUrl: text("hero_image_url"),
  accentColor: text("accent_color"),
  theme: text("theme").notNull().default("evenum"), // evenum | light | dark
  type: text("type").notNull().default("custom"), // registration|contribution|donation|application|membership|merchandise|custom
  status: text("status").notNull().default("draft"), // draft | active | ended
  visibility: text("visibility").notNull().default("public"), // public | private
  goalAmount: decimal("goal_amount", { precision: 12, scale: 2 }),
  currentAmount: decimal("current_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  requiresPayment: boolean("requires_payment").notNull().default(false),
  paymentAmount: decimal("payment_amount", { precision: 10, scale: 2 }),
  currency: text("currency").notNull().default("XAF"),
  fields: jsonb("fields").notNull().default([]),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  orgIdIdx: index("campaigns_org_id_idx").on(table.orgId),
  statusIdx: index("campaigns_status_idx").on(table.status),
  visibilityIdx: index("campaigns_visibility_idx").on(table.visibility),
  publicDiscoveryIdx: index("campaigns_public_discovery_idx").on(table.visibility, table.status, table.createdAt),
}));

export const campaignResponsesTable = pgTable("campaign_responses", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  submitterName: text("submitter_name").notNull(),
  submitterEmail: text("submitter_email").notNull(),
  data: jsonb("data").notNull().default({}),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("pending"), // pending | confirmed | rejected
  paymentStatus: text("payment_status").notNull().default("not_required"),
  flowpayTransactionId: text("flowpay_transaction_id"),
  idempotencyKey: text("idempotency_key"),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
}, (table) => ({
  campaignIdIdx: index("campaign_responses_campaign_id_idx").on(table.campaignId),
  statusIdx: index("campaign_responses_status_idx").on(table.status),
  submitterEmailIdx: index("campaign_responses_submitter_email_idx").on(table.submitterEmail),
  campaignSubmittedAtIdx: index("campaign_responses_campaign_submitted_at_idx").on(table.campaignId, table.submittedAt),
  flowpayTransactionIdx: index("campaign_responses_flowpay_transaction_idx").on(table.flowpayTransactionId),
}));

export const insertCampaignSchema = createInsertSchema(campaignsTable).omit({ id: true, createdAt: true, currentAmount: true });
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaignsTable.$inferSelect;

export const insertCampaignResponseSchema = createInsertSchema(campaignResponsesTable).omit({ id: true, submittedAt: true });
export type InsertCampaignResponse = z.infer<typeof insertCampaignResponseSchema>;
export type CampaignResponse = typeof campaignResponsesTable.$inferSelect;
