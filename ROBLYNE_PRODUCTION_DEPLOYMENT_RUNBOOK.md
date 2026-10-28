# ROBLYNE production deployment runbook

This guide covers the future three-process architecture. For the current low-cost deployment (static frontend plus API, without Redis or worker), follow `ROBLYNE_RENDER_DEPLOYMENT_GUIDE.md`.

## 1. Prepare the repository

1. Commit `render.yaml`, source changes, migrations, `.env.example`, and this documentation. Never commit `.env`, provider keys, database URLs, or generated local data.
2. Confirm the intended branch and a clean review with `git status` and `git log -1 --oneline`.
3. With Node.js and pnpm installed, run:

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build:render:web
pnpm run build:render:api
pnpm run build:render:worker
pnpm --filter @workspace/api-server run test
```

## 2. Prepare PostgreSQL

1. Create an empty PostgreSQL database at Iven (or another chosen provider). Obtain its TLS-capable `DATABASE_URL`; do not use a local URL.
2. Confirm the provider permits connections from Render and whether its URL already enforces `sslmode=require`. ROBLYNE passes the supplied URL directly to `pg`.
3. Do **not** run demo seed commands. The only production schema command is:

```sh
pnpm run migrate
```

4. The current single-instance API start command runs that command before each API release. It is tracked by Drizzle and does not reset or seed data. Workers must never run migrations. When scaling API replicas later, move migrations to one controlled release step to prevent concurrent migration attempts.
5. The migrations create the tables, indexes, and constraints. No extension requirement is present in the committed migration SQL. Verify the pre-deploy log says the migration completed without printing its connection string.

## 3. Prepare Redis

1. Create Redis at Iven and obtain the exact authenticated/TLS URL required by that provider as `REDIS_URL`.
2. Configure the same value on API and worker. Queue name is `evenum-maintenance`; Redis keys are created automatically. Do not pre-create keys.
3. When Redis is configured in production, API readiness automatically requires a fresh worker heartbeat. Redis contains coordination/cache/queue state only; PostgreSQL remains the durable record.

## 4. Configure Render

1. In Render, create a Blueprint from this repository's `render.yaml`. Keep its root directory at the repository root (`Roblyne`).
2. Accept the service types exactly as declared:

| Service | Render type | Build command | Start command | Health |
| --- | --- | --- | --- | --- |
| `roblyne-web` | Web service | `pnpm install --frozen-lockfile && pnpm run build:render:web` | `node artifacts/roblyne/server.mjs` | `/` |
| `roblyne-api` | Web service | `pnpm install --frozen-lockfile && pnpm run build:render:api` | `node --enable-source-maps artifacts/api-server/dist/index.mjs` | `/api/readyz` |
| `roblyne-worker` | Background worker | `pnpm install --frozen-lockfile && pnpm run build:render:worker` | `node --enable-source-maps artifacts/api-server/dist/worker.mjs` | Render worker logs |

3. Give the web service `API_PROXY_URL`, set to the public HTTPS origin of `roblyne-api` (no trailing slash). The web server proxies browser `/api/*` requests, preserving same-origin secure session cookies. Do not set this to a browser-visible secret.
4. Configure `DATABASE_URL` and `REDIS_URL` on both API and worker. Configure `SESSION_SECRET` (Blueprint generates it), S3 values, and `PLATFORM_ADMIN_BOOTSTRAP_SECRET` on API. Render does not share service variables automatically.
5. API production additionally requires `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_PUBLIC_BASE_URL`. Set `S3_REGION`/`S3_FORCE_PATH_STYLE` if required by the selected object store.
6. Configure FlowPay only when enabling live payments: `EVENUM_PAYMENT_MODE=flowpay`, production `FLOWPAY_*` credentials, and the production provider endpoint values. Production never silently uses the payment simulator.

## 5. Domains, DNS, CORS, and callbacks

1. Choose a web domain and an API domain, for example `app.<your-domain>` and `api.<your-domain>`. Add them in Render, then create the exact DNS records Render provides in Cloudflare. Keep Cloudflare proxy/TLS settings compatible with Render HTTPS.
2. Set `API_PROXY_URL=https://api.<your-domain>` on `roblyne-web` and `CORS_ALLOWED_ORIGINS=https://app.<your-domain>` on `roblyne-api`. The proxy means browser cookies remain scoped to the web domain.
3. Configure FlowPay's webhook callback as `https://api.<your-domain>/api/payments/webhooks/flowpay`. Do not use an `onrender.com` URL after custom-domain cutover.
4. Configure the S3 bucket CORS/public URL according to its provider. Only public object URLs belong in `S3_PUBLIC_BASE_URL`; credentials remain API-only.

## 6. First deployment and initialization

1. Deploy the worker first and confirm its logs show its health listener and a Redis connection. Wait up to 15 seconds for its heartbeat. It does not depend on the API process.
2. Deploy API. Its pre-deploy migration must pass before the process starts, and its readiness check can now see the worker heartbeat. Check `GET https://api.<your-domain>/api/readyz`.
3. Deploy web. Confirm `https://app.<your-domain>/` loads and `https://app.<your-domain>/api/healthz` is proxied successfully.
4. Register the intended first administrator through the normal UI, sign in, then complete the platform-admin bootstrap using the one-time `PLATFORM_ADMIN_BOOTSTRAP_SECRET`. It can succeed only when no administrator exists. Remove or rotate that secret immediately afterward.
5. No development accounts, organizations, samples, or demo transactions are created by migrations or deployment.

## 7. Smoke test and redeploy

- Register, log in, log out, and reopen a protected route.
- Create an organization, event, election, and campaign with safe test data; confirm organization permissions remain isolated.
- Check `GET /api/healthz` and `/api/readyz` via the web domain and inspect API/worker logs for errors.
- Confirm worker logs a `lifecycle-sweep` job after the API schedules it.
- Use only FlowPay sandbox credentials for payment testing until live credentials and provider approval are available.
- Deploy the same commit again. Drizzle must report no duplicate migrations; existing accounts and data must remain intact.

## 8. Rollback and recovery

- **Application failure:** roll back the affected Render service to its last successful release; check build/runtime logs and `/api/readyz`.
- **Bad migration:** do not blindly roll back SQL. Keep the application at a compatible release and forward-fix with a reviewed migration after backup/DBA assessment.
- **Worker stopped:** restore worker connectivity; when Redis is configured in production, API readiness intentionally stays unhealthy until the worker heartbeat returns.
- **Redis/PostgreSQL failure:** restore the provider service and connection URL first; do not delete Redis keys or database data as a recovery shortcut.

## Environment ownership

See `ROBLYNE_ENVIRONMENT_VARIABLES.md` and `.env.example` for the complete variable contract. Build-time frontend secrets are prohibited; this Vite build uses no `VITE_*` secret configuration. All service credentials are runtime configuration in Render.
