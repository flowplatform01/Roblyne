# ROBLYNE Regression Verification

## Environment

- Repository: local workspace at the remediation revision.
- Runtime used for validation: Node 20.19.5.
- No production data, live payment, or live browser account was used. A disposable local account performed a real configured-storage write.

## Completed automated checks

- Focused election/event access tests: 7 passing assertions, including election verification expiry and election scoping.
- Root, API, and frontend TypeScript checks: passed.
- API and worker production builds: passed.
- Frontend Vite/PWA production build: passed.
- Render artifact verifier: API, worker, and static frontend artifacts all present.
- `git diff --check`: passed during final artifact validation.
- Playwright/Chromium: focused production-reality coverage passes seven scenarios: public home remains visible during a stalled auth lookup; bounded discovery and Finance deep-link request behavior; organization image save/reload; upload failure/retry; withdrawal rejection; and one withdrawal request success state. Existing private-election and Finance recovery scenarios also remain covered.
- API tests: 33 passing assertions across access controls, lifecycle windows, CORS, queue readiness, session behavior, phone normalization, and settlement allocation.
- R2 upload integration: passed against the configured provider using a disposable local user and harmless 1×1 PNG. Local registration, `/api/uploads/presign`, signed PUT, and public object retrieval each returned HTTP 200; retrieved content type was `image/png`.

## Critical behavior covered by source/unit tests

- Production storage preflight: the configured R2 bucket returned HTTP 403 to a signed `OPTIONS` request from `https://roblyne.onrender.com`. Browser CORS remains a launch blocker until the documented bucket policy is applied and retested.

- Invite authorization cannot authorize another election and expires after four hours.
- A session verification contains timestamps only, not raw codes.
- Invite-only, private, draft, public, event registration lifecycle, session cookie, origin policy, queue readiness, and settlement allocation tests remain covered by the API suite.

## Not verified in this environment

- Dashboard, refresh, new-browser-context, duplicate-vote, and cross-organization journeys against an isolated running API/database.
- Finance responses from empty, historical, and active financial datasets.
- Authenticated production browser upload/settings replacement, reported election route, R2/S3 expiration, and production network interruption behavior.
- FlowPay sandbox collection/withdrawal outcomes and Redis/BullMQ worker execution.

These gaps are release verification requirements, not passing results.
