# ROBLYNE Scale and Production Readiness Audit

Audit date: 2026-10-29. This is an application-side audit. It does not claim that provider capacity, real FlowPay settlement, or hosted infrastructure has been load-tested.

## Current architecture

- Static Vite frontend backed by a CDN-capable static host.
- Stateless Express API with PostgreSQL-backed sessions.
- PostgreSQL is the source of truth for accounts, organizations, activity, payments, and finance.
- Redis provides shared rate limits, discovery caching, BullMQ coordination, and worker health.
- BullMQ worker lanes run lifecycle sweeps and bounded payment recovery.
- FlowPay is external. ROBLYNE owns payment intents, signed-webhook verification, idempotent local finalization, and a browser-driven status reconciliation fallback.
- Images upload directly from the browser to S3-compatible storage by short-lived presigned URL; API instances do not relay image bytes.

## Verified strengths

- API, frontend, worker, database, and object storage are separate deployable concerns.
- Sessions are durable in PostgreSQL; API instances do not retain user session state in memory.
- Payment intents have durable external references and idempotency keys. Webhooks are verified over the raw body and deduplicated by provider event ID.
- Election votes have a database uniqueness constraint to prevent double voting.
- Redis-backed rate limiting, discovery cache coalescing, worker heartbeat, and readiness checks already exist.
- The worker uses a scheduler lock, so repeated lifecycle registration is safe when the API scales out.
- Lifecycle decisions are also enforced on request paths; the scheduler is not the only deadline control.

## Hardening completed in this audit

- The API now retains a raw JSON body only for the FlowPay webhook endpoint. Normal JSON requests no longer incur the extra buffer copy required for HMAC verification.
- FlowPay webhooks now have an isolated high-capacity Redis-backed limiter. They bypass normal API and end-user write limits, preventing valid provider deliveries from being throttled during payment bursts.
- The deployment runbook documents health monitors, webhook-first settlement, and the browser reconciliation fallback.

## Material gaps before a one-million-user target

### Query and API shape

- Event, election, campaign, organization-member, attendee, and campaign-submission list routes include unbounded reads. The public list routes additionally use per-row count subqueries.
- CSV exports are generated synchronously in API requests. Large exports can exhaust memory, database connections, and request timeouts.
- Search uses `ILIKE '%term%'` across multiple tables. It needs PostgreSQL trigram/full-text indexes and a dedicated search design before broad high-volume discovery traffic.
- Offset pagination on finance views becomes progressively expensive at high offsets. Cursor/keyset pagination is needed for high-cardinality collections.

### Async processing

- The worker does not yet own report generation, notifications, image cleanup, analytics rollups, or a human-operated dead-letter replay tool.
- Payment reconciliation has bounded server-side recovery in addition to active checkout polling. The FlowPay webhook remains mandatory and primary.
- There is no transactional outbox. A production async design needs durable outbox records written with the source-of-truth transaction, then claimed and delivered by dedicated workers.

### Data and infrastructure

- API startup currently performs migrations. This is safe only for a single API release process; multi-replica production requires a separate one-time migration/release job.
- Connection limits are configuration-based but have not been budgeted against Aiven's connection cap, API replica count, worker concurrency, or a pooler such as PgBouncer.
- There is no verified backup restore drill, point-in-time recovery procedure, or load/capacity test against production-like data.
- Discovery cache invalidation scans keys by prefix. It is acceptable at the current small scale but needs versioned cache namespaces or tag-based invalidation at high cache-cardinality.

### Observability and operations

- HTTP metrics are process-local and reset on restart. Queue state counts are exposed, but job latency, database-pool pressure, webhook failures, payment reconciliation age, and business-level success rates still need central monitoring.
- No alerting SLOs, incident runbook, dead-letter replay procedure, or deployment rollback drill has been verified.
- Render free instances, uptime pings, and a single API/worker process are not a high-availability production posture.

## Required target architecture

1. **API lane:** horizontally scalable stateless API replicas behind a load balancer; controlled release migration job; per-route body, concurrency, and timeout limits.
2. **Data lane:** managed PostgreSQL with backups/PITR, connection pooler, query monitoring, production indexes, and read-replica strategy only after measured need.
3. **Async lanes:** independent BullMQ queues and worker concurrency for lifecycle, exports, notifications, payment recovery, media cleanup, and analytics. Each lane needs retry policy, backoff, retention, dead-letter/replay, idempotency, and queue-lag metrics.
4. **Integration lane:** FlowPay webhooks remain primary. A durable payment-reconciliation outbox gives server-side recovery for delayed webhooks without trusting the browser.
5. **Delivery lane:** CDN-served frontend and media, custom domain, strict CORS/session policy, direct object-storage uploads, and cache-control/versioning.
6. **Operations lane:** central logs, metrics, traces, health/readiness, Better Stack alerting, dashboards for API/queue/database/payment SLOs, backup restore tests, load tests, and incident runbooks.

## Delivery sequence

### Phase 1 — Mandatory before broad public launch

1. Add backward-compatible cursor pagination and strict response limits to every collection route; update the frontend to load pages incrementally.
2. Move CSV/report exports to an `exports` queue with object-storage output and signed download URLs.
3. Add a transactional outbox and a `payment-recovery` queue; reconcile pending FlowPay intents server-side with bounded exponential retry and alerting.
4. Add queue metrics, failed-job retention, an authenticated replay tool, and alerts for queue lag, failed webhooks, payment age, API 5xx rate, and readiness failures.
5. Replace migration-on-API-start with a controlled release migration command.
6. Add PostgreSQL indexes from actual query plans, starting with public discovery/search and high-volume finance/activity feeds.

### Phase 2 — Required for sustained scale

1. Add asynchronous notification delivery and template/provider failure handling.
2. Add media lifecycle jobs: abandoned-upload cleanup, retention policy, optional malware scanning, and image transformation/CDN strategy.
3. Add precomputed analytics/rollups instead of calculating high-cardinality totals in request paths.
4. Add full-text/trigram search and a measured promotion path to a dedicated search system only if PostgreSQL search is no longer sufficient.
5. Establish load-test scenarios for sign-in, discovery, high-contention voting, ticket checkout, FlowPay webhooks, and exports.

### Phase 3 — High availability and governance

1. Run at least two API replicas and independently scaled worker lanes after the migration/outbox work is complete.
2. Set recovery objectives, test database restore and regional/provider failure procedures, and document incident ownership.
3. Perform security review, dependency scanning, secrets rotation drills, privacy/retention review, and payment reconciliation controls.

## Acceptance criteria for the next implementation phase

- No unbounded public or administrative collection endpoint.
- No long-running export, payment-recovery, or notification work in the request/response path.
- Every async action has a durable idempotency key, retry/backoff policy, observable queue state, and replay procedure.
- A payment succeeds exactly once whether FlowPay webhook delivery is immediate, duplicated, delayed, or temporarily absent.
- API replicas can be added without concurrent migrations or duplicate background work.
- Production-like load tests demonstrate measured capacity and recovery behavior rather than inferred scale.
