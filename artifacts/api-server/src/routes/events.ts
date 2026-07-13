import { Router, type IRouter } from "express";
import { eq, sql, and } from "drizzle-orm";
import { db, eventsTable, ticketTypesTable, ticketsTable, organizationsTable } from "@workspace/db";
import {
  CreateEventBody, UpdateEventBody, GetEventParams, UpdateEventParams, DeleteEventParams, ListEventsQueryParams,
  ListTicketTypesParams, CreateTicketTypeParams, CreateTicketTypeBody,
  UpdateTicketTypeParams, UpdateTicketTypeBody, DeleteTicketTypeParams,
  RegisterForEventParams, RegisterForEventBody,
  ListAttendeesParams,
  CheckInAttendeeParams, CheckInAttendeeBody,
  GetEventAnalyticsParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { v4 as uuidv4 } from "uuid";

const router: IRouter = Router();

// List events
router.get("/events", async (req, res): Promise<void> => {
  const queryParsed = ListEventsQueryParams.safeParse(req.query);
  const filters: any[] = [];
  if (queryParsed.success) {
    const { orgId, status, visibility } = queryParsed.data;
    if (orgId) filters.push(eq(eventsTable.orgId, orgId));
    if (status) filters.push(eq(eventsTable.status, status));
    if (visibility) filters.push(eq(eventsTable.visibility, visibility));
  }

  const rows = await db.select({ event: eventsTable, orgName: organizationsTable.name })
    .from(eventsTable)
    .leftJoin(organizationsTable, eq(eventsTable.orgId, organizationsTable.id))
    .where(filters.length > 0 ? and(...filters) : undefined);

  const events = await Promise.all(rows.map(async ({ event, orgName }) => {
    const [{ attendeesCount }] = await db.select({ attendeesCount: sql<number>`count(*)::int` }).from(ticketsTable).where(eq(ticketsTable.eventId, event.id));
    const [{ ticketTypesCount }] = await db.select({ ticketTypesCount: sql<number>`count(*)::int` }).from(ticketTypesTable).where(eq(ticketTypesTable.eventId, event.id));
    return { ...event, organizationName: orgName ?? null, attendeesCount: attendeesCount ?? 0, ticketTypesCount: ticketTypesCount ?? 0 };
  }));
  res.json(events);
});

// Create event
router.post("/events", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { orgId, title, description, coverImageUrl, location, isOnline, onlineUrl, visibility, startsAt, endsAt, capacity } = parsed.data;
  const [event] = await db.insert(eventsTable).values({
    orgId, title, description, coverImageUrl, location,
    isOnline: isOnline ?? false, onlineUrl, visibility: visibility ?? "public",
    startsAt, endsAt, capacity,
  }).returning();
  res.status(201).json({ ...event, organizationName: null, attendeesCount: 0, ticketTypesCount: 0 });
});

// Get event
router.get("/events/:eventId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const parsed = GetEventParams.safeParse({ eventId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [row] = await db.select({ event: eventsTable, orgName: organizationsTable.name })
    .from(eventsTable).leftJoin(organizationsTable, eq(eventsTable.orgId, organizationsTable.id))
    .where(eq(eventsTable.id, parsed.data.eventId)).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const [{ attendeesCount }] = await db.select({ attendeesCount: sql<number>`count(*)::int` }).from(ticketsTable).where(eq(ticketsTable.eventId, row.event.id));
  const [{ ticketTypesCount }] = await db.select({ ticketTypesCount: sql<number>`count(*)::int` }).from(ticketTypesTable).where(eq(ticketTypesTable.eventId, row.event.id));
  res.json({ ...row.event, organizationName: row.orgName ?? null, attendeesCount: attendeesCount ?? 0, ticketTypesCount: ticketTypesCount ?? 0 });
});

// Update event
router.patch("/events/:eventId", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const paramParsed = UpdateEventParams.safeParse({ eventId: parseInt(rawId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = UpdateEventBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const [event] = await db.update(eventsTable).set(bodyParsed.data).where(eq(eventsTable.id, paramParsed.data.eventId)).returning();
  if (!event) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...event, organizationName: null, attendeesCount: 0, ticketTypesCount: 0 });
});

// Delete event
router.delete("/events/:eventId", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const parsed = DeleteEventParams.safeParse({ eventId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(eventsTable).where(eq(eventsTable.id, parsed.data.eventId));
  res.json({ message: "Deleted" });
});

// ── TICKET TYPES ───────────────────────────────────────────────────────────

router.get("/events/:eventId/ticket-types", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const parsed = ListTicketTypesParams.safeParse({ eventId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const types = await db.select().from(ticketTypesTable).where(eq(ticketTypesTable.eventId, parsed.data.eventId));
  res.json(types.map(t => ({ ...t, price: parseFloat(t.price) })));
});

router.post("/events/:eventId/ticket-types", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const paramParsed = CreateTicketTypeParams.safeParse({ eventId: parseInt(rawId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = CreateTicketTypeBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const { name, description, price, currency, quantity, saleStartsAt, saleEndsAt } = bodyParsed.data;
  const [tt] = await db.insert(ticketTypesTable).values({
    eventId: paramParsed.data.eventId, name, description,
    price: String(price ?? 0), currency: currency ?? "USD",
    quantity, saleStartsAt, saleEndsAt,
  }).returning();
  res.status(201).json({ ...tt, price: parseFloat(tt.price) });
});

router.patch("/events/:eventId/ticket-types/:ticketTypeId", requireAuth, async (req, res): Promise<void> => {
  const rawTtId = Array.isArray(req.params.ticketTypeId) ? req.params.ticketTypeId[0] : req.params.ticketTypeId;
  const rawEvId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const paramParsed = UpdateTicketTypeParams.safeParse({ eventId: parseInt(rawEvId, 10), ticketTypeId: parseInt(rawTtId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = UpdateTicketTypeBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const updateData: any = { ...bodyParsed.data };
  if (updateData.price !== undefined) updateData.price = String(updateData.price);
  const [tt] = await db.update(ticketTypesTable).set(updateData).where(eq(ticketTypesTable.id, paramParsed.data.ticketTypeId)).returning();
  if (!tt) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...tt, price: parseFloat(tt.price) });
});

router.delete("/events/:eventId/ticket-types/:ticketTypeId", requireAuth, async (req, res): Promise<void> => {
  const rawTtId = Array.isArray(req.params.ticketTypeId) ? req.params.ticketTypeId[0] : req.params.ticketTypeId;
  const rawEvId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const parsed = DeleteTicketTypeParams.safeParse({ eventId: parseInt(rawEvId, 10), ticketTypeId: parseInt(rawTtId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(ticketTypesTable).where(eq(ticketTypesTable.id, parsed.data.ticketTypeId));
  res.json({ message: "Deleted" });
});

// ── REGISTRATION ───────────────────────────────────────────────────────────

router.post("/events/:eventId/register", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const paramParsed = RegisterForEventParams.safeParse({ eventId: parseInt(rawId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = RegisterForEventBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }

  const { ticketTypeId, attendeeName, attendeeEmail } = bodyParsed.data;
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, paramParsed.data.eventId)).limit(1);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }

  const ticketCode = uuidv4().replace(/-/g, "").substring(0, 12).toUpperCase();
  const [ticket] = await db.insert(ticketsTable).values({
    eventId: paramParsed.data.eventId, ticketTypeId, attendeeName, attendeeEmail,
    ticketCode, status: "valid",
  }).returning();

  await db.execute(sql`UPDATE ticket_types SET sold = sold + 1 WHERE id = ${ticketTypeId}`);

  const [tt] = await db.select().from(ticketTypesTable).where(eq(ticketTypesTable.id, ticketTypeId)).limit(1);
  res.status(201).json({
    ...ticket,
    eventTitle: event.title,
    ticketTypeName: tt?.name ?? null,
  });
});

// ── ATTENDEES ──────────────────────────────────────────────────────────────

router.get("/events/:eventId/attendees", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const parsed = ListAttendeesParams.safeParse({ eventId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const attendees = await db
    .select({ ticket: ticketsTable, ticketTypeName: ticketTypesTable.name })
    .from(ticketsTable)
    .leftJoin(ticketTypesTable, eq(ticketsTable.ticketTypeId, ticketTypesTable.id))
    .where(eq(ticketsTable.eventId, parsed.data.eventId));
  res.json(attendees.map(({ ticket, ticketTypeName }) => ({ ...ticket, ticketTypeName: ticketTypeName ?? null })));
});

// ── CHECK-IN ───────────────────────────────────────────────────────────────

router.post("/events/:eventId/checkin", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const paramParsed = CheckInAttendeeParams.safeParse({ eventId: parseInt(rawId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = CheckInAttendeeBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }

  const { ticketCode } = bodyParsed.data;
  const [ticket] = await db.select().from(ticketsTable)
    .where(and(eq(ticketsTable.eventId, paramParsed.data.eventId), eq(ticketsTable.ticketCode, ticketCode))).limit(1);
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
  if (ticket.status === "used") { res.status(409).json({ error: "Already checked in" }); return; }

  const [updated] = await db.update(ticketsTable).set({ status: "used", checkedInAt: new Date() })
    .where(eq(ticketsTable.id, ticket.id)).returning();
  const [tt] = await db.select().from(ticketTypesTable).where(eq(ticketTypesTable.id, ticket.ticketTypeId)).limit(1);
  res.json({ ...updated, ticketTypeName: tt?.name ?? null });
});

// ── ANALYTICS ──────────────────────────────────────────────────────────────

router.get("/events/:eventId/analytics", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const parsed = GetEventAnalyticsParams.safeParse({ eventId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const eventId = parsed.data.eventId;

  const [{ totalAttendees }] = await db.select({ totalAttendees: sql<number>`count(*)::int` }).from(ticketsTable).where(eq(ticketsTable.eventId, eventId));
  const [{ checkedIn }] = await db.select({ checkedIn: sql<number>`count(*)::int` }).from(ticketsTable).where(and(eq(ticketsTable.eventId, eventId), eq(ticketsTable.status, "used")));

  const ticketTypes = await db.select().from(ticketTypesTable).where(eq(ticketTypesTable.eventId, eventId));
  const ticketsByType = await Promise.all(ticketTypes.map(async (tt) => {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(ticketsTable).where(and(eq(ticketsTable.eventId, eventId), eq(ticketsTable.ticketTypeId, tt.id)));
    const sold = count ?? 0;
    const price = parseFloat(tt.price);
    return { ticketTypeId: tt.id, name: tt.name, sold, revenue: sold * price };
  }));

  const regByDay = await db.execute(
    sql`SELECT date_trunc('day', issued_at)::date::text as date, count(*)::int as count FROM tickets WHERE event_id = ${eventId} GROUP BY 1 ORDER BY 1`
  );

  const totalAttend = totalAttendees ?? 0;
  const checkedInCount = checkedIn ?? 0;

  res.json({
    eventId,
    totalAttendees: totalAttend,
    checkedIn: checkedInCount,
    checkInRate: totalAttend > 0 ? Math.round((checkedInCount / totalAttend) * 1000) / 10 : 0,
    revenue: ticketsByType.reduce((sum, t) => sum + t.revenue, 0),
    ticketsByType,
    registrationsByDay: (regByDay.rows ?? []).map((r: any) => ({ date: r.date, count: r.count })),
  });
});

export default router;
