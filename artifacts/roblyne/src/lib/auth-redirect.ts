export function getSafeAuthReturnPath(search = window.location.search): string | null {
  const next = new URLSearchParams(search).get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export function loginPathForCurrentLocation(): string {
  const requestedPath = `${window.location.pathname}${window.location.search}`;
  return `/login?next=${encodeURIComponent(requestedPath)}`;
}
