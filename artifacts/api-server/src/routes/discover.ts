import { Router, type IRouter } from "express";
import { eq, sql, or, ilike, and } from "drizzle-orm";
import { db, electionsTable, eventsTable, campaignsTable, organizationsTable } from "@workspace/db";
import { DiscoverQueryParams, SearchQueryParams } from "@workspace/api-zod";
import { getJson, setJson } from "../lib/redis";

const router: IRouter = Router();

// ── DISCOVER ────────────────────────────────────────────────────────────────

router.get("/discover", async (req, res): Promise<void> => {
  const queryParsed = DiscoverQueryParams.safeParse(req.query);
  const typeFilter = queryParsed.success ? queryParsed.data.type : "all";
  const limit = queryParsed.success ? (queryParsed.data.limit ?? 24) : 24;
  const sort = queryParsed.success ? (queryParsed.data.sort ?? "newest") : "newest";
  const cacheKey = `evenum:discover:v1:${typeFilter}:${limit}:${sort}`;
  const cached = await getJson<{ items: any[]; featured: any[]; trending: any[] }>(cacheKey);
  if (cached) {
    res.setHeader("X-Cache", "HIT");
    res.json(cached);
    return;
  }

  // Fetch all three pillars in parallel using a single aggregated query each.
  // Participant counts come from a correlated subquery, avoiding N+1 loops.
  const [elections, events, campaigns] = await Promise.all([
    (!typeFilter || typeFilter === "all" || typeFilter === "elections")
      ? db.execute(sql`
          SELECT
            e.id, e.title, e.description, e.cover_image_url AS "coverImageUrl",
            e.status, e.starts_at AS "startsAt", e.ends_at AS "endsAt", e.created_at AS "createdAt",
            o.name AS "organizationName",
            (SELECT COUNT(*)::int FROM vote_selections vs
             INNER JOIN votes v ON v.id = vs.vote_id
             WHERE v.election_id = e.id) AS "participantsCount"
          FROM elections e
          LEFT JOIN organizations o ON o.id = e.org_id
           WHERE e.visibility = 'public'
             AND e.status <> 'draft'
          ORDER BY e.created_at DESC
          LIMIT ${limit}
        `)
      : { rows: [] },

    (!typeFilter || typeFilter === "all" || typeFilter === "events")
      ? db.execute(sql`
          SELECT
            e.id, e.title, e.description, e.cover_image_url AS "coverImageUrl",
            e.status, e.starts_at AS "startsAt", e.ends_at AS "endsAt", e.created_at AS "createdAt",
            o.name AS "organizationName",
            (SELECT COUNT(*)::int FROM tickets t WHERE t.event_id = e.id AND t.status <> 'cancelled') AS "participantsCount"
          FROM events e
          LEFT JOIN organizations o ON o.id = e.org_id
           WHERE e.visibility = 'public'
             AND e.status <> 'draft'
          ORDER BY e.created_at DESC
          LIMIT ${limit}
        `)
      : { rows: [] },

    (!typeFilter || typeFilter === "all" || typeFilter === "campaigns")
      ? db.execute(sql`
          SELECT
            c.id, c.title, c.description, c.cover_image_url AS "coverImageUrl",
            c.status, c.starts_at AS "startsAt", c.ends_at AS "endsAt", c.created_at AS "createdAt",
            o.name AS "organizationName",
            (SELECT COUNT(*)::int FROM campaign_responses cr WHERE cr.campaign_id = c.id) AS "participantsCount"
          FROM campaigns c
          LEFT JOIN organizations o ON o.id = c.org_id
           WHERE c.visibility = 'public'
             AND c.status <> 'draft'
          ORDER BY c.created_at DESC
          LIMIT ${limit}
        `)
      : { rows: [] },
  ]);

  const items: any[] = [
    ...elections.rows.map((r: any) => ({ ...r, type: "election" })),
    ...events.rows.map((r: any) => ({ ...r, type: "event" })),
    ...campaigns.rows.map((r: any) => ({ ...r, type: "campaign" })),
  ];

  if (sort === "trending" || sort === "popular") {
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

  const response = { items: items.slice(0, limit), featured, trending };
  await setJson(cacheKey, response, 10);
  res.setHeader("X-Cache", "MISS");
  res.json(response);
});

// ── SEARCH ─────────────────────────────────────────────────────────────────

router.get("/search", async (req, res): Promise<void> => {
  const queryParsed = SearchQueryParams.safeParse(req.query);
  if (!queryParsed.success || !queryParsed.data.q) {
    res.status(400).json({ error: "Query parameter 'q' is required" });
    return;
  }
  const { q, type: typeFilter } = queryParsed.data;
  const pattern = `%${q}%`;

  // All three searches run in parallel; participant counts are subqueries.
  const [elections, events, campaigns] = await Promise.all([
    (!typeFilter || typeFilter === "all" || typeFilter === "elections")
      ? db.execute(sql`
          SELECT
            e.id, e.title, e.description, e.cover_image_url AS "coverImageUrl",
            e.status, e.starts_at AS "startsAt", e.ends_at AS "endsAt", e.created_at AS "createdAt",
            o.name AS "organizationName",
            (SELECT COUNT(*)::int FROM vote_selections vs
             INNER JOIN votes v ON v.id = vs.vote_id
             WHERE v.election_id = e.id) AS "participantsCount"
          FROM elections e
          LEFT JOIN organizations o ON o.id = e.org_id
           WHERE e.visibility = 'public'
             AND e.status <> 'draft'
            AND (e.title ILIKE ${pattern} OR e.description ILIKE ${pattern})
        `)
      : { rows: [] },

    (!typeFilter || typeFilter === "all" || typeFilter === "events")
      ? db.execute(sql`
          SELECT
            e.id, e.title, e.description, e.cover_image_url AS "coverImageUrl",
            e.status, e.starts_at AS "startsAt", e.ends_at AS "endsAt", e.created_at AS "createdAt",
            o.name AS "organizationName",
            (SELECT COUNT(*)::int FROM tickets t WHERE t.event_id = e.id AND t.status <> 'cancelled') AS "participantsCount"
          FROM events e
          LEFT JOIN organizations o ON o.id = e.org_id
           WHERE e.visibility = 'public'
             AND e.status <> 'draft'
            AND (e.title ILIKE ${pattern} OR e.description ILIKE ${pattern})
        `)
      : { rows: [] },

    (!typeFilter || typeFilter === "all" || typeFilter === "campaigns")
      ? db.execute(sql`
          SELECT
            c.id, c.title, c.description, c.cover_image_url AS "coverImageUrl",
            c.status, c.starts_at AS "startsAt", c.ends_at AS "endsAt", c.created_at AS "createdAt",
            o.name AS "organizationName",
            (SELECT COUNT(*)::int FROM campaign_responses cr WHERE cr.campaign_id = c.id) AS "participantsCount"
          FROM campaigns c
          LEFT JOIN organizations o ON o.id = c.org_id
           WHERE c.visibility = 'public'
             AND c.status <> 'draft'
            AND (c.title ILIKE ${pattern} OR c.description ILIKE ${pattern})
        `)
      : { rows: [] },
  ]);

  const items: any[] = [
    ...elections.rows.map((r: any) => ({ ...r, type: "election" })),
    ...events.rows.map((r: any) => ({ ...r, type: "event" })),
    ...campaigns.rows.map((r: any) => ({ ...r, type: "campaign" })),
  ];

  res.json({ query: q, total: items.length, items });
});

export default router;
