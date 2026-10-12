const SAFE_HTTP_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function normalizeHttpOrigin(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:")
      || url.username
      || url.password
      || url.pathname !== "/"
      || url.search
      || url.hash
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function parseCorsAllowedOrigins(value: string | undefined): Set<string> {
  const origins = new Set<string>();
  for (const entry of (value ?? "").split(",").map(origin => origin.trim()).filter(Boolean)) {
    const origin = normalizeHttpOrigin(entry);
    if (!origin) {
      throw new Error(
        `Invalid CORS_ALLOWED_ORIGINS entry "${entry}". Use comma-separated HTTP(S) origins without paths.`,
      );
    }
    origins.add(origin);
  }
  return origins;
}

export function isCorsOriginAllowed(
  origin: string | undefined,
  allowedOrigins: ReadonlySet<string>,
): boolean {
  const normalizedOrigin = normalizeHttpOrigin(origin);
  return normalizedOrigin !== null && allowedOrigins.has(normalizedOrigin);
}

export function isWriteRequestOriginAllowed(input: {
  method: string;
  origin: string | undefined;
  requestOrigin: string | undefined;
  secFetchSite: string | undefined;
  allowedOrigins: ReadonlySet<string>;
}): boolean {
  if (SAFE_HTTP_METHODS.has(input.method.toUpperCase())) return true;

  if (!input.origin) {
    // Server-to-server clients such as payment webhooks have no browser origin.
    // Reject browser-marked cross-site requests even if the Origin header is absent.
    return input.secFetchSite?.toLowerCase() !== "cross-site";
  }

  const origin = normalizeHttpOrigin(input.origin);
  if (!origin) return false;

  const requestOrigin = normalizeHttpOrigin(input.requestOrigin);
  return origin === requestOrigin || input.allowedOrigins.has(origin);
}
