import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webOrigin = (process.env.PUBLIC_WEB_URL ?? "").trim().replace(/\/+$/, "");
const apiOrigin = (process.env.VITE_API_URL ?? "").trim().replace(/\/+$/, "");
const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(repositoryRoot, "artifacts", "roblyne", "dist", "public");

if (!webOrigin || !apiOrigin) {
  if (process.env.NODE_ENV === "production" || webOrigin || apiOrigin) {
    throw new Error("PUBLIC_WEB_URL and VITE_API_URL are required to generate production SEO files");
  }
  process.exit(0);
}

function normalizedOrigin(value, name) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid http(s) origin`);
  }

  if (!/^https?:$/.test(parsed.protocol) || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error(`${name} must be an origin without a path, query, or fragment`);
  }

  return parsed.origin;
}

const canonicalWebOrigin = normalizedOrigin(webOrigin, "PUBLIC_WEB_URL");
const canonicalApiOrigin = normalizedOrigin(apiOrigin, "VITE_API_URL");
const response = await fetch(`${canonicalApiOrigin}/api/seo/public-pages`, { signal: AbortSignal.timeout(15_000) });
if (!response.ok) throw new Error(`Unable to generate SEO files: ${response.status}`);
const { pages } = await response.json();
if (!Array.isArray(pages)) throw new Error("SEO endpoint returned an invalid page list");

const indexHtml = await readFile(join(outputDir, "index.html"), "utf8");

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeXml(value) {
  return escapeHtml(value).replace(/'/g, "&apos;");
}

function absoluteImage(image) {
  return typeof image === "string" && /^https:\/\//i.test(image) ? image : `${canonicalWebOrigin}/icons/apple-touch-icon.png`;
}

function compactText(value, maximumLength) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maximumLength) return normalized;

  const clipped = normalized.slice(0, Math.max(1, maximumLength - 1));
  const wordBoundary = clipped.lastIndexOf(" ");
  return `${(wordBoundary > Math.floor(maximumLength / 2) ? clipped.slice(0, wordBoundary) : clipped).trim()}…`;
}

function pageTitle(value) {
  const brand = " | ROBLYNE";
  const base = compactText(value, 60 - brand.length);
  return /\bROBLYNE$/i.test(base) ? compactText(base, 60) : `${base}${brand}`;
}

function validatePage(page) {
  if (!page || typeof page !== "object") throw new Error("SEO endpoint returned an invalid page");
  if (typeof page.path !== "string" || !/^\/[A-Za-z0-9/_-]*$/.test(page.path)) {
    throw new Error("SEO endpoint returned an unsafe page path");
  }
  if (typeof page.title !== "string" || typeof page.description !== "string") {
    throw new Error(`SEO endpoint returned incomplete metadata for ${page.path}`);
  }
  if (page.type !== "website" && page.type !== "profile") {
    throw new Error(`SEO endpoint returned an invalid Open Graph type for ${page.path}`);
  }
}

function metadata(page) {
  const url = `${canonicalWebOrigin}${page.path}`;
  const image = absoluteImage(page.image);
  const title = pageTitle(page.title);
  const description = compactText(page.description, 160);
  const structuredData = JSON.stringify({ ...page.structuredData, url }).replace(/</g, "\\u003c");
  return `<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta name="robots" content="index,follow,max-image-preview:large" />
<link rel="canonical" href="${escapeHtml(url)}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:type" content="${page.type}" />
<meta property="og:url" content="${escapeHtml(url)}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta property="og:image:alt" content="${escapeHtml(page.title)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:site_name" content="ROBLYNE" />
<meta property="og:locale" content="en_US" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />
<meta name="twitter:image:alt" content="${escapeHtml(page.title)}" />
<script type="application/ld+json">${structuredData}</script>`;
}

function withMetadata(html, page) {
  const stripped = html
    .replace(/<title>[\s\S]*?<\/title>\s*/i, "")
    .replace(/<meta\s+(?:name|property)="(?:description|robots|twitter:[^"]+|og:[^"]+)"[^>]*>\s*/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, "");
  return stripped.replace("</head>", `${metadata(page)}\n</head>`);
}

const home = {
  path: "/",
  title: "Online Elections, Events and Campaigns",
  description: "ROBLYNE helps organizations run online elections, event registrations, and campaigns in one professional participation platform.",
  image: null,
  type: "website",
  structuredData: {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "ROBLYNE",
    url: canonicalWebOrigin,
  },
};

const resourcePages = pages.map((page) => {
  validatePage(page);
  return page;
});
const allPages = [home, ...resourcePages].sort((left, right) => left.path.localeCompare(right.path));
if (new Set(allPages.map((page) => page.path)).size !== allPages.length) {
  throw new Error("SEO endpoint returned duplicate page paths");
}
for (const page of allPages) {
  const route = page.path === "/" ? "index.html" : join(page.path.replace(/^\/+/, ""), "index.html");
  const destination = join(outputDir, route);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, withMetadata(indexHtml, page));
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${allPages.map((page) => {
  const lastModified = page.lastModified ? `<lastmod>${new Date(page.lastModified).toISOString().slice(0, 10)}</lastmod>` : "";
  return `  <url><loc>${escapeXml(`${canonicalWebOrigin}${page.path}`)}</loc>${lastModified}</url>`;
}).join("\n")}\n</urlset>\n`;
await writeFile(join(outputDir, "sitemap.xml"), sitemap);
await writeFile(join(outputDir, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /dashboard\nDisallow: /login\nDisallow: /register\nDisallow: /password-reset\nDisallow: /settings\nDisallow: /admin\nDisallow: /organizations/new\nDisallow: /elections/new\nDisallow: /events/new\nDisallow: /campaigns/new\nDisallow: /dev-payment/\nSitemap: ${canonicalWebOrigin}/sitemap.xml\n`);

console.log(`Generated SEO files for ${resourcePages.length} public resources.`);
