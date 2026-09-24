# Evenum

Evenum is a bilingual participation platform for organizations to run elections, events, ticketing, and campaigns.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Optional env: `REDIS_URL` — enables shared rate limiting, discovery caching, and the maintenance queue
- Optional env: `REDIS_REQUIRED=true` — makes readiness fail when Redis is unavailable
- `pnpm --filter @workspace/api-server run build:worker && pnpm --filter @workspace/api-server run start:worker` — run the independent maintenance worker when Redis is configured

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/evenum` — Vite/React frontend and bilingual UI
- `artifacts/api-server` — Express API, health checks, structured request logs, optional Redis infrastructure, and worker entrypoint
- `lib/api-spec/openapi.yaml` — API contract source of truth
- `lib/db/src/schema` — PostgreSQL schema source of truth
- `artifacts/api-server/src/lib/metrics.ts` — bounded per-instance HTTP metrics exposed at `/api/metrics`

## Architecture decisions

- PostgreSQL remains authoritative for sessions, participation, payments, and lifecycle state.
- Redis is optional and replaceable: it improves cross-instance rate limiting, short-lived public discovery caching, and maintenance scheduling without becoming a source of truth.
- Lifecycle transitions have a database-safe in-process fallback when Redis is not configured or unavailable.
- Long-running maintenance is available as a BullMQ worker process rather than being tied to the web request process.
- Readiness checks the database and reports Redis degradation without taking the app offline unless `REDIS_REQUIRED=true`.

## Product

Organizations can create and manage elections, events, ticketing, and contribution campaigns. Participants discover public activities, vote, register, submit responses, and track payment status. Organization and platform administrators get operational, analytics, financial, and settlement views.

## User preferences

The existing product behavior and UX should be preserved while improving reliability, performance, and operational readiness.

## Gotchas

- Use the routed preview path (`/api`) for API checks; services are not exposed directly through their local ports.
- Do not use Drizzle push blindly: the session table is owned by `connect-pg-simple` and is not represented in the application schema.
- Redis and worker processes are configuration-driven; local development remains functional without Redis.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
