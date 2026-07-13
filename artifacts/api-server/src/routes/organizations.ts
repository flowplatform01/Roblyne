import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, organizationsTable, electionsTable, eventsTable, campaignsTable } from "@workspace/db";
import { CreateOrganizationBody, UpdateOrganizationBody, GetOrganizationParams, UpdateOrganizationParams, GetOrganizationStatsParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

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

export default router;
