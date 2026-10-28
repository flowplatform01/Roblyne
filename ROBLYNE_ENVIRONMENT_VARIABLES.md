# ROBLYNE environment variables

Placeholders only — never commit secrets. Copy from `.env.example` for local work.

## Frontend (`@workspace/evenum`)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes (per process) | Listen port (e.g. `5173` dev, `22244` prod). |
| `BASE_PATH` | Yes | URL prefix; use `/` at domain root. |
| `NODE_ENV` | Runtime | `development` or `production`. |
| `LOCAL_API_ORIGIN` | Dev only | Vite proxy target for `/api` (default `http://127.0.0.1:8080`). |
| `API_BASE_URL` | Optional prod | Public API base including `/api` for OG/link previews when hosts differ. Example: `https://app.example.com/api`. |

**Must not** expose to browser bundles: `DATABASE_URL`, `SESSION_SECRET`, Redis URL, FlowPay secret keys, S3 secret keys.

## API (`@workspace/api-server`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string. |
| `SESSION_SECRET` | Yes in production | Session cookie signing secret. |
| `PORT` | Yes | API listen port (default `8080`). |
| `NODE_ENV` | Yes | `production` enables strict checks (session secret, S3). |
| `PLATFORM_ADMIN_BOOTSTRAP_SECRET` | One-time setup | ≥32 bytes; remove after first platform admin. |
| `CORS_ALLOWED_ORIGINS` | Optional | Comma-separated origins if cross-origin API access is required. |
| `LOG_LEVEL` | Optional | Pino log level. |

### PostgreSQL pool (per API process)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_POOL_MAX` | `5` | Max pool connections. |
| `DATABASE_POOL_IDLE_TIMEOUT_MS` | `30000` | Idle connection release. |
| `DATABASE_POOL_CONNECTION_TIMEOUT_MS` | `8000` | Wait for connection from pool. |

### Redis / queue

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | unset | Redis connection URL for cache, rate limits, BullMQ. |
| `REDIS_REQUIRED` | `false` | If `true`, `/api/readyz` fails when Redis is configured but down. |
| `QUEUE_REQUIRED` | `false` | If `true`, readiness requires healthy maintenance worker heartbeat. |
| `DISABLE_LIFECYCLE_FALLBACK` | `false` | If `true`, API never runs in-process lifecycle sweeps. |
| `INSTANCE_ID` | Optional | Stable id for BullMQ scheduler lock across API restarts. |

### Object storage (production API)

| Variable | Required in prod | Description |
|----------|------------------|-------------|
| `S3_ENDPOINT` | Yes | S3-compatible endpoint. |
| `S3_REGION` | Optional | Default `auto`. |
| `S3_BUCKET` | Yes | Bucket name. |
| `S3_ACCESS_KEY_ID` | Yes | Access key. |
| `S3_SECRET_ACCESS_KEY` | Yes | Secret key. |
| `S3_PUBLIC_BASE_URL` | Yes | Public base URL for object links. |
| `S3_FORCE_PATH_STYLE` | Optional | `true` for path-style providers. |

### FlowPay

| Variable | Description |
|----------|-------------|
| `EVENUM_PAYMENT_MODE` | `simulation` (local default) or `flowpay`. |
| `FLOWPAY_ENVIRONMENT` | `sandbox` or production mapping. |
| `FLOWPAY_<ENV>_API_BASE_URL` | API base for sandbox/production. |
| `FLOWPAY_<ENV>_CLIENT_ID` | Client id. |
| `FLOWPAY_<ENV>_PUBLIC_KEY` | Public key. |
| `FLOWPAY_<ENV>_SECRET_KEY` | Secret key. |
| `FLOWPAY_<ENV>_WEBHOOK_SECRET` | Webhook HMAC secret. |
| `FLOWPAY_<ENV>_PROVIDER` | Optional provider override. |
| `FLOWPAY_TIMEOUT_MS` | Outbound timeout (default 15000, max 60000). |

Legacy unprefixed `FLOWPAY_*` names remain as fallbacks (see `SETUP.md`).

## Worker (`dist/worker.mjs`)

| Variable | Required | Description |
|----------|----------|-------------|
| `REDIS_URL` | Yes | BullMQ + heartbeat. |
| `DATABASE_URL` | Yes | Lifecycle sweep writes. |
| `WORKER_HEALTH_PORT` | Optional | Health HTTP port (default `8091`). |
| `NODE_ENV` | Recommended | Set `production` in deployed environments. |
| `LOG_LEVEL` | Optional | Same as API. |

Worker does **not** need `SESSION_SECRET` or S3 credentials unless future jobs require them.

## Harness / tooling only

Not for production services:

- `PERF_*`, `CONCURRENCY_*`, `INTEGRITY_*`, `ROBYNE_SEED_*` — see `SETUP.md`.

## Replit-injected (optional)

- `REPL_ID`, `REPLIT_DEPLOYMENT` — platform metadata; not required locally.
