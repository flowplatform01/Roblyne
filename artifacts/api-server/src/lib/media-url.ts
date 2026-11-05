/**
 * Media URLs are persisted as absolute URLs at upload time (for example
 * `https://<public-base>/images/<date>/<uuid>.jpg`). When the public media base
 * URL changes — such as moving from the temporary R2 `r2.dev` host to a custom
 * CDN domain — previously stored rows keep the old host. Retiring that old host
 * then breaks every existing image and preview even though the objects are still
 * present in the same bucket.
 *
 * Requests are normalized to the currently configured `S3_PUBLIC_BASE_URL` so
 * existing records keep rendering without rewriting the stored data.
 */
const LEGACY_MEDIA_BASE_URLS = [
  // Temporary Cloudflare R2 development host retired in favour of media.roblyne.com.
  "https://pub-efab6449b66449e6ad94fe42d2fd69ad.r2.dev",
];

function currentMediaBaseUrl(): string | null {
  const value = process.env.S3_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
  return value || null;
}

/** Rewrites a single stored media URL from a legacy host to the configured host. */
export function normalizeMediaUrl(value: string): string {
  const base = currentMediaBaseUrl();
  if (!base) return value;
  for (const legacy of LEGACY_MEDIA_BASE_URLS) {
    if (value.startsWith(`${legacy}/`)) {
      return `${base}${value.slice(legacy.length)}`;
    }
  }
  return value;
}

/** Rewrites every occurrence of a retired media base URL inside a text payload (server-rendered HTML). */
export function normalizeMediaUrlsInText(text: string): string {
  const base = currentMediaBaseUrl();
  if (!base) return text;
  let result = text;
  for (const legacy of LEGACY_MEDIA_BASE_URLS) {
    result = result.split(`${legacy}/`).join(`${base}/`);
  }
  return result;
}

function rewrite(value: unknown): unknown {
  return typeof value === "string" && value.startsWith("http") ? normalizeMediaUrl(value) : value;
}

/**
 * Recursively rewrites legacy media URLs inside a response payload in place.
 * Dates, buffers, and other non-plain objects are left untouched because they
 * expose no enumerable string media fields.
 */
export function normalizeMediaUrlsInPlace(value: unknown, seen = new WeakSet<object>()): void {
  if (Array.isArray(value)) {
    if (seen.has(value)) return;
    seen.add(value);
    for (let index = 0; index < value.length; index += 1) {
      const entry = value[index];
      if (typeof entry === "string") {
        value[index] = rewrite(entry);
      } else if (entry && typeof entry === "object") {
        normalizeMediaUrlsInPlace(entry, seen);
      }
    }
    return;
  }

  if (value && typeof value === "object") {
    if (seen.has(value)) return;
    seen.add(value);
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      const entry = record[key];
      if (typeof entry === "string") {
        record[key] = rewrite(entry);
      } else if (entry && typeof entry === "object") {
        normalizeMediaUrlsInPlace(entry, seen);
      }
    }
  }
}
