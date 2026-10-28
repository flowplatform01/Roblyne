# ROBLYNE local setup and deployment guide

This guide covers a fresh local installation and the services needed for a separate deployment. The app is a React/Vite frontend plus an Express API; it is not a single self-contained process. Route `/api` to the API and all other web paths to the frontend on the same public origin.

## Readiness summary

- The main election, event/ticketing, campaign, organization, payment, finance, and administration surfaces are present in the application and API.
- This workspace includes a PostgreSQL/Drizzle schema and versioned migrations. The first migration is the original 14-table baseline; the new second migration adds the current schema's remaining tables and changes. The new migration has been generated and reviewed but has **not** been applied to any database.
- Image uploads require S3-compatible storage in production. The API intentionally refuses to start in production without it.
- Production payments require a FlowPay account and webhook configuration. Local development uses the built-in payment simulator by default.
- Redis is optional. Without it, maintenance lifecycle sweeps run in-process; for multi-instance deployments, configure Redis and run the worker.
- No mail-delivery provider or external identity-provider account is required by the current implementation. Authentication uses the app's own email/password accounts, bcrypt password hashes, and PostgreSQL-backed sessions.
- The app can be developed outside Replit. The workspace now retains platform-specific native build packages in its lockfile and the local Vite server proxies `/api` to the API process.
- This audit did not connect to an external payment account, object store, Redis server, or production database. Those integrations still need to be configured and smoke-tested in the destination environment.

## Prerequisites

- Node.js 24
- pnpm 10
- PostgreSQL for local or deployed application data
- For production uploads: an S3-compatible bucket and credentials (AWS S3, Cloudflare R2, or another compatible service)
- For live payments: FlowPay account credentials and webhook configuration
- Optional: Redis for shared caching/rate limits and the BullMQ maintenance worker

Install pnpm 10 if needed, then verify `node --version` and `pnpm --version`.

## Download, install, and configure

1. Clone the repository or extract the downloaded project archive into a folder. Open a terminal in the project root.
2. Install the locked workspace dependencies:

   ```sh
   pnpm install --frozen-lockfile
   ```

3. Create a local PostgreSQL database, for example:

   ```sh
   createdb roblyne_dev
   ```

   If `createdb` is not on your path, create an empty database named `roblyne_dev` using your PostgreSQL provider's admin tool.

4. Copy `.env.example` to `.env`, then set `DATABASE_URL` to your local database connection string. Set `SESSION_SECRET` to a new random value. On macOS/Linux, generate one with:

   ```sh
   openssl rand -base64 48
   ```

   Store the output only in your local `.env` or hosting provider's secret manager. The checked-in `.env.example` contains placeholders, not working credentials. `.env` is ignored by Git.

5. Load `.env` into each terminal before running a command. In Bash:

   ```sh
   set -a
   . ./.env
   set +a
   ```

   In PowerShell, set each variable in the current terminal, for example `$env:DATABASE_URL = "..."`, `$env:SESSION_SECRET = "..."`; do not paste secrets into shared logs or commit them.

## Database initialization and migrations

The database is PostgreSQL, accessed through `pg` and Drizzle ORM. Schema definitions are in `lib/db/src/schema/`. Versioned SQL migrations are in `lib/db/drizzle/`; Drizzle tracks applied files in its migration-history table. The session table is managed by `connect-pg-simple` at runtime and is intentionally not part of the Drizzle schema.

For a **new, empty database**, use the reviewed migrations:

```sh
pnpm --filter @workspace/db run migrate
```

This runs pending migrations in order, starting with `0000_normal_ares.sql` and then `0001_complete-current-schema.sql`. `DATABASE_URL` must point to the intended database. The second migration adds missing application tables/columns and supporting indexes; it contains no `DROP TABLE`, `DROP COLUMN`, or data-deletion statements.

For a disposable local database where you explicitly want Drizzle to reconcile the schema directly, the available command is:

```sh
pnpm --filter @workspace/db run push
```

Prefer **reviewed migrations** for production. `push` compares live state and schema interactively and is not a versioned, reviewed deployment history; do not use `push-force` for a real database. Do not run the initial migration sequence blindly against a database that already has application tables or data. Existing databases may have been initialized with `push` and may not have migration-history records; first back up the database and establish a deliberate baseline/upgrade plan. This audit did not inspect or change a live database.

To create a migration after changing the Drizzle schema:

```sh
pnpm --filter @workspace/db run generate -- --name=describe_the_change
```

Review the generated SQL before applying it. Avoid running the historical `scripts/migrate-election-monetization.ts` against a new or production database; its schema change is superseded by the checked-in schema and migrations.

## Run locally in development

Keep the API and web app running in separate terminals. Load `.env` in each terminal first.

**Terminal 1 — API** (port 8080):

```sh
PORT=8080 pnpm --filter @workspace/api-server run dev
```

**Terminal 2 — web app** (port 5173):

```sh
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/evenum run dev
```

Open `http://localhost:5173`. The local Vite server forwards `/api` requests to `LOCAL_API_ORIGIN` (default `http://127.0.0.1:8080`). `PORT` is set per process; do not put one shared `PORT` value in `.env` for both processes.

PowerShell equivalents for the two process commands:

```powershell
# API terminal
$env:PORT = "8080"
pnpm --filter @workspace/api-server run dev

# Web terminal
$env:PORT = "5173"
$env:BASE_PATH = "/"
pnpm --filter @workspace/evenum run dev
```

For image upload testing, configure the S3 variables in `.env`. Without them, ordinary local application flows can run, but upload requests will report that storage is not configured.

### First platform administrator

1. Register a normal account through the app's registration flow.
2. Set `PLATFORM_ADMIN_BOOTSTRAP_SECRET` to a one-time random setup code of at least 32 bytes, restart the API, and use that code in the first-administrator setup prompt in the admin area.
3. After the first administrator is created, remove the bootstrap variable from the environment and restart the API. The route refuses to create another first administrator once one already exists.

Never reuse this code as a user password or publish it in documentation.

## Services and environment variables

### Required for normal operation

| Variable | Required? | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string, used by the API, session store, and Drizzle commands. |
| `SESSION_SECRET` | Yes for production; set locally too | Signs session cookies. Production refuses to start when missing or when set to the development default. |
| `PORT` | Yes per process | Listening port for API and Vite/preview processes. Assign distinct ports. |
| `BASE_PATH` | Required for Vite dev/build | Frontend path prefix; use `/` when hosted at the domain root. |

### Conditional/optional application services

| Variable(s) | Required when | Purpose |
|---|---|---|
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL` | Production API startup and image uploads | S3-compatible storage for user-uploaded images. Production startup exits if the required S3 configuration is incomplete. |
| `S3_REGION` | Optional | S3 region; defaults to `auto`, suitable for R2. |
| `S3_FORCE_PATH_STYLE` | Optional | Set `true` only for providers requiring path-style addressing; defaults to `false`. |
| `REDIS_URL` | Optional | Redis connection for shared rate limiting, discovery caching, and BullMQ scheduling. |
| `CORS_ALLOWED_ORIGINS` | Optional | Comma-separated HTTP(S) origins with no path. Prefer same-origin `/api` routing so session cookies work without cross-origin configuration. |
| `LOCAL_API_ORIGIN` | Optional, local Vite only | Local API proxy destination; defaults to `http://127.0.0.1:8080`. |
| `API_BASE_URL` | Optional | API origin plus `/api`, used by the production web server for entity-specific link-preview requests. Example shape: `https://your-domain.example/api`. |
| `NODE_ENV` | Runtime-managed | Use `development` locally and `production` for deployment. |
| `LOG_LEVEL` | Optional | Server log level. |

### Payments

Local development defaults to the simulator. To use FlowPay in development, set `EVENUM_PAYMENT_MODE=flowpay` and configure sandbox credentials. Production always requires real FlowPay configuration.

For each environment (`SANDBOX` or `PRODUCTION`), the preferred names are:

- `FLOWPAY_<ENV>_API_BASE_URL`
- `FLOWPAY_<ENV>_CLIENT_ID`
- `FLOWPAY_<ENV>_PUBLIC_KEY`
- `FLOWPAY_<ENV>_SECRET_KEY`
- `FLOWPAY_<ENV>_WEBHOOK_SECRET`
- Optional: `FLOWPAY_<ENV>_PROVIDER`

The supported legacy fallback names are `FLOWPAY_API_BASE_URL`, `FLOWPAY_CLIENT_ID`, `FLOWPAY_PUBLIC_KEY`, `FLOWPAY_SECRET_KEY`, `FLOWPAY_WEBHOOK_SECRET`, and `FLOWPAY_PROVIDER`. Environment-specific variables take precedence. `FLOWPAY_ENVIRONMENT` defaults to `sandbox` outside production; `FLOWPAY_TIMEOUT_MS` defaults to 15,000 ms and is capped at 60,000 ms.

Configure the FlowPay webhook to call:

```text
https://your-domain.example/api/payments/webhooks/flowpay
```

The endpoint validates FlowPay's HMAC signature over the raw request body. Use the matching sandbox or production webhook secret. Do not enable production payments until a real sandbox test has completed.

### Replit, framework, and utility-only variables

- `REPL_ID` and `REPLIT_DEPLOYMENT` are Replit-injected values. They are not needed for local operation; `REPL_ID` only controls Replit Vite plugins and the local API proxy boundary, while `REPLIT_DEPLOYMENT` blocks a sample-data script in deployment.
- Vite provides `DEV` and `BASE_URL` as built-in client variables. They are not credentials or values to add to `.env`.
- `ROBYNE_SEED_TARGET=development` and `ROBYNE_SEED_SAMPLES=1` are required together to run the additive development sample seeder. It also refuses production and Replit deployments.
- `INTEGRITY_ALLOW_WRITES=1`, optional `INTEGRITY_CONCURRENCY`, and optional `INTEGRITY_REPORT_PATH` belong only to the write-integrity harness. That harness creates and deletes isolated fixtures.
- `CONCURRENCY_TEST_ALLOW_WRITES=1`, optional `CONCURRENCY_API_ORIGIN`, `CONCURRENCY_API_BASE_PATH`, `CONCURRENCY_REQUESTS`, and `CONCURRENCY_TIMEOUT_MS` belong only to the concurrency harness. It creates and deletes isolated fixtures and refuses `NODE_ENV=production`.
- Performance harness settings are `PERF_API_ORIGIN`, `PERF_API_BASE_PATH`, `PERF_REQUESTS_PER_SCENARIO`, `PERF_CONCURRENCY`, `PERF_TIMEOUT_MS`, `PERF_SEARCH_QUERY`, `PERF_AUTH_COOKIE`, `PERF_REPORT_PATH`, `PERF_ORG_ID`, `PERF_WRITE_PATH`, `PERF_WRITE_METHOD`, `PERF_WRITE_BODY`, `PERF_RUN_WRITES`, `PERF_ALLOW_WRITES`, and `PERF_WRITE_REQUESTS`. `PERF_AUTH_COOKIE` is a live session credential: keep it private. Any optional write scenario requires both write flags.
- `DATABASE_URL`, `NODE_ENV`, and `FLOWPAY_WEBHOOK_SECRET` are also read by test/maintenance scripts. Do not point write-enabled scripts at production.

## Build, tests, and production startup

Run the workspace type checks:

```sh
pnpm run typecheck
```

Run the API's unit tests (they do not require a database):

```sh
pnpm --filter @workspace/api-server run test
```

There is no configured lint script. The concurrency/integrity and performance scripts are separate operational harnesses; some write and delete test fixtures and are intentionally not part of the routine test command. Do not run them against production.

Build the workspace:

```sh
PORT=5173 BASE_PATH=/ pnpm run build
```

For a root deployment, build the frontend with `BASE_PATH=/`. If it is hosted under a subpath, build it with the exact path prefix and configure the frontend server and reverse proxy to preserve that prefix.

Production API:

```sh
NODE_ENV=production PORT=8080 pnpm --filter @workspace/api-server run start
```

Production web server (after building):

```sh
NODE_ENV=production PORT=22244 BASE_PATH=/ node artifacts/evenum/server.mjs
```

Put both services behind HTTPS and a reverse proxy that routes `/api` to the API process and other frontend paths to the web process. Forward the original host/protocol headers correctly because the API trusts one reverse-proxy hop and sets secure session cookies in production. Set `API_BASE_URL` to the externally reachable API base ending in `/api` if link previews are not on the same origin.

### Redis worker (optional)

With Redis configured, build and start the separate worker process:

```sh
pnpm --filter @workspace/api-server run build:worker
NODE_ENV=production pnpm --filter @workspace/api-server run start:worker
```

Run one worker alongside the API service whenever `REDIS_URL` is configured in production. Without Redis, the API has an in-process lifecycle-sweep fallback.

## Replit-specific and external-service notes

- The core application does not need a Replit database product or Replit authentication provider. It uses generic PostgreSQL and app-managed sessions.
- Replit's Vite plugins activate only when `REPL_ID` exists. `REPLIT_DEPLOYMENT` is only referenced by a development sample-seed safety guard; neither is required locally.
- No production application route depends on a Replit-only API. `@replit/connectors-sdk` is declared at the workspace root, while production app services use PostgreSQL, S3-compatible storage, optional Redis, and FlowPay.
- Object storage must be durable and reachable from user browsers. Configure bucket CORS to permit the app's origin, `PUT`, and the `Content-Type` request header; image links use `S3_PUBLIC_BASE_URL`.
- There is no email-delivery integration or email-verification setup in the current code.
- Public entity pages include server-rendered link-preview metadata. The web process may need `API_BASE_URL` to reach the API when a reverse proxy or separate host is used.

## Safety and troubleshooting

- **Database connection errors:** check that PostgreSQL is running, the database exists, and `DATABASE_URL` targets the intended environment. Do not copy production URLs into local `.env`.
- **Drizzle says there are no pending migrations or tables are already present:** the database may have been initialized by schema push or may not have migration history. Back it up and review the schema/history before applying any migration.
- **Frontend requests return HTML or 404 instead of API JSON:** confirm the API is listening on port 8080 and the frontend is using the local Vite proxy. Set `LOCAL_API_ORIGIN` if the API uses a different port.
- **`BASE_PATH` or `PORT` missing:** set both when running Vite, including builds. The API also requires its own `PORT`.
- **Production startup exits about image storage:** configure the required S3-compatible environment variables and bucket permissions.
- **Sessions fail or users are logged out after restarts:** use a stable `SESSION_SECRET` and a reachable PostgreSQL database. Do not substitute in-memory sessions.
- **Redis/worker readiness is degraded:** either run Redis and the worker or leave the optional requirement flags disabled.
- **FlowPay rejects a webhook:** verify the matching environment's webhook secret and exact endpoint path. The signature must match the unmodified raw JSON body.
- **Do not run the demo seed on real data.** `scripts/seed-demo.ts` deletes selected fixture organization IDs and creates sample accounts with a fixed demo password. Use it only on a disposable development database.
- **Do not run the write-enabled integrity/concurrency scripts on production.** They create and clean up test rows.

## Audit verification record

The source review found no unfinished TODO/placeholder implementation in the core application routes and pages; form hint text and fixture/demo seed data are not production application stubs. The database and service-dependent user flows could not be fully exercised without the destination database, S3 bucket, Redis, and FlowPay account.

The checked-in SQL migrations were inspected, and the new migration was generated from the current Drizzle schema. No migration was applied during this audit. In the current workspace, all 22 API unit tests passed, workspace TypeScript checks passed, the production build completed, and `/api/healthz` plus `/api/readyz` returned success with the configured database. The frontend build emitted a non-blocking large-chunk advisory. Redis, external object storage, FlowPay, and installation on non-Linux operating systems were not tested.
