import { Router, type IRouter } from "express";
import { ReportClientDiagnosticBody, HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";
import { getPrometheusMetrics } from "../lib/metrics";
import { pingRedis } from "../lib/redis";
import { queueInfrastructureStatus } from "../lib/jobs";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/readyz", async (_req, res): Promise<void> => {
  const redis = await pingRedis();
  let databaseOk = false;
  try {
    await pool.query("SELECT 1");
    databaseOk = true;
  } catch (error) {
    res.status(503).json({
      status: "not_ready",
      database: false,
      redis,
      degraded: redis.configured && !redis.ok,
      queue: queueInfrastructureStatus(),
    });
    return;
  }

  const redisRequired = process.env.REDIS_REQUIRED === "true";
  if (redis.configured && !redis.ok && redisRequired) {
    res.status(503).json({
      status: "not_ready",
      database: databaseOk,
      redis,
      queue: queueInfrastructureStatus(),
    });
    return;
  }

  res.json({
    status: "ready",
    database: databaseOk,
    redis,
    degraded: redis.configured && !redis.ok,
    queue: queueInfrastructureStatus(),
  });
});

router.get("/metrics", (_req, res) => {
  res.type("text/plain").send(getPrometheusMetrics());
});

router.post("/diagnostics/client", (req, res): void => {
  const parsed = ReportClientDiagnosticBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid client diagnostic" });
    return;
  }

  req.log.warn(
    {
      diagnostic: parsed.data,
      requestId: req.id,
      userId: req.session.userId,
    },
    "Client diagnostic received",
  );
  res.status(202).json({ message: "Diagnostic accepted" });
});

export default router;
