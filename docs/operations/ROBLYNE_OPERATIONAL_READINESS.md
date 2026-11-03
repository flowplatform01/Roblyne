# ROBLYNE Operational Readiness

## Scope and evidence

This document records the current release gate after the final implementation audit. It is not a substitute for production smoke testing after deployment.

### Implemented reliability controls

- Organization withdrawals reserve ledger allocations in one database transaction, use a stable FlowPay idempotency key, and require a live worker before creation.
- If queue dispatch fails after the database transaction, the settlement remains recoverable (`dispatch_failed`) and the worker claims and re-enqueues stale FlowPay settlements without duplicate recovery jobs.
- A FlowPay timeout remains `processing` and is polled; a provider-confirmed failure marks the settlement failed and releases its allocations. The organization finance UI now shows the failure reason.
- The worker performs startup and one-minute stale-payout recovery. It never processes an already completed or failed settlement.
- A first-time `401 Not authenticated` response is treated as the normal anonymous state, not as a failed session restoration.
- Browser uploads are prepared client-side, capped at 2 MB for storage, uploaded directly to object storage through short-lived PUT URLs, and retain a visible retry state on failure.

### Legal-document controls

- `legal_documents` stores draft, published, and archived Terms and Privacy versions. Published documents are immutable; a new draft creates a new version.
- `legal_acceptances` preserves user, document, version, and timestamp. Material versions can require re-acceptance; non-material versions do not force already-accepted users again.
- Public `/legal/terms` and `/legal/privacy` pages show only current published documents.
- New password and social-account creation are blocked until both reviewed documents are published. Existing authenticated users are gated only when a required acceptance is outstanding.

## Release blockers and owner actions

1. Apply database migrations `0005_social_identities.sql` and `0006_legal_documents.sql` through the API service’s normal migration command.
2. As a platform administrator, create and publish reviewed Terms of Service and Privacy Policy in **Admin → Legal**. Do not publish placeholder or AI-generated legal claims without owner/legal review.
3. Configure `DISCORD_OAUTH_CLIENT_ID` and `DISCORD_OAUTH_CLIENT_SECRET` in the API environment. The local audit found them absent locally; the application deliberately hides Discord until both are present.
4. Verify the worker has the same `DATABASE_URL`, `REDIS_URL`, and FlowPay variables as the API. The API’s readiness endpoint should report a fresh worker heartbeat before any withdrawal is accepted.
5. Reconcile the historical 200 FCFA settlement after deploy: confirm it has no FlowPay payout ID, let the worker’s stale-recovery sweep process it, then verify either provider completion or an explicit failed/released record. Do not manually mark it complete.

## Configuration findings

- Local configuration contains the required API, database, Redis, FlowPay, S3, Brevo, Google, Microsoft, and LinkedIn variable names.
- `VITE_API_URL` is intentionally a frontend-build/deployment variable and is absent from the local API `.env`.
- `FLOWPAY_CLIENT_SECRET` is present locally but is not consumed by the current FlowPay integration; retain only the documented FlowPay variables in production.
- The audit cannot inspect the secret values in Render/Cloudflare or confirm provider-console callback registrations. Those remain owner-side verification steps.

## Verification performed

- TypeScript project build for database, API, and web packages passes after the changes.
- The full Playwright suite passes: 19 browser tests cover expected anonymous `401` handling, suspended session fallback, withdrawal failure messaging, successful payout submission, recoverable `202` queue dispatch, private invite flows, sharing, and upload retry state.
- The API suite passes: 35 tests cover access control, invite protections, origin policy, session-cookie settings, readiness, phone normalization, and settlement allocation.
- The historical production settlement could not be read locally because the local database endpoint was unavailable; no production record has been altered by this work.

## Post-deploy smoke test

1. Check `GET /api/readyz` returns `ready` with database, Redis, and worker healthy.
2. Open a fresh private browser window, use **Get Started**, and confirm registration has no session-restoration warning.
3. Register only after the published Terms and Privacy checkboxes appear; verify the public links and admin acceptance history.
4. Complete one controlled FlowPay payout with a verified recipient and confirm queued → provider status → completed (or explicit failed/released) in finance.
5. Test each enabled social provider, including cancel, new account, existing social account, and password-account linking refusal.
