import { pgTable, serial, text, integer, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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
});

export const candidatesTable = pgTable("candidates", {
  id: serial("id").primaryKey(),
  electionId: integer("election_id").notNull().references(() => electionsTable.id, { onDelete: "cascade" }),
  positionId: integer("position_id").notNull().references(() => positionsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  bio: text("bio"),
  photoUrl: text("photo_url"),
  platform: text("platform"),
});

export const votesTable = pgTable("votes", {
  id: serial("id").primaryKey(),
  electionId: integer("election_id").notNull().references(() => electionsTable.id, { onDelete: "cascade" }),
  voterIdentifier: text("voter_identifier").notNull(), // userId or sessionId
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
