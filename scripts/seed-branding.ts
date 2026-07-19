/**
 * Seed hero images + accent colors into all orgs and elections
 * Run: pnpm --filter @workspace/scripts run seed:branding
 */
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { electionsTable, organizationsTable } from "../lib/db/src/schema/index.js";
import { eq } from "drizzle-orm";

const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const picsum = (seed: string, w = 1400, h = 700) =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

async function main() {
  console.log("🎨 Seeding branding (hero images + accent colors)...\n");

  // --- Organizations ---
  const orgBranding: Array<{ id: number; hero: string; cover: string; accent: string }> = [
    { id: 1, hero: picsum("civic-hall"), cover: picsum("civic-hall", 1200, 630), accent: "#1E3A5F" },
    { id: 2, hero: picsum("greentech-lab"), cover: picsum("greentech-lab", 1200, 630), accent: "#1B7A4C" },
    { id: 3, hero: picsum("alumni-campus"), cover: picsum("alumni-campus", 1200, 630), accent: "#8B1A1A" },
  ];

  for (const o of orgBranding) {
    await db.update(organizationsTable).set({
      heroImageUrl: o.hero,
      coverImageUrl: o.cover,
      accentColor: o.accent,
      theme: "dark",
    }).where(eq(organizationsTable.id, o.id));
    console.log(`  ✓ Org ${o.id} branded`);
  }

  // Meridian Arts (dynamic ID — find by slug)
  const [meridian] = await db.select({ id: organizationsTable.id })
    .from(organizationsTable)
    .where(eq(organizationsTable.slug, "meridian-arts"))
    .limit(1);
  if (meridian) {
    await db.update(organizationsTable).set({
      heroImageUrl: picsum("arts-gallery"),
      coverImageUrl: picsum("arts-gallery", 1200, 630),
      accentColor: "#6B21A8",
      theme: "dark",
    }).where(eq(organizationsTable.id, meridian.id));
    console.log(`  ✓ Org ${meridian.id} (Meridian Arts) branded`);
  }

  // --- Elections ---
  const electionBranding: Array<{ id: number; hero: string; cover: string; accent: string }> = [
    { id: 1, hero: picsum("city-vote-hall"), cover: picsum("city-vote-hall", 1200, 630), accent: "#1E3A5F" },
    { id: 2, hero: picsum("solar-panels-green"), cover: picsum("solar-panels-green", 1200, 630), accent: "#1B7A4C" },
    { id: 3, hero: picsum("university-quad"), cover: picsum("university-quad", 1200, 630), accent: "#8B1A1A" },
    { id: 4, hero: picsum("art-studio-purple"), cover: picsum("art-studio-purple", 1200, 630), accent: "#6B21A8" },
  ];

  for (const e of electionBranding) {
    await db.update(electionsTable).set({
      heroImageUrl: e.hero,
      coverImageUrl: e.cover,
      accentColor: e.accent,
      theme: "dark",
    }).where(eq(electionsTable.id, e.id));
    console.log(`  ✓ Election ${e.id} branded`);
  }

  console.log("\n✅ Branding seed complete!");
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
