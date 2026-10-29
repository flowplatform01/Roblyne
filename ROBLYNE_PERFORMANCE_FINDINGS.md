# ROBLYNE Performance Findings

## Measurements in this checkout

- Frontend production build: 31.90 seconds on the local Windows workspace using Node 20.19.5; this is build time, not user navigation latency.
- Frontend output warns of one 505 kB minified chunk and several sourcemap-location warnings. These are optimization opportunities, not evidence of an in-browser incident.
- No browser runner or isolated runtime stack was available, so no cold/warm navigation, API timing, database latency, or main-thread measurements are reported.

## Actual cache, database, and worker map

- PostgreSQL is the authoritative source for organizations, elections, financial summaries, transactions, and settlements.
- TanStack Query uses a 30-second stale time, five-minute garbage-collection time, no refetch on window focus, and avoids retrying 4xx responses (`artifacts/roblyne/src/App.tsx`).
- Redis is used for rate-limit coordination, public discovery-cache entries, maintenance scheduling locks, and BullMQ queue infrastructure. It is not a general cache for Finance or election/vote authorization.
- Discover cache invalidation is invoked after election, event, campaign, and lifecycle writes. Financial data remains authoritative/fresh rather than being cached across organizations.
- BullMQ workers process lifecycle maintenance and payment recovery. Worker health/queue readiness is exposed through the existing job readiness logic.

## Changes made in this remediation

- Invite verification now avoids repeat protected-resource requests with a raw URL secret and reuses a short-lived server session capability.
- Upload operations now terminate within 45 seconds rather than presenting an unbounded spinner.
- Finance handles individual request failures locally, reducing global error-boundary activation during transient responses.

## Remaining constraints

Do not infer one-million-user capacity from this repository inspection. Perform controlled load tests against a disposable database and Redis instance; gather p50/p95 API timing, connection-pool saturation, queue lag, cache hit rates, and browser navigation traces before sizing production.
