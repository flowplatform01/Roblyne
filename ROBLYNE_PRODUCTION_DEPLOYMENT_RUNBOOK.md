# ROBLYNE production deployment runbook

## Pre-deploy checklist

1. PostgreSQL provisioned; `DATABASE_URL` set for API and worker.
2. `SESSION_SECRET` set to a strong random value (not `evenum-dev-secret`).
3. S3-compatible storage configured for production API (API **exits** if missing when `NODE_ENV=production`).
4. FlowPay production credentials + webhook URL `https://<host>/api/payments/webhooks/flowpay`.
5. For multi-instance API: **Redis** recommended (`REDIS_URL`) for shared rate limits and discover cache.
6. For scheduled lifecycle transitions in production: **Redis + worker**; set `QUEUE_REQUIRED=true` if readiness should fail without worker.

## Build (once per release)

From repository root:

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run build:worker
```

Frontend build requires `BASE_PATH=/` (or your subpath) and `PORT` for the build script context where applicable.

## Database migrations

**Before** switching traffic to a new API version:

```sh
pnpm --filter @workspace/db run migrate
```

Run migrations from **one** job only (not from every worker replica). Workers do not run migrations.

## Start services (three processes)

### 1. API

```sh
export NODE_ENV=production
export PORT=8080
# DATABASE_URL, SESSION_SECRET, S3_*, FlowPay_*, REDIS_URL, etc.
node --enable-source-maps artifacts/api-server/dist/index.mjs
```

Readiness: `GET /api/readyz`  
Liveness: `GET /api/healthz`

### 2. Frontend

```sh
export NODE_ENV=production
export PORT=22244
export BASE_PATH=/
# Optional when API is on another host:
# export API_BASE_URL=https://your-domain.example/api
node artifacts/evenum/server.mjs
```

### 3. Worker

```sh
export NODE_ENV=production
export REDIS_URL=redis://...
export DATABASE_URL=...
export WORKER_HEALTH_PORT=8091
node --enable-source-maps artifacts/api-server/dist/worker.mjs
```

Health: `GET http://<worker-host>:8091/healthz`

## Reverse proxy routing

- Route `/api/*` → API service (port 8080).
- Route all other paths → frontend (port 22244).
- Trust one proxy hop (`app.set("trust proxy", 1)`); terminate TLS at the edge.
- Set `secure` session cookies in production (`NODE_ENV=production`).

## Environment flags (production recommendations)

| Flag | Single instance | Multi-instance API |
|------|-----------------|---------------------|
| `REDIS_URL` | Optional | **Strongly recommended** |
| `REDIS_REQUIRED` | `false` unless you require Redis for readiness | Consider `true` when Redis is mandatory |
| `QUEUE_REQUIRED` | `false` unless worker is required | `true` when lifecycle sweeps must not lag |
| `DISABLE_LIFECYCLE_FALLBACK` | Rarely needed | `true` if any API still runs fallback (normally auto-disabled when `NODE_ENV=production` + `REDIS_URL`) |

## Connection budget

Approximate PostgreSQL connections:

```
(api_replicas + worker_replicas) × DATABASE_POOL_MAX + overhead
```

Default `DATABASE_POOL_MAX=5`. Lower per-process max before raising replica count.

## Scaling

- **API:** horizontal replicas behind load balancer; sticky sessions **not** required (PostgreSQL sessions).
- **Worker:** scale to 1+ consumers on the same queue; maintenance jobs use BullMQ locking (`concurrency: 1`, limiter) — only one sweep runs at a time.
- **Frontend:** static assets; scale CDN/origin replicas independently.

## Graceful shutdown

- API: SIGTERM/SIGINT → stop HTTP server, close BullMQ queue client, quit Redis.
- Worker: SIGTERM/SIGINT → stop health server, close BullMQ worker, quit Redis.

Allow 30–60s drain time in orchestrators.

## Failure modes

| Failure | User-visible behaviour |
|---------|------------------------|
| PostgreSQL down | `/api/readyz` 503; requests fail |
| Redis down, not required | Rate limits local per API; discover hits DB; queue unhealthy if configured |
| Redis down, `REDIS_REQUIRED=true` | Readiness 503 |
| Worker down, `QUEUE_REQUIRED=false` | API serves traffic; lifecycle DB transitions may delay until worker returns |
| Worker down, `QUEUE_REQUIRED=true` | Readiness 503 |
| FlowPay outage | Checkout failures; webhooks may retry at provider |
| S3 misconfiguration | Production API refuses start; uploads fail |

## Rollback

1. Route traffic to previous API + frontend build.
2. Roll back worker only if queue/job schema changed (currently single job type — usually safe).
3. **Do not** roll back migrations without a DBA plan; forward-fix preferred.

## Logs

- API/worker use **pino**; request logs redact query strings in URL field.
- Identify service via process command (`index.mjs` vs `worker.mjs`) and log fields `jobId`, `name` on worker.

## Local verification (developer)

See `SETUP.md`. Minimal smoke:

```sh
curl -s http://127.0.0.1:8080/api/healthz
curl -s http://127.0.0.1:8080/api/readyz
curl -s http://127.0.0.1:8091/healthz   # with worker running
```

## Replit notes

- Nix module includes `redis` package; still configure `REDIS_URL` for a reachable instance.
- Deploy artifacts: web (`artifacts/roblyne/.replit-artifact/artifact.toml`), API (`artifacts/api-server/.replit-artifact/artifact.toml`), worker template (`artifacts/api-server/.replit-artifact/worker-artifact.toml`).

## Post-deploy smoke

```sh
pnpm run verify:stack
```

Optional env: `VERIFY_API_ORIGIN`, `VERIFY_WORKER_ORIGIN` (worker check is optional if not deployed).
