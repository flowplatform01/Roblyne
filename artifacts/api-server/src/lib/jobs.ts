import { Queue } from "bullmq";
import { logger } from "./logger";
import { redisConfigured } from "./redis";

const queueConnection = process.env.REDIS_URL
  ? { url: process.env.REDIS_URL, maxRetriesPerRequest: null as null }
  : null;

export const maintenanceQueue = queueConnection
  ? new Queue("evenum-maintenance", { connection: queueConnection })
  : null;

export async function registerMaintenanceSchedule(): Promise<boolean> {
  if (!maintenanceQueue) return false;

  try {
    await maintenanceQueue.add(
      "lifecycle-sweep",
      { source: "scheduler" },
      {
        jobId: "lifecycle-sweep",
        repeat: { every: 30_000 },
        removeOnComplete: 10,
        removeOnFail: 100,
      },
    );
    logger.info("Registered Redis-backed lifecycle maintenance schedule");
    return true;
  } catch (error) {
    logger.error({ err: error }, "Could not register maintenance schedule");
    return false;
  }
}

export async function closeQueues(): Promise<void> {
  if (maintenanceQueue) {
    await maintenanceQueue.close().catch((error: unknown) => {
      logger.warn({ err: error }, "Could not close maintenance queue cleanly");
    });
  }
}

export function queueInfrastructureStatus(): {
  configured: boolean;
  enabled: boolean;
} {
  return { configured: redisConfigured, enabled: Boolean(maintenanceQueue) };
}