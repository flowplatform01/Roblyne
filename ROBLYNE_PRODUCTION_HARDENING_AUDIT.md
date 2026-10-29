# ROBLYNE Production Hardening Audit

Audit date: 2026-10-29

## Scope and method

This audit reviewed the checked-in application at commit `1fe7381` and the hardening change in this working tree. It traced source-level user journeys through the React frontend, Express API, Drizzle schema/migrations, background worker, payment state machine, storage presigning, and Render configuration. It used non-destructive unit/regression tests and TypeScript checks. It did **not** access production data, initiate payments, change provider configuration, or run write-capable scripts against the configured database.

## System inventory

| Area | Implementation |
| --- | --- |
| Public frontend | `artifacts/roblyne`: React/Vite SPA and PWA, deployed as a Render Static Site |
| API | `artifacts/api-server`: Express 5 API with PostgreSQL-backed sessions |
| Worker | `artifacts/api-server/src/worker.ts`: BullMQ lifecycle and payment-recovery workers when Redis is configured |
| Database | PostgreSQL via Drizzle; schemas in `lib/db/src/schema`, reviewed migrations in `lib/db/drizzle` |
| Storage | S3-compatible presigned browser PUTs; Cloudflare R2 is documented as the selected provider |
| Payments | FlowPay initialization, signed webhooks, provider status reconciliation, durable payment intents and financial ledger |
| Deployment | `render.yaml`: separate static frontend, API web service, and worker web service |

## Roles and enforced boundaries

- **Anonymous participant:** can read public resources and submit supported public registration, voting, or campaign flows.
- **Invitee:** can read only the matching non-draft invite-only election or event with its valid code; a code never authorizes a private resource or management access.
- **Organization member:** `member` permissions for limited operational actions such as event check-in.
- **Organization administrator/owner:** creates and manages their own organization resources, members, financial workspace, elections, events, campaigns, and allowlists.
- **Platform administrator:** server-side database flag checked by `requirePlatformAdmin` for platform and settlement operations.

Authorization is enforced by session middleware plus organization-resource lookup, not by frontend state alone. Election duplicate voting is additionally protected by the database unique index on `(election_id, voter_identifier)`.

## Critical workflow maps

### Paid participation

Participant form -> API validation and lifecycle/visibility checks -> database transaction creates a pending financial transaction plus payment intent -> FlowPay checkout initialization -> signed FlowPay webhook or authenticated status reconciliation -> transaction locks payment intent -> creates ticket, campaign response, or vote -> marks ledger and intent succeeded -> browser polls the status-token endpoint for confirmation.

Webhook events are deduplicated by event ID. Payment intents have unique external references and idempotency keys. Event inventory and election voting admission acquire database locks before creating payment intents.

### Election voting

Ballot -> server validates visibility, schedule, invite code/allowlist, positions, candidates, and selection limits -> election row lock -> duplicate-vote recheck -> immediate ballot insert or durable paid intent -> payment finalization creates exactly one vote and selections in the same database transaction.

### Event registration

Registration -> server validates visibility, invitation, event/ticket sale windows, capacity and paid-phone requirements -> locks event and ticket tier -> reserves inventory -> immediate ticket insert or durable paid intent -> payment finalization creates the ticket.

### Organization settlements

Owner/admin withdrawal request -> server locks completed ledger rows -> computes remaining allocations in cents -> creates explicit settlement allocations -> platform administrator advances only forward through `pending_settlement -> ready -> released -> completed` -> completed allocation updates settlement status without reusing already allocated funds.

## Tests and evidence executed

| Category | Result | Evidence |
| --- | --- | --- |
| API unit/regression suite | PASS, 31 tests | Node test run on 2026-10-29 |
| Frontend TypeScript | PASS | `tsc -p artifacts/roblyne/tsconfig.json --noEmit` |
| API TypeScript | PASS | `tsc -p artifacts/api-server/tsconfig.json --noEmit` |
| API and worker production builds | PASS | `node artifacts/api-server/build.mjs` and `--worker` on local Node 22 executable |
| Frontend/PWA production build | PASS | Vite build on Node `20.19.5`; service worker generated |
| Browser E2E | NOT RUN | No Playwright/browser runner is configured and no isolated local stack was started |
| R2 direct upload | NOT RUN | Requires provider bucket CORS and a browser session |
| FlowPay sandbox lifecycle | NOT RUN | Sandbox credentials/provider callbacks were not used |
| Write-concurrency harness | NOT RUN | It creates/deletes database fixtures; configured database was not assumed disposable |

## Findings

### P1 fixed — invite-only events were not usable by invitees

**Evidence:** Event registration accepted a valid invite code, but event and ticket-type reads returned `404` to every non-member. The copied registration link omitted the required code, and the registration page rendered `null` when its data query failed.

**Root cause:** Event read authorization only recognized organization membership; the invitation flow was implemented solely on the registration POST.

**Fix:** Valid codes now grant read access only to their matching non-draft invite-only event. Organizer copy/share links include the code, the registration request submits it, and invalid/missing access displays a neutral recovery screen rather than a blank page. Private events and drafts remain protected.

**Regression evidence:** `event-access.test.mjs` verifies matching-code access, draft rejection, private-resource protection, and organization access.

### P2 verified safeguard — payment and settlement state handling

No confirmed implementation defect was found in the reviewed payment idempotency or settlement-allocation paths. The audit verified durable payment intents, event-ID webhook deduplication, row locks on settlement/vote/capacity paths, and forward-only settlement state transitions. This is source and unit-test evidence only; it does not verify the external FlowPay contract or a real payout provider.

### P2 operational verification gap — external integration and browser journeys

The repository contains controlled concurrency and performance harnesses, but they require a disposable database and running API. No safe isolated environment was available in this audit. FlowPay sandbox, R2 browser CORS, Redis worker behavior, and real-browser/mobile interactions remain unverified externally.

## Remaining risks

- Do not treat a provider checkout opening as payment completion; FlowPay sandbox webhook and reconciliation tests are required before paid organizational onboarding.
- R2 requires the documented exact-origin CORS policy for direct browser PUTs; provider-side verification remains required.
- A shared custom domain for frontend and API is still required for reliable browser session behavior before broad onboarding.
- The write-capable concurrency harness should be run only against a fresh disposable database and synthetic records.
- No browser E2E framework is currently configured; add a minimal controlled suite before claiming broad UI journey coverage.
