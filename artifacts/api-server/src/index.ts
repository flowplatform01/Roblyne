import app from "./app";
import { logger } from "./lib/logger";
import { sweepExpiredLifecycles } from "./lib/lifecycle";
import { registerMaintenanceSchedule, closeQueues, queueInfrastructureStatus } from "./lib/jobs";
import { closeRedis } from "./lib/redis";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

void (async () => {
  const queued = await registerMaintenanceSchedule();
  const queueStatus = queued ? await queueInfrastructureStatus() : null;
  if (queued && queueStatus?.workerHealthy) return;

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
  process.exit(0);
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
