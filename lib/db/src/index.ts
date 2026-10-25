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

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,                        // Replit internal Postgres has a low connection limit
  idleTimeoutMillis: 30_000,     // release idle connections after 30s
  connectionTimeoutMillis: 8_000, // fail fast if pool is exhausted (vs. waiting forever)
});
export const db = drizzle(pool, { schema });

export * from "./schema";
