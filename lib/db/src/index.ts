import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  try {
    const rootEnv = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env");
    if (fs.existsSync(rootEnv)) {
      process.loadEnvFile(rootEnv);
    }
  } catch {}
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

function readPoolInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: readPoolInt("DATABASE_POOL_MAX", 5),
  idleTimeoutMillis: readPoolInt("DATABASE_POOL_IDLE_TIMEOUT_MS", 30_000),
  connectionTimeoutMillis: readPoolInt("DATABASE_POOL_CONNECTION_TIMEOUT_MS", 8_000),
});
export const db = drizzle(pool, { schema });

export async function closeDatabasePool(): Promise<void> {
  await pool.end();
}

export * from "./schema";
