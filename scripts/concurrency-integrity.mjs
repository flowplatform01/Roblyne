import { randomUUID } from "node:crypto";
import pg from "pg";
import { processFlowPayWebhook } from "../artifacts/api-server/src/lib/payment-intents.ts";

const { Client } = pg;
const apiOrigin = (process.env.CONCURRENCY_API_ORIGIN ?? "http://127.0.0.1:8080").replace(/\/+$/, "");
const apiBasePath = (process.env.CONCURRENCY_API_BASE_PATH ?? "/api").replace(/\/+$/, "");
const requestCount = positiveInt("CONCURRENCY_REQUESTS", 16);
const requestTimeoutMs = positiveInt("CONCURRENCY_TIMEOUT_MS", 15_000);

if (process.env.CONCURRENCY_TEST_ALLOW_WRITES !== "1") {
  throw new Error(
    "This harness writes and deletes isolated fixtures. Set CONCURRENCY_TEST_ALLOW_WRITES=1 to run it.",
  );
}
if (process.env.NODE_ENV === "production") {
  throw new Error("The concurrency integrity harness refuses to run with NODE_ENV=production.");
}
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

function positiveInt(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function apiUrl(path) {
  return `${apiOrigin}${apiBasePath}${path}`;
}

async function requestJson(path, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(apiUrl(path), {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { status: response.status, body };
  } finally {
    clearTimeout(timeout);
  }
}

async function postConcurrently(path, bodies) {
  return Promise.all(
    bodies.map((body) => requestJson(path, {
      method: "POST",
      body: JSON.stringify(body),
    })),
  );
}

async function createFixtures(client, prefix) {
  await client.query("BEGIN");
  try {
    const user = await client.query(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [`${prefix}@example.test`, "concurrency-test-not-a-login", "Concurrency Test Owner"],
    );
    const ownerId = user.rows[0].id;

    const organization = await client.query(
      `INSERT INTO organizations (name, slug, owner_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [`Concurrency Test ${prefix}`, prefix, ownerId],
    );
    const orgId = organization.rows[0].id;

    const election = await client.query(
      `INSERT INTO elections
        (org_id, title, description, status, visibility, requires_auth, eligibility_mode, currency)
       VALUES ($1, $2, $3, 'active', 'public', false, 'open', 'XAF')
       RETURNING id`,
      [orgId, `Concurrency Election ${prefix}`, "Isolated concurrency test election"],
    );
    const electionId = election.rows[0].id;

    const position = await client.query(
      `INSERT INTO positions (election_id, title, max_selections, sort_order)
       VALUES ($1, $2, 1, 0)
       RETURNING id`,
      [electionId, "Test Position"],
    );
    const positionId = position.rows[0].id;

    const candidate = await client.query(
      `INSERT INTO candidates (election_id, position_id, name)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [electionId, positionId, "Test Candidate"],
    );
    const candidateId = candidate.rows[0].id;

    const event = await client.query(
      `INSERT INTO events
        (org_id, title, description, status, visibility, capacity)
       VALUES ($1, $2, $3, 'published', 'public', 2)
       RETURNING id`,
      [orgId, `Concurrency Event ${prefix}`, "Isolated capacity test event"],
    );
    const eventId = event.rows[0].id;

    const ticketType = await client.query(
      `INSERT INTO ticket_types
        (event_id, name, price, currency, quantity, sold)
       VALUES ($1, 'General Admission', '0', 'XAF', 2, 0)
       RETURNING id`,
      [eventId],
    );
    const ticketTypeId = ticketType.rows[0].id;

    const paymentEvent = await client.query(
      `INSERT INTO events
        (org_id, title, description, status, visibility, capacity)
       VALUES ($1, $2, $3, 'published', 'public', 5)
       RETURNING id`,
      [orgId, `Concurrency Payment Event ${prefix}`, "Isolated webhook test event"],
    );
    const paymentEventId = paymentEvent.rows[0].id;

    const paymentTicketType = await client.query(
      `INSERT INTO ticket_types
        (event_id, name, price, currency, quantity, sold)
       VALUES ($1, 'Paid Admission', '100', 'XAF', 2, 1)
       RETURNING id`,
      [paymentEventId],
    );
    const paymentTicketTypeId = paymentTicketType.rows[0].id;

    await client.query("COMMIT");
    return {
      ownerId,
      orgId,
      electionId,
      positionId,
      candidateId,
      eventId,
      ticketTypeId,
      paymentEventId,
      paymentTicketTypeId,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function createPaymentFixture(client, prefix, fixture) {
  const payerEmail = `${prefix}-payer@example.test`;
  const financial = await client.query(
    `INSERT INTO financial_transactions
      (org_id, pillar, entity_id, entity_title, transaction_type,
       gross_amount, commission_rate, commission_amount, org_earnings,
       currency, status, payment_provider, payment_status, settlement_status,
       payer_email, idempotency_key)
     VALUES ($1, 'event', $2, $3, 'ticket',
       '100', '0.05', '5', '95',
       'XAF', 'pending', 'flowpay', 'pending', 'pending',
       $4, $5)
     RETURNING id`,
    [fixture.orgId, fixture.paymentEventId, "Concurrency Payment Fixture", payerEmail, `${prefix}-financial`],
  );
  const financialTransactionId = financial.rows[0].id;
  const externalReference = `${prefix}-payment`;
  const idempotencyKey = `${prefix}-intent`;
  const payload = {
    event: {
      ticketTypeId: fixture.paymentTicketTypeId,
      attendeeName: "Webhook Test Attendee",
      attendeeEmail: payerEmail,
      ticketCode: `${prefix.slice(-8).toUpperCase()}TICKET`,
    },
  };

  const intent = await client.query(
    `INSERT INTO payment_intents
      (external_reference, pillar, entity_id, transaction_type, amount, currency,
       customer_name, customer_email, customer_phone, payload, status, payment_status,
       idempotency_key, financial_transaction_id)
     VALUES ($1, 'event', $2, 'ticket', '100', 'XAF',
       'Webhook Test Attendee', $3, '+237600000000', $4::jsonb, 'pending', 'pending',
       $5, $6)
     RETURNING id`,
    [
      externalReference,
      fixture.paymentEventId,
      payerEmail,
      JSON.stringify(payload),
      idempotencyKey,
      financialTransactionId,
    ],
  );

  await client.query(
    `UPDATE ticket_types SET sold = 1 WHERE id = $1`,
    [fixture.paymentTicketTypeId],
  );

  return { paymentId: intent.rows[0].id, externalReference, payload };
}

async function runVoteRace(fixture, prefix) {
  const voterEmail = `${prefix}-voter@example.test`;
  const bodies = Array.from({ length: requestCount }, () => ({
    voterEmail,
    selections: [{ positionId: fixture.positionId, candidateIds: [fixture.candidateId] }],
  }));
  const responses = await postConcurrently(`/elections/${fixture.electionId}/vote`, bodies);
  const successCount = responses.filter((response) => response.status === 200).length;
  const duplicateCount = responses.filter((response) => response.status === 403).length;
  const statusCounts = Object.groupBy(responses, (response) => String(response.status));
  assert(
    successCount === 1 && duplicateCount === requestCount - 1,
    `Vote race expected one success and ${requestCount - 1} duplicate rejections; statuses=${JSON.stringify(statusCounts)} bodies=${JSON.stringify(responses.map((response) => response.body))}`,
  );
  return { requests: requestCount, successCount, duplicateCount, statusCounts };
}

async function runCapacityRace(fixture, prefix) {
  const bodies = Array.from({ length: requestCount }, (_, index) => ({
    ticketTypeId: fixture.ticketTypeId,
    attendeeName: `Capacity Test ${index}`,
    attendeeEmail: `${prefix}-attendee-${index}@example.test`,
  }));
  const responses = await postConcurrently(`/events/${fixture.eventId}/register`, bodies);
  const successCount = responses.filter((response) => response.status === 201).length;
  const fullCount = responses.filter((response) => response.status === 409).length;
  assert(successCount === 2, `Capacity race expected exactly two tickets, received ${successCount}.`);
  assert(fullCount === requestCount - 2, `Capacity race expected ${requestCount - 2} rejections, received ${fullCount}.`);
  return { requests: requestCount, successCount, fullCount };
}

async function runWebhookRace(fixture, payment) {
  const webhookPayload = {
    externalReference: payment.externalReference,
    status: "succeeded",
    id: `flowpay-${payment.externalReference}`,
  };
  const results = await Promise.all([
    processFlowPayWebhook({
      eventId: `${payment.externalReference}-event`,
      eventType: "payment.succeeded",
      payload: webhookPayload,
    }),
    processFlowPayWebhook({
      eventId: `${payment.externalReference}-event`,
      eventType: "payment.succeeded",
      payload: webhookPayload,
    }),
    processFlowPayWebhook({
      eventId: `${payment.externalReference}-retry`,
      eventType: "payment.succeeded",
      payload: webhookPayload,
    }),
  ]);
  const duplicateCount = results.filter((result) => result.duplicate).length;
  assert(duplicateCount === 1, `Webhook race expected one duplicate event, received ${duplicateCount}.`);
  return { deliveries: results.length, duplicateCount };
}

async function verifyInvariants(client, prefix, fixture, payment) {
  const votes = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM votes
     WHERE election_id = $1 AND voter_identifier = $2`,
    [fixture.electionId, `email:${prefix}-voter@example.test`],
  );
  const selections = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM vote_selections vs
     INNER JOIN votes v ON v.id = vs.vote_id
     WHERE v.election_id = $1`,
    [fixture.electionId],
  );
  const tickets = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM tickets
     WHERE event_id = $1 AND status <> 'cancelled'`,
    [fixture.eventId],
  );
  const paymentTickets = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM tickets
     WHERE event_id = $1 AND status <> 'cancelled'`,
    [fixture.paymentEventId],
  );
  const ticketType = await client.query(
    `SELECT quantity, sold FROM ticket_types WHERE id = $1`,
    [fixture.ticketTypeId],
  );
  const paymentTicketType = await client.query(
    `SELECT quantity, sold FROM ticket_types WHERE id = $1`,
    [fixture.paymentTicketTypeId],
  );
  const intent = await client.query(
    `SELECT status, payment_status FROM payment_intents WHERE id = $1`,
    [payment.paymentId],
  );
  const webhookEvents = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM payment_webhook_events
     WHERE event_id LIKE $1`,
    [`${payment.externalReference}%`],
  );

  assert(votes.rows[0].count === 1, `Vote invariant failed: expected one vote, found ${votes.rows[0].count}.`);
  assert(selections.rows[0].count === 1, `Vote invariant failed: expected one selection, found ${selections.rows[0].count}.`);
  assert(tickets.rows[0].count === 2, `Ticket invariant failed: expected two capacity tickets, found ${tickets.rows[0].count}.`);
  assert(paymentTickets.rows[0].count === 1, `Webhook ticket invariant failed: expected one ticket, found ${paymentTickets.rows[0].count}.`);
  assert(ticketType.rows[0].sold === 2, `Capacity ticket sold counter invariant failed: expected 2, found ${ticketType.rows[0].sold}.`);
  assert(ticketType.rows[0].quantity === 2, "Ticket fixture quantity changed unexpectedly.");
  assert(paymentTicketType.rows[0].sold === 1, `Webhook ticket sold counter invariant failed: expected 1, found ${paymentTicketType.rows[0].sold}.`);
  assert(intent.rows[0].status === "succeeded" && intent.rows[0].payment_status === "succeeded", "Payment intent did not finalize successfully.");
  assert(webhookEvents.rows[0].count === 2, `Webhook invariant failed: expected two unique delivery records, found ${webhookEvents.rows[0].count}.`);

  return {
    votes: votes.rows[0].count,
    voteSelections: selections.rows[0].count,
    tickets: tickets.rows[0].count,
    webhookTickets: paymentTickets.rows[0].count,
    ticketTypeSold: ticketType.rows[0].sold,
    paymentStatus: intent.rows[0].status,
    webhookEventRecords: webhookEvents.rows[0].count,
  };
}

async function cleanup(client, prefix) {
  await client.query("DELETE FROM payment_webhook_events WHERE event_id LIKE $1", [`${prefix}%`]);
  await client.query("DELETE FROM payment_intents WHERE external_reference LIKE $1", [`${prefix}%`]);
  await client.query(
    `DELETE FROM vote_selections
     WHERE vote_id IN (
       SELECT v.id
       FROM votes v
       INNER JOIN elections e ON e.id = v.election_id
       INNER JOIN organizations o ON o.id = e.org_id
       WHERE o.slug = $1
     )`,
    [prefix],
  );
  await client.query(
    `DELETE FROM votes
     WHERE election_id IN (
       SELECT e.id
       FROM elections e
       INNER JOIN organizations o ON o.id = e.org_id
       WHERE o.slug = $1
     )`,
    [prefix],
  );
  await client.query("DELETE FROM organizations WHERE slug = $1", [prefix]);
  await client.query("DELETE FROM users WHERE email = $1", [`${prefix}@example.test`]);
}

async function main() {
  const prefix = `concurrency-${randomUUID()}`;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const health = await requestJson("/healthz");
    assert(health.status === 200 && health.body?.status === "ok", `API health check failed with status ${health.status}.`);

    const fixture = await createFixtures(client, prefix);
    const payment = await createPaymentFixture(client, prefix, fixture);
    const vote = await runVoteRace(fixture, prefix);
    const capacity = await runCapacityRace(fixture, prefix);
    const webhook = await runWebhookRace(fixture, payment);
    const invariants = await verifyInvariants(client, prefix, fixture, payment);

    console.log(JSON.stringify({
      status: "passed",
      configuration: { apiOrigin, requestCount },
      vote,
      capacity,
      webhook,
      invariants,
    }, null, 2));
  } finally {
    await cleanup(client, prefix).catch((error) => {
      console.error(`Fixture cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    });
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});