import { randomUUID } from "node:crypto";
import { Queue } from "bullmq";
import { logger } from "./logger";
import {
  getRedis,
  hasFreshMaintenanceWorkerHeartbeat,
  MAINTENANCE_SCHEDULER_LOCK_KEY,
  MAINTENANCE_SCHEDULER_LOCK_TTL_SECONDS,
  redisConfigured,
} from "./redis";

const schedulerInstanceId = process.env.INSTANCE_ID?.trim() || randomUUID();
let schedulerLockRenewal: ReturnType<typeof setInterval> | null = null;

const queueConnection = process.env.REDIS_URL
  ? { url: process.env.REDIS_URL, maxRetriesPerRequest: null as null }
  : null;

export const maintenanceQueue = queueConnection
  ? new Queue("evenum-maintenance", { connection: queueConnection })
  : null;

export const paymentRecoveryQueue = queueConnection
  ? new Queue("evenum-payment-recovery", { connection: queueConnection })
  : null;

if (maintenanceQueue) {
  maintenanceQueue.on("error", (error) => {
    logger.warn({ err: error }, "Maintenance queue Redis error; API continues without crashing");
  });
}

if (paymentRecoveryQueue) {
  paymentRecoveryQueue.on("error", (error) => {
    logger.warn({ err: error }, "Payment recovery queue Redis error");
  });
}

export async function schedulePaymentRecovery(paymentIntentId: number, attempt = 0): Promise<void> {
  if (!paymentRecoveryQueue) return;
  const delay = Math.min(60_000 * 2 ** attempt, 30 * 60_000);
  await paymentRecoveryQueue.add(
    "reconcile-payment",
    { paymentIntentId, attempt },
    {
      jobId: `payment-recovery-${paymentIntentId}-${attempt}`,
      delay,
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  );
}

async function holdsMaintenanceSchedulerLock(): Promise<boolean> {
  const redis = await getRedis();
  if (!redis) return true;

  const acquired = await redis.set(
    MAINTENANCE_SCHEDULER_LOCK_KEY,
    schedulerInstanceId,
    "EX",
    MAINTENANCE_SCHEDULER_LOCK_TTL_SECONDS,
    "NX",
  );
  if (acquired === "OK") return true;

  const owner = await redis.get(MAINTENANCE_SCHEDULER_LOCK_KEY);
  if (owner !== schedulerInstanceId) return false;

  await redis.expire(MAINTENANCE_SCHEDULER_LOCK_KEY, MAINTENANCE_SCHEDULER_LOCK_TTL_SECONDS);
  return true;
}

function startSchedulerLockRenewal(): void {
  if (schedulerLockRenewal) return;
  schedulerLockRenewal = setInterval(() => {
    void holdsMaintenanceSchedulerLock();
  }, 45_000);
  schedulerLockRenewal.unref();
}

export async function registerMaintenanceSchedule(): Promise<boolean> {
  if (!maintenanceQueue) return false;

  const canRegister = await holdsMaintenanceSchedulerLock();
  if (!canRegister) {
    logger.info({ schedulerInstanceId }, "Another API instance owns maintenance schedule registration");
    return true;
  }
  startSchedulerLockRenewal();

  try {
    await maintenanceQueue.add(
      "lifecycle-sweep",
      { source: "scheduler" },
      {
        jobId: "lifecycle-sweep",
        repeat: { every: 30_000 },
        attempts: 5,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: 25,
        removeOnFail: 200,
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
  if (paymentRecoveryQueue) {
    await paymentRecoveryQueue.close().catch((error: unknown) => {
      logger.warn({ err: error }, "Could not close payment recovery queue cleanly");
    });
  }
}

export async function queueInfrastructureStatus(): Promise<{
  configured: boolean;
  enabled: boolean;
  workerHealthy: boolean | null;
  queues: Record<string, Record<string, number> | null>;
}> {
  const readCounts = async (queue: Queue | null): Promise<Record<string, number> | null> => {
    if (!queue) return null;
    try {
      return await queue.getJobCounts("waiting", "active", "delayed", "completed", "failed");
    } catch (error) {
      logger.warn({ err: error, queue: queue.name }, "Could not read queue metrics");
      return null;
    }
  };

  return {
    configured: redisConfigured,
    enabled: Boolean(maintenanceQueue),
    workerHealthy: maintenanceQueue ? await hasFreshMaintenanceWorkerHeartbeat() : null,
    queues: {
      maintenance: await readCounts(maintenanceQueue),
      paymentRecovery: await readCounts(paymentRecoveryQueue),
    },
  };
}
