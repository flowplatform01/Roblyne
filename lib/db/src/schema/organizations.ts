import { pgTable, serial, text, integer, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const organizationsTable = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  logoUrl: text("logo_url"),
  coverImageUrl: text("cover_image_url"),
  heroImageUrl: text("hero_image_url"),
  website: text("website"),
  accentColor: text("accent_color"), // hex color e.g. "#4F46E5"
  theme: text("theme").notNull().default("evenum"), // evenum | light | dark
  ownerId: integer("owner_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  ownerIdIdx: index("organizations_owner_id_idx").on(table.ownerId),
}));

// Team membership: every org automatically has its owner as an implicit "owner" member.
// Additional members are explicit rows here with a role granting scoped permissions.
export const organizationMembersTable = pgTable("organization_members", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), // admin | member (owner is tracked via organizations.ownerId)
  invitedAt: timestamp("invited_at").notNull().defaultNow(),
}, (table) => ({
  orgUserUnique: uniqueIndex("org_members_org_user_unique").on(table.orgId, table.userId),
}));

export const insertOrganizationSchema = createInsertSchema(organizationsTable).omit({ id: true, createdAt: true });
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizationsTable.$inferSelect;

export const insertOrganizationMemberSchema = createInsertSchema(organizationMembersTable).omit({ id: true, invitedAt: true });
export type InsertOrganizationMember = z.infer<typeof insertOrganizationMemberSchema>;
export type OrganizationMember = typeof organizationMembersTable.$inferSelect;
