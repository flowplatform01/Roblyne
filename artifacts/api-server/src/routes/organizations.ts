import { Router, type IRouter } from "express";
import { eq, sql, and } from "drizzle-orm";
import { db, organizationsTable, electionsTable, eventsTable, campaignsTable, organizationMembersTable, usersTable } from "@workspace/db";
import {
  CreateOrganizationBody, UpdateOrganizationBody, GetOrganizationParams, UpdateOrganizationParams, GetOrganizationStatsParams,
  AddOrganizationMemberParams, AddOrganizationMemberBody,
  UpdateOrganizationMemberParams, UpdateOrganizationMemberBody,
  RemoveOrganizationMemberParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { requireOrgRole } from "../middlewares/orgAccess";

const router: IRouter = Router();

async function memberRow(member: typeof organizationMembersTable.$inferSelect) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, member.userId)).limit(1);
  return { ...member, email: user?.email ?? null, name: user?.name ?? null };
}

// List organizations for current user
router.get("/organizations", requireAuth, async (req, res): Promise<void> => {
  const orgs = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.ownerId, req.session.userId!));
  res.json(orgs);
});

// Create organization
router.post("/organizations", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateOrganizationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { name, description, logoUrl, website } = parsed.data;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now();
  const [org] = await db.insert(organizationsTable).values({
    name,
    slug,
    description,
    logoUrl,
    website,
    ownerId: req.session.userId!,
  }).returning();
  res.status(201).json(org);
});

// Get organization
router.get("/organizations/:orgId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const parsed = GetOrganizationParams.safeParse({ orgId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, parsed.data.orgId)).limit(1);
  if (!org) { res.status(404).json({ error: "Not found" }); return; }
  res.json(org);
});

// Get public organization profile (with stats and recent activity)
router.get("/organizations/:orgId/public", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const parsed = GetOrganizationParams.safeParse({ orgId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const orgId = parsed.data.orgId;

  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1);
  if (!org) { res.status(404).json({ error: "Not found" }); return; }

  const [electionsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(electionsTable).where(eq(electionsTable.orgId, orgId));
  const [eventsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(eventsTable).where(eq(eventsTable.orgId, orgId));
  const [campaignsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(campaignsTable).where(eq(campaignsTable.orgId, orgId));
  const [activeElections] = await db.select({ count: sql<number>`count(*)::int` }).from(electionsTable).where(sql`${electionsTable.orgId} = ${orgId} AND ${electionsTable.status} = 'active'`);
  const [upcomingEvents] = await db.select({ count: sql<number>`count(*)::int` }).from(eventsTable).where(sql`${eventsTable.orgId} = ${orgId} AND ${eventsTable.status} = 'published'`);
  const [activeCampaigns] = await db.select({ count: sql<number>`count(*)::int` }).from(campaignsTable).where(sql`${campaignsTable.orgId} = ${orgId} AND ${campaignsTable.status} = 'active'`);

  const recentElections = await db.select().from(electionsTable)
    .where(sql`${electionsTable.orgId} = ${orgId} AND ${electionsTable.visibility} = 'public'`)
    .orderBy(sql`${electionsTable.createdAt} DESC`).limit(3);
  const recentEvents = await db.select().from(eventsTable)
    .where(sql`${eventsTable.orgId} = ${orgId} AND ${eventsTable.visibility} = 'public'`)
    .orderBy(sql`${eventsTable.createdAt} DESC`).limit(3);
  const recentCampaigns = await db.select().from(campaignsTable)
    .where(sql`${campaignsTable.orgId} = ${orgId} AND ${campaignsTable.visibility} = 'public'`)
    .orderBy(sql`${campaignsTable.createdAt} DESC`).limit(3);

  // Flatten stats at top level so frontend can read them directly (e.g. org.electionsCount)
  res.json({
    ...org,
    electionsCount: electionsCount?.count ?? 0,
    eventsCount: eventsCount?.count ?? 0,
    campaignsCount: campaignsCount?.count ?? 0,
    totalParticipants: 0,
    activeElectionsCount: activeElections?.count ?? 0,
    upcomingEventsCount: upcomingEvents?.count ?? 0,
    activeCampaignsCount: activeCampaigns?.count ?? 0,
    recentElections: recentElections.map(e => ({ ...e, organizationName: org.name, organizationLogoUrl: org.logoUrl, positionsCount: 0, candidatesCount: 0, totalVotes: 0 })),
    recentEvents: recentEvents.map(e => ({ ...e, organizationName: org.name, organizationLogoUrl: org.logoUrl, attendeesCount: 0, ticketTypesCount: 0 })),
    recentCampaigns: recentCampaigns.map(c => ({ ...c, organizationName: org.name, organizationLogoUrl: org.logoUrl, submissionsCount: 0, currentAmount: c.currentAmount ?? "0" })),
  });
});

// Update organization
router.patch("/organizations/:orgId", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const paramParsed = UpdateOrganizationParams.safeParse({ orgId: parseInt(rawId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }

  const bodyParsed = UpdateOrganizationBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }

  const [org] = await db.update(organizationsTable)
    .set(bodyParsed.data)
    .where(eq(organizationsTable.id, paramParsed.data.orgId))
    .returning();
  if (!org) { res.status(404).json({ error: "Not found" }); return; }
  res.json(org);
});

// Get organization stats
router.get("/organizations/:orgId/stats", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const parsed = GetOrganizationStatsParams.safeParse({ orgId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const orgId = parsed.data.orgId;

  const [electionsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(electionsTable).where(eq(electionsTable.orgId, orgId));
  const [eventsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(eventsTable).where(eq(eventsTable.orgId, orgId));
  const [campaignsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(campaignsTable).where(eq(campaignsTable.orgId, orgId));
  const [activeElections] = await db.select({ count: sql<number>`count(*)::int` }).from(electionsTable).where(sql`${electionsTable.orgId} = ${orgId} AND ${electionsTable.status} = 'active'`);
  const [upcomingEvents] = await db.select({ count: sql<number>`count(*)::int` }).from(eventsTable).where(sql`${eventsTable.orgId} = ${orgId} AND ${eventsTable.status} = 'published'`);
  const [activeCampaigns] = await db.select({ count: sql<number>`count(*)::int` }).from(campaignsTable).where(sql`${campaignsTable.orgId} = ${orgId} AND ${campaignsTable.status} = 'active'`);

  res.json({
    electionsCount: electionsCount?.count ?? 0,
    eventsCount: eventsCount?.count ?? 0,
    campaignsCount: campaignsCount?.count ?? 0,
    totalParticipants: 0,
    activeElectionsCount: activeElections?.count ?? 0,
    upcomingEventsCount: upcomingEvents?.count ?? 0,
    activeCampaignsCount: activeCampaigns?.count ?? 0,
  });
});

// ── MEMBERS ────────────────────────────────────────────────────────────────

router.get("/organizations/:orgId/members", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const paramParsed = AddOrganizationMemberParams.pick({ orgId: true }).safeParse({ orgId: parseInt(rawId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const orgId = paramParsed.data.orgId;

  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1);
  if (!org) { res.status(404).json({ error: "Not found" }); return; }
  const [owner] = await db.select().from(usersTable).where(eq(usersTable.id, org.ownerId)).limit(1);

  const members = await db.select().from(organizationMembersTable).where(eq(organizationMembersTable.orgId, orgId));
  const memberRows = await Promise.all(members.map(memberRow));

  res.json([
    { id: 0, orgId, userId: org.ownerId, email: owner?.email ?? null, name: owner?.name ?? null, role: "owner", invitedAt: org.createdAt },
    ...memberRows,
  ]);
});

router.post("/organizations/:orgId/members", requireAuth, requireOrgRole(["owner", "admin"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const paramParsed = AddOrganizationMemberParams.safeParse({ orgId: parseInt(rawId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = AddOrganizationMemberBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const orgId = paramParsed.data.orgId;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, bodyParsed.data.email)).limit(1);
  if (!user) { res.status(404).json({ error: "No user found with that email" }); return; }

  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1);
  if (org?.ownerId === user.id) { res.status(409).json({ error: "User already owns this organization" }); return; }

  const existing = await db.select().from(organizationMembersTable)
    .where(and(eq(organizationMembersTable.orgId, orgId), eq(organizationMembersTable.userId, user.id))).limit(1);
  if (existing.length > 0) { res.status(409).json({ error: "Already a member" }); return; }

  const [member] = await db.insert(organizationMembersTable).values({
    orgId, userId: user.id, role: bodyParsed.data.role ?? "member",
  }).returning();
  res.status(201).json(await memberRow(member));
});

router.patch("/organizations/:orgId/members/:memberId", requireAuth, requireOrgRole(["owner", "admin"]), async (req, res): Promise<void> => {
  const rawOrgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const rawMemberId = Array.isArray(req.params.memberId) ? req.params.memberId[0] : req.params.memberId;
  const paramParsed = UpdateOrganizationMemberParams.safeParse({ orgId: parseInt(rawOrgId, 10), memberId: parseInt(rawMemberId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = UpdateOrganizationMemberBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }

  const [member] = await db.update(organizationMembersTable).set({ role: bodyParsed.data.role })
    .where(and(eq(organizationMembersTable.id, paramParsed.data.memberId), eq(organizationMembersTable.orgId, paramParsed.data.orgId)))
    .returning();
  if (!member) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await memberRow(member));
});

router.delete("/organizations/:orgId/members/:memberId", requireAuth, requireOrgRole(["owner", "admin"]), async (req, res): Promise<void> => {
  const rawOrgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const rawMemberId = Array.isArray(req.params.memberId) ? req.params.memberId[0] : req.params.memberId;
  const parsed = RemoveOrganizationMemberParams.safeParse({ orgId: parseInt(rawOrgId, 10), memberId: parseInt(rawMemberId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(organizationMembersTable)
    .where(and(eq(organizationMembersTable.id, parsed.data.memberId), eq(organizationMembersTable.orgId, parsed.data.orgId)));
  res.json({ message: "Removed" });
});

export default router;
