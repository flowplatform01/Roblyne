import { Router, type IRouter } from "express";
import { getPaymentStatus, processFlowPayWebhook } from "../lib/payment-intents";
import { verifyFlowPaySignature } from "../lib/flowpay";

const router: IRouter = Router();

// FlowPay sends this request without an Evenum session. Authentication is the
// HMAC signature over the exact raw JSON body, not a browser/session cookie.
router.post("/payments/webhooks/flowpay", async (req, res): Promise<void> => {
  const eventId = req.header("x-flowpay-event-id");
  const eventType = req.header("x-flowpay-event-type") || String(req.body?.type || "");
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