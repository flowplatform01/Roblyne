const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, "") || null;

if (import.meta.env.PROD && !configuredApiUrl) {
  throw new Error("VITE_API_URL is required for a production ROBLYNE web build");
}

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (configuredApiUrl) return `${configuredApiUrl}${normalizedPath}`;

  const basePath = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  return `${basePath}${normalizedPath}`;
}

export function getApiUrl(): string | null {
  return configuredApiUrl;
}
