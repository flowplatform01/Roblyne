# ROBLYNE Production Readiness Audit

Audit date: 2026-10-28. This audit is evidence-based and does not claim hosted services were tested without credentials.

## Architecture found

- Vite SPA frontend: `artifacts/roblyne`, deployable as static files.
- Express API: `artifacts/api-server`, built to `dist/index.mjs`.
- BullMQ maintenance worker: `artifacts/api-server`, built to `dist/worker.mjs`.
- PostgreSQL/Drizzle migrations: `lib/db/drizzle`; two tracked migrations and Drizzle journal.
- Object storage is mandatory for a production API. Redis is optional until the dedicated worker is enabled.

## Deployment root causes

1. Render had been configured with `npm install --frozen-lockfile`, which does not install the pnpm workspace dependencies. The API build consequently could not resolve `esbuild`.
2. The lockfile had previously diverged from workspace configuration, causing pnpm frozen-lockfile failure. Commit `6a87825` aligned it.
3. `NODE_ENV=production` is configured for deployed services but build tools (`vite`, `esbuild`, `drizzle-kit`) are dev dependencies. Relying on pnpm's default production dependency behavior was unsafe and could omit required tools.
4. Earlier deployment documentation contradicted the intended topology by describing a frontend web service and a Render background worker, while the deployed configuration uses a static site and normal worker web service.

## Fixes implemented

- Pinned the repository package manager to `pnpm@9.15.9` in `package.json`.
- Changed each Render build command to `pnpm install --frozen-lockfile --prod=false` before its service build.
- Added `pnpm run verify:render:artifacts` to check all built API, worker, and static frontend outputs.
- Added `ROBLYNE_DEPLOYMENT_RUNBOOK.md` as the sole authoritative procedure and marked the conflicting former runbook as superseded.
- Kept the portable service split and existing automatic Redis behavior: no Redis means in-process fallback; production Redis means worker-backed readiness.

## Reliability and security observations

- API startup rejects missing database, production session secret, and production S3 configuration.
- Cross-origin credentialed browser access uses explicit CORS origins and `Secure`, `SameSite=None` production cookies.
- API readiness checks PostgreSQL and, when Redis is configured, Redis plus worker heartbeat.
- Tracked schema migrations are rerunnable through Drizzle. API migration-on-start is appropriate only for one API instance; horizontal scaling needs a controlled one-time migration release.
- Database, Redis, S3, FlowPay, real browser sessions, and hosted Render settings were not available for this audit and are not claimed verified.
