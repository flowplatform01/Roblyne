import rateLimit from "express-rate-limit";
import { getRedis } from "../lib/redis";

type RedisRateLimitStore = {
  prefix: string;
  increment: (key: string) => Promise<{ totalHits: number; resetTime: Date }>;
  decrement: (key: string) => Promise<void>;
  resetKey: (key: string) => Promise<void>;
};

function createRedisStore(prefix: string): RedisRateLimitStore | undefined {
  if (!process.env.REDIS_URL) return undefined;
  const fallback = new Map<string, { totalHits: number; resetTime: number }>();

  function localIncrement(key: string) {
    const current = fallback.get(key);
    const now = Date.now();
    if (!current || current.resetTime <= now) {
      const next = { totalHits: 1, resetTime: now + 60_000 };
      fallback.set(key, next);
      return next;
    }
    current.totalHits += 1;
    return current;
  }

  return {
    prefix,
    async increment(key) {
      const redis = await getRedis();
      if (!redis) {
        const local = localIncrement(key);
        return { totalHits: local.totalHits, resetTime: new Date(local.resetTime) };
      }
      try {
        const redisKey = `${prefix}:${key}`;
        const results = await redis.multi().incr(redisKey).pttl(redisKey).exec();
        const totalHits = Number(results?.[0]?.[1] ?? 0);
        const ttlMs = Number(results?.[1]?.[1] ?? -1);
        if (ttlMs < 0) await redis.pexpire(redisKey, 60_000);
        return {
          totalHits,
          resetTime: new Date(Date.now() + (ttlMs > 0 ? ttlMs : 60_000)),
        };
      } catch {
        const local = localIncrement(key);
        return { totalHits: local.totalHits, resetTime: new Date(local.resetTime) };
      }
    },
    async decrement(key) {
      const redis = await getRedis();
      if (redis) {
        await redis.decr(`${prefix}:${key}`);
      } else {
        const current = fallback.get(key);
        if (current) current.totalHits = Math.max(0, current.totalHits - 1);
      }
    },
    async resetKey(key) {
      const redis = await getRedis();
      if (redis) await redis.del(`${prefix}:${key}`);
      fallback.delete(key);
    },
  };
}

const isDev = process.env.NODE_ENV !== "production";

// General ceiling for all API traffic — generous enough for normal browsing/polling.
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: isDev ? 10_000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
  store: createRedisStore("evenum:ratelimit:api") as never,
});

// Limit on auth endpoints (login/register) to blunt credential-stuffing / brute force.
// In development this is effectively off so testing multiple accounts is painless.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isDev ? 10_000 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Please wait a few minutes and try again." },
  store: createRedisStore("evenum:ratelimit:auth") as never,
});

// Brute-force protection for the first-administrator setup code.
export const bootstrapLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: isDev ? 100 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many setup-code attempts. Please wait before trying again." },
  store: createRedisStore("evenum:ratelimit:bootstrap") as never,
});

// Tighter limit specifically on state-changing requests (votes, registrations, submissions).
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: isDev ? 10_000 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS",
  message: { error: "Too many submissions in a short time. Please slow down." },
  store: createRedisStore("evenum:ratelimit:write") as never,
});

// Targeted limit on the public search/discover endpoints to prevent scraping or DoS.
// These endpoints are read-only but can be expensive (ILIKE queries across multiple tables).
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: isDev ? 10_000 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many search requests. Please slow down." },
  store: createRedisStore("evenum:ratelimit:search") as never,
});
