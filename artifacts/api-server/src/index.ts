import app from "./app";
import { logger } from "./lib/logger";
import { sweepExpiredLifecycles } from "./lib/lifecycle";

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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

const lifecycleSweep = setInterval(() => {
  void sweepExpiredLifecycles().catch((err) => {
    logger.error({ err }, "Lifecycle sweep failed");
  });
}, 30_000);
lifecycleSweep.unref();
void sweepExpiredLifecycles().catch((err) => {
  logger.error({ err }, "Initial lifecycle sweep failed");
});
