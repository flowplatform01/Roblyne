import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, financialTransactionsTable, paymentIntentsTable } from "@workspace/db";
import { getPaymentStatus, processFlowPayWebhook } from "../lib/payment-intents";
import { shouldUsePaymentSimulator, verifyFlowPaySignature } from "../lib/flowpay";

const router: IRouter = Router();

// FlowPay sends this request without an Evenum session. Authentication is the
// HMAC signature over the exact raw JSON body, not a browser/session cookie.
router.post("/payments/webhooks/flowpay", async (req, res): Promise<void> => {
  const eventId = req.header("x-flowpay-event-id")
    || (typeof req.body?.eventId === "string" ? req.body.eventId : undefined)
    || (typeof req.body?.event_id === "string" ? req.body.event_id : undefined);
  const eventType = req.header("x-flowpay-event-type")
    || (typeof req.body?.eventType === "string" ? req.body.eventType : undefined)
    || (typeof req.body?.event_type === "string" ? req.body.event_type : undefined)
    || (typeof req.body?.type === "string" ? req.body.type : undefined);
  const signature = req.header("x-flowpay-signature");
  const rawBody = (req as any).rawBody as Buffer | undefined;

  if (!eventId || !eventType || !rawBody || !verifyFlowPaySignature(rawBody, signature)) {
    res.status(401).json({ error: "Invalid FlowPay webhook signature" });
    return;
  }

  const result = await processFlowPayWebhook({
    eventId,
    eventType,
    payload: req.body,
  });
  res.status(200).json({ received: true, duplicate: result.duplicate });
});

router.post("/payments/:paymentId", async (req, res): Promise<void> => {
  if (!shouldUsePaymentSimulator()) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const rawId = Array.isArray(req.params.paymentId) ? req.params.paymentId[0] : req.params.paymentId;
  const paymentId = Number.parseInt(rawId, 10);
  const token = req.body?.token;
  const status = req.body?.status;
  if (
    !Number.isInteger(paymentId)
    || paymentId <= 0
    || typeof token !== "string"
    || !["pending", "processing", "succeeded", "failed", "cancelled"].includes(status)
  ) {
    res.status(400).json({ error: "Invalid simulator request" });
    return;
  }

  const [intent] = await db.select({
    id: paymentIntentsTable.id,
    externalReference: paymentIntentsTable.externalReference,
    paymentProvider: financialTransactionsTable.paymentProvider,
  }).from(paymentIntentsTable)
    .leftJoin(
      financialTransactionsTable,
      eq(financialTransactionsTable.id, paymentIntentsTable.financialTransactionId),
    )
    .where(eq(paymentIntentsTable.id, paymentId))
    .limit(1);
  if (
    !intent
    || intent.externalReference !== token
    || intent.paymentProvider !== "evenum_dev_simulator"
  ) {
    res.status(404).json({ error: "Payment attempt not found" });
    return;
  }

  const result = await processFlowPayWebhook({
    eventId: `dev-${paymentId}-${randomUUID()}`,
    eventType: `dev.payment.${status}`,
    payload: {
      externalReference: intent.externalReference,
      status,
      id: `evenum-dev-${paymentId}`,
    },
  });
  const payment = await getPaymentStatus(paymentId);
  res.json(payment ?? { id: paymentId, status: result.status, paymentStatus: result.status, checkoutUrl: null, result: null });
});

router.get("/payments/:paymentId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.paymentId) ? req.params.paymentId[0] : req.params.paymentId;
  const paymentId = Number.parseInt(rawId, 10);
  if (!Number.isInteger(paymentId) || paymentId <= 0) {
    res.status(400).json({ error: "Invalid payment ID" });
    return;
  }
  const payment = await getPaymentStatus(paymentId);
  if (!payment) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }
  res.json(payment);
});

export default router;