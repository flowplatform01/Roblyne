import app from "./app";
import { logger } from "./lib/logger";
import { sweepExpiredLifecycles } from "./lib/lifecycle";
import { registerMaintenanceSchedule, closeQueues, queueInfrastructureStatus } from "./lib/jobs";
import { closeRedis } from "./lib/redis";
import { validateApiStartupConfig } from "./lib/startup-config";
import { closeDatabasePool } from "@workspace/db";

import path from "node:path";
import fs from "node:fs";

if (!process.env.PORT || !process.env.DATABASE_URL) {
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

const rawPort = process.env["PORT"] ?? "8080";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

validateApiStartupConfig();

const server = app.listen(port, "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

function shouldRunInProcessLifecycleFallback(): boolean {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (process.env.NODE_ENV === "production" && redisUrl) {
    // Production with Redis expects the dedicated worker; avoid duplicate sweeps on every API replica.
    return false;
  }
  return true;
}

void (async () => {
  await registerMaintenanceSchedule();

  if (!shouldRunInProcessLifecycleFallback()) {
    logger.info("In-process lifecycle sweep disabled; Redis worker or request-time checks handle transitions");
    return;
  }

  // Safe single-process fallback for local development or environments without Redis.
  const runFallbackSweep = async () => {
    const currentQueueStatus = await queueInfrastructureStatus();
    if (currentQueueStatus.workerHealthy) return;
    await sweepExpiredLifecycles().catch((err) => {
      logger.error({ err }, "Lifecycle sweep failed");
    });
  };
  const lifecycleSweep = setInterval(() => {
    void runFallbackSweep();
  }, 30_000);
  lifecycleSweep.unref();
  void runFallbackSweep();
})();

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutting down API server");
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await closeQueues();
  await closeRedis();
  await closeDatabasePool();
  process.exit(0);
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

// Redis/BullMQ transient failures must not take down the HTTP process.
process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  if (
    message.includes("max retries per request")
    || message.includes("ECONNRESET")
    || message.includes("ECONNREFUSED")
    || message.includes("Connection is closed")
  ) {
    logger.warn({ err: reason }, "Unhandled Redis/network rejection absorbed by API");
    return;
  }
  logger.error({ err: reason }, "Unhandled promise rejection");
});
