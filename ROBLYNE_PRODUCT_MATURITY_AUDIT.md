# ROBLYNE Product Maturity Audit

## Scope and evidence

This audit reviewed the deployed architecture, client lifecycle behavior, service worker, query policy, payment pipeline, financial ledger, organization Finance, product analytics, administration, worker, Redis use, and Render configuration. It deliberately reuses the existing architecture instead of creating a second ledger or a new financial interface.

## Architecture map

- **Web client:** React, Wouter, TanStack Query, Vite PWA, route-level code splitting, and an authenticated dashboard shell.
- **PWA:** a standalone Web App Manifest and Workbox-generated service worker precache versioned build assets. Static assets are suitable for offline reuse.
- **API:** Express API with Zod contracts generated from `lib/api-spec/openapi.yaml`, PostgreSQL through Drizzle, session authentication, organization RBAC, and Platform Admin RBAC.
- **Background processing:** BullMQ workers process payment reconciliation, lifecycle maintenance, and FlowPay payouts. Redis provides queues, shared limits, and public discovery caching when configured.
- **Payments:** every paid event ticket, campaign contribution, and paid vote creates a durable payment intent and a linked financial ledger row before checkout. FlowPay webhooks are stored idempotently; direct session reconciliation is the fallback when webhook delivery is delayed or unavailable.
- **Finance:** `financial_transactions` is the central ledger. `settlement_allocations` reserves explicit portions of completed organization earnings for payouts. The organization Finance summary aggregates completed ledger rows by currency and pillar; Platform Admin separately aggregates gross collection and platform commission.

### Platform-admin commission controls

Platform commission withdrawals are now a separate financial boundary. `platform_payout_destinations`, `platform_withdrawals`, and `platform_withdrawal_allocations` never share organization payout recipients, settlements, or `org_earnings`. A withdrawal can reserve only the unallocated portion of completed `commission_amount` ledger rows in its requested currency. The FlowPay worker uses provider idempotency and completes the record only on provider-confirmed success; a failed payout releases its commission reservations for a later, explicit retry.

## Findings and corrections

### PWA and loading behavior

The service worker previously applied `NetworkFirst` caching to every `/api/` request. That included authenticated, financial, and access-controlled responses. Besides being unsafe on a shared device, a slow network-first request could delay response delivery after a background return. The service worker now precaches only static application assets; TanStack Query retains live-session API data in memory.

The client already disables focus refetching, but its 30-second stale window and five-minute garbage collection made ordinary back-navigation and resume behavior more likely to issue reloads. The default query window is now two minutes with a twenty-minute garbage-collection window. Reconnect refetch bursts are disabled. Cached data remains rendered while a future refetch occurs; financial mutations and server-side validation remain authoritative.

Sensitive API data is intentionally not persisted in IndexedDB or the service-worker cache. That is a security boundary, not a missing offline feature.

### Financial reconciliation

The central Finance implementation already aggregated all completed ledger pillars (`event`, `election`, and `campaign`). It does not include pending or failed intents in an available withdrawal balance, which is correct.

The inconsistency was in product analytics:

- Organization analytics summed `gross_amount`, so its displayed revenue could exceed the organization allocation.
- Event analytics multiplied ticket price by ticket count, which could report gross values and could not reconcile exactly with completed payment status.
- Campaign analytics used `campaign.current_amount`, which is a gross campaign-progress value rather than the organization allocation.

These existing presentations now source organization-facing earnings from completed `financial_transactions.org_earnings`. No commission rate, settlement behavior, Finance layout, or organization withdrawal workflow changed. A successful 100 FCFA collection with the configured five-percent allocation now reports 95 FCFA consistently in organization-facing earnings and central Finance, while Platform Admin continues to retain the corresponding commission accounting.

## What remains operational verification

Automated tests cannot prove a live mobile provider transfer or iOS installed-PWA suspension. Before declaring a financial rollout complete, run controlled FlowPay transactions for one paid election, one campaign, and one paid event where enabled. For each, verify the payment intent, webhook/reconciliation result, completed ledger row, product earnings, organization Finance, Platform Admin commission, and a withdrawal eligibility calculation. Test a failed transaction and a reversal/refund if FlowPay supports it in the target environment.

On a physical iPhone, test the installed PWA after switching to WhatsApp, locking/unlocking, an offline interval, and a deployment update. The expected behavior is that the shell and existing in-memory content remain visible while data refreshes, and no authenticated API response is read from the service-worker cache.

## Validation performed

- API contract regenerated from the OpenAPI specification.
- Workspace typecheck passed.
- Production web build passed.
- Production API build passed.

The local shell uses Node 18.17 and reports the expected engine warning; Render is configured to use Node 22.12.
