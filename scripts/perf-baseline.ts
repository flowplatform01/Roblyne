import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { performance } from "node:perf_hooks";
import { Client } from "pg";

type HttpScenario = {
  name: string;
  path: string;
  method?: string;
  body?: string;
};

type RequestResult = {
  ok: boolean;
  status: number | null;
  latencyMs: number;
  bytes: number;
  error?: string;
};

type ScenarioReport = {
  name: string;
  path: string;
  method: string;
  requests: number;
  concurrency: number;
  durationMs: number;
  throughputPerSecond: number;
  successCount: number;
  errorCount: number;
  statusCounts: Record<string, number>;
  totalBytes: number;
  bytesPerResponse: number;
  latencyMs: {
    min: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
    max: number;
  };
  errorSamples: string[];
};

type DatabaseSnapshot = {
  available: boolean;
  capturedAt: string;
  activeConnections?: number;
  totalConnections?: number;
  transactionsCommitted?: string;
  transactionsRolledBack?: string;
  blocksRead?: string;
  blocksHit?: string;
  tuplesReturned?: string;
  tuplesFetched?: string;
  error?: string;
};

type BaselineReport = {
  startedAt: string;
  finishedAt: string;
  basePath: string;
  configuration: {
    requestsPerScenario: number;
    concurrency: number;
    timeoutMs: number;
    scenarioCount: number;
    writeScenarioIncluded: boolean;
  };
  scenarios: ScenarioReport[];
  database: {
    before: DatabaseSnapshot;
    after: DatabaseSnapshot;
    delta: Record<string, string | number>;
  };
};

const apiOrigin = process.env.PERF_API_ORIGIN ?? "http://127.0.0.1:8080";
const apiBasePath = (process.env.PERF_API_BASE_PATH ?? "/api").replace(/\/+$/, "");
const requestsPerScenario = readPositiveInt("PERF_REQUESTS_PER_SCENARIO", 20);
const concurrency = readPositiveInt("PERF_CONCURRENCY", 8);
const timeoutMs = readPositiveInt("PERF_TIMEOUT_MS", 10_000);
const searchQuery = process.env.PERF_SEARCH_QUERY ?? "evenum";
const authCookie = process.env.PERF_AUTH_COOKIE;
const reportPath = process.env.PERF_REPORT_PATH ?? "reports/evenum-baseline.json";

function readPositiveInt(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function safeBasePath(): string {
  try {
    const url = new URL(`${apiOrigin}${apiBasePath}`);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "[invalid API URL]";
  }
}

function buildReadScenarios(): HttpScenario[] {
  const scenarios: HttpScenario[] = [
    { name: "health", path: "/healthz" },
    { name: "discover-all", path: "/discover?limit=24&sort=newest" },
    { name: "discover-elections", path: "/discover?limit=24&type=elections" },
    { name: "search", path: `/search?q=${encodeURIComponent(searchQuery)}` },
  ];

  if (authCookie) {
    scenarios.push({ name: "authenticated-me", path: "/auth/me" });

    const orgId = process.env.PERF_ORG_ID;
    if (orgId) {
      scenarios.push({
        name: "authenticated-finance-summary",
        path: `/organizations/${encodeURIComponent(orgId)}/finance`,
      });
    }
  }

  return scenarios;
}

function buildOptionalWriteScenario(): HttpScenario | null {
  const writePath = process.env.PERF_WRITE_PATH;
  if (!writePath) return null;

  if (process.env.PERF_RUN_WRITES !== "1" || process.env.PERF_ALLOW_WRITES !== "1") {
    throw new Error(
      "PERF_WRITE_PATH is set, but write tests require both PERF_RUN_WRITES=1 and PERF_ALLOW_WRITES=1.",
    );
  }

  return {
    name: "opt-in-write",
    path: writePath,
    method: process.env.PERF_WRITE_METHOD ?? "POST",
    body: process.env.PERF_WRITE_BODY,
  };
}

function headersFor(scenario: HttpScenario): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (authCookie) headers.Cookie = authCookie;
  if (scenario.body !== undefined) headers["Content-Type"] = "application/json";

  return headers;
}

async function requestOnce(scenario: HttpScenario): Promise<RequestResult> {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${apiOrigin}${apiBasePath}${scenario.path}`, {
      method: scenario.method ?? "GET",
      headers: headersFor(scenario),
      body: scenario.body,
      signal: controller.signal,
    });
    const payload = await response.arrayBuffer();

    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      latencyMs: performance.now() - started,
      bytes: payload.byteLength,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      latencyMs: performance.now() - started,
      bytes: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function percentile(values: number[], percentage: number): number {
  if (values.length === 0) return 0;
  const index = Math.min(values.length - 1, Math.ceil(values.length * percentage) - 1);
  return values[index] ?? 0;
}

async function runScenario(scenario: HttpScenario): Promise<ScenarioReport> {
  const totalRequests = scenario.name === "opt-in-write"
    ? readPositiveInt("PERF_WRITE_REQUESTS", requestsPerScenario)
    : requestsPerScenario;
  const started = performance.now();
  const results: RequestResult[] = [];
  let nextRequest = 0;

  async function worker(): Promise<void> {
    while (true) {
      const requestIndex = nextRequest++;
      if (requestIndex >= totalRequests) return;
      results[requestIndex] = await requestOnce(scenario);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, totalRequests) }, () => worker()),
  );

  const durationMs = performance.now() - started;
  const latencies = results.map((result) => result.latencyMs).sort((a, b) => a - b);
  const successful = results.filter((result) => result.ok).length;
  const statusCounts: Record<string, number> = {};
  const errorSamples: string[] = [];

  for (const result of results) {
    const status = result.status === null ? "network-error" : String(result.status);
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
    if (result.error && errorSamples.length < 5) errorSamples.push(result.error);
  }

  const totalBytes = results.reduce((sum, result) => sum + result.bytes, 0);
  const average = latencies.reduce((sum, value) => sum + value, 0) / Math.max(1, latencies.length);

  return {
    name: scenario.name,
    path: scenario.path,
    method: scenario.method ?? "GET",
    requests: totalRequests,
    concurrency: Math.min(concurrency, totalRequests),
    durationMs,
    throughputPerSecond: totalRequests / Math.max(0.001, durationMs / 1000),
    successCount: successful,
    errorCount: totalRequests - successful,
    statusCounts,
    totalBytes,
    bytesPerResponse: totalBytes / Math.max(1, totalRequests),
    latencyMs: {
      min: latencies[0] ?? 0,
      avg: average,
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      p99: percentile(latencies, 0.99),
      max: latencies[latencies.length - 1] ?? 0,
    },
    errorSamples,
  };
}

async function captureDatabaseSnapshot(): Promise<DatabaseSnapshot> {
  const capturedAt = new Date().toISOString();
  if (!process.env.DATABASE_URL) {
    return { available: false, capturedAt, error: "DATABASE_URL is not set" };
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const connections = await client.query<{ active_connections: number; total_connections: number }>(`
      SELECT
        COUNT(*) FILTER (WHERE state = 'active')::int AS active_connections,
        COUNT(*)::int AS total_connections
      FROM pg_stat_activity
      WHERE datname = current_database()
    `);
    const database = await client.query<{
      xact_commit: string;
      xact_rollback: string;
      blks_read: string;
      blks_hit: string;
      tup_returned: string;
      tup_fetched: string;
    }>(`
      SELECT xact_commit, xact_rollback, blks_read, blks_hit, tup_returned, tup_fetched
      FROM pg_stat_database
      WHERE datname = current_database()
    `);
    const connectionRow = connections.rows[0];
    const databaseRow = database.rows[0];

    return {
      available: true,
      capturedAt,
      activeConnections: connectionRow?.active_connections ?? 0,
      totalConnections: connectionRow?.total_connections ?? 0,
      transactionsCommitted: databaseRow?.xact_commit ?? "0",
      transactionsRolledBack: databaseRow?.xact_rollback ?? "0",
      blocksRead: databaseRow?.blks_read ?? "0",
      blocksHit: databaseRow?.blks_hit ?? "0",
      tuplesReturned: databaseRow?.tup_returned ?? "0",
      tuplesFetched: databaseRow?.tup_fetched ?? "0",
    };
  } catch {
    return {
      available: false,
      capturedAt,
      error: "PostgreSQL statistics could not be read",
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

function numericDelta(before: string | number | undefined, after: string | number | undefined): string | number {
  if (typeof before === "number" && typeof after === "number") return after - before;
  return String(Number(after ?? 0) - Number(before ?? 0));
}

function databaseDelta(before: DatabaseSnapshot, after: DatabaseSnapshot): Record<string, string | number> {
  return {
    activeConnections: numericDelta(before.activeConnections, after.activeConnections),
    totalConnections: numericDelta(before.totalConnections, after.totalConnections),
    transactionsCommitted: numericDelta(before.transactionsCommitted, after.transactionsCommitted),
    transactionsRolledBack: numericDelta(before.transactionsRolledBack, after.transactionsRolledBack),
    blocksRead: numericDelta(before.blocksRead, after.blocksRead),
    blocksHit: numericDelta(before.blocksHit, after.blocksHit),
    tuplesReturned: numericDelta(before.tuplesReturned, after.tuplesReturned),
    tuplesFetched: numericDelta(before.tuplesFetched, after.tuplesFetched),
  };
}

function printSummary(report: BaselineReport): void {
  console.log(`Evenum performance baseline: ${report.basePath}`);
  console.log(
    `Configuration: ${report.configuration.requestsPerScenario} requests/scenario, ` +
    `${report.configuration.concurrency} concurrent workers, ${report.configuration.timeoutMs}ms timeout`,
  );
  console.table(
    report.scenarios.map((scenario) => ({
      scenario: scenario.name,
      requests: scenario.requests,
      success: scenario.successCount,
      errors: scenario.errorCount,
      p50_ms: scenario.latencyMs.p50.toFixed(1),
      p95_ms: scenario.latencyMs.p95.toFixed(1),
      p99_ms: scenario.latencyMs.p99.toFixed(1),
      req_per_s: scenario.throughputPerSecond.toFixed(2),
      bytes: Math.round(scenario.bytesPerResponse),
    })),
  );
  console.log(`Report written to ${reportPath}`);
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const scenarios = buildReadScenarios();
  const optionalWrite = buildOptionalWriteScenario();
  if (optionalWrite) scenarios.push(optionalWrite);

  const databaseBefore = await captureDatabaseSnapshot();
  const scenarioReports: ScenarioReport[] = [];

  for (const scenario of scenarios) {
    scenarioReports.push(await runScenario(scenario));
  }

  const databaseAfter = await captureDatabaseSnapshot();
  const report: BaselineReport = {
    startedAt,
    finishedAt: new Date().toISOString(),
    basePath: safeBasePath(),
    configuration: {
      requestsPerScenario,
      concurrency,
      timeoutMs,
      scenarioCount: scenarios.length,
      writeScenarioIncluded: Boolean(optionalWrite),
    },
    scenarios: scenarioReports,
    database: {
      before: databaseBefore,
      after: databaseAfter,
      delta: databaseDelta(databaseBefore, databaseAfter),
    },
  };

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  printSummary(report);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});