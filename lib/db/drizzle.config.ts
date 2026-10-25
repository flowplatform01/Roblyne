import { defineConfig } from "drizzle-kit";
import path from "path";

import fs from "fs";

if (!process.env.DATABASE_URL) {
  const rootEnv = path.resolve(__dirname, "../../.env");
  if (fs.existsSync(rootEnv)) {
    try {
      process.loadEnvFile(rootEnv);
    } catch {}
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
