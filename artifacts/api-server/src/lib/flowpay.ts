import { createHmac, timingSafeEqual } from "node:crypto";
import { logger } from "./logger";

export type FlowPayPaymentStatus = "pending" | "processing" | "succeeded" | "failed";

export interface FlowPayTransaction {
  id: string | null;
  externalReference: string;
  status: FlowPayPaymentStatus;
  checkoutUrl: string | null;
  raw: Record<string, unknown>;
}

interface FlowPayConfig {
  baseUrl: string;
  clientId: string;
  publicKey: string;
  secretKey: string;
  webhookSecret: string;
  provider: string;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required FlowPay configuration: ${name}`);
  return value;
}

function getConfig(): FlowPayConfig {
  return {
    baseUrl: requiredEnv("FLOWPAY_API_BASE_URL").replace(/\/+$/, ""),
    clientId: requiredEnv("FLOWPAY_CLIENT_ID"),
    publicKey: requiredEnv("FLOWPAY_PUBLIC_KEY"),
    secretKey: requiredEnv("FLOWPAY_SECRET_KEY"),
    webhookSecret: requiredEnv("FLOWPAY_WEBHOOK_SECRET"),
    provider: process.env.FLOWPAY_PROVIDER?.trim() || "FAPSHI",
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function normalizeFlowPayStatus(value: unknown): FlowPayPaymentStatus {
  const status = String(value ?? "").toUpperCase();
  if (["SUCCEEDED", "SUCCESS", "PAID", "COMPLETED"].includes(status)) return "succeeded";
  if (["FAILED", "FAILURE", "CANCELLED", "CANCELED", "DECLINED"].includes(status)) return "failed";
  if (["PROCESSING", "IN_PROGRESS"].includes(status)) return "processing";
  return "pending";
}

function normalizeTransaction(body: unknown, externalReference: string): FlowPayTransaction {
  const root = asRecord(body);
  const transaction = asRecord(root.transaction ?? root.data ?? body);
  return {
    id: firstString(transaction.id, transaction.transactionId, transaction.reference),
    externalReference: firstString(transaction.externalReference, externalReference) || externalReference,
    status: normalizeFlowPayStatus(transaction.status),
    checkoutUrl: firstString(
      transaction.checkoutSessionUrl,
      transaction.checkoutUrl,
      transaction.sessionUrl,
      transaction.paymentUrl,
      root.checkoutSessionUrl,
      root.checkoutUrl,
    ),
    raw: transaction,
  };
}

export async function initializeFlowPayPayment(input: {
  externalReference: string;
  amount: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  idempotencyKey: string;
  metadata: Record<string, unknown>;
}): Promise<FlowPayTransaction> {
  const config = getConfig();
  const body = {
    externalReference: input.externalReference,
    amount: input.amount,
    currency: input.currency,
    provider: config.provider,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    deferCapture: true,
    metadata: input.metadata,
  };

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(`${config.baseUrl}/payments/initialize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "x-flowpay-client-id": config.clientId,
          "x-flowpay-public-key": config.publicKey,
          "x-flowpay-secret-key": config.secretKey,
          "Idempotency-Key": input.idempotencyKey,
        },
        body: JSON.stringify(body),
      });

      const responseText = await response.text();
      let responseBody: unknown = null;
      try {
        responseBody = responseText ? JSON.parse(responseText) : null;
      } catch {
        responseBody = responseText;
      }

      if (!response.ok) {
        const errorBody = asRecord(responseBody);
        const message = firstString(errorBody.message, errorBody.error, errorBody.detail) || `FlowPay returned HTTP ${response.status}`;
        throw new Error(message);
      }

      return normalizeTransaction(responseBody, input.externalReference);
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  logger.error({ err: lastError }, "FlowPay payment initialization failed");
  throw lastError instanceof Error ? lastError : new Error("FlowPay payment initialization failed");
}

export function verifyFlowPaySignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!signature) return false;
  let received = signature.trim();
  if (received.startsWith("sha256=")) received = received.slice("sha256=".length);
  const expectedHex = createHmac("sha256", requiredEnv("FLOWPAY_WEBHOOK_SECRET")).update(rawBody).digest("hex");
  const expectedBase64 = createHmac("sha256", requiredEnv("FLOWPAY_WEBHOOK_SECRET")).update(rawBody).digest("base64");
  const candidates = [expectedHex, expectedBase64];
  return candidates.some(candidate => {
    const receivedBuffer = Buffer.from(received, candidate === expectedHex ? "hex" : "base64");
    const expectedBuffer = Buffer.from(candidate, candidate === expectedHex ? "hex" : "base64");
    return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
  });
}

export function getFlowPayProvider(): string {
  return process.env.FLOWPAY_PROVIDER?.trim() || "FAPSHI";
}