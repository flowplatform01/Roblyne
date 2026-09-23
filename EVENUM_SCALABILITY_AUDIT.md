# Evenum Scalability Audit and Phased Implementation Plan

**Status:** Baseline review completed; implementation intentionally not started  
**Scope:** Performance, concurrency, multi-instance operation, resilience, and
production readiness  
**Guiding constraint:** Preserve current product behavior, correctness, security,
UX, and the existing Evenum architecture unless measured evidence justifies a
change.

## Executive summary

Evenum already has several important production-hardening controls:

- PostgreSQL-backed sessions rather than process-memory sessions
- Transactional writes for voting, campaign participation, ticket inventory,
  and payment state
- Database uniqueness constraints and idempotency handling for high-contention
  operations
- Request IDs, structured logging, error boundaries, and client diagnostics
- API rate limiting and security middleware
- React Query caching, lazy route loading, and PWA support
- Shared OpenAPI-generated React Query and Zod libraries

The application is not yet a fully multi-instance platform. The most concrete
scaling gaps are:

1. API rate limits are process-local, so limits do not aggregate across
   instances.
2. Lifecycle sweeping runs inside every API process, creating duplicate
   scheduled work as instances are added.
3. PostgreSQL connection capacity is bounded per process, but the aggregate
   connection budget is not yet configured for multiple API instances.
4. Public search and some administrative endpoints can return unbounded
   result sets and perform expensive correlated counts.
5. There is no repeatable load/concurrency test harness or database query
   baseline.
6. Redis, BullMQ, independent workers, and WebSockets are not currently
   present. They should be added only where the baseline shows a real need.

The recommended approach is to measure first, fix database and request-shape
risks second, then introduce shared infrastructure only for proven
multi-instance requirements.

## Current architecture baseline

```text
Browser
  │
  ├─ React/Vite SPA
  │    ├─ Wouter routes
  │    ├─ TanStack Query cache
  │    ├─ generated React API client
  │    └─ PWA service worker
  │
  └─ /api
       └─ Express API
            ├─ session cookies
            ├─ route and business logic
            ├─ request logging and rate limits
            └─ Drizzle ORM
                 └─ PostgreSQL
```

Relevant source-of-truth locations:

| Area | Location |
| --- | --- |
| API middleware and server setup | `artifacts/api-server/src/app.ts` |
| API process startup and scheduler | `artifacts/api-server/src/index.ts` |
| Lifecycle transitions | `artifacts/api-server/src/lib/lifecycle.ts` |
| Database connection pool | `lib/db/src/index.ts` |
| Database schemas and indexes | `lib/db/src/schema/` |
| Public discovery/search | `artifacts/api-server/src/routes/discover.ts` |
| Election concurrency paths | `artifacts/api-server/src/routes/elections.ts` |
| Event inventory paths | `artifacts/api-server/src/routes/events.ts` |
| Payment idempotency/webhooks | `artifacts/api-server/src/lib/payment-intents.ts` and `routes/payments.ts` |
| Frontend query defaults | `artifacts/evenum/src/App.tsx` |
| PWA runtime caching | `artifacts/evenum/vite.config.ts` |

## Controls already in place

### Request and API layer

- Helmet is enabled with an explicit cross-origin resource policy.
- CORS allows credentialed requests.
- JSON and URL-encoded body sizes are capped at 10 MB.
- Every request receives a correlation ID and the response exposes it through
  `X-Request-Id`.
- Pino provides structured server logs with sensitive headers redacted.
- General, authentication, write, and search rate limits are defined.
- The API returns a bounded JSON error shape for unhandled route failures.

### Authentication and shared state

- Passwords are hashed with bcryptjs.
- Sessions use `express-session` with `connect-pg-simple`.
- The session store is PostgreSQL-backed, so authentication does not disappear
  when an API process restarts.
- Production startup refuses to run with the development session secret.

### High-contention business operations

- Election voting uses database transactions, row locking, ownership checks,
  candidate/position validation, and uniqueness constraints.
- Event registration locks the event and ticket-type rows before checking
  capacity and ticket inventory.
- Campaign participation updates the campaign and related financial records
  transactionally.
- Payment webhook events have a unique event ID and duplicate handling.
- Request-time lifecycle checks remain authoritative even when the background
  sweep is delayed.

These protections should be preserved while introducing any shared
infrastructure.

## Evidence-backed risks and gaps

### 1. Rate limiting is not shared across API instances

`artifacts/api-server/src/middlewares/rateLimit.ts` uses the default
process-local store from `express-rate-limit`. With one instance, this provides
a useful ceiling. With multiple instances behind a load balancer, each
instance has its own counters and the effective limit grows with the number of
instances.

**Impact:**

- Authentication and write protection become less predictable at scale.
- Search protection can be bypassed by distributing requests across instances.
- Restarting an instance resets its counters.

**Recommendation:** Keep the current limits for the single-instance baseline.
When multi-instance operation is enabled, move only the rate-limit counters to
a shared store, preferably Redis or a Redis-compatible service. Do not move
business state into Redis.

### 2. Lifecycle sweeping is duplicated across instances

`artifacts/api-server/src/index.ts` starts a 30-second `setInterval` in every
API process. `sweepExpiredLifecycles()` uses conditional updates, so the
database remains authoritative and the transition itself is largely
idempotent. However, every instance still performs the same three update
queries.

**Impact:**

- Query and log volume grows linearly with API instance count.
- Scheduler work competes with user traffic.
- A future scheduled operation added to this loop could accidentally run more
  than once.

**Recommendation:** Keep request-time lifecycle enforcement. Before running
multiple API instances, extract the sweep into a single scheduled worker or
use a database-backed/distributed lease. The operation should retain an
idempotent conditional update so duplicate execution is safe.

### 3. PostgreSQL connection capacity needs an instance budget

`lib/db/src/index.ts` configures a pool with `max: 5` connections per process.
That is a sensible local limit for the current Replit database environment,
but the aggregate budget becomes `5 × number of API/worker processes`.

**Impact:**

- Adding instances without a connection budget can exhaust PostgreSQL.
- Workers, migrations, and scripts can compete with request-serving pools.
- Pool saturation can look like application latency unless pool wait time is
  measured.

**Recommendation:** Define a production connection budget before horizontal
scaling. Allocate it across API instances, workers, and administrative jobs.
Instrument pool saturation and query latency before changing the per-process
limit.

### 4. Public search can scale poorly with dataset size

`artifacts/api-server/src/routes/discover.ts` runs up to three searches in
parallel. The search predicates use `ILIKE '%query%'`, participant counts are
correlated subqueries, and the result arrays are combined and sorted in Node.
The search response does not currently enforce a result limit equivalent to a
page.

**Impact:**

- Large public tables can produce sequential scans.
- Three concurrent queries can multiply database pressure.
- Correlated counts repeat work for every matching row.
- Large responses consume database, API, and browser memory.

**Recommendation:**

1. Establish query plans with representative data before adding indexes.
2. Add an explicit bounded page size and stable pagination contract.
3. Consider full-text or trigram search only after measuring the current
   workload.
4. Replace per-row count subqueries with precomputed counters or a measured
   aggregate strategy if counts become a bottleneck.
5. Cache only public, safely-stale discovery responses with deliberate TTLs.

### 5. Administrative list endpoints are unbounded

The platform admin user and organization endpoints currently return complete
lists. This is acceptable for a small installation but will become a memory
and payload problem as the platform grows.

**Recommendation:** Add pagination, bounded limits, and server-side search or
filters before the admin dataset becomes large. This is lower priority than
public discovery because the endpoints are admin-only and lower volume.

### 6. Event capacity checks can contend on hot rows

Event registration locks the event row and then calculates capacity from ticket
and pending payment rows. This is correct for preventing oversells, but a
popular event serializes registrations on the event row and repeats count
work.

**Recommendation:**

- Preserve the current lock and transaction until concurrency tests establish
  a problem.
- Use `EXPLAIN (ANALYZE, BUFFERS)` on the ticket and payment-intent count
  queries with realistic volumes.
- Add composite indexes only when query plans justify them; existing
  single-column indexes are not automatically sufficient for every predicate.
- If the event becomes a proven hotspot, consider an atomic counter or
  reservation model while keeping the database as the source of truth.

### 7. Payment-status polling needs a load profile

The frontend payment status hook polls at approximately 1.5-second intervals
while a payment is active. This is simple and reliable, but the aggregate
request rate can be high during a large payment wave.

**Recommendation:** Measure concurrent checkout behavior first. If needed,
use bounded exponential backoff, stop conditions, server hints, or a
real-time update mechanism. Do not replace polling with WebSockets without
measuring the actual payment traffic.

### 8. PWA API caching needs a privacy audit

The PWA service worker uses `NetworkFirst` caching for `/api/` GET requests.
This can improve resilience and repeat navigation, but the rule covers both
public and potentially authenticated API reads.

**Recommendation:** Explicitly classify API responses as public, session-bound,
or mutation-related and ensure private data is never served from an
inappropriate shared/browser cache. Preserve the existing offline-first
behavior for data that is safe to reuse.

### 9. Observability is good at request level but incomplete for load analysis

Request IDs, structured logs, health checks, and client diagnostics already
exist. The current baseline does not yet expose a complete view of:

- request latency distributions
- database query and pool wait time
- cache hit/miss behavior
- queue depth and job duration
- worker health
- WebSocket connection counts
- external payment latency

**Recommendation:** Add provider-neutral metrics and timing around the
highest-value boundaries before optimizing infrastructure.

## Infrastructure decisions

### Redis

**Decision: justified, but not as the first change.**

Redis is a good fit for shared rate-limit counters, short-lived coordination,
distributed leases, and later queue backing. It is not a replacement for
PostgreSQL business state.

Adoption criteria:

- configuration-driven connection settings
- explicit TTLs and invalidation rules
- bounded memory behavior
- fail-open or fail-closed behavior chosen per use case
- graceful behavior when Redis is unavailable
- no code path treats Redis as the authoritative record for votes, tickets,
  payments, or financial transactions

The first justified Redis use is shared rate limiting or a lifecycle lease
when multi-instance deployment is actually enabled. General-purpose caching
should follow measured hot-read data, not precede it.

### BullMQ and background workers

**Decision: defer until asynchronous workloads are identified.**

The current API does not show a large notification, email, batch-processing, or
analytics workload that must be moved out of the request path. Adding BullMQ
without such a workload would add failure modes and operational cost.

The first likely worker candidate is lifecycle sweeping if API instances are
scaled horizontally. Future candidates include notifications, reconciliation,
large exports, and analytics aggregation.

Every future job must define:

- an idempotency key or duplicate-safe behavior
- retry and backoff policy
- timeout and concurrency limit
- failure visibility and dead-letter handling
- a clear source of truth in PostgreSQL

### WebSockets

**Decision: do not add yet.**

No WebSocket transport is currently present. Current flows can continue to use
HTTP and controlled polling while the real-time requirements are measured.

Consider WebSockets only for a concrete user-visible requirement such as live
results, payment status, event state, or notifications where polling is
demonstrably expensive or too stale. Multiple WebSocket-serving instances
would require shared pub/sub coordination, likely Redis-backed.

### Microservices

**Decision: do not introduce them.**

The current separation between the static web artifact, API artifact, shared
libraries, and future workers is sufficient. Independent workers are
appropriate when asynchronous load justifies them; splitting domain routes
into microservices is not currently justified.

## Phased implementation plan

### Phase 0 — Establish a measurable baseline

**Goal:** Know what is slow, expensive, and concurrency-sensitive before
changing infrastructure.

- Add request timing and route-level latency metrics.
- Add database query timing and pool saturation visibility.
- Define target workloads:
  - public discovery browsing and search
  - election voting
  - event registration and ticket inventory
  - campaign submission
  - payment initialization and webhook delivery
  - authenticated workspace reads
- Seed representative data volumes, not only demo-sized data.
- Capture response sizes, error rates, p50/p95/p99 latency, and database load.
- Add a repeatable load-test command or isolated test harness.

**Exit criteria:**

- Baseline numbers exist for each target workload.
- The slowest routes and highest database-cost queries are identified.
- Tests can reproduce at least one concurrent vote and one concurrent ticket
  inventory scenario.

### Phase 1 — Fix boundedness and database hot paths

**Goal:** Prevent avoidable work from growing without a bound.

- Add pagination and maximum limits to public search and admin lists.
- Define stable ordering and cursor/offset behavior per endpoint.
- Analyze discovery count subqueries and event capacity queries.
- Add only evidence-backed composite indexes.
- Review all large exports and analytics endpoints for bounded work.
- Review payment polling load and introduce backoff only if the baseline
  warrants it.
- Complete the PWA cache privacy classification.

**Exit criteria:**

- No high-volume public or admin list endpoint has an unbounded response.
- Query plans are recorded for the top database-cost operations.
- Concurrency tests still preserve vote, ticket, payment, and campaign
  invariants.

### Phase 2 — Make multi-instance operation explicit

**Goal:** Run more than one API process without relying on process-local
  shared state.

- Define API, worker, and database connection budgets.
- Move rate-limit state to a shared Redis-compatible store.
- Extract lifecycle sweeping from the API process.
- Use a distributed lease or a dedicated worker so scheduled work has one
  active owner at a time.
- Add readiness and liveness checks appropriate to API and worker processes.
- Test two API instances against the same database and shared session store.

**Exit criteria:**

- A request can be served by any API instance without behavior changes.
- Rate limits aggregate across instances.
- Lifecycle work runs once per interval without losing correctness if a worker
  restarts.
- Redis failure behavior is tested and documented.

### Phase 3 — Add only justified asynchronous workloads

**Goal:** Keep expensive or failure-prone work out of user request paths.

- Introduce BullMQ only for workloads identified in Phase 0 or Phase 1.
- Start with one worker process and one queue per clear workload boundary.
- Add retries, backoff, timeouts, controlled concurrency, and failure
  visibility.
- Make webhook, reconciliation, export, and notification operations
  duplicate-safe.
- Keep PostgreSQL authoritative and make job state reconstructable.

**Exit criteria:**

- Duplicate jobs do not duplicate business effects.
- Worker restarts do not lose or corrupt work.
- Queue depth, job age, processing time, and failures are observable.

### Phase 4 — Add real-time updates only where they earn their cost

**Goal:** Improve clearly time-sensitive flows without replacing ordinary HTTP.

- Select one measured use case, such as live election results or payment
  status.
- Define connection authentication, authorization, reconnect behavior, and
  event ordering.
- Use a shared pub/sub adapter before running multiple real-time instances.
- Keep HTTP endpoints as the authoritative read/recovery path.

**Exit criteria:**

- Clients recover correctly after disconnects and reconnects.
- Multiple instances deliver events consistently.
- WebSocket load and connection health are observable.

### Phase 5 — Production parity and failure testing

**Goal:** Validate the architecture under realistic failure and load.

- Run multi-instance API tests.
- Run concurrent vote, registration, inventory, and payment tests.
- Test database pressure and pool exhaustion behavior.
- Test Redis unavailability and reconnect behavior.
- Test queue retries, duplicate jobs, dead-letter handling, and worker restart.
- Test slow or failing payment-provider calls.
- Run browser regression tests for core user flows.
- Document capacity assumptions and operational runbooks.

## Definition of done

The scalability stage is complete when:

- Performance decisions are backed by representative measurements.
- Public and administrative collection endpoints are bounded.
- Concurrent business operations remain correct under load.
- The API can run across multiple instances without process-local shared
  state affecting correctness or security.
- Background work is isolated only where it provides a measured benefit.
- Redis and worker failure modes are explicit and tested when adopted.
- Observability can trace slow requests from the API through the database,
  queues, workers, and external services.
- Existing product behavior, security controls, UX, and PWA behavior remain
  intact.

## Explicit non-goals

This plan does not call for:

- introducing Redis solely because it is common in scalable systems
- adding BullMQ for ordinary lightweight CRUD
- replacing HTTP with WebSockets
- splitting the current API into microservices
- moving authoritative business records out of PostgreSQL
- optimizing against synthetic benchmarks without representative data
- changing product behavior or redesigning the existing Evenum experience