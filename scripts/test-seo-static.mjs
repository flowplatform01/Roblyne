import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);

const pages = [{
  path: "/campaigns/7/participate",
  title: "Clean Water Fund",
  description: "Fund a community water project.",
  image: "https://media.example.com/water.jpg",
  type: "website",
  lastModified: "2026-10-31T00:00:00.000Z",
  structuredData: { "@context": "https://schema.org", "@type": "WebPage", name: "Clean Water Fund" },
}];

const server = createServer((req, res) => {
  if (req.url === "/api/seo/public-pages") {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ pages }));
    return;
  }
  res.statusCode = 404;
  res.end();
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address !== "string");

try {
  await run(process.execPath, ["scripts/generate-seo-static.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PUBLIC_WEB_URL: "https://www.roblyne.test",
      VITE_API_URL: `http://127.0.0.1:${address.port}`,
    },
  });

  const campaignHtml = await readFile("artifacts/roblyne/dist/public/campaigns/7/participate/index.html", "utf8");
  const sitemap = await readFile("artifacts/roblyne/dist/public/sitemap.xml", "utf8");
  const robots = await readFile("artifacts/roblyne/dist/public/robots.txt", "utf8");

  assert.match(campaignHtml, /Clean Water Fund \| ROBLYNE/);
  assert.match(campaignHtml, /https:\/\/www\.roblyne\.test\/campaigns\/7\/participate/);
  assert.match(campaignHtml, /https:\/\/media\.example\.com\/water\.jpg/);
  assert.match(sitemap, /https:\/\/www\.roblyne\.test\/campaigns\/7\/participate/);
  assert.match(robots, /Disallow: \/dashboard/);
  console.log("PASS generated SEO documents include resource metadata and private-route exclusions");
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
