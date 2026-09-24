import { Worker } from "bullmq";
import { sweepExpiredLifecycles } from "./lib/lifecycle";
import { logger } from "./lib/logger";
import { recordMaintenanceWorkerHeartbeat } from "./lib/redis";

const redisUrl = process.env.REDIS_URL?.trim();

if (!redisUrl) {
  logger.fatal("REDIS_URL is required when starting the Evenum worker");
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

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Stopping background worker");
  clearInterval(heartbeatInterval);
  await worker.close();
  process.exit(0);
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));