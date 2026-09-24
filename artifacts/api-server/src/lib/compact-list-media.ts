const embeddedMediaFields = [
  "logoUrl",
  "coverImageUrl",
  "heroImageUrl",
  "organizationLogoUrl",
] as const;

/**
 * List endpoints are allowed to return remote image URLs, but embedded data
 * URLs can be megabytes long and are duplicated across many cards. Detail
 * endpoints still return the original media for full-page views and editing.
 */
export function compactListMedia<T extends Record<string, unknown>>(row: T): T {
  const compacted = { ...row } as Record<string, unknown>;

  for (const field of embeddedMediaFields) {
    const value = compacted[field];
    if (typeof value === "string" && value.startsWith("data:")) {
      compacted[field] = null;
    }
  }

  return compacted as T;
}