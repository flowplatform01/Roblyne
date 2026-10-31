import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, ne } from "drizzle-orm";
import {
  campaignsTable,
  candidatesTable,
  db,
  electionsTable,
  eventsTable,
  organizationsTable,
  positionsTable,
} from "@workspace/db";

const router: IRouter = Router();

type ShareMetadata = {
  title: string;
  description: string;
  image: string;
  destination: string;
  type?: "website" | "profile";
};

function parseId(value: string): number | null {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function text(value: unknown, fallback: string): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  return (normalized || fallback).slice(0, 300);
}

function publicImage(value: unknown, fallback: string): string {
  return typeof value === "string" && /^https:\/\//i.test(value.trim()) ? value.trim() : fallback;
}

function frontendOrigin(): string | null {
  const configured = process.env.PUBLIC_WEB_URL?.trim() || process.env.CORS_ALLOWED_ORIGINS?.split(",")[0]?.trim();
  if (!configured) return null;
  try {
    const parsed = new URL(configured);
    return ["https:", "http:"].includes(parsed.protocol) ? parsed.origin : null;
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function shareHtml(metadata: ShareMetadata, shareUrl: string): string {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(metadata.title)} | ROBLYNE</title>
<meta name="description" content="${escapeHtml(metadata.description)}" />
<meta property="og:title" content="${escapeHtml(metadata.title)}" />
<meta property="og:description" content="${escapeHtml(metadata.description)}" />
<meta property="og:image" content="${escapeHtml(metadata.image)}" />
<meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" />
<meta property="og:url" content="${escapeHtml(shareUrl)}" /><meta property="og:type" content="${metadata.type ?? "website"}" />
<meta property="og:site_name" content="ROBLYNE" />
<meta name="twitter:card" content="summary_large_image" /><meta name="twitter:title" content="${escapeHtml(metadata.title)}" />
<meta name="twitter:description" content="${escapeHtml(metadata.description)}" /><meta name="twitter:image" content="${escapeHtml(metadata.image)}" />
<link rel="canonical" href="${escapeHtml(metadata.destination)}" /><meta http-equiv="refresh" content="0;url=${escapeHtml(metadata.destination)}" />
</head><body><a href="${escapeHtml(metadata.destination)}">Open on ROBLYNE</a></body></html>`;
}

function respond(req: Request, res: Response, metadata: ShareMetadata | null): void {
  if (!metadata) {
    res.status(404).send("Not found");
    return;
  }
  const shareUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  res.setHeader("X-Robots-Tag", "noindex");
  res.type("html").send(shareHtml(metadata, shareUrl));
}

function imageFallback(origin: string): string {
  return `${origin}/icons/apple-touch-icon.png`;
}

router.get("/share/campaigns/:campaignId", async (req, res): Promise<void> => {
  const id = parseId(req.params.campaignId);
  const origin = frontendOrigin();
  if (!id || !origin) return respond(req, res, null);
  const [row] = await db.select({ campaign: campaignsTable, organizationName: organizationsTable.name })
    .from(campaignsTable).leftJoin(organizationsTable, eq(campaignsTable.orgId, organizationsTable.id))
    .where(and(eq(campaignsTable.id, id), eq(campaignsTable.visibility, "public"), ne(campaignsTable.status, "draft"))).limit(1);
  if (!row) return respond(req, res, null);
  return respond(req, res, {
    title: row.organizationName ? `${row.campaign.title} by ${row.organizationName}` : row.campaign.title,
    description: text(row.campaign.description, `Participate in ${row.campaign.title} on ROBLYNE.`),
    image: publicImage(row.campaign.heroImageUrl || row.campaign.coverImageUrl, imageFallback(origin)),
    destination: `${origin}/campaigns/${id}/participate`,
  });
});

router.get("/share/events/:eventId", async (req, res): Promise<void> => {
  const id = parseId(req.params.eventId);
  const origin = frontendOrigin();
  if (!id || !origin) return respond(req, res, null);
  const [row] = await db.select({ event: eventsTable, organizationName: organizationsTable.name })
    .from(eventsTable).leftJoin(organizationsTable, eq(eventsTable.orgId, organizationsTable.id))
    .where(and(eq(eventsTable.id, id), eq(eventsTable.visibility, "public"), ne(eventsTable.status, "draft"))).limit(1);
  if (!row) return respond(req, res, null);
  const venue = row.event.isOnline ? "Online" : row.event.location;
  return respond(req, res, {
    title: row.event.title,
    description: text(row.event.description, [venue, row.organizationName].filter(Boolean).join(" - ") || `Register for ${row.event.title} on ROBLYNE.`),
    image: publicImage(row.event.heroImageUrl || row.event.coverImageUrl, imageFallback(origin)),
    destination: `${origin}/events/${id}/register`,
  });
});

router.get("/share/elections/:electionId/:destination", async (req, res): Promise<void> => {
  const id = parseId(req.params.electionId);
  const origin = frontendOrigin();
  if (!id || !origin || !["vote", "results"].includes(req.params.destination)) return respond(req, res, null);
  const [row] = await db.select({ election: electionsTable })
    .from(electionsTable)
    .where(and(eq(electionsTable.id, id), eq(electionsTable.visibility, "public"), ne(electionsTable.status, "draft"))).limit(1);
  if (!row) return respond(req, res, null);
  const results = req.params.destination === "results";
  return respond(req, res, {
    title: results ? `${row.election.title} results` : row.election.title,
    description: text(row.election.description, results ? `View the official results for ${row.election.title} on ROBLYNE.` : `Cast your vote in ${row.election.title} on ROBLYNE.`),
    image: publicImage(row.election.heroImageUrl || row.election.coverImageUrl, imageFallback(origin)),
    destination: `${origin}/elections/${id}/${results ? "results" : "vote"}`,
  });
});

router.get("/share/candidates/:electionId/:candidateId", async (req, res): Promise<void> => {
  const electionId = parseId(req.params.electionId);
  const candidateId = parseId(req.params.candidateId);
  const origin = frontendOrigin();
  if (!electionId || !candidateId || !origin) return respond(req, res, null);
  const [row] = await db.select({ candidate: candidatesTable, election: electionsTable, position: positionsTable })
    .from(candidatesTable).innerJoin(electionsTable, eq(candidatesTable.electionId, electionsTable.id))
    .innerJoin(positionsTable, eq(candidatesTable.positionId, positionsTable.id))
    .where(and(eq(candidatesTable.id, candidateId), eq(candidatesTable.electionId, electionId), eq(positionsTable.electionId, electionId), eq(electionsTable.visibility, "public"), ne(electionsTable.status, "draft"))).limit(1);
  if (!row) return respond(req, res, null);
  return respond(req, res, {
    title: `${row.candidate.name} - ${row.position.title} - ${row.election.title}`,
    description: text(row.candidate.bio, `Meet ${row.candidate.name}, candidate for ${row.position.title} in ${row.election.title}.`),
    image: publicImage(row.candidate.photoUrl, publicImage(row.election.heroImageUrl || row.election.coverImageUrl, imageFallback(origin))),
    destination: `${origin}/candidates/${electionId}/${candidateId}`,
    type: "profile",
  });
});

router.get("/share/organizations/:organizationId", async (req, res): Promise<void> => {
  const id = parseId(req.params.organizationId);
  const origin = frontendOrigin();
  if (!id || !origin) return respond(req, res, null);
  const [organization] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, id)).limit(1);
  if (!organization) return respond(req, res, null);
  return respond(req, res, {
    title: organization.name,
    description: text(organization.description, `${organization.name} uses ROBLYNE for elections, events, and campaigns.`),
    image: publicImage(organization.heroImageUrl || organization.coverImageUrl || organization.logoUrl, imageFallback(origin)),
    destination: `${origin}/organizations/${id}/public`,
  });
});

export default router;
