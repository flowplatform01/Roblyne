import { createHmac, timingSafeEqual } from "node:crypto";
import { logger } from "./logger";
import { normalizeCameroonPhone, maskPhoneNumber } from "./phone";

export type FlowPayPaymentStatus = "pending" | "processing" | "succeeded" | "failed";
export type FlowPayEnvironment = "sandbox" | "production";

export interface FlowPayTransaction {
  id: string | null;
  externalReference: string;
  status: FlowPayPaymentStatus;
  checkoutUrl: string | null;
  sessionToken?: string | null;
  raw: Record<string, unknown>;
}

interface FlowPayConfig {
  baseUrl: string;
  clientId: string;
  publicKey: string;
  secretKey: string;
  webhookSecret: string;
  provider: string;
  environment: FlowPayEnvironment;
  timeoutMs: number;
}

function requiredEnv(name: string, fallbackName?: string): string {
  const value = process.env[name]?.trim() || (fallbackName ? process.env[fallbackName]?.trim() : undefined);
  if (!value) {
    throw new Error(
      `Missing required FlowPay configuration: ${name}${fallbackName ? ` (or ${fallbackName})` : ""}`,
    );
  }
  return value;
}

function getEnvironment(): FlowPayEnvironment {
  if (process.env.NODE_ENV === "production") return "production";
  const configuredEnvironment = process.env.FLOWPAY_ENVIRONMENT?.trim().toLowerCase();
  if (configuredEnvironment === "production") {
    throw new Error("FlowPay production credentials may only be used when NODE_ENV=production");
  }
  return configuredEnvironment === "production"
    ? "production"
    : configuredEnvironment === "sandbox"
      ? "sandbox"
      : "sandbox";
}

export function shouldUsePaymentSimulator(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const configuredMode = process.env.ROBLYNE_PAYMENT_MODE?.trim().toLowerCase()
    || process.env.EVENUM_PAYMENT_MODE?.trim().toLowerCase();
  if (!configuredMode || configuredMode === "simulation") return true;
  if (configuredMode === "flowpay") return false;
  throw new Error("ROBLYNE_PAYMENT_MODE must be either simulation or flowpay");
}

function getWebhookSecret(environment = getEnvironment()): string {
  return requiredEnv(
    `FLOWPAY_${environment.toUpperCase()}_WEBHOOK_SECRET`,
    "FLOWPAY_WEBHOOK_SECRET",
  );
}

function getConfig(): FlowPayConfig {
  const environment = getEnvironment();
  const configuredTimeout = Number(process.env.FLOWPAY_TIMEOUT_MS);
  const environmentPrefix = `FLOWPAY_${environment.toUpperCase()}`;
  const env = (suffix: string) => `${environmentPrefix}_${suffix}`;

  return {
    baseUrl: requiredEnv(env("API_BASE_URL"), "FLOWPAY_API_BASE_URL").replace(/\/+$/, ""),
    clientId: requiredEnv(env("CLIENT_ID"), "FLOWPAY_CLIENT_ID"),
    publicKey: requiredEnv(env("PUBLIC_KEY"), "FLOWPAY_PUBLIC_KEY"),
    secretKey: requiredEnv(env("SECRET_KEY"), "FLOWPAY_SECRET_KEY"),
    webhookSecret: getWebhookSecret(environment),
    provider: process.env[env("PROVIDER")]?.trim() || process.env.FLOWPAY_PROVIDER?.trim() || "FAPSHI",
    environment,
    timeoutMs: Number.isFinite(configuredTimeout) && configuredTimeout >= 1_000
      ? Math.min(configuredTimeout, 60_000)
      : 15_000,
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
  if (["SUCCEEDED", "SUCCESS", "PAID", "COMPLETED", "SUCCESSFUL", "AUTHORIZED", "APPROVED", "CAPTURED"].includes(status)) return "succeeded";
  if (["FAILED", "FAILURE", "CANCELLED", "CANCELED", "DECLINED"].includes(status)) return "failed";
  if (["PROCESSING", "IN_PROGRESS"].includes(status)) return "processing";
  return "pending";
}

function normalizeTransaction(body: unknown, externalReference: string): FlowPayTransaction {
  const root = asRecord(body);
  const data = asRecord(root.data);
  const transaction = asRecord(
    root.transaction
      ?? data.transaction
      ?? data.payment
      ?? root.payment
      ?? (root.status || root.externalReference ? root : data),
  );
  const checkout = asRecord(root.checkout ?? data.checkout ?? transaction.checkout);
  const checkoutUrl = firstString(
    checkout.url,
    checkout.checkoutUrl,
    checkout.sessionUrl,
    transaction.checkoutSessionUrl,
    transaction.checkoutUrl,
    transaction.sessionUrl,
    transaction.paymentUrl,
    root.checkoutSessionUrl,
    root.checkoutUrl,
    root.sessionUrl,
    root.paymentUrl,
  );
  let sessionToken = firstString(
    checkout.sessionToken,
    checkout.token,
    transaction.sessionToken,
    transaction.checkoutSessionToken,
    root.checkoutSessionToken,
  );
  if (!sessionToken && checkoutUrl) {
    try {
      const parsedUrl = new URL(checkoutUrl, "https://flowpay.internal");
      sessionToken = parsedUrl.searchParams.get("token");
    } catch {
      // ignore
    }
  }

  return {
    id: firstString(transaction.id, transaction.transactionId, transaction.reference, root.id, root.transactionId),
    externalReference: firstString(
      transaction.externalReference,
      transaction.external_reference,
      root.externalReference,
      root.external_reference,
      externalReference,
    ) || externalReference,
    status: normalizeFlowPayStatus(
      transaction.status
        ?? transaction.paymentStatus
        ?? root.status
        ?? root.paymentStatus,
    ),
    checkoutUrl,
    sessionToken,
    raw: transaction,
  };
}

class FlowPayRequestError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = "FlowPayRequestError";
  }
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
  const normalizedPhone = normalizeCameroonPhone(input.customerPhone) || input.customerPhone.trim();
  const body = {
    externalReference: input.externalReference,
    amount: input.amount,
    currency: input.currency,
    provider: config.provider,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: normalizedPhone,
    deferCapture: true,
    metadata: {
      ...input.metadata,
      customerPhone: normalizedPhone,
    },
  };

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const endpoint = config.baseUrl.endsWith("/api/v1")
        ? `${config.baseUrl}/payments/initialize`
        : `${config.baseUrl}/api/v1/payments/initialize`;
      const response = await fetch(endpoint, {
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
          signal: AbortSignal.timeout(config.timeoutMs),
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
        throw new FlowPayRequestError(message, response.status === 408 || response.status === 429 || response.status >= 500, response.status);
      }

      return normalizeTransaction(responseBody, input.externalReference);
    } catch (error) {
      lastError = error;
      const retryable = !(error instanceof FlowPayRequestError) || error.retryable;
      if (attempt === 0 && retryable) {
        await new Promise(resolve => setTimeout(resolve, 250));
        continue;
      }
      break;
    }
  }

  logger.error(
    {
      err: lastError,
      externalReference: input.externalReference,
      customerPhone: maskPhoneNumber(input.customerPhone),
    },
    "FlowPay payment initialization failed",
  );
  throw lastError instanceof Error ? lastError : new Error("FlowPay payment initialization failed");
}

export async function fetchFlowPaySessionStatus(
  flowpayTransactionId: string,
  checkoutSessionToken?: string,
): Promise<{
  status: FlowPayPaymentStatus;
  externalReference: string;
  raw: Record<string, unknown>;
}> {
  const config = getConfig();
  const baseEndpoint = config.baseUrl.endsWith("/api/v1")
    ? `${config.baseUrl}/checkout/session/${encodeURIComponent(flowpayTransactionId)}`
    : `${config.baseUrl}/api/v1/checkout/session/${encodeURIComponent(flowpayTransactionId)}`;

  const url = checkoutSessionToken
    ? `${baseEndpoint}?token=${encodeURIComponent(checkoutSessionToken)}`
    : baseEndpoint;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "x-flowpay-client-id": config.clientId,
      "x-flowpay-public-key": config.publicKey,
      "x-flowpay-secret-key": config.secretKey,
    },
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  const responseText = await response.text();
  let responseBody: any = null;
  try {
    responseBody = responseText ? JSON.parse(responseText) : null;
  } catch {
    responseBody = responseText;
  }

  if (!response.ok) {
    const errorBody = asRecord(responseBody);
    const message = firstString(errorBody.message, errorBody.error, errorBody.detail) || `FlowPay status lookup failed (HTTP ${response.status})`;
    throw new FlowPayRequestError(message, response.status === 408 || response.status === 429 || response.status >= 500, response.status);
  }

  const transaction = asRecord(
    responseBody?.transaction
      ?? responseBody?.data?.transaction
      ?? responseBody?.data
      ?? responseBody,
  );

  const status = normalizeFlowPayStatus(
    transaction.status
      ?? transaction.paymentStatus
      ?? responseBody?.status,
  );

  const externalReference = firstString(
    transaction.externalReference,
    transaction.external_reference,
    responseBody?.externalReference,
    responseBody?.external_reference,
  ) || "";

  return {
    status,
    externalReference,
    raw: transaction,
  };
}

export function verifyFlowPaySignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!signature) return false;
  let received = signature.trim();
  if (received.startsWith("sha256=")) received = received.slice("sha256=".length);
  const secret = getWebhookSecret();
  const expectedHex = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBase64 = createHmac("sha256", secret).update(rawBody).digest("base64");
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