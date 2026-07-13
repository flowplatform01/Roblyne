import { Router, type IRouter } from "express";
import { eq, sql, or, ilike } from "drizzle-orm";
import { db, electionsTable, eventsTable, campaignsTable, organizationsTable, votesTable, ticketsTable, campaignResponsesTable } from "@workspace/db";
import { DiscoverQueryParams, SearchQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

async function toDiscoveryItem(type: "election" | "event" | "campaign", row: any, orgName: string | null, participantsCount: number) {
  return {
    id: row.id,
    type,
    title: row.title,
    description: row.description ?? null,
    coverImageUrl: row.coverImageUrl ?? null,
    organizationName: orgName ?? "",
    status: row.status,
    startsAt: row.startsAt ?? null,
    endsAt: row.endsAt ?? null,
    participantsCount,
    createdAt: row.createdAt,
  };
}

router.get("/discover", async (req, res): Promise<void> => {
  const queryParsed = DiscoverQueryParams.safeParse(req.query);
  const typeFilter = queryParsed.success ? queryParsed.data.type : "all";
  const limit = queryParsed.success ? (queryParsed.data.limit ?? 24) : 24;
  const sort = queryParsed.success ? (queryParsed.data.sort ?? "newest") : "newest";

  const items: any[] = [];

  if (!typeFilter || typeFilter === "all" || typeFilter === "elections") {
    const elections = await db.select({ e: electionsTable, orgName: organizationsTable.name })
      .from(electionsTable).leftJoin(organizationsTable, eq(electionsTable.orgId, organizationsTable.id))
      .where(eq(electionsTable.visibility, "public")).limit(limit);
    for (const { e, orgName } of elections) {
      const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(votesTable).where(eq(votesTable.electionId, e.id));
      items.push(await toDiscoveryItem("election", e, orgName ?? null, count ?? 0));
    }
  }

  if (!typeFilter || typeFilter === "all" || typeFilter === "events") {
    const events = await db.select({ e: eventsTable, orgName: organizationsTable.name })
      .from(eventsTable).leftJoin(organizationsTable, eq(eventsTable.orgId, organizationsTable.id))
      .where(eq(eventsTable.visibility, "public")).limit(limit);
    for (const { e, orgName } of events) {
      const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(ticketsTable).where(eq(ticketsTable.eventId, e.id));
      items.push(await toDiscoveryItem("event", e, orgName ?? null, count ?? 0));
    }
  }

  if (!typeFilter || typeFilter === "all" || typeFilter === "campaigns") {
    const campaigns = await db.select({ c: campaignsTable, orgName: organizationsTable.name })
      .from(campaignsTable).leftJoin(organizationsTable, eq(campaignsTable.orgId, organizationsTable.id))
      .where(eq(campaignsTable.visibility, "public")).limit(limit);
    for (const { c, orgName } of campaigns) {
      const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(campaignResponsesTable).where(eq(campaignResponsesTable.campaignId, c.id));
      items.push(await toDiscoveryItem("campaign", c as any, orgName ?? null, count ?? 0));
    }
  }

  if (sort === "trending" || sort === "popular") {
    // "Trending" weighs recency alongside participation; "popular" is pure participant count.
    items.sort((a, b) => {
      if (sort === "popular") return b.participantsCount - a.participantsCount;
      const score = (i: typeof a) => {
        const ageHours = Math.max(1, (Date.now() - new Date(i.createdAt).getTime()) / 3_600_000);
        return i.participantsCount / Math.pow(ageHours, 0.5);
      };
      return score(b) - score(a);
    });
  } else {
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const featured = items.filter(i => i.status === "active" || i.status === "published").slice(0, 4);
  const trending = [...items].sort((a, b) => b.participantsCount - a.participantsCount).slice(0, 4);

  res.json({ items: items.slice(0, limit), featured, trending });
});

router.get("/search", async (req, res): Promise<void> => {
  const queryParsed = SearchQueryParams.safeParse(req.query);
  if (!queryParsed.success || !queryParsed.data.q) {
    res.status(400).json({ error: "Query parameter 'q' is required" });
    return;
  }
  const { q, type: typeFilter } = queryParsed.data;
  const pattern = `%${q}%`;
  const items: any[] = [];

  if (!typeFilter || typeFilter === "all" || typeFilter === "elections") {
    const elections = await db.select({ e: electionsTable, orgName: organizationsTable.name })
      .from(electionsTable).leftJoin(organizationsTable, eq(electionsTable.orgId, organizationsTable.id))
      .where(or(ilike(electionsTable.title, pattern), ilike(electionsTable.description ?? sql`''`, pattern)));
    for (const { e, orgName } of elections) {
      const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(votesTable).where(eq(votesTable.electionId, e.id));
      items.push(await toDiscoveryItem("election", e, orgName ?? null, count ?? 0));
    }
  }

  if (!typeFilter || typeFilter === "all" || typeFilter === "events") {
    const events = await db.select({ e: eventsTable, orgName: organizationsTable.name })
      .from(eventsTable).leftJoin(organizationsTable, eq(eventsTable.orgId, organizationsTable.id))
      .where(or(ilike(eventsTable.title, pattern), ilike(eventsTable.description ?? sql`''`, pattern)));
    for (const { e, orgName } of events) {
      const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(ticketsTable).where(eq(ticketsTable.eventId, e.id));
      items.push(await toDiscoveryItem("event", e, orgName ?? null, count ?? 0));
    }
  }

  if (!typeFilter || typeFilter === "all" || typeFilter === "campaigns") {
    const campaigns = await db.select({ c: campaignsTable, orgName: organizationsTable.name })
      .from(campaignsTable).leftJoin(organizationsTable, eq(campaignsTable.orgId, organizationsTable.id))
      .where(or(ilike(campaignsTable.title, pattern), ilike(campaignsTable.description ?? sql`''`, pattern)));
    for (const { c, orgName } of campaigns) {
      const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(campaignResponsesTable).where(eq(campaignResponsesTable.campaignId, c.id));
      items.push(await toDiscoveryItem("campaign", c as any, orgName ?? null, count ?? 0));
    }
  }

  res.json({ query: q, total: items.length, items });
});

export default router;
