import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const users = await pool.query(
    `SELECT id, email, name, length(password_hash) AS hash_len, is_platform_admin, created_at
     FROM users ORDER BY id DESC LIMIT 20`,
  );
  console.log("Recent users:", users.rowCount);
  for (const r of users.rows) {
    console.log(JSON.stringify(r));
  }

  const tables = await pool.query(
    `SELECT to_regclass('public.session') AS session_table, to_regclass('public.users') AS users_table`,
  );
  console.log("Tables:", tables.rows[0]);

  const sessionCols = await pool.query(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'session'
     ORDER BY ordinal_position`,
  );
  console.log(
    "Session columns:",
    sessionCols.rows.map((r) => `${r.column_name}:${r.data_type}`).join(", ") || "(none)",
  );

  const userCols = await pool.query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users'
     ORDER BY ordinal_position`,
  );
  console.log("Users columns:", userCols.rows.map((r) => r.column_name).join(", "));

  const gaps = await pool.query(
    `SELECT id, email, created_at FROM users WHERE id >= 24 ORDER BY id`,
  );
  console.log("Users id>=24:", gaps.rowCount);
  for (const row of gaps.rows) {
    console.log(row.id, row.email, row.created_at.toISOString());
  }

  const maxId = await pool.query(`SELECT MAX(id) AS max_id, COUNT(*) AS total FROM users`);
  console.log("User stats:", maxId.rows[0]);
} catch (e) {
  console.error("DB error:", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
