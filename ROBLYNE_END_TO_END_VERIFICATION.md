# ROBLYNE End-to-End Verification Matrix

Audit date: 2026-10-29. `PASS` means the stated automated/source-level evidence passed, not a live-provider or production assertion.

| Workflow | Role | Environment | Scenario | Expected outcome | Actual outcome | Status | Evidence / limitation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Account registration | New user | Source + API typecheck | Account/session/workspace path reviewed | Session established and a primary workspace is created atomically | Implemented in one DB transaction | PASS (source) | `routes/auth.ts`; needs isolated DB/browser run |
| Login/session | Existing user | Unit/source | Cookie and origin policy reviewed | Secure production cookie and exact CORS origin checks | Existing tests pass in prior suite | PASS (unit) | `session-cookie.test.mjs`, `origin-policy.test.mjs` |
| Organization isolation | Owner/member | Source | Change resource or `orgId` directly | Server requires role on body/resource organization | All management mutations use org role middleware | PASS (source) | Requires API integration test with two users |
| Public election | Anonymous voter | Source + unit | Read and vote public active election | Valid ballot only; one vote per voter | DB unique vote constraint and locked admission path | PASS (source) | Controlled DB concurrency harness not run |
| Invite-only election | Invitee | Unit/source | Open matching code link; invalid/private/draft variants | Matching code shows ballot only; no private/draft leak | Access helper tests pass | PASS (unit) | Browser journey not run |
| Invite-only event | Invitee | Unit/typecheck | Open organizer share link and ticket list | Matching code loads registration; invalid code stays neutral | Confirmed defect fixed; helper test passes | PASS (regression) | Browser journey not run |
| Event capacity | Participant | Source + lifecycle tests | Parallel registrations | Capacity cannot oversell | Event/tier locks and reservations present | PASS (source) | `concurrency-integrity.mjs` not run against disposable DB |
| Campaign submission | Participant | Source | Public/active/submission-window validation | Valid response only; paid response waits for confirmation | Validated before intent creation | PASS (source) | Provider sandbox not run |
| Payment completion | Participant | Source | Webhook duplicate/out-of-order and status polling | Intent and ledger finalized idempotently | Durable event IDs and intent locks present | PASS (source) | FlowPay sandbox and real callback not run |
| Settlement request | Org owner/admin | Unit/source | Partial/concurrent allocation | No double allocation; only available earnings claimed | Allocation tests pass | PASS (unit) | Requires disposable DB integration run |
| Settlement release | Platform admin | Source | Skip/backward lifecycle state | Rejected | Forward-only transition map present | PASS (source) | Requires API integration test |
| R2 image upload | Authenticated user | Provider/browser | JPEG, PNG, GIF, CORS failure | Presign + direct PUT; clear recoverable error | Code and runbook ready | BLOCKED | Requires real bucket CORS + browser |
| Redis worker | Operator | Controlled deploy | Worker heartbeat and payment recovery | API readiness reflects worker health | Code reviewed | BLOCKED | Requires Redis + worker runtime |
| Mobile/browser UX | All public/auth users | Browser | Desktop and mobile navigation/forms/errors | No blank/dead-end states | Event/election blank fallbacks reviewed/fixed | NOT TESTED | No browser test runner or safe running stack used |

## Required controlled verification before broad onboarding

1. Provision a disposable database and run `scripts/concurrency-integrity.mjs` with its explicit write opt-in.
2. Use FlowPay sandbox to test success, failure, pending, duplicate webhook, and reconciliation recovery without real money.
3. Use a real browser against a staging deployment to test registration, login, public/private/invite election and event journeys, image upload formats, and iPhone-sized viewport behavior.
4. Run the API, worker, and Redis together; verify `/api/readyz`, worker `/healthz`, queue heartbeat, and a non-destructive recovery job.
