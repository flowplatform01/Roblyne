import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeMediaUrl, normalizeMediaUrlsInPlace, normalizeMediaUrlsInText } from "./media-url.ts";

const LEGACY = "https://pub-efab6449b66449e6ad94fe42d2fd69ad.r2.dev";
const KEY = "/images/2026-10-31/13fbf424-f7d5-45c5-9a18-ec21836fbb46.jpg";

function withBaseUrl(base, run) {
  const previous = process.env.S3_PUBLIC_BASE_URL;
  if (base === undefined) delete process.env.S3_PUBLIC_BASE_URL;
  else process.env.S3_PUBLIC_BASE_URL = base;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.S3_PUBLIC_BASE_URL;
    else process.env.S3_PUBLIC_BASE_URL = previous;
  }
}

test("rewrites a retired R2 development host to the configured public base URL", () => {
  assert.equal(
    withBaseUrl("https://media.roblyne.com", () => normalizeMediaUrl(`${LEGACY}${KEY}`)),
    `https://media.roblyne.com${KEY}`,
  );
});

test("accepts a public base URL with a trailing slash", () => {
  assert.equal(
    withBaseUrl("https://media.roblyne.com/", () => normalizeMediaUrl(`${LEGACY}${KEY}`)),
    `https://media.roblyne.com${KEY}`,
  );
});

test("leaves unrelated hosts and non-matching values unchanged", () => {
  withBaseUrl("https://media.roblyne.com", () => {
    assert.equal(normalizeMediaUrl("https://example.com/a.jpg"), "https://example.com/a.jpg");
    assert.equal(normalizeMediaUrl(`${LEGACY}-evil.example${KEY}`), `${LEGACY}-evil.example${KEY}`);
    assert.equal(normalizeMediaUrl("data:image/png;base64,AAAA"), "data:image/png;base64,AAAA");
  });
});

test("does not rewrite when no public base URL is configured", () => {
  assert.equal(withBaseUrl(undefined, () => normalizeMediaUrl(`${LEGACY}${KEY}`)), `${LEGACY}${KEY}`);
});

test("rewrites legacy URLs embedded in server-rendered HTML", () => {
  const html = `<!doctype html><head><meta property="og:image" content="${LEGACY}${KEY}" /></head>`;
  const result = withBaseUrl("https://media.roblyne.com", () => normalizeMediaUrlsInText(html));
  assert.ok(result.includes(`content="https://media.roblyne.com${KEY}"`));
  assert.equal(result.includes(LEGACY), false);
});

test("text rewriting is a no-op when no public base URL is configured", () => {
  const html = `<img src="${LEGACY}${KEY}" />`;
  assert.equal(withBaseUrl(undefined, () => normalizeMediaUrlsInText(html)), html);
});

test("rewrites legacy URLs nested in response payloads while preserving other values", () => {
  const createdAt = new Date("2026-10-31T15:32:36.000Z");
  const payload = {
    items: [
      { id: 1, coverImageUrl: `${LEGACY}${KEY}`, organizationLogoUrl: null, createdAt },
      { id: 2, coverImageUrl: "https://example.com/keep.jpg", createdAt },
    ],
    title: "Lubak team",
    featured: [],
    trending: [{ heroImageUrl: `${LEGACY}${KEY}` }],
  };

  withBaseUrl("https://media.roblyne.com", () => normalizeMediaUrlsInPlace(payload));

  assert.equal(payload.items[0].coverImageUrl, `https://media.roblyne.com${KEY}`);
  assert.equal(payload.items[1].coverImageUrl, "https://example.com/keep.jpg");
  assert.equal(payload.trending[0].heroImageUrl, `https://media.roblyne.com${KEY}`);
  assert.equal(payload.items[0].organizationLogoUrl, null);
  assert.equal(payload.title, "Lubak team");
  assert.equal(payload.items[0].createdAt, createdAt);
  assert.equal(payload.items[0].createdAt.toISOString(), "2026-10-31T15:32:36.000Z");
});
