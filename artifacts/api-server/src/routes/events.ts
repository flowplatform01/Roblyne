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
  GetEventAnalyticsParams, ExportEventAttendeesParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { getOrgRole, requireBodyOrgRole, requireResourceOrgRole } from "../middlewares/orgAccess";
import { v4 as uuidv4 } from "uuid";
import { recordTransaction } from "../lib/commission-engine";

const router: IRouter = Router();

function hasValidTimeWindow(startsAt: Date | null | undefined, endsAt: Date | null | undefined): boolean {
  if (!startsAt || !endsAt) return true;
  return startsAt.getTime() < endsAt.getTime();
}

function toCsvValue(value: unknown): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// List events — single query with subquery counts to avoid N+1
router.get("/events", async (req, res): Promise<void> => {
  const queryParsed = ListEventsQueryParams.safeParse(req.query);
  const filters: any[] = [];
  const requestedOrgId = queryParsed.success ? queryParsed.data.orgId : undefined;
  const orgRole = requestedOrgId && req.session?.userId
    ? await getOrgRole(requestedOrgId, req.session.userId)
    : null;
  const canSeePrivate = Boolean(orgRole);
  if (queryParsed.success) {
    const { orgId, status, visibility } = queryParsed.data;
    if (orgId) filters.push(eq(eventsTable.orgId, orgId));
    if (status) filters.push(eq(eventsTable.status, status));
    if (visibility && (visibility === "public" || canSeePrivate)) {
      filters.push(eq(eventsTable.visibility, visibility));
    } else if (!canSeePrivate) {
      filters.push(eq(eventsTable.visibility, "public"));
    }
  } else {
    filters.push(eq(eventsTable.visibility, "public"));
  }
  if (!canSeePrivate) {
    filters.push(sql`${eventsTable.status} <> 'draft'`);
  }

  const rows = await db
    .select({
      event: eventsTable,
      orgName: organizationsTable.name,
      orgLogoUrl: organizationsTable.logoUrl,
      attendeesCount: sql<number>`(SELECT COUNT(*)::int FROM tickets t WHERE t.event_id = ${eventsTable.id})`,
      ticketTypesCount: sql<number>`(SELECT COUNT(*)::int FROM ticket_types tt WHERE tt.event_id = ${eventsTable.id})`,
    })
    .from(eventsTable)
    .leftJoin(organizationsTable, eq(eventsTable.orgId, organizationsTable.id))
    .where(filters.length > 0 ? and(...filters) : undefined);

  res.json(rows.map(({ event, orgName, orgLogoUrl, attendeesCount, ticketTypesCount }) => ({
    ...event,
    inviteCode: null,
    organizationName: orgName ?? null,
    organizationLogoUrl: orgLogoUrl ?? null,
    attendeesCount: attendeesCount ?? 0,
    ticketTypesCount: ticketTypesCount ?? 0,
  })));
});

// Create event
router.post("/events", requireAuth, requireBodyOrgRole(["owner", "admin"]), async (req, res): Promise<void> => {
  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { orgId, title, description, coverImageUrl, heroImageUrl, accentColor, theme, location, isOnline, onlineUrl, visibility, startsAt, endsAt, capacity } = parsed.data;
  if (!hasValidTimeWindow(startsAt, endsAt)) {
    res.status(400).json({ error: "The event closing time must be after its opening time" });
    return;
  }
  const inviteCode = visibility === "invite_only" ? uuidv4().replace(/-/g, "").substring(0, 10).toUpperCase() : null;
  const [event] = await db.insert(eventsTable).values({
    orgId, title, description, coverImageUrl, heroImageUrl, accentColor, theme: theme ?? "evenum", location,
    isOnline: isOnline ?? false, onlineUrl, visibility: visibility ?? "public",
    inviteCode, startsAt, endsAt, capacity,
  }).returning();
  res.status(201).json({ ...event, organizationName: null, organizationLogoUrl: null, attendeesCount: 0, ticketTypesCount: 0 });
});

// Get event — subquery counts to avoid extra round-trips
router.get("/events/:eventId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const parsed = GetEventParams.safeParse({ eventId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [row] = await db
    .select({
      event: eventsTable,
      orgName: organizationsTable.name,
      orgLogoUrl: organizationsTable.logoUrl,
      attendeesCount: sql<number>`(SELECT COUNT(*)::int FROM tickets t WHERE t.event_id = ${eventsTable.id})`,
      ticketTypesCount: sql<number>`(SELECT COUNT(*)::int FROM ticket_types tt WHERE tt.event_id = ${eventsTable.id})`,
    })
    .from(eventsTable)
    .leftJoin(organizationsTable, eq(eventsTable.orgId, organizationsTable.id))
    .where(eq(eventsTable.id, parsed.data.eventId))
    .limit(1);

  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const viewerRole = req.session?.userId ? await getOrgRole(row.event.orgId, req.session.userId) : null;
  if (row.event.visibility !== "public" && !viewerRole) {
    res.status(404).json({ error: "Not found" }); return;
  }

  res.json({
    ...row.event,
    inviteCode: viewerRole === "owner" || viewerRole === "admin" ? row.event.inviteCode : null,
    organizationName: row.orgName ?? null,
    organizationLogoUrl: row.orgLogoUrl ?? null,
    attendeesCount: row.attendeesCount ?? 0,
    ticketTypesCount: row.ticketTypesCount ?? 0,
  });
});

// Update event — must be org owner/admin
router.patch("/events/:eventId", requireAuth, requireResourceOrgRole(eventsTable, "eventId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const paramParsed = UpdateEventParams.safeParse({ eventId: parseInt(rawId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = UpdateEventBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const [current] = await db.select({ startsAt: eventsTable.startsAt, endsAt: eventsTable.endsAt })
    .from(eventsTable).where(eq(eventsTable.id, paramParsed.data.eventId)).limit(1);
  if (!current) { res.status(404).json({ error: "Not found" }); return; }
  const startsAt = bodyParsed.data.startsAt === undefined ? current.startsAt : bodyParsed.data.startsAt;
  const endsAt = bodyParsed.data.endsAt === undefined ? current.endsAt : bodyParsed.data.endsAt;
  if (!hasValidTimeWindow(startsAt, endsAt)) {
    res.status(400).json({ error: "The event closing time must be after its opening time" });
    return;
  }
  const [event] = await db.update(eventsTable).set(bodyParsed.data).where(eq(eventsTable.id, paramParsed.data.eventId)).returning();
  if (!event) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...event, organizationName: null, organizationLogoUrl: null, attendeesCount: 0, ticketTypesCount: 0 });
});

// Delete event — must be org owner/admin
router.delete("/events/:eventId", requireAuth, requireResourceOrgRole(eventsTable, "eventId", ["owner", "admin"]), async (req, res): Promise<void> => {
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
  const [event] = await db.select({ visibility: eventsTable.visibility, orgId: eventsTable.orgId })
    .from(eventsTable)
    .where(eq(eventsTable.id, parsed.data.eventId))
    .limit(1);
  const viewerRole = event && req.session?.userId ? await getOrgRole(event.orgId, req.session.userId) : null;
  if (!event || (event.visibility !== "public" && !viewerRole)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const types = await db.select().from(ticketTypesTable).where(eq(ticketTypesTable.eventId, parsed.data.eventId));
  res.json(types.map(t => ({ ...t, price: parseFloat(t.price) })));
});

router.post("/events/:eventId/ticket-types", requireAuth, requireResourceOrgRole(eventsTable, "eventId", ["owner", "admin"]), async (req, res): Promise<void> => {
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

router.patch("/events/:eventId/ticket-types/:ticketTypeId", requireAuth, requireResourceOrgRole(eventsTable, "eventId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawTtId = Array.isArray(req.params.ticketTypeId) ? req.params.ticketTypeId[0] : req.params.ticketTypeId;
  const rawEvId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const paramParsed = UpdateTicketTypeParams.safeParse({ eventId: parseInt(rawEvId, 10), ticketTypeId: parseInt(rawTtId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = UpdateTicketTypeBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const updateData: any = { ...bodyParsed.data };
  if (updateData.price !== undefined) updateData.price = String(updateData.price);
  const [tt] = await db.update(ticketTypesTable).set(updateData).where(and(eq(ticketTypesTable.id, paramParsed.data.ticketTypeId), eq(ticketTypesTable.eventId, paramParsed.data.eventId))).returning();
  if (!tt) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...tt, price: parseFloat(tt.price) });
});

router.delete("/events/:eventId/ticket-types/:ticketTypeId", requireAuth, requireResourceOrgRole(eventsTable, "eventId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawTtId = Array.isArray(req.params.ticketTypeId) ? req.params.ticketTypeId[0] : req.params.ticketTypeId;
  const rawEvId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const parsed = DeleteTicketTypeParams.safeParse({ eventId: parseInt(rawEvId, 10), ticketTypeId: parseInt(rawTtId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(ticketTypesTable).where(and(eq(ticketTypesTable.id, parsed.data.ticketTypeId), eq(ticketTypesTable.eventId, parsed.data.eventId)));
  res.json({ message: "Deleted" });
});

// ── REGISTRATION ───────────────────────────────────────────────────────────

router.post("/events/:eventId/register", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const paramParsed = RegisterForEventParams.safeParse({ eventId: parseInt(rawId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = RegisterForEventBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }

  const { ticketTypeId, attendeeName, attendeeEmail, inviteCode } = bodyParsed.data;
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, paramParsed.data.eventId)).limit(1);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }

  // ── Lifecycle enforcement ─────────────────────────────────────────────
  if (event.status !== "published") {
    const reason =
      event.status === "cancelled" ? "This event has been cancelled" :
      event.status === "completed" ? "This event has already concluded" :
      "This event is not currently open for registration";
    res.status(403).json({ error: reason });
    return;
  }

  const now = new Date();
  if (event.endsAt && new Date(event.endsAt) <= now) {
    res.status(403).json({ error: "Registration for this event has closed" });
    return;
  }
  if (event.startsAt && new Date(event.startsAt) > now) {
    res.status(403).json({ error: "Registration for this event has not opened yet" });
    return;
  }

  // ── Invite code check ─────────────────────────────────────────────────
  if (event.visibility === "invite_only") {
    if (!inviteCode || inviteCode !== event.inviteCode) {
      res.status(403).json({ error: "A valid invite code is required to register for this event" });
      return;
    }
  }

  // Verify ticket type belongs to this event
  const [tt] = await db.select().from(ticketTypesTable)
    .where(and(eq(ticketTypesTable.id, ticketTypeId), eq(ticketTypesTable.eventId, paramParsed.data.eventId))).limit(1);
  if (!tt) { res.status(404).json({ error: "Ticket type not found for this event" }); return; }

  // Check ticket sale window
  if (tt.saleStartsAt && new Date(tt.saleStartsAt) > now) {
    res.status(403).json({ error: "Ticket sales for this tier have not started yet" });
    return;
  }
  if (tt.saleEndsAt && new Date(tt.saleEndsAt) < now) {
    res.status(403).json({ error: "Ticket sales for this tier have ended" });
    return;
  }

  // ── Atomic sold-count check and ticket issuance ───────────────────────
  // The transaction re-reads ticket type FOR UPDATE to prevent overselling under concurrency.
  const ticketCode = uuidv4().replace(/-/g, "").substring(0, 12).toUpperCase();

  try {
    const ticket = await db.transaction(async (tx) => {
      // Lock the ticket type row to prevent concurrent oversells
      const [lockedEvent] = (await tx.execute(
        sql`SELECT id, status, starts_at, ends_at, capacity FROM events WHERE id = ${paramParsed.data.eventId} FOR UPDATE`
      )).rows as any[];
      if (!lockedEvent) {
        throw Object.assign(new Error("Event not found"), { code: "EVENT_NOT_FOUND" });
      }
      if (lockedEvent.status !== "published") {
        throw Object.assign(new Error("Event unavailable"), { code: "EVENT_UNAVAILABLE" });
      }
      if (lockedEvent.ends_at && new Date(lockedEvent.ends_at) <= new Date()) {
        throw Object.assign(new Error("Registration closed"), { code: "REGISTRATION_CLOSED" });
      }
      if (lockedEvent.starts_at && new Date(lockedEvent.starts_at) > new Date()) {
        throw Object.assign(new Error("Registration not started"), { code: "REGISTRATION_NOT_STARTED" });
      }
      if (lockedEvent.capacity !== null) {
        const capacityResult = await tx.execute(
          sql`SELECT COUNT(*)::int AS count FROM tickets WHERE event_id = ${paramParsed.data.eventId} AND status <> 'cancelled'`
        );
        const registeredCount = Number((capacityResult.rows[0] as any)?.count ?? 0);
        if (registeredCount >= lockedEvent.capacity) {
          throw Object.assign(new Error("Event full"), { code: "EVENT_FULL" });
        }
      }

      const lockResult = await tx.execute(
        sql`SELECT id, event_id, name, price, currency, quantity, sold, sale_starts_at, sale_ends_at FROM ticket_types WHERE id = ${ticketTypeId} AND event_id = ${paramParsed.data.eventId} FOR UPDATE`
      );
      const lockedTt = lockResult.rows[0] as any;
      if (!lockedTt) {
        throw Object.assign(new Error("Ticket type not found"), { code: "TICKET_TYPE_NOT_FOUND" });
      }
      const lockedNow = new Date();
      if (lockedTt.sale_starts_at && new Date(lockedTt.sale_starts_at) > lockedNow) {
        throw Object.assign(new Error("Ticket sales have not started"), { code: "TICKET_SALE_NOT_STARTED" });
      }
      if (lockedTt.sale_ends_at && new Date(lockedTt.sale_ends_at) <= lockedNow) {
        throw Object.assign(new Error("Ticket sales have ended"), { code: "TICKET_SALE_ENDED" });
      }
      if (lockedTt.quantity !== null && lockedTt.sold >= lockedTt.quantity) {
        throw Object.assign(new Error("Sold out"), { code: "SOLD_OUT" });
      }

      const [inserted] = await tx.insert(ticketsTable).values({
        eventId: paramParsed.data.eventId, ticketTypeId, attendeeName, attendeeEmail,
        ticketCode, status: "valid",
      }).returning();
      await tx.execute(sql`UPDATE ticket_types SET sold = sold + 1 WHERE id = ${ticketTypeId}`);
      if (Number(lockedTt.price) > 0) {
        await recordTransaction({
          orgId: event.orgId,
          pillar: "event",
          entityId: event.id,
          entityTitle: event.title,
          transactionType: "ticket",
          grossAmount: Number(lockedTt.price),
          currency: lockedTt.currency || "USD",
          payerName: attendeeName,
          payerEmail: attendeeEmail,
        }, tx);
      }
      return inserted;
    });

    res.status(201).json({
      ...ticket,
      eventTitle: event.title,
      ticketTypeName: tt?.name ?? null,
    });
  } catch (err: any) {
    if (err?.code === "SOLD_OUT") {
      res.status(409).json({ error: "This ticket type is sold out" });
      return;
    }
    if (err?.code === "EVENT_FULL") {
      res.status(409).json({ error: "This event has reached capacity" });
      return;
    }
    if (err?.code === "EVENT_NOT_FOUND") {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    if (err?.code === "TICKET_TYPE_NOT_FOUND") {
      res.status(404).json({ error: "Ticket type not found for this event" });
      return;
    }
    if (err?.code === "EVENT_UNAVAILABLE" || err?.code === "REGISTRATION_CLOSED") {
      res.status(403).json({ error: err.code === "REGISTRATION_CLOSED" ? "Registration for this event has closed" : "This event is not currently open for registration" });
      return;
    }
     if (err?.code === "REGISTRATION_NOT_STARTED") {
       res.status(403).json({ error: "Registration for this event has not opened yet" });
       return;
     }
     if (err?.code === "TICKET_SALE_NOT_STARTED" || err?.code === "TICKET_SALE_ENDED") {
      res.status(403).json({ error: err.code === "TICKET_SALE_NOT_STARTED" ? "Ticket sales for this tier have not started yet" : "Ticket sales for this tier have ended" });
      return;
    }
    throw err;
  }
});

// ── ATTENDEES — org admin only ─────────────────────────────────────────────

router.get("/events/:eventId/attendees", requireAuth, requireResourceOrgRole(eventsTable, "eventId", ["owner", "admin", "member"]), async (req, res): Promise<void> => {
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

// ── CHECK-IN — org member+ ─────────────────────────────────────────────────

router.post("/events/:eventId/checkin", requireAuth, requireResourceOrgRole(eventsTable, "eventId", ["owner", "admin", "member"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const paramParsed = CheckInAttendeeParams.safeParse({ eventId: parseInt(rawId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = CheckInAttendeeBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }

  const { ticketCode } = bodyParsed.data;

  // Atomic check-in: update only if status is currently 'valid' to prevent double check-in
  const [updated] = await db
    .update(ticketsTable)
    .set({ status: "used", checkedInAt: new Date() })
    .where(and(
      eq(ticketsTable.eventId, paramParsed.data.eventId),
      eq(ticketsTable.ticketCode, ticketCode),
      eq(ticketsTable.status, "valid"),
    ))
    .returning();

  if (!updated) {
    // Distinguish not-found from already-checked-in
    const [ticket] = await db.select().from(ticketsTable)
      .where(and(eq(ticketsTable.eventId, paramParsed.data.eventId), eq(ticketsTable.ticketCode, ticketCode))).limit(1);
    if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
    res.status(409).json({ error: "Already checked in" }); return;
  }

  const [tt] = await db.select().from(ticketTypesTable).where(eq(ticketTypesTable.id, updated.ticketTypeId)).limit(1);
  res.json({ ...updated, ticketTypeName: tt?.name ?? null });
});

// ── ANALYTICS — org admin only ─────────────────────────────────────────────

router.get("/events/:eventId/analytics", requireAuth, requireResourceOrgRole(eventsTable, "eventId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const parsed = GetEventAnalyticsParams.safeParse({ eventId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const eventId = parsed.data.eventId;

  // All aggregations in a single query; ticket type breakdown uses GROUP BY
  const [summaryResult, ticketBreakdownResult, regByDayResult] = await Promise.all([
    db.execute(sql`
      SELECT
        COUNT(*)::int                                                                     AS total_attendees,
        COUNT(*) FILTER (WHERE status = 'used')::int                                     AS checked_in
      FROM tickets WHERE event_id = ${eventId}
    `),
    db.execute(sql`
      SELECT
        tt.id     AS ticket_type_id,
        tt.name,
        tt.price,
        COUNT(t.id)::int AS sold
      FROM ticket_types tt
      LEFT JOIN tickets t ON t.ticket_type_id = tt.id AND t.event_id = ${eventId}
      WHERE tt.event_id = ${eventId}
      GROUP BY tt.id, tt.name, tt.price
    `),
    db.execute(
      sql`SELECT date_trunc('day', issued_at)::date::text as date, count(*)::int as count FROM tickets WHERE event_id = ${eventId} GROUP BY 1 ORDER BY 1`
    ),
  ]);

  const summary = summaryResult.rows[0] as any;
  const totalAttend = summary?.total_attendees ?? 0;
  const checkedInCount = summary?.checked_in ?? 0;

  const ticketsByType = (ticketBreakdownResult.rows as any[]).map((row: any) => ({
    ticketTypeId: row.ticket_type_id,
    name: row.name,
    sold: row.sold,
    revenue: row.sold * parseFloat(row.price),
  }));

  res.json({
    eventId,
    totalAttendees: totalAttend,
    checkedIn: checkedInCount,
    checkInRate: totalAttend > 0 ? Math.round((checkedInCount / totalAttend) * 1000) / 10 : 0,
    revenue: ticketsByType.reduce((sum, t) => sum + t.revenue, 0),
    ticketsByType,
    registrationsByDay: (regByDayResult.rows ?? []).map((r: any) => ({ date: r.date, count: r.count })),
  });
});

// ── EXPORT ─────────────────────────────────────────────────────────────────

router.get("/events/:eventId/export", requireAuth, requireResourceOrgRole(eventsTable, "eventId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const parsed = ExportEventAttendeesParams.safeParse({ eventId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }

  const attendees = await db
    .select({ ticket: ticketsTable, ticketTypeName: ticketTypesTable.name })
    .from(ticketsTable)
    .leftJoin(ticketTypesTable, eq(ticketsTable.ticketTypeId, ticketTypesTable.id))
    .where(eq(ticketsTable.eventId, parsed.data.eventId));

  const rows = [["Name", "Email", "Ticket Type", "Ticket Code", "Status", "Checked In At", "Issued At"]];
  for (const { ticket, ticketTypeName } of attendees) {
    rows.push([
      ticket.attendeeName, ticket.attendeeEmail, ticketTypeName ?? "", ticket.ticketCode,
      ticket.status, ticket.checkedInAt ? new Date(ticket.checkedInAt).toISOString() : "",
      new Date(ticket.issuedAt).toISOString(),
    ]);
  }
  const csv = rows.map(r => r.map(toCsvValue).join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="event-${parsed.data.eventId}-attendees.csv"`);
  res.send(csv);
});

export default router;
