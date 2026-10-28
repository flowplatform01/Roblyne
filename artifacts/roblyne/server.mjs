import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "dist/public");
const port = Number(process.env.PORT ?? 22244);
const basePath = normalizeBasePath(process.env.BASE_PATH ?? "/");
const configuredApiBase = process.env.API_BASE_URL?.replace(/\/$/, "");
const apiProxyUrl = process.env.API_PROXY_URL?.replace(/\/$/, "");

const botRegex =
  /WhatsApp|facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|Discordbot|TelegramBot|ia_archiver|Pinterestbot|redditbot|bufferbot|iframely|Googlebot|Applebot|vkShare|MicrosoftPreview|SkypeUriPreview|nuzzel|SeznamBot|Yahoo.*Slurp|DuckDuckBot/i;

function normalizeBasePath(value) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") return "";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

function isBot(userAgent) {
  return Boolean(userAgent && botRegex.test(userAgent));
}

function parseRoute(pathname) {
  let match;
  if ((match = pathname.match(/^\/elections\/(\d+)\/vote$/))) return { kind: "election-vote", id: Number(match[1]) };
  if ((match = pathname.match(/^\/elections\/(\d+)\/results$/))) return { kind: "election-results", id: Number(match[1]) };
  if ((match = pathname.match(/^\/elections\/(\d+)$/))) return { kind: "election", id: Number(match[1]) };
  if ((match = pathname.match(/^\/events\/(\d+)\/register$/))) return { kind: "event-register", id: Number(match[1]) };
  if ((match = pathname.match(/^\/events\/(\d+)$/))) return { kind: "event", id: Number(match[1]) };
  if ((match = pathname.match(/^\/campaigns\/(\d+)\/participate$/))) return { kind: "campaign-participate", id: Number(match[1]) };
  if ((match = pathname.match(/^\/campaigns\/(\d+)$/))) return { kind: "campaign", id: Number(match[1]) };
  if ((match = pathname.match(/^\/candidates\/(\d+)\/(\d+)$/))) {
    return { kind: "candidate", electionId: Number(match[1]), candidateId: Number(match[2]) };
  }
  if ((match = pathname.match(/^\/organizations\/(\d+)\/public$/))) return { kind: "org", id: Number(match[1]) };
  return null;
}

function requestOrigin(req) {
  const proto = String(req.headers["x-forwarded-proto"] ?? "https").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost");
  return `${proto}://${host}${basePath}`;
}

async function fetchJson(base, route, timeoutMs) {
  try {
    const response = await fetch(`${base}${route}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function proxyApi(req, res) {
  if (!apiProxyUrl) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "API proxy is not configured" }));
    return;
  }

  const target = new URL(req.url ?? "/api", apiProxyUrl);
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined || name === "host" || name === "connection") continue;
    headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  headers.set("x-forwarded-host", String(req.headers.host ?? ""));
  headers.set("x-forwarded-proto", "https");

  try {
    const response = await fetch(target, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : req,
      duplex: "half",
    });
    const responseHeaders = {};
    response.headers.forEach((value, name) => {
      if (name !== "transfer-encoding" && name !== "connection") responseHeaders[name] = value;
    });
    const setCookies = response.headers.getSetCookie?.();
    if (setCookies?.length) responseHeaders["set-cookie"] = setCookies;
    res.writeHead(response.status, responseHeaders);
    if (!response.body) {
      res.end();
      return;
    }
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "API is unavailable" }));
  }
}

async function apiFetch(route, origin) {
  const bases = [...new Set([
    configuredApiBase,
    `${origin}/api`,
    process.env.NODE_ENV === "production" ? null : "http://127.0.0.1:8080/api",
  ].filter(Boolean))];
  for (const [index, base] of bases.entries()) {
    const result = await fetchJson(base, route, index === 0 ? 750 : 2000);
    if (result !== null) return result;
  }
  return null;
}

function truncate(value, max = 200) {
  const text = String(value ?? "");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function imageUrl(value) {
  if (!value || /^data:/i.test(value)) return null;
  return value;
}

async function resolveOgData(route, origin) {
  if (route.kind === "election" || route.kind === "election-vote" || route.kind === "election-results") {
    const election = await apiFetch(`/elections/${route.id}`, origin);
    if (!election) return null;
    const suffix = election.status === "active" ? " · Now Open" : election.status === "ended" ? " · Voting Closed" : "";
    const orgSuffix = election.organizationName ? ` · ${election.organizationName}` : "";
    const routePath = route.kind === "election"
      ? `/elections/${route.id}`
      : `/elections/${route.id}/${route.kind === "election-vote" ? "vote" : "results"}`;
    return {
      title: `${election.title}${suffix}${orgSuffix}`,
      description: truncate(election.description || "View this election on ROBLYNE."),
      image: imageUrl(election.heroImageUrl || election.coverImageUrl),
      canonicalUrl: `${origin}${routePath}`,
    };
  }

  if (route.kind === "event" || route.kind === "event-register") {
    const event = await apiFetch(`/events/${route.id}`, origin);
    if (!event) return null;
    const venue = event.isOnline ? "Online" : event.location || "";
    const date = event.startsAt
      ? new Date(event.startsAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "";
    const subtitle = [date, venue, event.organizationName].filter(Boolean).join(" · ");
    const routePath = route.kind === "event-register" ? `/events/${route.id}/register` : `/events/${route.id}`;
    return {
      title: event.title,
      description: truncate(subtitle || event.description || "Register for this event on ROBLYNE."),
      image: imageUrl(event.heroImageUrl || event.coverImageUrl),
      canonicalUrl: `${origin}${routePath}`,
    };
  }

  if (route.kind === "campaign" || route.kind === "campaign-participate") {
    const campaign = await apiFetch(`/campaigns/${route.id}`, origin);
    if (!campaign) return null;
    const orgSuffix = campaign.organizationName ? ` by ${campaign.organizationName}` : "";
    const routePath = route.kind === "campaign-participate"
      ? `/campaigns/${route.id}/participate`
      : `/campaigns/${route.id}`;
    return {
      title: `${campaign.title}${orgSuffix}`,
      description: truncate(campaign.description || "Join this campaign on ROBLYNE."),
      image: imageUrl(campaign.heroImageUrl || campaign.coverImageUrl),
      canonicalUrl: `${origin}${routePath}`,
    };
  }

  if (route.kind === "candidate") {
    const [candidate, positions, election] = await Promise.all([
      apiFetch(`/elections/${route.electionId}/candidates/${route.candidateId}`, origin),
      apiFetch(`/elections/${route.electionId}/positions`, origin),
      apiFetch(`/elections/${route.electionId}`, origin),
    ]);
    if (!candidate) return null;
    const position = Array.isArray(positions) ? positions.find((item) => item.id === candidate.positionId) : null;
    return {
      title: `${candidate.name}${position ? ` — ${position.title}` : ""}${election ? ` · ${election.title}` : ""}`,
      description: truncate(candidate.bio || `Meet ${candidate.name} — a candidate on ROBLYNE.`),
      image: imageUrl(candidate.photoUrl),
      type: "profile",
      canonicalUrl: `${origin}/candidates/${route.electionId}/${route.candidateId}`,
    };
  }

  if (route.kind === "org") {
    const organization = await apiFetch(`/organizations/${route.id}/public`, origin);
    if (!organization) return null;
    return {
      title: `${organization.name} · ROBLYNE`,
      description: truncate(organization.description || `${organization.name} uses ROBLYNE to run elections, events, and campaigns.`),
      image: imageUrl(organization.logoUrl),
      canonicalUrl: `${origin}/organizations/${route.id}/public`,
    };
  }

  return null;
}

function buildOgHtml(data) {
  const imageTags = data.image
    ? `  <meta property="og:image" content="${escapeHtml(data.image)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:image" content="${escapeHtml(data.image)}" />`
    : "";

  return `<!doctype html>
<html lang="en"><head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(data.title)}</title>
  <meta name="description" content="${escapeHtml(data.description)}" />
  <meta property="og:title" content="${escapeHtml(data.title)}" />
  <meta property="og:description" content="${escapeHtml(data.description)}" />
  <meta property="og:url" content="${escapeHtml(data.canonicalUrl)}" />
  <meta property="og:type" content="${data.type ?? "website"}" />
  <meta property="og:site_name" content="ROBLYNE" />
${imageTags}
  <meta name="twitter:card" content="${data.image ? "summary_large_image" : "summary"}" />
  <meta name="twitter:title" content="${escapeHtml(data.title)}" />
  <meta name="twitter:description" content="${escapeHtml(data.description)}" />
  <link rel="canonical" href="${escapeHtml(data.canonicalUrl)}" />
</head><body>
  <script>window.location.replace(${JSON.stringify(data.canonicalUrl)});</script>
  <noscript><a href="${escapeHtml(data.canonicalUrl)}">Open on ROBLYNE</a></noscript>
</body></html>`;
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
  }[extension] ?? "application/octet-stream";
}

async function serveStatic(req, res, pathname) {
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = path.resolve(root, relativePath);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }

  try {
    const stat = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": contentType(filePath),
      "Cache-Control": filePath.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable",
    });
    res.end(stat);
  } catch {
    const fallback = await readFile(path.join(root, "index.html"));
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
    res.end(fallback);
  }
}

createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url ?? "/", "http://localhost");
    const rawPath = requestUrl.pathname;
    const pathname = basePath && rawPath.startsWith(basePath)
      ? rawPath.slice(basePath.length) || "/"
      : rawPath;

    if (pathname === "/api" || pathname.startsWith("/api/")) {
      await proxyApi(req, res);
      return;
    }

    if (isBot(req.headers["user-agent"])) {
      const route = parseRoute(pathname);
      if (route) {
        const data = await resolveOgData(route, requestOrigin(req));
        if (data) {
          res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
            "X-Robots-Tag": "noindex",
          });
          res.end(buildOgHtml(data));
          return;
        }
      }
    }

    await serveStatic(req, res, pathname);
  } catch {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Internal server error");
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`Evenum web server listening on ${port}`);
});
