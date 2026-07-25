import { Router, type IRouter } from "express";
import { ReportClientDiagnosticBody, HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
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
