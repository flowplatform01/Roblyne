# ROBLYNE Fresh Deployment Verification

| Area | Result | Evidence / remaining action |
| --- | --- | --- |
| Schema migration mechanism | PARTIAL | Drizzle migrations `0000_normal_ares.sql` and `0001_complete-current-schema.sql` are committed and `pnpm run migrate` is configured as the API Render pre-deploy command. It was not executed here against an isolated database. |
| Essential initialization | PASS (code review) | No required system records are assumed at startup. Platform settings have safe defaults and are created on authorized administration; commission defaults use conflict-safe insertion only when the finance configuration route is used. |
| Demo data exclusion | PASS (code review) | Demo scripts are explicit `scripts` package commands and are absent from Render build/start/pre-deploy commands. |
| First administrator | PASS (code review) | Authenticated bootstrap requires a 32+ byte operator secret, takes a PostgreSQL advisory transaction lock, and rejects a second administrator. |
| API/worker separation | PASS (code review) | API starts `dist/index.mjs`; worker separately starts `dist/worker.mjs` and consumes `evenum-maintenance`. The current starter deployment leaves Redis unset and safely uses the API lifecycle fallback until the worker is funded. |
| Redis initialization | PASS (code review) | API registers the repeatable queue schedule; worker creates a heartbeat. No manual keys are needed. |
| Fresh database end-to-end test | NOT TESTED | No disposable PostgreSQL/Redis service was available in this environment. Run the first-deployment sequence against isolated Iven test services. |
| Second deployment test | NOT TESTED | Requires the preceding isolated test environment; rerun the same migration/deploy sequence and verify no duplicate migration or records. |
| Typecheck, API/worker build, API tests | PASS | `pnpm run typecheck` passed across all workspace packages; API and worker production bundles built; 27 API tests passed. These ran on local Node 18.17.0 with an engine warning; Render must use Node 20.19+ (`.node-version` pins 22.12.0). |
| Static frontend production build | PASS | `pnpm run build:render:web` completed successfully with a production-style `VITE_API_URL`. Vite produced the static PWA assets. It reports non-blocking source-map warnings and chunks above 500 kB. |

## Required verification procedure

1. Provision disposable empty PostgreSQL and Redis services, not the production database.
2. Configure the exact Render variables documented in `.env.example` and the deployment runbook.
3. Deploy API, confirm migration log; deploy worker, confirm heartbeat; deploy web, confirm proxied `/api/healthz` and `/api/readyz`.
4. Register a test account, bootstrap it once as administrator, create an organization and representative event/election/campaign, and observe a lifecycle job in worker logs.
5. Redeploy all services without running any seed command. Confirm data, login, admin status, and job scheduling remain intact.
