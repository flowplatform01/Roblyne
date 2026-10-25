/**
 * Starts a local embedded PostgreSQL server for ROBLYNE development.
 * Data persists in .pgdata at the project root.
 *
 * Usage:  pnpm exec tsx scripts/start-postgres.ts
 *         PGPORT=5433 pnpm exec tsx scripts/start-postgres.ts
 */
import EmbeddedPostgres from "embedded-postgres";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../.pgdata");
const port = Number(process.env.PGPORT ?? "5432");
const password = process.env.PGPASSWORD ?? "postgres";

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "postgres",
    password,
    port,
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });

  const alreadyInitialised = fs.existsSync(path.join(dataDir, "PG_VERSION"));
  if (!alreadyInitialised) {
    console.log(`Initialising PostgreSQL in ${dataDir}...`);
    await pg.initialise();
  } else {
    console.log(`Using existing PostgreSQL data in ${dataDir}`);
  }

  console.log(`Starting PostgreSQL on port ${port}...`);
  try {
    await pg.start();
  } catch (err: any) {
    const msg = String(err?.message ?? err ?? "");
    if (
      msg.includes("postmaster.pid") ||
      msg.includes("EADDRINUSE") ||
      msg.includes("already exists")
    ) {
      console.log(
        `PostgreSQL appears to already be running on port ${port}. Continuing.`,
      );
      await new Promise(() => {});
      return;
    }
    throw err;
  }

  try {
    await pg.createDatabase("roblyne_dev");
    console.log("Created database: roblyne_dev");
  } catch {
    console.log("Database roblyne_dev already exists, continuing.");
  }

  console.log(
    `PostgreSQL ready: postgresql://postgres:${password}@localhost:${port}/roblyne_dev`,
  );
  console.log("Press Ctrl+C to stop.");

  const shutdown = async () => {
    console.log("\nStopping PostgreSQL...");
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Keep the process alive
  await new Promise(() => {});
}

main().catch((err) => {
  console.error("Failed to start PostgreSQL:", err);
  process.exit(1);
});
