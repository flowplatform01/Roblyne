/**
 * Migration: add monetization columns to elections table
 * Run: pnpm --filter @workspace/scripts run migrate:election-monetization
 */
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { sql } from "drizzle-orm";

const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function main() {
  console.log("🔧 Running election monetization migration...\n");

  await db.execute(sql`
    ALTER TABLE elections
      ADD COLUMN IF NOT EXISTS requires_payment boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS payment_amount   decimal(10,2),
      ADD COLUMN IF NOT EXISTS currency         text NOT NULL DEFAULT 'XAF'
  `);

  console.log("  ✓ Added requires_payment, payment_amount, currency to elections\n");
  console.log("✅ Migration complete!");
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
