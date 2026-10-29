# ROBLYNE Critical UX Remediation

## Scope and evidence

This remediation inspected the deployed-code paths for private election access, Finance, uploads, navigation, caching, and multi-organization authorization. It does not claim live-production or provider verification.

## Private election verification loop — fixed

- **Reproduction at source:** a shared `?invite=` link was only forwarded to read requests and stored in component state. The vote endpoint independently required the raw code again. There was no durable server authorization after a successful read.
- **Root cause:** code matching was stateless and the inline voter-verification input was always shown for invite-only elections. The previous modal described in the report is not present in the current source; the remaining inline control represented the same underlying raw-code requirement.
- **Fix:** `POST /api/elections/:electionId/invite-verification` validates an invite code and stores only a timestamp keyed by election ID in the existing PostgreSQL-backed session. Verification is browser-session scoped, expires after four hours, is removed on login session regeneration/logout, and never stores the invite secret. Reads and vote submission accept this server-side verification; direct votes without a valid session verification or a matching legacy code remain rejected.
- **UX:** shared links verify before protected data loads, clear `invite` from the address bar on success, and no longer show the inline code input after server confirmation. A refresh in the same browser session retains authorization; a new browser context must verify independently.
- **Files:** `artifacts/api-server/src/routes/elections.ts`, `artifacts/api-server/src/lib/election-invite-verification.ts`, and `artifacts/roblyne/src/pages/ElectionVote.tsx`.

## Finance reliability — mitigated at the presentation boundary

- **Investigation:** Finance performs independent summary, transaction, and settlement queries. Empty states were already represented, but failures had no local recovery. Historical/malformed transaction fields could also throw during `replace` or date formatting and reach the global error boundary.
- **Fix:** a failed authoritative summary now shows a local retry state rather than fabricated balances. Transaction and settlement failures have independent retry states; malformed dates and optional historical fields render safely.
- **Limit:** no safe isolated production-like financial database was available here, so the reported production crash cannot be claimed reproduced or eliminated against live data. Server-side org-role checks remain the financial authorization boundary.

## Uploads that can stall — fixed bounded client behavior

- **Root cause:** the client had no timeout on either presign or direct S3-compatible PUT request, so a stalled request could keep the upload state active indefinitely.
- **Fix:** both stages use a 45-second deadline. Timeout clears busy state, preserves normal retry behavior, and gives a recovery message. The backend still validates image type/size and only returns a pre-signed URL; application records are not created by the upload endpoint.
- **Limit:** R2/S3 CORS, credentials, and actual object retrieval require controlled provider verification after deployment.

## Route and organization isolation

- Numeric IDs are identifiers, not authorization. The audited API applies organization access middleware to 42 route handlers, and election/event public read paths apply explicit visibility rules. No identifier-only authorization bypass was confirmed by source review.
- Cross-organization runtime attempts require two isolated test accounts and are recorded as an outstanding browser/integration verification item.

## Browser limitation

No `playwright` package or `playwright.config.*` exists in this checkout. No browser test was claimed or simulated. A dedicated isolated test database, test accounts, and Playwright setup are required before treating the reported live journeys as browser-verified.
