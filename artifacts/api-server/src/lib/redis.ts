import Redis from "ioredis";
import { logger } from "./logger";

const redisUrl = process.env.REDIS_URL?.trim();
export const MAINTENANCE_WORKER_HEARTBEAT_KEY = "evenum:maintenance:worker:heartbeat";
export const MAINTENANCE_WORKER_HEARTBEAT_TTL_SECONDS = 45;
let client: Redis | null = null;
let connectPromise: Promise<Redis> | null = null;
let unavailableUntil = 0;

export const redisConfigured = Boolean(redisUrl);

function getClient(): Redis | null {
  if (!redisUrl) return null;
  if (!client) {
    client = new Redis(redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 1_500,
      retryStrategy: (attempt) => Math.min(attempt * 250, 2_000),
    });
    client.on("error", (error) => {
      logger.warn({ err: error }, "Redis connection error; using database fallback where possible");
    });
  }
  return client;
}

export async function getRedis(): Promise<Redis | null> {
  const redis = getClient();
  if (!redis) return null;
  if (Date.now() < unavailableUntil) return null;
  if (redis.status === "ready") return redis;
  if (!connectPromise) {
    connectPromise = redis.connect().then(() => redis).catch((error) => {
      unavailableUntil = Date.now() + 5_000;
      logger.warn({ err: error }, "Redis unavailable; continuing without shared cache or coordination");
      return redis;
    }).finally(() => {
      connectPromise = null;
    });
  }
  await connectPromise;
  return (redis as unknown as { status: string }).status === "ready" ? redis : null;
}

export async function pingRedis(): Promise<{ configured: boolean; ok: boolean }> {
  if (!redisUrl) return { configured: false, ok: true };
  const redis = await getRedis();
  if (!redis) return { configured: true, ok: false };
  try {
    await redis.ping();
    return { configured: true, ok: true };
  } catch (error) {
    logger.warn({ err: error }, "Redis health check failed");
    return { configured: true, ok: false };
  }
}

export async function getJson<T>(key: string): Promise<T | null> {
  const redis = await getRedis();
  if (!redis) return null;
  try {
    const value = await redis.get(key);
    return value ? JSON.parse(value) as T : null;
  } catch (error) {
    logger.warn({ err: error, key }, "Redis cache read failed");
    return null;
  }
}

export async function setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (error) {
    logger.warn({ err: error, key }, "Redis cache write failed");
  }
}

export async function recordMaintenanceWorkerHeartbeat(): Promise<boolean> {
  const redis = await getRedis();
  if (!redis) return false;
  try {
    await redis.set(
      MAINTENANCE_WORKER_HEARTBEAT_KEY,
      String(Date.now()),
      "EX",
      MAINTENANCE_WORKER_HEARTBEAT_TTL_SECONDS,
    );
    return true;
  } catch (error) {
    logger.warn({ err: error }, "Could not record maintenance worker heartbeat");
    return false;
  }
}

export async function hasFreshMaintenanceWorkerHeartbeat(): Promise<boolean> {
  const redis = await getRedis();
  if (!redis) return false;
  try {
    const rawTimestamp = await redis.get(MAINTENANCE_WORKER_HEARTBEAT_KEY);
    const timestamp = Number(rawTimestamp);
    return Number.isFinite(timestamp)
      && Date.now() - timestamp <= MAINTENANCE_WORKER_HEARTBEAT_TTL_SECONDS * 1_000;
  } catch (error) {
    logger.warn({ err: error }, "Could not read maintenance worker heartbeat");
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  if (client && client.status !== "end") {
    await client.quit().catch(() => undefined);
  }
  client = null;
  unavailableUntil = 0;
}