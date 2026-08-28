import { pgTable, serial, text, integer, timestamp, boolean, uniqueIndex, decimal, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const electionsTable = pgTable("elections", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  heroImageUrl: text("hero_image_url"),
  accentColor: text("accent_color"),
  theme: text("theme").notNull().default("evenum"), // evenum | light | dark
  status: text("status").notNull().default("draft"), // draft | active | ended
  visibility: text("visibility").notNull().default("public"), // public | private | invite_only
  requiresAuth: boolean("requires_auth").notNull().default(false),
  eligibilityMode: text("eligibility_mode").notNull().default("open"), // open | allowlist
  inviteCode: text("invite_code"),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  requiresPayment: boolean("requires_payment").notNull().default(false),
  paymentAmount: decimal("payment_amount", { precision: 10, scale: 2 }),
  currency: text("currency").notNull().default("XAF"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  orgIdIdx: index("elections_org_id_idx").on(table.orgId),
  statusIdx: index("elections_status_idx").on(table.status),
  visibilityIdx: index("elections_visibility_idx").on(table.visibility),
}));

// Allowlisted voter emails, used when eligibilityMode = "allowlist".
export const electionEligibleVotersTable = pgTable("election_eligible_voters", {
  id: serial("id").primaryKey(),
  electionId: integer("election_id").notNull().references(() => electionsTable.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
}, (table) => ({
  electionEmailUnique: uniqueIndex("election_eligible_voters_election_email_unique").on(table.electionId, table.email),
}));

export const positionsTable = pgTable("positions", {
  id: serial("id").primaryKey(),
  electionId: integer("election_id").notNull().references(() => electionsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  maxSelections: integer("max_selections").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => ({
  electionIdIdx: index("positions_election_id_idx").on(table.electionId),
}));

export const candidatesTable = pgTable("candidates", {
  id: serial("id").primaryKey(),
  electionId: integer("election_id").notNull().references(() => electionsTable.id, { onDelete: "cascade" }),
  positionId: integer("position_id").notNull().references(() => positionsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  bio: text("bio"),
  photoUrl: text("photo_url"),
  platform: text("platform"),
  requiresPayment: boolean("requires_payment").notNull().default(false),
  paymentAmount: decimal("payment_amount", { precision: 10, scale: 2 }),
  currency: text("currency").notNull().default("USD"),
}, (table) => ({
  electionIdIdx: index("candidates_election_id_idx").on(table.electionId),
  positionIdIdx: index("candidates_position_id_idx").on(table.positionId),
}));

export const votesTable = pgTable("votes", {
  id: serial("id").primaryKey(),
  electionId: integer("election_id").notNull().references(() => electionsTable.id, { onDelete: "cascade" }),
  voterIdentifier: text("voter_identifier").notNull(), // userId or sessionId
  quantity: integer("quantity").notNull().default(1),
  votedAt: timestamp("voted_at").notNull().defaultNow(),
}, (table) => ({
  // Hard DB-level guarantee against double-voting, not just an application-level check.
  electionVoterUnique: uniqueIndex("votes_election_voter_unique").on(table.electionId, table.voterIdentifier),
}));

export const voteSelectionsTable = pgTable("vote_selections", {
  id: serial("id").primaryKey(),
  voteId: integer("vote_id").notNull().references(() => votesTable.id, { onDelete: "cascade" }),
  positionId: integer("position_id").notNull().references(() => positionsTable.id),
  candidateId: integer("candidate_id").notNull().references(() => candidatesTable.id),
}, (table) => ({
  voteIdIdx: index("vote_selections_vote_id_idx").on(table.voteId),
  candidateIdIdx: index("vote_selections_candidate_id_idx").on(table.candidateId),
}));

export const platformSettingsTable = pgTable("platform_settings", {
  id: serial("id").primaryKey(),
  paymentMode: text("payment_mode").notNull().default("quantity_first"), // quantity_first | amount_first
  defaultCurrency: text("default_currency").notNull().default("XAF"),
  supportedCurrencies: text("supported_currencies").notNull().default("XAF"),
  supportEmail: text("support_email"),
  supportPhone: text("support_phone"),
  supportWhatsapp: text("support_whatsapp"),
  supportUrl: text("support_url"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertElectionSchema = createInsertSchema(electionsTable).omit({ id: true, createdAt: true });
export type InsertElection = z.infer<typeof insertElectionSchema>;
export type Election = typeof electionsTable.$inferSelect;

export const insertElectionEligibleVoterSchema = createInsertSchema(electionEligibleVotersTable).omit({ id: true });
export type InsertElectionEligibleVoter = z.infer<typeof insertElectionEligibleVoterSchema>;
export type ElectionEligibleVoter = typeof electionEligibleVotersTable.$inferSelect;

export const insertPositionSchema = createInsertSchema(positionsTable).omit({ id: true });
export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type Position = typeof positionsTable.$inferSelect;

export const insertCandidateSchema = createInsertSchema(candidatesTable).omit({ id: true });
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type Candidate = typeof candidatesTable.$inferSelect;
