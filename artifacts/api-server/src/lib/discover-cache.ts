import { getRedis } from "./redis";
import { logger } from "./logger";

export const DISCOVER_CACHE_PREFIX = "evenum:discover:v2:";

/** Drop cached public discovery payloads after catalog-changing writes or lifecycle sweeps. */
export async function invalidateDiscoverCache(): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  try {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        `${DISCOVER_CACHE_PREFIX}*`,
        "COUNT",
        100,
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  } catch (error) {
    logger.warn({ err: error }, "Discover cache invalidation failed");
  }
}
