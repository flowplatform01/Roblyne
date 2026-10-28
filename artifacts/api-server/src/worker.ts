import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { Worker } from "bullmq";
import { sweepExpiredLifecycles } from "./lib/lifecycle";
import { logger } from "./lib/logger";
import { closeRedis, pingRedis, recordMaintenanceWorkerHeartbeat } from "./lib/redis";
import { validateWorkerStartupConfig } from "./lib/startup-config";
import { closeDatabasePool } from "@workspace/db";

if (!process.env.DATABASE_URL || !process.env.REDIS_URL) {
  try {
    const rootEnv = path.resolve(process.cwd(), "../../.env");
    const fallbackEnv = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(rootEnv)) {
      process.loadEnvFile(rootEnv);
    } else if (fs.existsSync(fallbackEnv)) {
      process.loadEnvFile(fallbackEnv);
    }
  } catch {}
}

validateWorkerStartupConfig();

const redisUrl = process.env.REDIS_URL!.trim();

const healthPort = Number(process.env.PORT ?? process.env.WORKER_HEALTH_PORT ?? "8091");
if (!Number.isFinite(healthPort) || healthPort <= 0) {
  logger.fatal({ WORKER_HEALTH_PORT: process.env.WORKER_HEALTH_PORT }, "Invalid WORKER_HEALTH_PORT");
  process.exit(1);
}

const worker = new Worker(
  "evenum-maintenance",
  async (job) => {
    if (job.name === "lifecycle-sweep") {
      await sweepExpiredLifecycles();
      return { completedAt: new Date().toISOString() };
    }
    throw new Error(`Unknown maintenance job: ${job.name}`);
  },
  {
    connection: { url: redisUrl, maxRetriesPerRequest: null },
    concurrency: 1,
    limiter: { max: 1, duration: 5_000 },
    lockDuration: 120_000,
  },
);

const heartbeatInterval = setInterval(() => {
  void recordMaintenanceWorkerHeartbeat();
}, 15_000);
heartbeatInterval.unref();
void recordMaintenanceWorkerHeartbeat();

worker.on("completed", (job) => logger.info({ jobId: job.id, name: job.name }, "Background job completed"));
worker.on("failed", (job, error) => logger.error({ err: error, jobId: job?.id, name: job?.name }, "Background job failed"));
worker.on("error", (error) => logger.error({ err: error }, "Background worker error"));

const healthServer = http.createServer((req, res) => {
  if (req.url === "/healthz" || req.url === "/") {
    void pingRedis().then((redis) => {
      const ready = redis.configured && redis.ok;
      res.writeHead(ready ? 200 : 503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: ready ? "ok" : "degraded",
        service: "roblyne-worker",
        redis,
      }));
    }).catch(() => {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "error", service: "roblyne-worker" }));
    });
    return;
  }
  res.writeHead(404);
  res.end();
});

healthServer.listen(healthPort, "0.0.0.0", () => {
  logger.info({ healthPort }, "Worker health server listening");
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Stopping background worker");
  clearInterval(heartbeatInterval);
  await new Promise<void>((resolve) => healthServer.close(() => resolve()));
  await worker.close();
  await closeRedis();
  await closeDatabasePool();
  process.exit(0);
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  if (
    message.includes("max retries per request")
    || message.includes("ECONNRESET")
    || message.includes("ECONNREFUSED")
    || message.includes("Connection is closed")
  ) {
    logger.warn({ err: reason }, "Unhandled Redis/network rejection absorbed by worker");
    return;
  }
  logger.error({ err: reason }, "Unhandled promise rejection in worker");
});
