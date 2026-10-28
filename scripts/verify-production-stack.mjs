/**
 * Smoke-check that API and worker health endpoints respond.
 * Usage: node scripts/verify-production-stack.mjs
 * Env: VERIFY_API_ORIGIN (default http://127.0.0.1:8080)
 *      VERIFY_WORKER_ORIGIN (default http://127.0.0.1:8091)
 */
const apiOrigin = process.env.VERIFY_API_ORIGIN ?? "http://127.0.0.1:8080";
const workerOrigin = process.env.VERIFY_WORKER_ORIGIN ?? "http://127.0.0.1:8091";
const timeoutMs = Number(process.env.VERIFY_TIMEOUT_MS ?? 5000);

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

const checks = [
  { name: "api-healthz", url: `${apiOrigin.replace(/\/+$/, "")}/api/healthz`, required: true },
  { name: "api-readyz", url: `${apiOrigin.replace(/\/+$/, "")}/api/readyz`, required: false },
  { name: "worker-healthz", url: `${workerOrigin.replace(/\/+$/, "")}/healthz`, required: false },
];

let failed = false;
for (const check of checks) {
  try {
    const result = await fetchJson(check.url);
    const pass = result.ok;
    console.log(`${pass ? "PASS" : "FAIL"} ${check.name} ${check.url} (${result.status})`);
    if (!pass && check.required) failed = true;
    if (!pass && !check.required) console.log(`  optional: ${JSON.stringify(result.body)}`);
  } catch (error) {
    console.log(`FAIL ${check.name} ${check.url} (${error instanceof Error ? error.message : String(error)})`);
    if (check.required) failed = true;
  }
}

process.exit(failed ? 1 : 0);
