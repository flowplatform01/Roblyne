import { Router, type IRouter } from "express";
import { and, eq, ne, or, sql } from "drizzle-orm";
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

type SeoPage = {
  path: string;
  title: string;
  description: string;
  image: string | null;
  type: "website" | "profile";
  lastModified: string | null;
  structuredData: Record<string, unknown>;
};

function description(value: string | null, fallback: string): string {
  return (value?.trim() || fallback).slice(0, 300);
}

function publicImage(...values: Array<string | null | undefined>): string | null {
  return values.find((value) => Boolean(value && /^https:\/\//i.test(value.trim()))) ?? null;
}

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

router.get("/seo/public-pages", async (_req, res): Promise<void> => {
  const [organizations, campaigns, events, elections, candidates] = await Promise.all([
    db.select({
      id: organizationsTable.id,
      name: organizationsTable.name,
      description: organizationsTable.description,
      logoUrl: organizationsTable.logoUrl,
      coverImageUrl: organizationsTable.coverImageUrl,
      heroImageUrl: organizationsTable.heroImageUrl,
      website: organizationsTable.website,
      createdAt: organizationsTable.createdAt,
    }).from(organizationsTable).where(sql`EXISTS (
      SELECT 1 FROM elections e WHERE e.org_id = ${organizationsTable.id} AND e.visibility = 'public' AND e.status <> 'draft'
      UNION ALL SELECT 1 FROM events ev WHERE ev.org_id = ${organizationsTable.id} AND ev.visibility = 'public' AND ev.status <> 'draft'
      UNION ALL SELECT 1 FROM campaigns c WHERE c.org_id = ${organizationsTable.id} AND c.visibility = 'public' AND c.status <> 'draft'
    )`),
    db.select({ campaign: campaignsTable, organizationName: organizationsTable.name })
      .from(campaignsTable).leftJoin(organizationsTable, eq(campaignsTable.orgId, organizationsTable.id))
      .where(and(eq(campaignsTable.visibility, "public"), ne(campaignsTable.status, "draft"))),
    db.select({ event: eventsTable, organizationName: organizationsTable.name })
      .from(eventsTable).leftJoin(organizationsTable, eq(eventsTable.orgId, organizationsTable.id))
      .where(and(eq(eventsTable.visibility, "public"), ne(eventsTable.status, "draft"))),
    db.select({ election: electionsTable, organizationName: organizationsTable.name })
      .from(electionsTable).leftJoin(organizationsTable, eq(electionsTable.orgId, organizationsTable.id))
      .where(and(eq(electionsTable.visibility, "public"), ne(electionsTable.status, "draft"))),
    db.select({ candidate: candidatesTable, election: electionsTable, position: positionsTable })
      .from(candidatesTable)
      .innerJoin(electionsTable, eq(candidatesTable.electionId, electionsTable.id))
      .innerJoin(positionsTable, and(eq(candidatesTable.positionId, positionsTable.id), eq(positionsTable.electionId, electionsTable.id)))
      .where(and(eq(electionsTable.visibility, "public"), ne(electionsTable.status, "draft"))),
  ]);

  const pages: SeoPage[] = [
    ...organizations.map((organization) => ({
      path: `/organizations/${organization.id}/public`,
      title: organization.name,
      description: description(organization.description, `${organization.name} uses ROBLYNE for elections, events, and campaigns.`),
      image: publicImage(organization.heroImageUrl, organization.coverImageUrl, organization.logoUrl),
      type: "website" as const,
      lastModified: iso(organization.createdAt),
      structuredData: {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: organization.name,
        ...(organization.website ? { url: organization.website } : {}),
        ...(publicImage(organization.logoUrl) ? { logo: publicImage(organization.logoUrl) } : {}),
      },
    })),
    ...campaigns.map(({ campaign, organizationName }) => ({
      path: `/campaigns/${campaign.id}/participate`,
      title: organizationName ? `${campaign.title} by ${organizationName}` : campaign.title,
      description: description(campaign.description, `Participate in ${campaign.title} on ROBLYNE.`),
      image: publicImage(campaign.heroImageUrl, campaign.coverImageUrl),
      type: "website" as const,
      lastModified: iso(campaign.createdAt),
      structuredData: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: campaign.title,
        description: description(campaign.description, `Participate in ${campaign.title} on ROBLYNE.`),
      },
    })),
    ...events.map(({ event, organizationName }) => ({
      path: `/events/${event.id}/register`,
      title: event.title,
      description: description(event.description, `Register for ${event.title} on ROBLYNE.`),
      image: publicImage(event.heroImageUrl, event.coverImageUrl),
      type: "website" as const,
      lastModified: iso(event.createdAt),
      structuredData: {
        "@context": "https://schema.org",
        "@type": "Event",
        name: event.title,
        description: description(event.description, `Register for ${event.title} on ROBLYNE.`),
        ...(event.startsAt ? { startDate: event.startsAt.toISOString() } : {}),
        ...(event.endsAt ? { endDate: event.endsAt.toISOString() } : {}),
        ...(event.isOnline ? { eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode" } : {}),
        ...(!event.isOnline && event.location ? { location: { "@type": "Place", name: event.location } } : {}),
        ...(organizationName ? { organizer: { "@type": "Organization", name: organizationName } } : {}),
      },
    })),
    ...elections.map(({ election, organizationName }) => ({
      path: `/elections/${election.id}/vote`,
      title: election.title,
      description: description(election.description, `Cast your vote in ${election.title} on ROBLYNE.`),
      image: publicImage(election.heroImageUrl, election.coverImageUrl),
      type: "website" as const,
      lastModified: iso(election.createdAt),
      structuredData: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: election.title,
        description: description(election.description, `Cast your vote in ${election.title} on ROBLYNE.`),
        ...(organizationName ? { publisher: { "@type": "Organization", name: organizationName } } : {}),
      },
    })),
    ...candidates.map(({ candidate, election, position }) => ({
      path: `/candidates/${election.id}/${candidate.id}`,
      title: `${candidate.name} - ${position.title} - ${election.title}`,
      description: description(candidate.bio, `Meet ${candidate.name}, candidate for ${position.title} in ${election.title}.`),
      image: publicImage(candidate.photoUrl, election.heroImageUrl, election.coverImageUrl),
      type: "profile" as const,
      lastModified: iso(election.createdAt),
      structuredData: {
        "@context": "https://schema.org",
        "@type": "Person",
        name: candidate.name,
        ...(candidate.bio ? { description: candidate.bio.slice(0, 300) } : {}),
        ...(publicImage(candidate.photoUrl) ? { image: publicImage(candidate.photoUrl) } : {}),
      },
    })),
  ];

  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  res.json({ pages });
});

export default router;
