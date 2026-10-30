import { Router, type IRouter } from "express";
import { desc, eq, sql, and } from "drizzle-orm";
import { db, eventsTable, ticketTypesTable, ticketsTable, organizationsTable, paymentIntentsTable } from "@workspace/db";
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
import { getPlatformCurrency, isPlatformCurrencySupported } from "../lib/commission-engine";
import { createPaymentIntent, failPaymentIntent, initializePaymentIntent } from "../lib/payment-intents";
import { compactListMedia } from "../lib/compact-list-media";
import { getEventRegistrationBlockReason } from "../lib/event-registration-lifecycle";
import { normalizeCameroonPhone } from "../lib/phone";
import { invalidateDiscoverCache } from "../lib/discover-cache";
import { canReadEvent } from "../lib/event-access";
import {
  addEventInviteVerification,
  hasEventInviteVerification,
} from "../lib/event-invite-verification";

const router: IRouter = Router();
const MAX_EVENT_LIST_RESULTS = 100;
const MAX_EVENT_ATTENDEE_RESULTS = 500;

function requestInviteCode(query: unknown): string | null {
  const value = (query as Record<string, unknown> | undefined)?.invite;
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return code.length > 0 && code.length <= 64 ? code : null;
}

function canReadEventRequest(
  eventId: number,
  event: { visibility: string; status: string; inviteCode?: string | null },
  viewerRole: string | null,
  inviteCode: string | null,
  inviteVerifications?: Record<string, number>,
): boolean {
  const inviteCodeMatches = Boolean(inviteCode && event.inviteCode && inviteCode === event.inviteCode);
  return canReadEvent(
    event.visibility,
    event.status,
    Boolean(viewerRole),
    inviteCodeMatches || hasEventInviteVerification(inviteVerifications, eventId),
  );
}

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
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(eventsTable.createdAt))
    .limit(MAX_EVENT_LIST_RESULTS);

  res.setHeader("X-Result-Limit", String(MAX_EVENT_LIST_RESULTS));
  res.json(rows.map(({ event, orgName, orgLogoUrl, attendeesCount, ticketTypesCount }) => ({
    ...compactListMedia({
      ...event,
      organizationLogoUrl: orgLogoUrl ?? null,
    }),
    inviteCode: null,
    organizationName: orgName ?? null,
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
  void invalidateDiscoverCache();
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
  if (!canReadEventRequest(row.event.id, row.event, viewerRole, requestInviteCode(req.query), req.session.eventInviteVerifications)) {
    res.status(404).json({ error: "Not found" }); return;
  }

  res.json({
    ...row.event,
    inviteCode: viewerRole === "owner" || viewerRole === "admin" ? row.event.inviteCode : null,
    inviteVerified: row.event.visibility === "invite_only"
      && hasEventInviteVerification(req.session.eventInviteVerifications, row.event.id),
    organizationName: row.orgName ?? null,
    organizationLogoUrl: row.orgLogoUrl ?? null,
    attendeesCount: row.attendeesCount ?? 0,
    ticketTypesCount: row.ticketTypesCount ?? 0,
  });
});

router.post("/events/:eventId/invite-verification", async (req, res): Promise<void> => {
  const eventId = parseInt(String(req.params.eventId), 10);
  const inviteCode = requestInviteCode({ invite: req.body?.inviteCode });
  if (!Number.isInteger(eventId) || eventId <= 0 || !inviteCode) {
    res.status(400).json({ error: "Enter a valid invite code" });
    return;
  }

  const [event] = await db.select({
    id: eventsTable.id,
    visibility: eventsTable.visibility,
    status: eventsTable.status,
    inviteCode: eventsTable.inviteCode,
  }).from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
  if (!event || event.status === "draft" || event.visibility !== "invite_only" || inviteCode !== event.inviteCode) {
    res.status(403).json({ error: "This invite code is invalid or no longer available" });
    return;
  }

  req.session.eventInviteVerifications = addEventInviteVerification(req.session.eventInviteVerifications, eventId);
  await new Promise<void>((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));
  res.json({ verified: true });
});

// Update event — must be org owner/admin
router.patch("/events/:eventId", requireAuth, requireResourceOrgRole(eventsTable, "eventId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const paramParsed = UpdateEventParams.safeParse({ eventId: parseInt(rawId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = UpdateEventBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const outcome = await db.transaction(async (tx) => {
    const [current] = await tx.select({
      status: eventsTable.status,
      startsAt: eventsTable.startsAt,
      endsAt: eventsTable.endsAt,
      capacity: eventsTable.capacity,
      location: eventsTable.location,
      isOnline: eventsTable.isOnline,
      onlineUrl: eventsTable.onlineUrl,
      visibility: eventsTable.visibility,
    })
      .from(eventsTable)
      .where(eq(eventsTable.id, paramParsed.data.eventId))
      .for("update");
    if (!current) return { kind: "missing" as const };

    const startsAt = bodyParsed.data.startsAt === undefined ? current.startsAt : bodyParsed.data.startsAt;
    const endsAt = bodyParsed.data.endsAt === undefined ? current.endsAt : bodyParsed.data.endsAt;
    if (!hasValidTimeWindow(startsAt, endsAt)) return { kind: "invalid_window" as const };

    const nextStatus = bodyParsed.data.status;
    const invalidStatusTransition =
      (current.status === "draft" && nextStatus !== undefined && nextStatus !== "published")
      || (current.status === "published" && nextStatus !== undefined && !["published", "cancelled", "completed"].includes(nextStatus))
      || (["cancelled", "completed"].includes(current.status) && nextStatus !== undefined && nextStatus !== current.status);
    if (invalidStatusTransition) return { kind: "locked" as const };

    if (current.status === "draft" && nextStatus === "published") {
      const [ticketType] = await tx.select({ id: ticketTypesTable.id })
        .from(ticketTypesTable)
        .where(eq(ticketTypesTable.eventId, paramParsed.data.eventId))
        .limit(1);
      if (!ticketType) return { kind: "missing_ticket_types" as const };
    }

    const timeChanged = (currentValue: Date | null, nextValue: Date | undefined) =>
      nextValue !== undefined && currentValue?.getTime() !== nextValue.getTime();
    const changesAttendeeInstructions =
      timeChanged(current.startsAt, bodyParsed.data.startsAt)
      || timeChanged(current.endsAt, bodyParsed.data.endsAt)
      || (bodyParsed.data.capacity !== undefined && bodyParsed.data.capacity !== current.capacity)
      || (bodyParsed.data.location !== undefined && bodyParsed.data.location !== current.location)
      || (bodyParsed.data.isOnline !== undefined && bodyParsed.data.isOnline !== current.isOnline)
      || (bodyParsed.data.onlineUrl !== undefined && bodyParsed.data.onlineUrl !== current.onlineUrl)
      || (bodyParsed.data.visibility !== undefined && bodyParsed.data.visibility !== current.visibility);
    if (current.status === "published" && changesAttendeeInstructions) {
      const [ticket] = await tx.select({ id: ticketsTable.id })
        .from(ticketsTable)
        .where(eq(ticketsTable.eventId, paramParsed.data.eventId))
        .limit(1);
      const [pendingPayment] = await tx.select({ id: paymentIntentsTable.id })
        .from(paymentIntentsTable)
        .where(and(
          eq(paymentIntentsTable.pillar, "event"),
          eq(paymentIntentsTable.entityId, paramParsed.data.eventId),
          sql`${paymentIntentsTable.status} IN ('initializing', 'pending', 'processing')`,
        ))
        .limit(1);
      if (ticket || pendingPayment) return { kind: "locked" as const };
    }

    const [event] = await tx.update(eventsTable)
      .set(bodyParsed.data)
      .where(eq(eventsTable.id, paramParsed.data.eventId))
      .returning();
    return event ? { kind: "updated" as const, event } : { kind: "missing" as const };
  });
  if (outcome.kind === "missing") { res.status(404).json({ error: "Not found" }); return; }
  if (outcome.kind === "invalid_window") {
    res.status(400).json({ error: "The event closing time must be after its opening time" });
    return;
  }
  if (outcome.kind === "locked") {
    res.status(409).json({
      error: "Schedule, capacity, visibility, and attendee location details cannot be changed after registrations or a pending payment exist. Cancel the event rather than rewriting information for existing attendees.",
    });
    return;
  }
  if (outcome.kind === "missing_ticket_types") {
    res.status(409).json({ error: "Add at least one ticket type before publishing this event" });
    return;
  }
  void invalidateDiscoverCache();
  res.json({ ...outcome.event, organizationName: null, organizationLogoUrl: null, attendeesCount: 0, ticketTypesCount: 0 });
});

// Delete event — must be org owner/admin
router.delete("/events/:eventId", requireAuth, requireResourceOrgRole(eventsTable, "eventId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const parsed = DeleteEventParams.safeParse({ eventId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const outcome = await db.transaction(async (tx) => {
    const [event] = await tx.select({ status: eventsTable.status })
      .from(eventsTable)
      .where(eq(eventsTable.id, parsed.data.eventId))
      .for("update");
    if (!event) return "not_found" as const;
    const [ticket] = await tx.select({ id: ticketsTable.id })
      .from(ticketsTable)
      .where(eq(ticketsTable.eventId, parsed.data.eventId))
      .limit(1);
    const [payment] = await tx.select({ id: paymentIntentsTable.id })
      .from(paymentIntentsTable)
      .where(and(
        eq(paymentIntentsTable.pillar, "event"),
        eq(paymentIntentsTable.entityId, parsed.data.eventId),
      ))
      .limit(1);
    if (event.status !== "draft" || ticket || payment) return "protected" as const;
    await tx.delete(eventsTable).where(eq(eventsTable.id, parsed.data.eventId));
    return "deleted" as const;
  });
  if (outcome === "not_found") { res.status(404).json({ error: "Not found" }); return; }
  if (outcome === "protected") {
    res.status(409).json({ error: "Only draft events with no attendees or payment history can be permanently deleted. Cancel a published event to preserve its records." });
    return;
  }
  void invalidateDiscoverCache();
  res.json({ message: "Deleted" });
});

// ── TICKET TYPES ───────────────────────────────────────────────────────────

router.get("/events/:eventId/ticket-types", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const parsed = ListTicketTypesParams.safeParse({ eventId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [event] = await db.select({ visibility: eventsTable.visibility, status: eventsTable.status, inviteCode: eventsTable.inviteCode, orgId: eventsTable.orgId })
    .from(eventsTable)
    .where(eq(eventsTable.id, parsed.data.eventId))
    .limit(1);
  const viewerRole = event && req.session?.userId ? await getOrgRole(event.orgId, req.session.userId) : null;
  if (!event || !canReadEventRequest(parsed.data.eventId, event, viewerRole, requestInviteCode(req.query), req.session.eventInviteVerifications)) {
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
  const normalizedCurrency = (currency ?? await getPlatformCurrency()).trim().toUpperCase();
  if (!await isPlatformCurrencySupported(normalizedCurrency)) {
    res.status(400).json({ error: `Currency ${normalizedCurrency} is not enabled for this platform` });
    return;
  }
  const [tt] = await db.insert(ticketTypesTable).values({
    eventId: paramParsed.data.eventId, name, description,
    price: String(price ?? 0), currency: normalizedCurrency,
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
  if (
    bodyParsed.data.currency !== undefined
    && !await isPlatformCurrencySupported(bodyParsed.data.currency.trim().toUpperCase())
  ) {
    res.status(400).json({ error: `Currency ${bodyParsed.data.currency.toUpperCase()} is not enabled for this platform` });
    return;
  }
  const updateData: any = { ...bodyParsed.data };
  if (updateData.price !== undefined) updateData.price = String(updateData.price);
  if (updateData.currency !== undefined) updateData.currency = updateData.currency.trim().toUpperCase();
  const outcome = await db.transaction(async (tx) => {
    const [event] = await tx.select({ id: eventsTable.id })
      .from(eventsTable)
      .where(eq(eventsTable.id, paramParsed.data.eventId))
      .for("update");
    if (!event) return { kind: "not_found" as const };
    const [current] = await tx.select({ sold: ticketTypesTable.sold })
      .from(ticketTypesTable)
      .where(and(
        eq(ticketTypesTable.id, paramParsed.data.ticketTypeId),
        eq(ticketTypesTable.eventId, paramParsed.data.eventId),
      ))
      .for("update");
    if (!current) return { kind: "not_found" as const };

    const [pendingPayment] = await tx.select({ id: paymentIntentsTable.id })
      .from(paymentIntentsTable)
      .where(and(
        eq(paymentIntentsTable.pillar, "event"),
        eq(paymentIntentsTable.entityId, paramParsed.data.eventId),
        sql`${paymentIntentsTable.payload}->'event'->>'ticketTypeId' = ${String(paramParsed.data.ticketTypeId)}`,
        sql`${paymentIntentsTable.status} IN ('initializing', 'pending', 'processing')`,
      ))
      .limit(1);
    const changingPrice = bodyParsed.data.price !== undefined || bodyParsed.data.currency !== undefined;
    if (changingPrice && (current.sold > 0 || pendingPayment)) return { kind: "locked" as const };
    if (
      bodyParsed.data.quantity !== undefined
      && bodyParsed.data.quantity !== null
      && bodyParsed.data.quantity < current.sold
    ) {
      return { kind: "quantity" as const };
    }
    const [ticketType] = await tx.update(ticketTypesTable)
      .set(updateData)
      .where(and(
        eq(ticketTypesTable.id, paramParsed.data.ticketTypeId),
        eq(ticketTypesTable.eventId, paramParsed.data.eventId),
      ))
      .returning();
    return ticketType ? { kind: "updated" as const, ticketType } : { kind: "not_found" as const };
  });
  if (outcome.kind === "not_found") { res.status(404).json({ error: "Not found" }); return; }
  if (outcome.kind === "locked") {
    res.status(409).json({ error: "A ticket price or currency cannot change after tickets have sold or a payment is in progress." });
    return;
  }
  if (outcome.kind === "quantity") {
    res.status(409).json({ error: "Ticket quantity cannot be set below the number already reserved or sold." });
    return;
  }
  res.json({ ...outcome.ticketType, price: parseFloat(outcome.ticketType.price) });
});

router.delete("/events/:eventId/ticket-types/:ticketTypeId", requireAuth, requireResourceOrgRole(eventsTable, "eventId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawTtId = Array.isArray(req.params.ticketTypeId) ? req.params.ticketTypeId[0] : req.params.ticketTypeId;
  const rawEvId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const parsed = DeleteTicketTypeParams.safeParse({ eventId: parseInt(rawEvId, 10), ticketTypeId: parseInt(rawTtId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const outcome = await db.transaction(async (tx) => {
    const [event] = await tx.select({ id: eventsTable.id })
      .from(eventsTable)
      .where(eq(eventsTable.id, parsed.data.eventId))
      .for("update");
    if (!event) return "not_found" as const;
    const [ticketType] = await tx.select({ sold: ticketTypesTable.sold })
      .from(ticketTypesTable)
      .where(and(
        eq(ticketTypesTable.id, parsed.data.ticketTypeId),
        eq(ticketTypesTable.eventId, parsed.data.eventId),
      ))
      .for("update");
    if (!ticketType) return "not_found" as const;
    const [ticket] = await tx.select({ id: ticketsTable.id })
      .from(ticketsTable)
      .where(eq(ticketsTable.ticketTypeId, parsed.data.ticketTypeId))
      .limit(1);
    const [pendingPayment] = await tx.select({ id: paymentIntentsTable.id })
      .from(paymentIntentsTable)
      .where(and(
        eq(paymentIntentsTable.pillar, "event"),
        eq(paymentIntentsTable.entityId, parsed.data.eventId),
        sql`${paymentIntentsTable.payload}->'event'->>'ticketTypeId' = ${String(parsed.data.ticketTypeId)}`,
        sql`${paymentIntentsTable.status} IN ('initializing', 'pending', 'processing')`,
      ))
      .limit(1);
    if (ticketType.sold > 0 || ticket || pendingPayment) return "protected" as const;
    await tx.delete(ticketTypesTable).where(and(
      eq(ticketTypesTable.id, parsed.data.ticketTypeId),
      eq(ticketTypesTable.eventId, parsed.data.eventId),
    ));
    return "deleted" as const;
  });
  if (outcome === "not_found") { res.status(404).json({ error: "Not found" }); return; }
  if (outcome === "protected") {
    res.status(409).json({ error: "This ticket type has attendee, reservation, or payment history and cannot be permanently deleted." });
    return;
  }
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
  const viewerRole = req.session?.userId ? await getOrgRole(event.orgId, req.session.userId) : null;
  if (event.visibility === "private" && !viewerRole) {
    res.status(403).json({ error: "This event is private and is not open to public registration" });
    return;
  }

  // ── Lifecycle enforcement ─────────────────────────────────────────────
  // startsAt is the event's scheduled start. Ticket sale windows determine
  // when registration opens; endsAt remains the hard registration cutoff.
  const now = new Date();
  const registrationBlock = getEventRegistrationBlockReason(event.status, event.endsAt, now);
  if (registrationBlock === "unavailable") {
    const reason =
      event.status === "cancelled" ? "This event has been cancelled" :
      event.status === "completed" ? "This event has already concluded" :
      "This event is not currently open for registration";
    res.status(403).json({ error: reason });
    return;
  }
  if (registrationBlock === "closed") {
    res.status(403).json({ error: "Registration for this event has closed" });
    return;
  }

  // ── Invite code check ─────────────────────────────────────────────────
  if (event.visibility === "invite_only") {
    if (inviteCode !== event.inviteCode && !hasEventInviteVerification(req.session.eventInviteVerifications, paramParsed.data.eventId)) {
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

  // ── Atomic sold-count check and ticket issuance/reservation ───────────
  // Paid tickets reserve inventory now and are issued only after FlowPay
  // confirms payment through the webhook.
  const ticketCode = uuidv4().replace(/-/g, "").substring(0, 12).toUpperCase();

  try {
    const paymentOrTicket = await db.transaction(async (tx) => {
      // Lock the ticket type row to prevent concurrent oversells
      const [lockedEvent] = (await tx.execute(
        sql`SELECT id, status, ends_at, capacity FROM events WHERE id = ${paramParsed.data.eventId} FOR UPDATE`
      )).rows as any[];
      if (!lockedEvent) {
        throw Object.assign(new Error("Event not found"), { code: "EVENT_NOT_FOUND" });
      }
      const lockedRegistrationBlock = getEventRegistrationBlockReason(lockedEvent.status, lockedEvent.ends_at);
      if (lockedRegistrationBlock === "unavailable") {
        throw Object.assign(new Error("Event unavailable"), { code: "EVENT_UNAVAILABLE" });
      }
      if (lockedRegistrationBlock === "closed") {
        throw Object.assign(new Error("Registration closed"), { code: "REGISTRATION_CLOSED" });
      }
      if (lockedEvent.capacity !== null) {
        const capacityResult = await tx.execute(
          sql`
            SELECT (
              (SELECT COUNT(*) FROM tickets WHERE event_id = ${paramParsed.data.eventId} AND status <> 'cancelled') +
              (SELECT COUNT(*) FROM payment_intents
               WHERE pillar = 'event'
                 AND entity_id = ${paramParsed.data.eventId}
                 AND status IN ('initializing', 'pending', 'processing'))
            )::int AS count
          `
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
      const isPaid = Number(lockedTt.price) > 0;
      let normalizedCustomerPhone: string | null = null;
      if (isPaid) {
        if (!bodyParsed.data.customerPhone?.trim()) {
          throw Object.assign(new Error("A customer phone number is required"), { code: "CUSTOMER_PHONE_REQUIRED" });
        }
        normalizedCustomerPhone = normalizeCameroonPhone(bodyParsed.data.customerPhone);
        if (!normalizedCustomerPhone) {
          throw Object.assign(new Error("Please enter a valid phone number"), { code: "INVALID_CUSTOMER_PHONE" });
        }
      }
      if (lockedTt.quantity !== null && lockedTt.sold >= lockedTt.quantity) {
        throw Object.assign(new Error("Sold out"), { code: "SOLD_OUT" });
      }

      await tx.execute(sql`UPDATE ticket_types SET sold = sold + 1 WHERE id = ${ticketTypeId}`);

      if (isPaid) {
        const { intent } = await createPaymentIntent({
          orgId: event.orgId,
          pillar: "event",
          entityId: event.id,
          entityTitle: event.title,
          transactionType: "ticket",
          amount: Number(lockedTt.price),
          currency: lockedTt.currency || "XAF",
          customerName: attendeeName,
          customerEmail: attendeeEmail,
          customerPhone: normalizedCustomerPhone!,
          payload: { event: { ticketTypeId, attendeeName, attendeeEmail, ticketCode } },
          database: tx,
        });
        return { paymentIntent: intent };
      }

      const [inserted] = await tx.insert(ticketsTable).values({
        eventId: paramParsed.data.eventId, ticketTypeId, attendeeName, attendeeEmail,
        ticketCode, status: "valid", paymentStatus: "not_required",
      }).returning();
      return { ticket: inserted };
    });

    if (paymentOrTicket.paymentIntent) {
      try {
        const intent = await initializePaymentIntent(paymentOrTicket.paymentIntent);
        res.status(201).json({
          paymentRequired: true,
          paymentId: intent.id,
          paymentStatus: intent.paymentStatus,
          statusToken: intent.statusToken,
          checkoutUrl: intent.checkoutUrl,
        });
      } catch (error: any) {
        await failPaymentIntent(paymentOrTicket.paymentIntent.id, error?.message || "Payment initialization failed");
        await db.execute(sql`UPDATE ticket_types SET sold = GREATEST(sold - 1, 0) WHERE id = ${ticketTypeId}`);
        res.status(502).json({ error: "Unable to start the payment. Please try again." });
      }
      return;
    }

    const ticket = paymentOrTicket.ticket;
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
    if (err?.code === "CUSTOMER_PHONE_REQUIRED") {
      res.status(400).json({ error: "A customer phone number is required for paid event registration" });
      return;
    }
    if (err?.code === "INVALID_CUSTOMER_PHONE") {
      res.status(400).json({ error: "Please enter a valid phone number (e.g. +237 6XXXXXXXX or 6XXXXXXXX)" });
      return;
    }
    if (err?.code === "EVENT_UNAVAILABLE" || err?.code === "REGISTRATION_CLOSED") {
      res.status(403).json({ error: err.code === "REGISTRATION_CLOSED" ? "Registration for this event has closed" : "This event is not currently open for registration" });
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
    .where(eq(ticketsTable.eventId, parsed.data.eventId))
    .orderBy(desc(ticketsTable.issuedAt))
    .limit(MAX_EVENT_ATTENDEE_RESULTS);
  res.setHeader("X-Result-Limit", String(MAX_EVENT_ATTENDEE_RESULTS));
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
