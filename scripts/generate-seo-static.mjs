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

const response = await fetch(`${apiOrigin}/api/seo/public-pages`, { signal: AbortSignal.timeout(15_000) });
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
  return typeof image === "string" && /^https:\/\//i.test(image) ? image : `${webOrigin}/icons/apple-touch-icon.png`;
}

function metadata(page) {
  const url = `${webOrigin}${page.path}`;
  const image = absoluteImage(page.image);
  const title = page.title.endsWith("ROBLYNE") ? page.title : `${page.title} | ROBLYNE`;
  const structuredData = JSON.stringify({ ...page.structuredData, url }).replace(/</g, "\\u003c");
  return `<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(page.description)}" />
<meta name="robots" content="index,follow,max-image-preview:large" />
<link rel="canonical" href="${escapeHtml(url)}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(page.description)}" />
<meta property="og:type" content="${page.type}" />
<meta property="og:url" content="${escapeHtml(url)}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:site_name" content="ROBLYNE" />
<meta property="og:locale" content="en_US" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(page.description)}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />
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
  title: "ROBLYNE - Organized Participation",
  description: "The professional platform for elections, events, and campaigns.",
  image: null,
  type: "website",
  structuredData: {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "ROBLYNE",
    url: webOrigin,
  },
};

const allPages = [home, ...pages];
for (const page of allPages) {
  const route = page.path === "/" ? "index.html" : join(page.path.replace(/^\/+/, ""), "index.html");
  const destination = join(outputDir, route);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, withMetadata(indexHtml, page));
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${allPages.map((page) => {
  const lastModified = page.lastModified ? `<lastmod>${new Date(page.lastModified).toISOString().slice(0, 10)}</lastmod>` : "";
  return `  <url><loc>${escapeXml(`${webOrigin}${page.path}`)}</loc>${lastModified}</url>`;
}).join("\n")}\n</urlset>\n`;
await writeFile(join(outputDir, "sitemap.xml"), sitemap);
await writeFile(join(outputDir, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /dashboard\nDisallow: /login\nDisallow: /register\nDisallow: /password-reset\nDisallow: /settings\nDisallow: /admin\nDisallow: /organizations/new\nSitemap: ${webOrigin}/sitemap.xml\n`);

console.log(`Generated SEO files for ${pages.length} public resources.`);
