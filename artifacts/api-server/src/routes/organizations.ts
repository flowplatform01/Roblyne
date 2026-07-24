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
import { requireOrgRole, getOrgRole } from "../middlewares/orgAccess";

const router: IRouter = Router();

// List organizations for current user — includes owned + member orgs
router.get("/organizations", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  // Single query: orgs owned OR where user is an explicit member.
  // Use explicit camelCase aliases so the response matches the TypeScript Organization type.
  const orgs = await db.execute(sql`
    SELECT DISTINCT
      o.id,
      o.name,
      o.slug,
      o.description,
      o.logo_url            AS "logoUrl",
      o.cover_image_url     AS "coverImageUrl",
      o.hero_image_url      AS "heroImageUrl",
      o.website,
      o.accent_color        AS "accentColor",
      o.theme,
      o.owner_id            AS "ownerId",
      o.created_at          AS "createdAt"
    FROM organizations o
    LEFT JOIN organization_members om ON om.org_id = o.id AND om.user_id = ${userId}
    WHERE o.owner_id = ${userId} OR om.user_id IS NOT NULL
    ORDER BY o.created_at DESC
  `);
  res.json(orgs.rows);
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

// Get organization — any auth'd user (needed for workspace access)
router.get("/organizations/:orgId", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const parsed = GetOrganizationParams.safeParse({ orgId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [[org], role] = await Promise.all([
    db.select().from(organizationsTable).where(eq(organizationsTable.id, parsed.data.orgId)).limit(1),
    getOrgRole(parsed.data.orgId, req.session.userId!),
  ]);

  if (!org) { res.status(404).json({ error: "Not found" }); return; }
  if (!role) { res.status(403).json({ error: "Access denied" }); return; }
  res.json(org);
});

// Get public organization profile — public, no auth required
router.get("/organizations/:orgId/public", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const parsed = GetOrganizationParams.safeParse({ orgId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const orgId = parsed.data.orgId;

  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1);
  if (!org) { res.status(404).json({ error: "Not found" }); return; }

  // Run all count queries and recent activity queries in parallel
  const [
    countsResult,
    recentElections,
    recentEvents,
    recentCampaigns,
  ] = await Promise.all([
    db.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM elections WHERE org_id = ${orgId} AND visibility = 'public')       AS elections_count,
        (SELECT COUNT(*)::int FROM events    WHERE org_id = ${orgId} AND visibility = 'public')       AS events_count,
        (SELECT COUNT(*)::int FROM campaigns WHERE org_id = ${orgId} AND visibility = 'public')       AS campaigns_count,
        (SELECT COUNT(*)::int FROM elections WHERE org_id = ${orgId} AND status = 'active'    AND visibility = 'public') AS active_elections,
        (SELECT COUNT(*)::int FROM events    WHERE org_id = ${orgId} AND status = 'published' AND visibility = 'public') AS upcoming_events,
        (SELECT COUNT(*)::int FROM campaigns WHERE org_id = ${orgId} AND status = 'active'    AND visibility = 'public') AS active_campaigns
    `),
    db.select().from(electionsTable)
      .where(sql`${electionsTable.orgId} = ${orgId} AND ${electionsTable.visibility} = 'public'`)
      .orderBy(sql`${electionsTable.createdAt} DESC`).limit(3),
    db.select().from(eventsTable)
      .where(sql`${eventsTable.orgId} = ${orgId} AND ${eventsTable.visibility} = 'public'`)
      .orderBy(sql`${eventsTable.createdAt} DESC`).limit(3),
    db.select().from(campaignsTable)
      .where(sql`${campaignsTable.orgId} = ${orgId} AND ${campaignsTable.visibility} = 'public'`)
      .orderBy(sql`${campaignsTable.createdAt} DESC`).limit(3),
  ]);

  const counts = countsResult.rows[0] as any;

  res.json({
    ...org,
    electionsCount: counts?.elections_count ?? 0,
    eventsCount: counts?.events_count ?? 0,
    campaignsCount: counts?.campaigns_count ?? 0,
    totalParticipants: 0,
    activeElectionsCount: counts?.active_elections ?? 0,
    upcomingEventsCount: counts?.upcoming_events ?? 0,
    activeCampaignsCount: counts?.active_campaigns ?? 0,
    recentElections: recentElections.map(e => ({ ...e, organizationName: org.name, organizationLogoUrl: org.logoUrl, positionsCount: 0, candidatesCount: 0, totalVotes: 0 })),
    recentEvents: recentEvents.map(e => ({ ...e, organizationName: org.name, organizationLogoUrl: org.logoUrl, attendeesCount: 0, ticketTypesCount: 0 })),
    recentCampaigns: recentCampaigns.map(c => ({ ...c, organizationName: org.name, organizationLogoUrl: org.logoUrl, submissionsCount: 0, currentAmount: c.currentAmount ?? "0" })),
  });
});

// Update organization — must be owner or admin of that org
router.patch("/organizations/:orgId", requireAuth, requireOrgRole(["owner", "admin"]), async (req, res): Promise<void> => {
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

// Get organization stats — must be org member
router.get("/organizations/:orgId/stats", requireAuth, requireOrgRole(["owner", "admin", "member"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const parsed = GetOrganizationStatsParams.safeParse({ orgId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const orgId = parsed.data.orgId;

  // Single query for all counts
  const result = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM elections WHERE org_id = ${orgId})                                AS elections_count,
      (SELECT COUNT(*)::int FROM events    WHERE org_id = ${orgId})                                AS events_count,
      (SELECT COUNT(*)::int FROM campaigns WHERE org_id = ${orgId})                                AS campaigns_count,
      (SELECT COUNT(*)::int FROM elections WHERE org_id = ${orgId} AND status = 'active')          AS active_elections,
      (SELECT COUNT(*)::int FROM events    WHERE org_id = ${orgId} AND status = 'published')       AS upcoming_events,
      (SELECT COUNT(*)::int FROM campaigns WHERE org_id = ${orgId} AND status = 'active')          AS active_campaigns
  `);

  const counts = result.rows[0] as any;
  res.json({
    electionsCount: counts?.elections_count ?? 0,
    eventsCount: counts?.events_count ?? 0,
    campaignsCount: counts?.campaigns_count ?? 0,
    totalParticipants: 0,
    activeElectionsCount: counts?.active_elections ?? 0,
    upcomingEventsCount: counts?.upcoming_events ?? 0,
    activeCampaignsCount: counts?.active_campaigns ?? 0,
  });
});

// ── MEMBERS ────────────────────────────────────────────────────────────────

// Members list — JOIN to avoid N+1 user lookups
router.get("/organizations/:orgId/members", requireAuth, requireOrgRole(["owner", "admin", "member"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const paramParsed = AddOrganizationMemberParams.pick({ orgId: true }).safeParse({ orgId: parseInt(rawId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const orgId = paramParsed.data.orgId;

  // Fetch org + owner in parallel, members with a JOIN
  const [[org], memberRows] = await Promise.all([
    db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1),
    db
      .select({
        id: organizationMembersTable.id,
        orgId: organizationMembersTable.orgId,
        userId: organizationMembersTable.userId,
        role: organizationMembersTable.role,
        invitedAt: organizationMembersTable.invitedAt,
        email: usersTable.email,
        name: usersTable.name,
      })
      .from(organizationMembersTable)
      .leftJoin(usersTable, eq(organizationMembersTable.userId, usersTable.id))
      .where(eq(organizationMembersTable.orgId, orgId)),
  ]);

  if (!org) { res.status(404).json({ error: "Not found" }); return; }

  const [owner] = await db.select({ email: usersTable.email, name: usersTable.name })
    .from(usersTable).where(eq(usersTable.id, org.ownerId)).limit(1);

  res.json([
    { id: 0, orgId, userId: org.ownerId, email: owner?.email ?? null, name: owner?.name ?? null, role: "owner", invitedAt: org.createdAt },
    ...memberRows.map(m => ({ ...m, email: m.email ?? null, name: m.name ?? null })),
  ]);
});

router.post("/organizations/:orgId/members", requireAuth, requireOrgRole(["owner", "admin"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
  const paramParsed = AddOrganizationMemberParams.safeParse({ orgId: parseInt(rawId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = AddOrganizationMemberBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const orgId = paramParsed.data.orgId;

  // Fetch user + org in parallel
  const [[user], [org]] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.email, bodyParsed.data.email)).limit(1),
    db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1),
  ]);

  if (!user) { res.status(404).json({ error: "No user found with that email" }); return; }
  if (org?.ownerId === user.id) { res.status(409).json({ error: "User already owns this organization" }); return; }

  const existing = await db.select().from(organizationMembersTable)
    .where(and(eq(organizationMembersTable.orgId, orgId), eq(organizationMembersTable.userId, user.id))).limit(1);
  if (existing.length > 0) { res.status(409).json({ error: "Already a member" }); return; }

  const [member] = await db.insert(organizationMembersTable).values({
    orgId, userId: user.id, role: bodyParsed.data.role ?? "member",
  }).returning();

  res.status(201).json({ ...member, email: user.email ?? null, name: user.name ?? null });
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

  const [user] = await db.select({ email: usersTable.email, name: usersTable.name })
    .from(usersTable).where(eq(usersTable.id, member.userId)).limit(1);
  res.json({ ...member, email: user?.email ?? null, name: user?.name ?? null });
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
