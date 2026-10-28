import { and, eq, sql } from "drizzle-orm";
import {
  db,
  paymentIntentsTable,
  paymentWebhookEventsTable,
  financialTransactionsTable,
  ticketsTable,
  ticketTypesTable,
  campaignResponsesTable,
  campaignsTable,
  electionsTable,
  votesTable,
  voteSelectionsTable,
} from "@workspace/db";
import { randomUUID } from "node:crypto";
import {
  fetchFlowPaySessionStatus,
  initializeFlowPayPayment,
  normalizeFlowPayStatus,
  shouldUsePaymentSimulator,
  type FlowPayPaymentStatus,
} from "./flowpay";
import { logger } from "./logger";
import { recordTransaction, type Pillar, type TransactionType } from "./commission-engine";

export interface PaymentPayload {
  event?: {
    ticketTypeId: number;
    attendeeName: string;
    attendeeEmail: string;
    ticketCode: string;
  };
  campaign?: {
    submitterName: string;
    submitterEmail: string;
    data: Record<string, unknown>;
  };
  election?: {
    voterIdentifier: string;
    voterEmail?: string;
    voteQuantity: number;
    selections: Array<{ positionId: number; candidateIds: number[] }>;
  };
}

export interface CreatePaymentIntentInput {
  orgId: number;
  pillar: Pillar;
  entityId: number;
  entityTitle?: string;
  transactionType: TransactionType;
  amount: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  payload: PaymentPayload;
  database?: any;
}

export async function createPaymentIntent(input: CreatePaymentIntentInput): Promise<{
  intent: any;
  idempotencyKey: string;
}> {
  const database = input.database ?? db;
  const idempotencyKey = `evenum-${randomUUID()}`;
  const externalReference = `evenum-${input.pillar}-${input.entityId}-${randomUUID()}`;
  const financial = await recordTransaction({
    orgId: input.orgId,
    pillar: input.pillar,
    entityId: input.entityId,
    entityTitle: input.entityTitle,
    transactionType: input.transactionType,
    grossAmount: input.amount,
    currency: input.currency,
    payerName: input.customerName,
    payerEmail: input.customerEmail,
    paymentProvider: shouldUsePaymentSimulator() ? "evenum_dev_simulator" : "flowpay",
    paymentStatus: "pending",
    idempotencyKey,
    status: "pending",
  }, database);
  const [intent] = await database.insert(paymentIntentsTable).values({
    externalReference,
    pillar: input.pillar,
    entityId: input.entityId,
    transactionType: input.transactionType,
    amount: String(input.amount),
    currency: input.currency,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    payload: input.payload,
    status: "initializing",
    paymentStatus: "pending",
    idempotencyKey,
    financialTransactionId: financial.transactionId,
  }).returning();
  return { intent, idempotencyKey };
}

export async function initializePaymentIntent(intent: any): Promise<any> {
  if (shouldUsePaymentSimulator()) {
    const checkoutUrl = `/dev-payment/${intent.id}?token=${encodeURIComponent(intent.externalReference)}`;
    const [updated] = await db.update(paymentIntentsTable)
      .set({ status: "pending", checkoutUrl })
      .where(eq(paymentIntentsTable.id, intent.id))
      .returning();
    return { ...updated, statusToken: intent.externalReference };
  }

  const transaction = await initializeFlowPayPayment({
    externalReference: intent.externalReference,
    amount: Number(intent.amount),
    currency: intent.currency,
    customerName: intent.customerName,
    customerEmail: intent.customerEmail,
    customerPhone: intent.customerPhone,
    idempotencyKey: intent.idempotencyKey,
    metadata: {
      evenumPaymentId: intent.id,
      pillar: intent.pillar,
      entityId: intent.entityId,
      transactionType: intent.transactionType,
    },
  });
  const status = transaction.status;
  const existingPayload = asRecord(intent.payload);
  const [updated] = await db.update(paymentIntentsTable).set({
    status,
    paymentStatus: status,
    flowpayTransactionId: transaction.id,
    checkoutUrl: transaction.checkoutUrl,
    payload: {
      ...existingPayload,
      flowpaySessionToken: transaction.sessionToken,
    },
    updatedAt: new Date(),
  }).where(eq(paymentIntentsTable.id, intent.id)).returning();
  if (updated.financialTransactionId) {
    await db.update(financialTransactionsTable).set({
      paymentStatus: status,
      flowpayTransactionId: transaction.id,
    }).where(eq(financialTransactionsTable.id, updated.financialTransactionId));
  }
  return { ...updated, statusToken: intent.externalReference };
}

export async function buildPaymentInitializationResponse(intent: {
  id: number;
  externalReference: string;
  checkoutUrl?: string | null;
  status?: string | null;
  paymentStatus?: string | null;
}): Promise<{
  paymentRequired: true;
  paymentId: number;
  paymentStatus: string | null;
  statusToken: string;
  checkoutUrl: string | null;
}> {
  let checkoutUrl = intent.checkoutUrl ?? null;
  let paymentStatus = intent.paymentStatus ?? intent.status ?? "pending";
  if (!checkoutUrl || intent.status === "initializing") {
    const initialized = await initializePaymentIntent(intent);
    checkoutUrl = initialized.checkoutUrl ?? null;
    paymentStatus = initialized.paymentStatus ?? initialized.status ?? paymentStatus;
    return {
      paymentRequired: true,
      paymentId: initialized.id,
      paymentStatus,
      statusToken: initialized.statusToken ?? intent.externalReference,
      checkoutUrl,
    };
  }
  return {
    paymentRequired: true,
    paymentId: intent.id,
    paymentStatus,
    statusToken: intent.externalReference,
    checkoutUrl,
  };
}

export async function failPaymentIntent(intentId: number, message: string): Promise<void> {
  const [intent] = await db.select().from(paymentIntentsTable).where(eq(paymentIntentsTable.id, intentId)).limit(1);
  await db.update(paymentIntentsTable).set({
    status: "failed",
    paymentStatus: "failed",
    errorMessage: message.slice(0, 500),
    updatedAt: new Date(),
  }).where(eq(paymentIntentsTable.id, intentId));
  if (intent?.financialTransactionId) {
    await db.update(financialTransactionsTable).set({
      status: "failed",
      paymentStatus: "failed",
    }).where(eq(financialTransactionsTable.id, intent.financialTransactionId));
  }
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function transactionFromWebhook(payload: unknown): Record<string, any> {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  return asRecord(
    data.transaction
      ?? data.payment
      ?? root.transaction
      ?? root.payment
      ?? (data.externalReference || data.external_reference || data.status ? data : root),
  );
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function statusRank(status: FlowPayPaymentStatus): number {
  return status === "pending" ? 1 : status === "processing" ? 2 : 3;
}

export async function processFlowPayWebhook(input: {
  eventId: string;
  eventType: string;
  payload: unknown;
}): Promise<{ duplicate: boolean; status: FlowPayPaymentStatus; paymentId?: number }> {
  const transaction = transactionFromWebhook(input.payload);
  const root = asRecord(input.payload);
  const data = asRecord(root.data);
  const externalReference = firstString(
    transaction.externalReference,
    transaction.external_reference,
    data.externalReference,
    data.external_reference,
    root.externalReference,
    root.external_reference,
  );
  if (!externalReference) throw new Error("Webhook transaction is missing externalReference");
  const status = normalizeFlowPayStatus(transaction.status ?? transaction.paymentStatus);
  const flowpayTransactionId = firstString(transaction.id, transaction.transactionId, transaction.reference);

  return db.transaction(async (tx) => {
    const [webhookEvent] = await tx.insert(paymentWebhookEventsTable).values({
      eventId: input.eventId,
      eventType: input.eventType,
      payload: input.payload as any,
    }).onConflictDoNothing().returning();
    if (!webhookEvent) return { duplicate: true, status };

    const [intent] = await tx.select().from(paymentIntentsTable)
      .where(eq(paymentIntentsTable.externalReference, externalReference))
      .for("update");
    if (!intent) throw new Error("Payment intent not found for webhook externalReference");
    if (intent.status === "succeeded" || intent.status === "failed") {
      return { duplicate: false, status: normalizeFlowPayStatus(intent.status), paymentId: intent.id };
    }

    const payload = asRecord(intent.payload);
    const currentStatus = statusRank(status) < statusRank(normalizeFlowPayStatus(intent.status))
      ? normalizeFlowPayStatus(intent.status)
      : status;
    await tx.update(paymentIntentsTable).set({
      status: currentStatus,
      paymentStatus: currentStatus,
      flowpayTransactionId: flowpayTransactionId ?? intent.flowpayTransactionId,
      updatedAt: new Date(),
    }).where(eq(paymentIntentsTable.id, intent.id));

    if (intent.financialTransactionId) {
      await tx.update(financialTransactionsTable).set({
        status: currentStatus === "succeeded" ? "completed" : currentStatus === "failed" ? "failed" : "pending",
        paymentStatus: currentStatus,
        flowpayTransactionId: flowpayTransactionId ?? intent.flowpayTransactionId,
      }).where(eq(financialTransactionsTable.id, intent.financialTransactionId));
    }

    if (currentStatus === "failed") {
      if (intent.pillar === "event") {
        const eventPayload = asRecord(payload.event);
        await tx.execute(
          sql`UPDATE ticket_types SET sold = GREATEST(sold - 1, 0) WHERE id = ${Number(eventPayload.ticketTypeId)}`,
        );
      }
      return { duplicate: false, status: currentStatus, paymentId: intent.id };
    }
    if (currentStatus !== "succeeded") {
      return { duplicate: false, status: currentStatus, paymentId: intent.id };
    }

    if (intent.pillar === "event") {
      const eventPayload = asRecord(payload.event);
      await tx.insert(ticketsTable).values({
        eventId: intent.entityId,
        ticketTypeId: Number(eventPayload.ticketTypeId),
        attendeeName: String(eventPayload.attendeeName),
        attendeeEmail: String(eventPayload.attendeeEmail),
        ticketCode: String(eventPayload.ticketCode),
        status: "valid",
        paymentStatus: "succeeded",
        flowpayTransactionId,
        idempotencyKey: intent.idempotencyKey,
      });
    } else if (intent.pillar === "campaign") {
      const campaignPayload = asRecord(payload.campaign);
      await tx.insert(campaignResponsesTable).values({
        campaignId: intent.entityId,
        submitterName: String(campaignPayload.submitterName),
        submitterEmail: String(campaignPayload.submitterEmail),
        data: asRecord(campaignPayload.data),
        amountPaid: String(intent.amount),
        status: "confirmed",
        paymentStatus: "succeeded",
        flowpayTransactionId,
        idempotencyKey: intent.idempotencyKey,
      });
      await tx.execute(
        sql`UPDATE campaigns SET current_amount = current_amount + ${Number(intent.amount)} WHERE id = ${intent.entityId}`,
      );
    } else if (intent.pillar === "election") {
      // Candidate deletion locks the same election row. Acquiring this lock
      // before inserting paid ballot selections prevents a deletion from
      // racing with payment finalization.
      const [election] = await tx.select({ id: electionsTable.id })
        .from(electionsTable)
        .where(eq(electionsTable.id, intent.entityId))
        .for("update");
      if (!election) throw new Error("Election not found while finalizing paid vote");

      const electionPayload = asRecord(payload.election);
      const [vote] = await tx.insert(votesTable).values({
        electionId: intent.entityId,
        voterIdentifier: String(electionPayload.voterIdentifier),
        quantity: Number(electionPayload.voteQuantity),
        paymentStatus: "succeeded",
        flowpayTransactionId,
        idempotencyKey: intent.idempotencyKey,
      }).returning();
      const selections = Array.isArray(electionPayload.selections) ? electionPayload.selections : [];
      const selectionValues = selections.flatMap((selection: any) =>
        (Array.isArray(selection.candidateIds) ? selection.candidateIds : []).map((candidateId: number) => ({
          voteId: vote.id,
          positionId: Number(selection.positionId),
          candidateId: Number(candidateId),
        })),
      );
      if (selectionValues.length > 0) await tx.insert(voteSelectionsTable).values(selectionValues);
    }

    await tx.update(paymentIntentsTable).set({
      status: "succeeded",
      paymentStatus: "succeeded",
      flowpayTransactionId: flowpayTransactionId ?? intent.flowpayTransactionId,
      finalizedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(paymentIntentsTable.id, intent.id));
    return { duplicate: false, status: "succeeded", paymentId: intent.id };
  });
}

function extractFlowPaySessionIdFromCheckoutUrl(checkoutUrl?: string | null): string | null {
  if (!checkoutUrl) return null;
  try {
    const parsed = new URL(checkoutUrl, "https://flowpay.internal");
    const segments = parsed.pathname.split("/").filter(Boolean);
    const checkoutIndex = segments.findIndex((segment) => segment === "checkout" || segment === "session");
    if (checkoutIndex >= 0 && segments[checkoutIndex + 1]) {
      return segments[checkoutIndex + 1];
    }
    const last = segments[segments.length - 1];
    return last && last.length >= 8 ? last : null;
  } catch {
    return null;
  }
}

function resolveFlowPaySessionIds(intent: {
  flowpayTransactionId?: string | null;
  checkoutUrl?: string | null;
}): string[] {
  const ids = [
    intent.flowpayTransactionId,
    extractFlowPaySessionIdFromCheckoutUrl(intent.checkoutUrl),
  ].filter((value): value is string => Boolean(value?.trim()));
  return [...new Set(ids.map((value) => value.trim()))];
}

async function reconcilePaymentIntentWithFlowPay(intent: {
  id: number;
  status: string;
  externalReference: string;
  flowpayTransactionId?: string | null;
  checkoutUrl?: string | null;
  payload?: unknown;
}): Promise<void> {
  if (shouldUsePaymentSimulator()) return;
  if (!["pending", "processing", "initializing"].includes(intent.status)) return;

  const payload = asRecord(intent.payload);
  const checkoutSessionToken = extractCheckoutToken(intent.checkoutUrl, payload);
  const sessionIds = resolveFlowPaySessionIds(intent);
  if (sessionIds.length === 0) return;

  let lastError: unknown;
  for (const sessionId of sessionIds) {
    try {
      const remote = await fetchFlowPaySessionStatus(sessionId, checkoutSessionToken);
      if (remote.status !== "succeeded" && remote.status !== "failed") continue;
      await processFlowPayWebhook({
        eventId: `reconcile-${sessionId}-${Date.now()}`,
        eventType: remote.status === "succeeded" ? "payment.succeeded" : "payment.failed",
        payload: {
          data: {
            transaction: {
              id: sessionId,
              externalReference: intent.externalReference,
              status: remote.status.toUpperCase(),
              ...remote.raw,
            },
          },
        },
      });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    logger.warn(
      { err: lastError, paymentId: intent.id, sessionIds },
      "Failed to reconcile remote FlowPay session status",
    );
  }
}

function extractCheckoutToken(checkoutUrl?: string | null, payload?: Record<string, any>): string | undefined {
  if (payload?.flowpaySessionToken && typeof payload.flowpaySessionToken === "string") {
    return payload.flowpaySessionToken;
  }
  if (checkoutUrl) {
    try {
      const parsed = new URL(checkoutUrl, "https://flowpay.internal");
      const token = parsed.searchParams.get("token");
      if (token) return token;
    } catch {
      // ignore
    }
  }
  return undefined;
}

export async function getPaymentStatus(paymentId: number, statusToken: string): Promise<any | null> {
  let [intent] = await db.select().from(paymentIntentsTable).where(and(
    eq(paymentIntentsTable.id, paymentId),
    eq(paymentIntentsTable.externalReference, statusToken),
  )).limit(1);
  if (!intent) return null;

  // Active status reconciliation: if the local transaction is in a non-terminal state,
  // query FlowPay directly to reconcile with the authoritative checkout session status.
  // This guarantees local dev (without inbound webhooks) and transient webhook drops
  // immediately update the Evenum ledger and business records (tickets, votes, contributions).
  if (
    (intent.status === "pending" || intent.status === "processing" || intent.status === "initializing")
    && intent.flowpayTransactionId
    && !shouldUsePaymentSimulator()
  ) {
    const payload = asRecord(intent.payload);
    const checkoutSessionToken = extractCheckoutToken(intent.checkoutUrl, payload);
    try {
      const remote = await fetchFlowPaySessionStatus(intent.flowpayTransactionId, checkoutSessionToken);
      if (remote.status === "succeeded" || remote.status === "failed") {
        // Prefer our durable externalReference so webhook processing never
        // fails when FlowPay omits it from the session lookup response.
        const remoteExternalReference = remote.externalReference?.trim() || intent.externalReference;
        await processFlowPayWebhook({
          eventId: `reconcile-${intent.id}-${intent.flowpayTransactionId}-${remote.status}`,
          eventType: remote.status === "succeeded" ? "payment.succeeded" : "payment.failed",
          payload: {
            data: {
              transaction: {
                ...remote.raw,
                id: intent.flowpayTransactionId,
                externalReference: remoteExternalReference,
                status: remote.status.toUpperCase(),
              },
            },
          },
        });
        const [refreshed] = await db.select().from(paymentIntentsTable).where(eq(paymentIntentsTable.id, paymentId)).limit(1);
        if (refreshed) {
          intent = refreshed;
        }
      }
    } catch (err) {
      logger.warn({ err, paymentId, flowpayTransactionId: intent.flowpayTransactionId }, "Failed to reconcile remote FlowPay session status");
    }
  }

  let result: any = null;
  if (intent.status === "succeeded" && intent.flowpayTransactionId) {
    if (intent.pillar === "event") {
      const [ticket] = await db.select({
        ticketCode: ticketsTable.ticketCode,
        ticketTypeName: ticketTypesTable.name,
      }).from(ticketsTable)
        .innerJoin(ticketTypesTable, eq(ticketTypesTable.id, ticketsTable.ticketTypeId))
        .where(eq(ticketsTable.flowpayTransactionId, intent.flowpayTransactionId)).limit(1);
      result = ticket ? { ticketCode: ticket.ticketCode, ticketTypeName: ticket.ticketTypeName } : null;
    } else if (intent.pillar === "campaign") {
      result = { message: "Contribution recorded" };
    } else {
      result = { message: "Vote recorded" };
    }
  }
  return {
    id: intent.id,
    status: intent.status,
    paymentStatus: intent.paymentStatus,
    checkoutUrl: intent.checkoutUrl,
    result,
  };
}