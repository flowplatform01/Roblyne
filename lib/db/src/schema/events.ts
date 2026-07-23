import { pgTable, serial, text, integer, timestamp, boolean, decimal, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  heroImageUrl: text("hero_image_url"),
  accentColor: text("accent_color"),
  theme: text("theme").notNull().default("evenum"), // evenum | light | dark
  location: text("location"),
  isOnline: boolean("is_online").notNull().default(false),
  onlineUrl: text("online_url"),
  status: text("status").notNull().default("draft"), // draft | published | cancelled | completed
  visibility: text("visibility").notNull().default("public"), // public | private | invite_only
  inviteCode: text("invite_code"),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  capacity: integer("capacity"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  orgIdIdx: index("events_org_id_idx").on(table.orgId),
  statusIdx: index("events_status_idx").on(table.status),
  visibilityIdx: index("events_visibility_idx").on(table.visibility),
}));

export const ticketTypesTable = pgTable("ticket_types", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("USD"),
  quantity: integer("quantity"), // null = unlimited
  sold: integer("sold").notNull().default(0),
  saleStartsAt: timestamp("sale_starts_at"),
  saleEndsAt: timestamp("sale_ends_at"),
}, (table) => ({
  eventIdIdx: index("ticket_types_event_id_idx").on(table.eventId),
}));

export const ticketsTable = pgTable("tickets", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  ticketTypeId: integer("ticket_type_id").notNull().references(() => ticketTypesTable.id),
  attendeeName: text("attendee_name").notNull(),
  attendeeEmail: text("attendee_email").notNull(),
  ticketCode: text("ticket_code").notNull().unique(),
  status: text("status").notNull().default("valid"), // valid | used | cancelled
  checkedInAt: timestamp("checked_in_at"),
  issuedAt: timestamp("issued_at").notNull().defaultNow(),
}, (table) => ({
  eventIdIdx: index("tickets_event_id_idx").on(table.eventId),
  ticketTypeIdIdx: index("tickets_ticket_type_id_idx").on(table.ticketTypeId),
  attendeeEmailIdx: index("tickets_attendee_email_idx").on(table.attendeeEmail),
}));

export const insertEventSchema = createInsertSchema(eventsTable).omit({ id: true, createdAt: true });
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;

export const insertTicketTypeSchema = createInsertSchema(ticketTypesTable).omit({ id: true, sold: true });
export type InsertTicketType = z.infer<typeof insertTicketTypeSchema>;
export type TicketType = typeof ticketTypesTable.$inferSelect;

export const insertTicketSchema = createInsertSchema(ticketsTable).omit({ id: true, issuedAt: true });
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof ticketsTable.$inferSelect;
