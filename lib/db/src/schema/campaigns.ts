import { pgTable, serial, text, integer, timestamp, boolean, decimal, jsonb } from "drizzle-orm/pg-core";
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
  currency: text("currency").notNull().default("USD"),
  fields: jsonb("fields").notNull().default([]),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const campaignResponsesTable = pgTable("campaign_responses", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  submitterName: text("submitter_name").notNull(),
  submitterEmail: text("submitter_email").notNull(),
  data: jsonb("data").notNull().default({}),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("pending"), // pending | confirmed | rejected
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
});

export const insertCampaignSchema = createInsertSchema(campaignsTable).omit({ id: true, createdAt: true, currentAmount: true });
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaignsTable.$inferSelect;

export const insertCampaignResponseSchema = createInsertSchema(campaignResponsesTable).omit({ id: true, submittedAt: true });
export type InsertCampaignResponse = z.infer<typeof insertCampaignResponseSchema>;
export type CampaignResponse = typeof campaignResponsesTable.$inferSelect;
