import { boolean, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const legalDocumentsTable = pgTable("legal_documents", {
  id: serial("id").primaryKey(),
  documentType: text("document_type").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  version: integer("version").notNull(),
  status: text("status").notNull().default("draft"),
  effectiveAt: timestamp("effective_at"),
  requiresReacceptance: boolean("requires_reacceptance").notNull().default(false),
  publishedAt: timestamp("published_at"),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  typeVersionUnique: uniqueIndex("legal_documents_type_version_uq").on(table.documentType, table.version),
  publicLookupIdx: index("legal_documents_public_lookup_idx").on(table.documentType, table.status, table.effectiveAt),
}));

export const legalAcceptancesTable = pgTable("legal_acceptances", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  legalDocumentId: integer("legal_document_id").notNull().references(() => legalDocumentsTable.id, { onDelete: "restrict" }),
  documentType: text("document_type").notNull(),
  documentVersion: integer("document_version").notNull(),
  acceptedAt: timestamp("accepted_at").notNull().defaultNow(),
}, (table) => ({
  userDocumentUnique: uniqueIndex("legal_acceptances_user_document_uq").on(table.userId, table.legalDocumentId),
  userTypeVersionIdx: index("legal_acceptances_user_type_version_idx").on(table.userId, table.documentType, table.documentVersion),
}));
