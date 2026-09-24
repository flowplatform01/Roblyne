/**
 * Evenum write-integrity proof
 *
 * Run with:
 *   INTEGRITY_ALLOW_WRITES=1 pnpm --filter @workspace/scripts run integrity
 *
 * The runner starts the real API app on an ephemeral local port, creates
 * isolated fixtures, drives concurrent HTTP requests, verifies persisted
 * invariants, writes a JSON report, and removes its fixtures.
 */

import { createHmac, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import pg from "pg";

type HttpResult = {
  status: number | null;
  body: unknown;
  error?: string;
};

type ScenarioReport = {
  name: string;
  requests: number;
  concurrency: number;
  statusCounts: Record<string, number>;
  invariantChecks: InvariantCheck[];
  passed: boolean;
  errors: string[];
};

type InvariantCheck = {
  name: string;
  expected: string | number | boolean;
  actual: string | number | boolean;
  passed: boolean;
};

type IntegrityReport = {
  startedAt: string;
  finishedAt: string;
  baseUrl: string;
  fixturePrefix: string;
  scenarios: ScenarioReport[];
  passed: boolean;
  cleanup: {
    attempted: boolean;
    completed: boolean;
    error?: string;
  };
};

type FixtureIds = {
  eventTicketCapacity: number;
  eventEventCapacity: number;
  ticketTypeTicketCapacity: number;
  ticketTypeEventCapacity: number;
  electionDuplicate: number;
  electionLifecycle: number;
  duplicatePosition: number;
  duplicateCandidate: number;
  lifecyclePosition: number;
  lifecycleCandidate: number;
  webhookEvent: number;
  webhookTicketType: number;
  paymentIntent: number;
  paymentEventId: string;
  campaignWebhook: number;
  campaignPaymentIntent: number;
  campaignPaymentEventId: string;
  electionWebhook: number;
  electionWebhookPosition: number;
  electionWebhookCandidate: number;
  electionPaymentIntent: number;
  electionPaymentEventId: string;
};

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const reportPath = process.env.INTEGRITY_REPORT_PATH ?? "reports/evenum-integrity.json";
const concurrency = readPositiveInt("INTEGRITY_CONCURRENCY", 16);
const webhookSecret = "evenum-integrity-proof-secret";
const fixturePrefix = `__integrity_test__${randomUUID()}`;

if (!databaseUrl) throw new Error("DATABASE_URL must be set");
if (process.env.INTEGRITY_ALLOW_WRITES !== "1") {
  throw new Error("Refusing to run write integrity proof without INTEGRITY_ALLOW_WRITES=1");
}

const pool = new Pool({ connectionString: databaseUrl, max: 4 });

function readPositiveInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function countStatuses(results: HttpResult[]): Record<string, number> {
  return results.reduce<Record<string, number>>((counts, result) => {
    const key = result.status === null ? "network-error" : String(result.status);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function check(
  name: string,
  expected: string | number | boolean,
  actual: string | number | boolean,
): InvariantCheck {
  return { name, expected, actual, passed: expected === actual };
}

function scenario(
  name: string,
  requests: number,
  results: HttpResult[],
  invariantChecks: InvariantCheck[],
  errors: string[] = [],
): ScenarioReport {
  const allChecksPass = invariantChecks.every((item) => item.passed);
  return {
    name,
    requests,
    concurrency: Math.min(concurrency, requests),
    statusCounts: countStatuses(results),
    invariantChecks,
    passed: allChecksPass && errors.length === 0,
    errors,
  };
}

async function jsonRequest(
  baseUrl: string,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<HttpResult> {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // Preserve non-JSON response bodies for the report.
    }
    return { status: response.status, body: parsed };
  } catch (error) {
    return { status: null, body: null, error: error instanceof Error ? error.message : String(error) };
  }
}

function signWebhook(body: string): string {
  return createHmac("sha256", webhookSecret).update(body).digest("hex");
}

async function concurrentRequests(
  count: number,
  request: (index: number) => Promise<HttpResult>,
): Promise<HttpResult[]> {
  return Promise.all(Array.from({ length: count }, (_, index) => request(index)));
}

async function createFixtures(client: pg.PoolClient): Promise<FixtureIds> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneHourAhead = new Date(now.getTime() + 60 * 60 * 1000);

  const eventTicketCapacity = (
    await client.query<{ id: number }>(
      `INSERT INTO events
        (org_id, title, status, visibility, starts_at, ends_at, capacity)
       VALUES (1, $1, 'published', 'public', $2, $3, 100)
       RETURNING id`,
      [`${fixturePrefix}_event_ticket_capacity`, oneHourAgo, oneHourAhead],
    )
  ).rows[0]!.id;
  const eventEventCapacity = (
    await client.query<{ id: number }>(
      `INSERT INTO events
        (org_id, title, status, visibility, starts_at, ends_at, capacity)
       VALUES (1, $1, 'published', 'public', $2, $3, 2)
       RETURNING id`,
      [`${fixturePrefix}_event_event_capacity`, oneHourAgo, oneHourAhead],
    )
  ).rows[0]!.id;

  const ticketTypeTicketCapacity = (
    await client.query<{ id: number }>(
      `INSERT INTO ticket_types
        (event_id, name, price, currency, quantity, sold)
       VALUES ($1, $2, '0', 'XAF', 3, 0)
       RETURNING id`,
      [eventTicketCapacity, `${fixturePrefix}_ticket_capacity`],
    )
  ).rows[0]!.id;
  const ticketTypeEventCapacity = (
    await client.query<{ id: number }>(
      `INSERT INTO ticket_types
        (event_id, name, price, currency, quantity, sold)
       VALUES ($1, $2, '0', 'XAF', 10, 0)
       RETURNING id`,
      [eventEventCapacity, `${fixturePrefix}_event_capacity`],
    )
  ).rows[0]!.id;

  const electionDuplicate = (
    await client.query<{ id: number }>(
      `INSERT INTO elections
        (org_id, title, status, visibility, eligibility_mode, starts_at, ends_at)
       VALUES (1, $1, 'active', 'public', 'open', $2, $3)
       RETURNING id`,
      [`${fixturePrefix}_election_duplicate`, oneHourAgo, oneHourAhead],
    )
  ).rows[0]!.id;
  const electionLifecycle = (
    await client.query<{ id: number }>(
      `INSERT INTO elections
        (org_id, title, status, visibility, eligibility_mode, starts_at, ends_at)
       VALUES (1, $1, 'active', 'public', 'open', $2, $3)
       RETURNING id`,
      [
        `${fixturePrefix}_election_lifecycle`,
        new Date(now.getTime() - 2 * 60 * 60 * 1000),
        new Date(now.getTime() - 60 * 60 * 1000),
      ],
    )
  ).rows[0]!.id;

  const lifecyclePosition = (
    await client.query<{ id: number }>(
      `INSERT INTO positions (election_id, title, max_selections, sort_order)
       VALUES ($1, $2, 1, 1)
       RETURNING id`,
      [electionLifecycle, `${fixturePrefix}_lifecycle_position`],
    )
  ).rows[0]!.id;
  const lifecycleCandidate = (
    await client.query<{ id: number }>(
      `INSERT INTO candidates (election_id, position_id, name)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [electionLifecycle, lifecyclePosition, `${fixturePrefix}_lifecycle_candidate`],
    )
  ).rows[0]!.id;

  const duplicatePosition = (
    await client.query<{ id: number }>(
      `INSERT INTO positions (election_id, title, max_selections, sort_order)
       VALUES ($1, $2, 1, 1)
       RETURNING id`,
      [electionDuplicate, `${fixturePrefix}_position`],
    )
  ).rows[0]!.id;
  const duplicateCandidate = (
    await client.query<{ id: number }>(
      `INSERT INTO candidates (election_id, position_id, name)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [electionDuplicate, duplicatePosition, `${fixturePrefix}_candidate`],
    )
  ).rows[0]!.id;

  const webhookEvent = (
    await client.query<{ id: number }>(
      `INSERT INTO events
        (org_id, title, status, visibility, starts_at, ends_at, capacity)
       VALUES (1, $1, 'published', 'public', $2, $3, 10)
       RETURNING id`,
      [`${fixturePrefix}_event_webhook`, oneHourAgo, oneHourAhead],
    )
  ).rows[0]!.id;
  const webhookTicketType = (
    await client.query<{ id: number }>(
      `INSERT INTO ticket_types
        (event_id, name, price, currency, quantity, sold)
       VALUES ($1, $2, '25', 'XAF', 10, 1)
       RETURNING id`,
      [webhookEvent, `${fixturePrefix}_webhook_ticket`],
    )
  ).rows[0]!.id;
  const financial = (
    await client.query<{ id: number }>(
      `INSERT INTO financial_transactions
        (org_id, pillar, entity_id, entity_title, transaction_type,
         gross_amount, commission_rate, commission_amount, org_earnings,
         currency, status, payment_provider, payment_status, idempotency_key)
       VALUES (1, 'event', $1, $2, 'ticket', 25, 0.05, 1.25, 23.75,
               'XAF', 'pending', 'flowpay', 'pending', $3)
       RETURNING id`,
      [webhookEvent, `${fixturePrefix}_webhook_event`, `${fixturePrefix}_financial`],
    )
  ).rows[0]!.id;
  const paymentEventId = `${fixturePrefix}_payment_event`;
  const paymentIntent = (
    await client.query<{ id: number }>(
      `INSERT INTO payment_intents
        (external_reference, pillar, entity_id, transaction_type, amount,
         currency, customer_name, customer_email, customer_phone, payload,
         status, payment_status, idempotency_key, financial_transaction_id)
       VALUES ($1, 'event', $2, 'ticket', 25, 'XAF', 'Webhook Attendee',
               'webhook@example.test', '+237600000000', $3::jsonb,
               'pending', 'pending', $4, $5)
       RETURNING id`,
      [
        `${fixturePrefix}_external_reference`,
        webhookEvent,
        JSON.stringify({
          event: {
            ticketTypeId: webhookTicketType,
            attendeeName: "Webhook Attendee",
            attendeeEmail: "webhook@example.test",
            ticketCode: `${fixturePrefix}_ticket_code`,
          },
        }),
        `${fixturePrefix}_payment_idempotency`,
        financial,
      ],
    )
  ).rows[0]!.id;

  const campaignWebhook = (
    await client.query<{ id: number }>(
      `INSERT INTO campaigns
        (org_id, title, status, visibility, requires_payment, payment_amount,
         currency, fields, starts_at, ends_at)
       VALUES (1, $1, 'active', 'public', true, '25', 'XAF', '[]'::jsonb, $2, $3)
       RETURNING id`,
      [`${fixturePrefix}_campaign_webhook`, oneHourAgo, oneHourAhead],
    )
  ).rows[0]!.id;
  const campaignFinancial = (
    await client.query<{ id: number }>(
      `INSERT INTO financial_transactions
        (org_id, pillar, entity_id, entity_title, transaction_type,
         gross_amount, commission_rate, commission_amount, org_earnings,
         currency, status, payment_provider, payment_status, idempotency_key)
       VALUES (1, 'campaign', $1, $2, 'campaign_response', 25, 0.05, 1.25, 23.75,
               'XAF', 'pending', 'flowpay', 'pending', $3)
       RETURNING id`,
      [campaignWebhook, `${fixturePrefix}_webhook_campaign`, `${fixturePrefix}_campaign_financial`],
    )
  ).rows[0]!.id;
  const campaignPaymentEventId = `${fixturePrefix}_campaign_payment_event`;
  const campaignPaymentIntent = (
    await client.query<{ id: number }>(
      `INSERT INTO payment_intents
        (external_reference, pillar, entity_id, transaction_type, amount,
         currency, customer_name, customer_email, customer_phone, payload,
         status, payment_status, idempotency_key, financial_transaction_id)
       VALUES ($1, 'campaign', $2, 'campaign_response', 25, 'XAF',
               'Campaign Webhook Attendee', 'campaign@example.test', '+237600000001', $3::jsonb,
               'pending', 'pending', $4, $5)
       RETURNING id`,
      [
        `${fixturePrefix}_campaign_external_reference`,
        campaignWebhook,
        JSON.stringify({
          campaign: {
            submitterName: "Campaign Webhook Attendee",
            submitterEmail: "campaign@example.test",
            data: { source: "integrity-proof" },
          },
        }),
        `${fixturePrefix}_campaign_payment_idempotency`,
        campaignFinancial,
      ],
    )
  ).rows[0]!.id;

  const electionWebhook = (
    await client.query<{ id: number }>(
      `INSERT INTO elections
        (org_id, title, status, visibility, eligibility_mode, starts_at, ends_at)
       VALUES (1, $1, 'active', 'public', 'open', $2, $3)
       RETURNING id`,
      [`${fixturePrefix}_election_webhook`, oneHourAgo, oneHourAhead],
    )
  ).rows[0]!.id;
  const electionWebhookPosition = (
    await client.query<{ id: number }>(
      `INSERT INTO positions (election_id, title, max_selections, sort_order)
       VALUES ($1, $2, 1, 1)
       RETURNING id`,
      [electionWebhook, `${fixturePrefix}_webhook_position`],
    )
  ).rows[0]!.id;
  const electionWebhookCandidate = (
    await client.query<{ id: number }>(
      `INSERT INTO candidates (election_id, position_id, name)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [electionWebhook, electionWebhookPosition, `${fixturePrefix}_webhook_candidate`],
    )
  ).rows[0]!.id;
  const electionFinancial = (
    await client.query<{ id: number }>(
      `INSERT INTO financial_transactions
        (org_id, pillar, entity_id, entity_title, transaction_type,
         gross_amount, commission_rate, commission_amount, org_earnings,
         currency, status, payment_provider, payment_status, idempotency_key)
       VALUES (1, 'election', $1, $2, 'vote', 25, 0.05, 1.25, 23.75,
               'XAF', 'pending', 'flowpay', 'pending', $3)
       RETURNING id`,
      [electionWebhook, `${fixturePrefix}_webhook_election`, `${fixturePrefix}_election_financial`],
    )
  ).rows[0]!.id;
  const electionPaymentEventId = `${fixturePrefix}_election_payment_event`;
  const electionPaymentIntent = (
    await client.query<{ id: number }>(
      `INSERT INTO payment_intents
        (external_reference, pillar, entity_id, transaction_type, amount,
         currency, customer_name, customer_email, customer_phone, payload,
         status, payment_status, idempotency_key, financial_transaction_id)
       VALUES ($1, 'election', $2, 'vote', 25, 'XAF',
               'Election Webhook Attendee', 'election@example.test', '+237600000002', $3::jsonb,
               'pending', 'pending', $4, $5)
       RETURNING id`,
      [
        `${fixturePrefix}_election_external_reference`,
        electionWebhook,
        JSON.stringify({
          election: {
            voterIdentifier: "email:election@example.test",
            voterEmail: "election@example.test",
            voteQuantity: 1,
            selections: [{ positionId: electionWebhookPosition, candidateIds: [electionWebhookCandidate] }],
          },
        }),
        `${fixturePrefix}_election_payment_idempotency`,
        electionFinancial,
      ],
    )
  ).rows[0]!.id;

  return {
    eventTicketCapacity,
    eventEventCapacity,
    ticketTypeTicketCapacity,
    ticketTypeEventCapacity,
    electionDuplicate,
    electionLifecycle,
    duplicatePosition,
    duplicateCandidate,
    lifecyclePosition,
    lifecycleCandidate,
    webhookEvent,
    webhookTicketType,
    paymentIntent,
    paymentEventId,
    campaignWebhook,
    campaignPaymentIntent,
    campaignPaymentEventId,
    electionWebhook,
    electionWebhookPosition,
    electionWebhookCandidate,
    electionPaymentIntent,
    electionPaymentEventId,
  };
}

async function readEventInvariant(
  client: pg.PoolClient,
  eventId: number,
  ticketTypeId: number,
  eventCapacity: number,
  ticketCapacity: number,
): Promise<InvariantCheck[]> {
  const result = await client.query<{
    event_count: string;
    type_count: string;
    sold: number;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM tickets WHERE event_id = $1 AND status <> 'cancelled')::int AS event_count,
       (SELECT COUNT(*) FROM tickets WHERE ticket_type_id = $2 AND status <> 'cancelled')::int AS type_count,
       (SELECT sold FROM ticket_types WHERE id = $2) AS sold`,
    [eventId, ticketTypeId],
  );
  const row = result.rows[0]!;
  const eventCount = Number(row.event_count);
  const typeCount = Number(row.type_count);
  const sold = Number(row.sold);
  return [
    check("event ticket count <= event capacity", true, eventCount <= eventCapacity),
    check("ticket count <= ticket-type capacity", true, typeCount <= ticketCapacity),
    check("ticket-type sold counter matches tickets", typeCount, sold),
  ];
}

async function cleanupFixtures(client: pg.PoolClient): Promise<void> {
  const events = await client.query<{ id: number }>(
    "SELECT id FROM events WHERE title LIKE $1",
    [`${fixturePrefix}%`],
  );
  const elections = await client.query<{ id: number }>(
    "SELECT id FROM elections WHERE title LIKE $1",
    [`${fixturePrefix}%`],
  );
  const campaigns = await client.query<{ id: number }>(
    "SELECT id FROM campaigns WHERE title LIKE $1",
    [`${fixturePrefix}%`],
  );
  const eventIds = events.rows.map((row) => row.id);
  const electionIds = elections.rows.map((row) => row.id);
  const campaignIds = campaigns.rows.map((row) => row.id);

  await client.query(
    "DELETE FROM payment_webhook_events WHERE event_id LIKE $1",
    [`${fixturePrefix}%`],
  );
  if (eventIds.length > 0) {
    await client.query(
      "DELETE FROM payment_intents WHERE pillar = 'event' AND entity_id = ANY($1::int[])",
      [eventIds],
    );
    await client.query(
      "DELETE FROM financial_transactions WHERE pillar = 'event' AND entity_id = ANY($1::int[])",
      [eventIds],
    );
    await client.query("DELETE FROM events WHERE id = ANY($1::int[])", [eventIds]);
  }
  if (electionIds.length > 0) {
    await client.query(
      `DELETE FROM vote_selections
       WHERE vote_id IN (
         SELECT id FROM votes WHERE election_id = ANY($1::int[])
       )`,
      [electionIds],
    );
    await client.query(
      "DELETE FROM votes WHERE election_id = ANY($1::int[])",
      [electionIds],
    );
    await client.query(
      "DELETE FROM payment_intents WHERE pillar = 'election' AND entity_id = ANY($1::int[])",
      [electionIds],
    );
    await client.query(
      "DELETE FROM financial_transactions WHERE pillar = 'election' AND entity_id = ANY($1::int[])",
      [electionIds],
    );
    await client.query("DELETE FROM elections WHERE id = ANY($1::int[])", [electionIds]);
  }
  if (campaignIds.length > 0) {
    await client.query(
      "DELETE FROM payment_intents WHERE pillar = 'campaign' AND entity_id = ANY($1::int[])",
      [campaignIds],
    );
    await client.query(
      "DELETE FROM financial_transactions WHERE pillar = 'campaign' AND entity_id = ANY($1::int[])",
      [campaignIds],
    );
    await client.query("DELETE FROM campaigns WHERE id = ANY($1::int[])", [campaignIds]);
  }
}

async function listen(app: { listen: Function }): Promise<{ server: any; baseUrl: string }> {
  const server = await new Promise<any>((resolve, reject) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    instance.on("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not determine test server address");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function closeServer(server: any): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  process.env.FLOWPAY_WEBHOOK_SECRET = webhookSecret;
  process.env.NODE_ENV = "test";

  // Keep the API import dynamic so the scripts package typecheck does not
  // absorb the API package's source tree under scripts/rootDir.
  const apiModulePath = "../artifacts/api-server/src/app.ts";
  const { default: app } = await import(apiModulePath);
  const { server, baseUrl } = await listen(app);
  const client = await pool.connect();
  const reports: ScenarioReport[] = [];
  let fixtureIds: FixtureIds | undefined;
  let cleanupCompleted = false;
  let cleanupError: string | undefined;

  try {
    fixtureIds = await createFixtures(client);

    const ticketCapacityResults = await concurrentRequests(12, (index) =>
      jsonRequest(baseUrl, `/api/events/${fixtureIds!.eventTicketCapacity}/register`, {
        ticketTypeId: fixtureIds!.ticketTypeTicketCapacity,
        attendeeName: `Ticket Capacity ${index}`,
        attendeeEmail: `ticket-capacity-${index}@example.test`,
      }),
    );
    reports.push(scenario(
      "concurrent registrations respect ticket-type capacity",
      ticketCapacityResults.length,
      ticketCapacityResults,
      [
        check("three registrations return created", 3, ticketCapacityResults.filter((result) => result.status === 201).length),
        check("nine registrations return conflict", 9, ticketCapacityResults.filter((result) => result.status === 409).length),
        ...await readEventInvariant(client, fixtureIds.eventTicketCapacity, fixtureIds.ticketTypeTicketCapacity, 100, 3),
      ],
    ));

    const eventCapacityResults = await concurrentRequests(12, (index) =>
      jsonRequest(baseUrl, `/api/events/${fixtureIds!.eventEventCapacity}/register`, {
        ticketTypeId: fixtureIds!.ticketTypeEventCapacity,
        attendeeName: `Event Capacity ${index}`,
        attendeeEmail: `event-capacity-${index}@example.test`,
      }),
    );
    reports.push(scenario(
      "concurrent registrations respect event capacity",
      eventCapacityResults.length,
      eventCapacityResults,
      [
        check("two registrations return created", 2, eventCapacityResults.filter((result) => result.status === 201).length),
        check("ten registrations return conflict", 10, eventCapacityResults.filter((result) => result.status === 409).length),
        ...await readEventInvariant(client, fixtureIds.eventEventCapacity, fixtureIds.ticketTypeEventCapacity, 2, 10),
      ],
    ));

    const duplicateVoteResults = await concurrentRequests(12, () =>
      jsonRequest(baseUrl, `/api/elections/${fixtureIds!.electionDuplicate}/vote`, {
        voterEmail: "duplicate-voter@example.test",
        selections: [{ positionId: fixtureIds!.duplicatePosition, candidateIds: [fixtureIds!.duplicateCandidate] }],
      }),
    );
    const voteInvariant = await client.query<{ votes: string; selections: string }>(
      `SELECT
         (SELECT COUNT(*) FROM votes WHERE election_id = $1)::int AS votes,
         (SELECT COUNT(*) FROM vote_selections vs
            JOIN votes v ON v.id = vs.vote_id WHERE v.election_id = $1)::int AS selections`,
      [fixtureIds.electionDuplicate],
    );
    reports.push(scenario(
      "concurrent election submissions reject duplicate voter",
      duplicateVoteResults.length,
      duplicateVoteResults,
      [
        check("one duplicate submission returns OK", 1, duplicateVoteResults.filter((result) => result.status === 200).length),
        check("eleven duplicate submissions return forbidden", 11, duplicateVoteResults.filter((result) => result.status === 403).length),
        check("one ballot persisted", 1, Number(voteInvariant.rows[0]!.votes)),
        check("one ballot selection persisted", 1, Number(voteInvariant.rows[0]!.selections)),
      ],
    ));

    const lifecycleResult = await jsonRequest(baseUrl, `/api/elections/${fixtureIds.electionLifecycle}/vote`, {
      voterEmail: "closed-voter@example.test",
      selections: [{ positionId: fixtureIds.lifecyclePosition, candidateIds: [fixtureIds.lifecycleCandidate] }],
    });
    const lifecycleVotes = await client.query<{ count: string }>(
      "SELECT COUNT(*)::int AS count FROM votes WHERE election_id = $1",
      [fixtureIds.electionLifecycle],
    );
    reports.push(scenario(
      "ended election rejects submissions",
      1,
      [lifecycleResult],
      [
        check("closed election returns forbidden", 403, lifecycleResult.status ?? -1),
        check("closed election persists no ballot", 0, Number(lifecycleVotes.rows[0]!.count)),
      ],
    ));

    const webhookCases = [
      {
        pillar: "ticket",
        eventId: fixtureIds.paymentEventId,
        externalReference: `${fixturePrefix}_external_reference`,
        transactionId: `${fixturePrefix}_flowpay_transaction`,
      },
      {
        pillar: "campaign",
        eventId: fixtureIds.campaignPaymentEventId,
        externalReference: `${fixturePrefix}_campaign_external_reference`,
        transactionId: `${fixturePrefix}_campaign_flowpay_transaction`,
      },
      {
        pillar: "election",
        eventId: fixtureIds.electionPaymentEventId,
        externalReference: `${fixturePrefix}_election_external_reference`,
        transactionId: `${fixturePrefix}_election_flowpay_transaction`,
      },
    ];
    const webhookResultGroups = await Promise.all(webhookCases.map((webhookCase) => {
      const webhookPayload = {
        eventId: webhookCase.eventId,
        eventType: "payment.succeeded",
        data: {
          transaction: {
            externalReference: webhookCase.externalReference,
            id: webhookCase.transactionId,
            status: "SUCCEEDED",
          },
        },
      };
      const webhookBody = JSON.stringify(webhookPayload);
      return concurrentRequests(12, () =>
        jsonRequest(
          baseUrl,
          "/api/payments/webhooks/flowpay",
          webhookPayload,
          {
            "x-flowpay-event-id": webhookCase.eventId,
            "x-flowpay-event-type": "payment.succeeded",
            "x-flowpay-signature": signWebhook(webhookBody),
          },
        ),
      );
    }));
    const webhookResults = webhookResultGroups.flat();
    const eventWebhookInvariant = await client.query<{
      webhook_events: string;
      tickets: string;
      intents: string;
      financial: string;
      sold: number;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM payment_webhook_events WHERE event_id = $1)::int AS webhook_events,
         (SELECT COUNT(*) FROM tickets WHERE event_id = $2 AND ticket_code = $3)::int AS tickets,
         (SELECT COUNT(*) FROM payment_intents WHERE id = $4 AND status = 'succeeded')::int AS intents,
         (SELECT COUNT(*) FROM financial_transactions WHERE id = (
           SELECT financial_transaction_id FROM payment_intents WHERE id = $4
         ) AND status = 'completed' AND payment_status = 'succeeded')::int AS financial,
         (SELECT sold FROM ticket_types WHERE id = $5) AS sold`,
      [
        fixtureIds.paymentEventId,
        fixtureIds.webhookEvent,
        `${fixturePrefix}_ticket_code`,
        fixtureIds.paymentIntent,
        fixtureIds.webhookTicketType,
      ],
    );
    const campaignWebhookInvariant = await client.query<{
      webhook_events: string;
      responses: string;
      intents: string;
      financial: string;
      current_amount: string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM payment_webhook_events WHERE event_id = $1)::int AS webhook_events,
         (SELECT COUNT(*) FROM campaign_responses WHERE campaign_id = $2)::int AS responses,
         (SELECT COUNT(*) FROM payment_intents WHERE id = $3 AND status = 'succeeded')::int AS intents,
         (SELECT COUNT(*) FROM financial_transactions WHERE id = (
           SELECT financial_transaction_id FROM payment_intents WHERE id = $3
         ) AND status = 'completed' AND payment_status = 'succeeded')::int AS financial,
         (SELECT current_amount FROM campaigns WHERE id = $2) AS current_amount`,
      [
        fixtureIds.campaignPaymentEventId,
        fixtureIds.campaignWebhook,
        fixtureIds.campaignPaymentIntent,
      ],
    );
    const electionWebhookInvariant = await client.query<{
      webhook_events: string;
      votes: string;
      selections: string;
      intents: string;
      financial: string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM payment_webhook_events WHERE event_id = $1)::int AS webhook_events,
         (SELECT COUNT(*) FROM votes WHERE election_id = $2)::int AS votes,
         (SELECT COUNT(*) FROM vote_selections vs
            JOIN votes v ON v.id = vs.vote_id WHERE v.election_id = $2)::int AS selections,
         (SELECT COUNT(*) FROM payment_intents WHERE id = $3 AND status = 'succeeded')::int AS intents,
         (SELECT COUNT(*) FROM financial_transactions WHERE id = (
           SELECT financial_transaction_id FROM payment_intents WHERE id = $3
         ) AND status = 'completed' AND payment_status = 'succeeded')::int AS financial`,
      [
        fixtureIds.electionPaymentEventId,
        fixtureIds.electionWebhook,
        fixtureIds.electionPaymentIntent,
      ],
    );
    const eventWebhookRow = eventWebhookInvariant.rows[0]!;
    const campaignWebhookRow = campaignWebhookInvariant.rows[0]!;
    const electionWebhookRow = electionWebhookInvariant.rows[0]!;
    reports.push(scenario(
      "replayed FlowPay webhooks are idempotent across all pillars",
      webhookResults.length,
      webhookResults,
      [
        check("all webhook deliveries return OK", true, webhookResults.every((result) => result.status === 200)),
        check("one ticket webhook event persisted", 1, Number(eventWebhookRow.webhook_events)),
        check("one ticket issued", 1, Number(eventWebhookRow.tickets)),
        check("ticket payment intent finalized once", 1, Number(eventWebhookRow.intents)),
        check("ticket financial transaction completed once", 1, Number(eventWebhookRow.financial)),
        check("ticket webhook fulfillment does not increment sold counter", 1, Number(eventWebhookRow.sold)),
        check("one campaign webhook event persisted", 1, Number(campaignWebhookRow.webhook_events)),
        check("one campaign response created", 1, Number(campaignWebhookRow.responses)),
        check("campaign payment intent finalized once", 1, Number(campaignWebhookRow.intents)),
        check("campaign financial transaction completed once", 1, Number(campaignWebhookRow.financial)),
        check("campaign amount incremented once", "25.00", campaignWebhookRow.current_amount),
        check("one election webhook event persisted", 1, Number(electionWebhookRow.webhook_events)),
        check("one paid vote created", 1, Number(electionWebhookRow.votes)),
        check("one paid vote selection created", 1, Number(electionWebhookRow.selections)),
        check("election payment intent finalized once", 1, Number(electionWebhookRow.intents)),
        check("election financial transaction completed once", 1, Number(electionWebhookRow.financial)),
      ],
    ));
  } catch (error) {
    reports.push(scenario(
      "integrity runner execution",
      0,
      [],
      [],
      [error instanceof Error ? error.stack ?? error.message : String(error)],
    ));
  } finally {
    try {
      await cleanupFixtures(client);
      cleanupCompleted = true;
    } catch (error) {
      cleanupError = error instanceof Error ? error.message : String(error);
    }
    client.release();
    await closeServer(server);
    await pool.end();
  }

  const report: IntegrityReport = {
    startedAt,
    finishedAt: new Date().toISOString(),
    baseUrl,
    fixturePrefix,
    scenarios: reports,
    passed: reports.length > 0 && reports.every((item) => item.passed) && cleanupCompleted,
    cleanup: { attempted: true, completed: cleanupCompleted, error: cleanupError },
  };
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Evenum concurrency integrity proof: ${report.passed ? "PASS" : "FAIL"}`);
  console.table(
    reports.map((item) => ({
      scenario: item.name,
      passed: item.passed,
      statuses: JSON.stringify(item.statusCounts),
      invariants: `${item.invariantChecks.filter((checkItem) => checkItem.passed).length}/${item.invariantChecks.length}`,
    })),
  );
  console.log(`Report written to ${reportPath}`);
  if (!report.passed) process.exitCode = 1;
}

void main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await pool.end().catch(() => undefined);
  process.exitCode = 1;
});