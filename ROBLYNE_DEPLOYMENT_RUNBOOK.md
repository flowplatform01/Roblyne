# ROBLYNE Deployment Runbook

This is the authoritative production procedure. ROBLYNE is host-portable; Render-specific fields below describe only the initial target platform.

## Architecture

- `roblyne-web`: Render Static Site. Vite produces static files and receives only `VITE_API_URL` at build time.
- `roblyne-api`: Render Node Web Service. It owns HTTP, sessions, PostgreSQL access, S3 uploads, and migrations.
- `roblyne-worker`: Render Node Web Service, created only after Redis is provisioned. It owns BullMQ maintenance jobs.
- External services: PostgreSQL, S3-compatible object storage, and Redis when the worker is enabled. FlowPay is optional.

## Before creating services

1. Push the commit containing `render.yaml` and confirm the Render deploy log checks out that commit.
2. Provision an empty PostgreSQL database and S3-compatible bucket. Do not use development data or a development database.
3. Generate a random `SESSION_SECRET` and a separate high-entropy `PLATFORM_ADMIN_BOOTSTRAP_SECRET`.
4. Do not configure Redis or create the worker until Redis is available.

## API service

Create a Node **Web Service** at the repository root.

| Field | Value |
| --- | --- |
| Build command | `pnpm install --frozen-lockfile --prod=false && pnpm run build:render:api` |
| Start command | `pnpm run migrate && node --enable-source-maps artifacts/api-server/dist/index.mjs` |
| Health check | `/api/readyz` |
| Node version | `22.12.0` |

Set: `NODE_ENV=production`, `DATABASE_URL`, `SESSION_SECRET`, `PLATFORM_ADMIN_BOOTSTRAP_SECRET`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_PUBLIC_BASE_URL`. Add `S3_REGION` and `S3_FORCE_PATH_STYLE=true` only when required by the storage provider.

Leave `CORS_ALLOWED_ORIGINS` unset until the static site URL exists. Keep this API service at one instance while its start command performs migrations; move migrations to a controlled single release task before scaling API replicas.

## Static frontend

Create a **Static Site** at the repository root.

| Field | Value |
| --- | --- |
| Build command | `pnpm install --frozen-lockfile --prod=false && pnpm run build:render:web` |
| Publish directory | `artifacts/roblyne/dist/public` |
| Rewrite | `/*` to `/index.html` |
| Node version | `22.12.0` |

Set the build-time variable `VITE_API_URL` to the exact public HTTPS API origin, with no trailing path. After the static site deploys, set the API `CORS_ALLOWED_ORIGINS` to the exact static-site origin and redeploy the API. Frontend and API must both use HTTPS because cross-origin session cookies are `Secure` and `SameSite=None` in production.

## Redis worker (later)

After provisioning Redis, create a Node **Web Service** at the repository root.

| Field | Value |
| --- | --- |
| Build command | `pnpm install --frozen-lockfile --prod=false && pnpm run build:render:worker` |
| Start command | `node --enable-source-maps artifacts/api-server/dist/worker.mjs` |
| Health check | `/healthz` |

Set `NODE_ENV=production`, `NODE_VERSION=22.12.0`, `DATABASE_URL`, and `REDIS_URL`. First deploy the worker and wait for `/healthz`; then set the same `REDIS_URL` on the API and redeploy it. Without `REDIS_URL`, the API has a single-instance in-process lifecycle fallback. With it, `/api/readyz` requires Redis and a fresh worker heartbeat.

## Safe deployment order

1. Deploy API and wait for the migration plus `/api/readyz` to pass.
2. Deploy the static site with the API origin configured.
3. Set the static-site origin in API CORS and redeploy API.
4. Register the first account, complete bootstrap with `PLATFORM_ADMIN_BOOTSTRAP_SECRET`, then remove or rotate that secret.
5. Add custom domains by rebuilding the static site with the API custom origin, then update API CORS with the frontend custom origin.
6. Add Redis and worker only as described above.

## Validation and recovery

- For any changed build configuration, use **Manual Deploy -> Clear build cache & deploy**.
- Confirm the build log uses `pnpm`, never `npm install`, and the build command includes `--prod=false`. This is required because Vite, esbuild, and Drizzle Kit are build dependencies.
- API success: `GET /api/healthz` returns `200`, then `GET /api/readyz` returns `200` after PostgreSQL is ready.
- Worker success: `GET /healthz` returns `200` only after Redis connectivity succeeds.
- A failed migration stops API startup. Fix the migration or database permission issue; do not use schema push or manually edit production tables as a workaround.
- Do not put credentials in frontend `VITE_*` variables, source control, logs, or support tickets.
