/**
 * Vite plugin: og-prerender
 *
 * Intercepts requests from known social-media crawler bots (WhatsApp,
 * Telegram, Slack, Discord, etc.) and returns server-rendered HTML with
 * full Open Graph + Twitter Card meta tags. All other requests pass through
 * to Vite's normal SPA handling, so users never see this layer.
 *
 * This gives every public Evenum URL a rich link preview on every major
 * platform without SSR and without changing the SPA routing.
 *
 * Data is fetched from the API server (localhost:8080) so no DB import
 * is needed in the Vite plugin context.
 */

import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";

// ── API server base URL ───────────────────────────────────────────────────────
// The API server always runs on port 8080 in this workspace (see artifact.toml)
const API_BASE = "http://localhost:8080/api";

async function apiFetch<T = unknown>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

// ── Bot User-Agent detection ──────────────────────────────────────────────────
const BOT_REGEX =
  /WhatsApp|facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|Discordbot|TelegramBot|ia_archiver|Pinterestbot|redditbot|bufferbot|iframely|Googlebot|Applebot|vkShare|MicrosoftPreview|SkypeUriPreview|nuzzel|SeznamBot|Yahoo.*Slurp|DuckDuckBot/i;

function isBot(ua: string | undefined): boolean {
  return !!ua && BOT_REGEX.test(ua);
}

// ── URL pattern matching ──────────────────────────────────────────────────────
type RouteKind =
  | { kind: "election-vote"; id: number }
  | { kind: "election-results"; id: number }
  | { kind: "election"; id: number }
  | { kind: "event-register"; id: number }
  | { kind: "event"; id: number }
  | { kind: "campaign-participate"; id: number }
  | { kind: "campaign"; id: number }
  | { kind: "candidate"; electionId: number; candidateId: number }
  | { kind: "org"; id: number };

function parseRoute(pathname: string): RouteKind | null {
  let m: RegExpMatchArray | null;
  if ((m = pathname.match(/^\/elections\/(\d+)\/vote$/)))        return { kind: "election-vote",        id: +m[1] };
  if ((m = pathname.match(/^\/elections\/(\d+)\/results$/)))     return { kind: "election-results",     id: +m[1] };
  if ((m = pathname.match(/^\/elections\/(\d+)$/)))              return { kind: "election",             id: +m[1] };
  if ((m = pathname.match(/^\/events\/(\d+)\/register$/)))       return { kind: "event-register",       id: +m[1] };
  if ((m = pathname.match(/^\/events\/(\d+)$/)))                 return { kind: "event",                id: +m[1] };
  if ((m = pathname.match(/^\/campaigns\/(\d+)\/participate$/))) return { kind: "campaign-participate", id: +m[1] };
  if ((m = pathname.match(/^\/campaigns\/(\d+)$/)))              return { kind: "campaign",             id: +m[1] };
  if ((m = pathname.match(/^\/candidates\/(\d+)\/(\d+)$/)))      return { kind: "candidate",            electionId: +m[1], candidateId: +m[2] };
  if ((m = pathname.match(/^\/organizations\/(\d+)\/public$/)))  return { kind: "org",                  id: +m[1] };
  return null;
}

// ── OG data shape ─────────────────────────────────────────────────────────────
interface OgData {
  title: string;
  description: string;
  image?: string | null;
  type?: string;
  canonicalUrl: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function trunc(s: string, n = 200): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function buildHtml(og: OgData): string {
  const imgTags = og.image
    ? `  <meta property="og:image"        content="${esc(og.image)}" />
  <meta property="og:image:width"  content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:image"       content="${esc(og.image)}" />\n`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(og.title)}</title>
  <meta name="description"              content="${esc(og.description)}" />
  <meta property="og:title"            content="${esc(og.title)}" />
  <meta property="og:description"      content="${esc(og.description)}" />
  <meta property="og:url"              content="${esc(og.canonicalUrl)}" />
  <meta property="og:type"             content="${og.type ?? "website"}" />
  <meta property="og:site_name"        content="Evenum" />
${imgTags}  <meta name="twitter:card"            content="${og.image ? "summary_large_image" : "summary"}" />
  <meta name="twitter:title"           content="${esc(og.title)}" />
  <meta name="twitter:description"     content="${esc(og.description)}" />
  <link rel="canonical"                href="${esc(og.canonicalUrl)}" />
</head>
<body>
  <script>window.location.replace(${JSON.stringify(og.canonicalUrl)});</script>
  <noscript><a href="${esc(og.canonicalUrl)}">Open on Evenum →</a></noscript>
</body>
</html>`;
}

// ── OG data resolvers — each calls the API server ─────────────────────────────

async function resolveOgData(route: RouteKind, origin: string): Promise<OgData | null> {
  const spaUrl = (path: string) => `${origin}${path}`;

  switch (route.kind) {
    case "election":
    case "election-vote":
    case "election-results": {
      const election: any = await apiFetch(`/elections/${route.id}`);
      if (!election) return null;
      const pathMap: Record<string, string> = {
        "election":         `/elections/${route.id}`,
        "election-vote":    `/elections/${route.id}/vote`,
        "election-results": `/elections/${route.id}/results`,
      };
      const ctaMap: Record<string, string> = {
        "election":         "View this election on Evenum.",
        "election-vote":    "Cast your vote now on Evenum.",
        "election-results": `View the official results for ${election.title} on Evenum.`,
      };
      const statusLabel =
        election.status === "active" ? " · Now Open" :
        election.status === "ended"  ? " · Voting Closed" : "";
      const orgSuffix = election.organizationName ? ` · ${election.organizationName}` : "";
      return {
        title:       `${election.title}${statusLabel}${orgSuffix}`,
        description: trunc(election.description || ctaMap[route.kind]),
        image:       election.heroImageUrl || election.coverImageUrl || null,
        canonicalUrl: spaUrl(pathMap[route.kind]),
      };
    }

    case "event":
    case "event-register": {
      const event: any = await apiFetch(`/events/${route.id}`);
      if (!event) return null;
      const venue = event.isOnline ? "Online" : (event.location || "");
      const dateStr = event.startsAt
        ? new Date(event.startsAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
        : "";
      const subtitle = [dateStr, venue, event.organizationName].filter(Boolean).join(" · ");
      const path = route.kind === "event-register" ? `/events/${route.id}/register` : `/events/${route.id}`;
      return {
        title:        event.title,
        description:  trunc(subtitle || event.description || `Register for this event on Evenum.`),
        image:        event.heroImageUrl || event.coverImageUrl || null,
        canonicalUrl: spaUrl(path),
      };
    }

    case "campaign":
    case "campaign-participate": {
      const campaign: any = await apiFetch(`/campaigns/${route.id}`);
      if (!campaign) return null;
      const typeLabel: Record<string, string> = {
        fundraiser: "Fundraising Campaign", petition: "Petition",
        survey: "Survey", application: "Application", collection: "Collection",
      };
      const orgSuffix = campaign.organizationName ? ` by ${campaign.organizationName}` : "";
      const path = route.kind === "campaign-participate"
        ? `/campaigns/${route.id}/participate`
        : `/campaigns/${route.id}`;
      return {
        title:        `${campaign.title}${orgSuffix}`,
        description:  trunc(campaign.description || `Join this ${typeLabel[campaign.type] ?? "campaign"} on Evenum.`),
        image:        campaign.heroImageUrl || campaign.coverImageUrl || null,
        canonicalUrl: spaUrl(path),
      };
    }

    case "candidate": {
      // Fetch candidate and election in parallel
      const [candidate, positions]: [any, any[]] = await Promise.all([
        apiFetch(`/elections/${route.electionId}/candidates/${route.candidateId}`),
        apiFetch(`/elections/${route.electionId}/positions`).then((r: any) => r ?? []),
      ]);
      if (!candidate) return null;
      const position = (positions as any[])?.find((p: any) => p.id === candidate.positionId);
      const election: any = await apiFetch(`/elections/${route.electionId}`);
      const positionSuffix = position ? ` — ${position.title}` : "";
      const electionSuffix = election ? ` · ${election.title}` : "";
      return {
        title:        `${candidate.name}${positionSuffix}${electionSuffix}`,
        description:  trunc(candidate.bio || `Meet ${candidate.name} — a candidate on Evenum. View their profile and platform.`),
        image:        candidate.photoUrl || null,
        type:         "profile",
        canonicalUrl: spaUrl(`/candidates/${route.electionId}/${route.candidateId}`),
      };
    }

    case "org": {
      const org: any = await apiFetch(`/organizations/${route.id}/public`);
      if (!org) return null;
      return {
        title:        `${org.name} · Evenum`,
        description:  trunc(org.description || `${org.name} uses Evenum to run elections, events, and campaigns.`),
        image:        org.logoUrl || null,
        canonicalUrl: spaUrl(`/organizations/${route.id}/public`),
      };
    }

    default:
      return null;
  }
}

// ── Plugin export ─────────────────────────────────────────────────────────────
export function ogPrerenderPlugin(): Plugin {
  return {
    name:  "evenum-og-prerender",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        try {
          if (!isBot(req.headers["user-agent"])) return next();

          // Strip query string and the SPA base path prefix
          const rawPath = (req.url ?? "/").split("?")[0];
          const basePath = (process.env.BASE_PATH ?? "/").replace(/\/$/, "");
          const pathname =
            basePath && rawPath.startsWith(basePath)
              ? rawPath.slice(basePath.length) || "/"
              : rawPath;

          const route = parseRoute(pathname);
          if (!route) return next();

          // Build origin for canonical URLs
          const proto = String(req.headers["x-forwarded-proto"] ?? "https");
          const host  = String(req.headers.host ?? "localhost");
          // Include base path so canonical URL matches the actual SPA URL
          const origin = `${proto}://${host}${basePath}`;

          const ogData = await resolveOgData(route, origin);
          if (!ogData) return next();

          const html = buildHtml(ogData);
          res.writeHead(200, {
            "Content-Type":  "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
            "X-Robots-Tag":  "noindex",
          });
          res.end(html);
        } catch {
          next();
        }
      });
    },
  };
}
