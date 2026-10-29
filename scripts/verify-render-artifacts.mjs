import { access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const requiredArtifacts = [
  "artifacts/api-server/dist/index.mjs",
  "artifacts/api-server/dist/worker.mjs",
  "artifacts/roblyne/dist/public/index.html",
];

let failed = false;
for (const relativePath of requiredArtifacts) {
  try {
    await access(path.resolve(process.cwd(), relativePath), constants.R_OK);
    console.log(`PASS artifact ${relativePath}`);
  } catch {
    failed = true;
    console.error(`FAIL artifact ${relativePath} is missing. Run the matching production build first.`);
  }
}

process.exitCode = failed ? 1 : 0;
