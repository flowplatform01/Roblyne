# ROBLYNE Render Deployment Guide

This setup matches the Airfyl/FlowPay service split: static frontend, API Web Service, and an optional worker deployed as a normal Web Service. The application itself remains portable to other hosts.

## What to create in Render

Create these services from the ROBLYNE repository:

1. **Web Service** named `roblyne-api`
2. **Static Site** named `roblyne-web`
3. **Web Service** named `roblyne-worker` when Redis and background processing are ready

`render.yaml` contains the same configuration if you later choose Render Blueprint instead of manual setup.

## 1. Create the API

Render -> **New +** -> **Web Service** -> select the ROBLYNE repository.

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Root directory | Leave empty (repository root) |
| Build command | `pnpm install --frozen-lockfile --prod=false && pnpm run build:render:api` |
| Start command | `pnpm run migrate && node --enable-source-maps artifacts/api-server/dist/index.mjs` |
| Health check | `/api/readyz` |

Add these environment variables:

```text
NODE_VERSION=22.12.0
NODE_ENV=production
DATABASE_URL=<your Iven PostgreSQL connection URL>
SESSION_SECRET=<Render-generated value or long random secret>
PLATFORM_ADMIN_BOOTSTRAP_SECRET=<long random one-time secret>
CORS_ALLOWED_ORIGINS=<leave blank until you create the static frontend>
S3_ENDPOINT=<storage endpoint>
S3_BUCKET=<bucket name>
S3_ACCESS_KEY_ID=<access key>
S3_SECRET_ACCESS_KEY=<secret key>
S3_PUBLIC_BASE_URL=<public bucket URL>
```

Set `S3_REGION` and `S3_FORCE_PATH_STYLE=true` only if your provider requires them. Do **not** add `REDIS_URL` now. ROBLYNE automatically uses its safe in-process lifecycle maintenance mode when Redis is absent. The start command runs tracked Drizzle migrations before API startup, so no separate Render pre-deploy field or local migration step is required. Deploy and confirm the migration and health check succeed.

### If using Cloudflare R2 for storage

Create a **separate** R2 bucket for ROBLYNE (for example `roblyne-images-prod`) and a bucket-restricted **Object Read & Write** R2 API token. Do not reuse the Airfyl bucket or credentials. Use the R2 S3 endpoint as `S3_ENDPOINT`, set `S3_REGION=auto` and `S3_FORCE_PATH_STYLE=true`, and use the bucket's public URL as `S3_PUBLIC_BASE_URL`. Without your own domain, Cloudflare provides an `r2.dev` public URL; it works for initial testing but is development-only and rate-limited. When you later own a domain, attach a Cloudflare R2 custom domain such as `media.<your-domain>` and replace only `S3_PUBLIC_BASE_URL`. Full steps are in `ROBLYNE_DEPLOYMENT_RUNBOOK.md`.

## 2. Create the static frontend

Render -> **New +** -> **Static Site** -> select the same ROBLYNE repository.

| Setting | Value |
| --- | --- |
| Root directory | Leave empty (repository root) |
| Build command | `pnpm install --frozen-lockfile --prod=false && pnpm run build:render:web` |
| Publish directory | `artifacts/roblyne/dist/public` |

Add these build-time variables:

```text
NODE_VERSION=22.12.0
VITE_API_URL=<the HTTPS public URL of roblyne-api, for example https://roblyne-api.onrender.com>
```

Add a Render rewrite rule:

```text
Source: /*
Destination: /index.html
Type: Rewrite
```

Deploy the static site and copy its public URL.

## 3. Connect them

On the API service, replace `CORS_ALLOWED_ORIGINS` with the static site's public URL, for example:

```text
CORS_ALLOWED_ORIGINS=https://roblyne-web.onrender.com
```

Save and redeploy API. Then open the static frontend, register your account, and sign in. The browser communicates directly with the public API URL embedded as `VITE_API_URL`.

## 4. Make your first platform administrator

1. Register your own account through the frontend.
2. Sign in and open the first-administrator setup screen.
3. Enter `PLATFORM_ADMIN_BOOTSTRAP_SECRET`.
4. After it succeeds, remove or rotate that secret in the API service environment settings.

## 5. Add custom domains

You can use Render `onrender.com` URLs for deployment and health-check testing, but not for reliable browser login when the static site and API are separate services. They cannot reliably share the session cookie because Render subdomains are cross-site to each other in browsers. Before inviting real users, buy one domain and use `app.<your-domain>` for the static site and `api.<your-domain>` for the API.

When you later buy a domain, follow the **Domains and Cloudflare** section in `ROBLYNE_DEPLOYMENT_RUNBOOK.md`: add `app.<your-domain>` to the static site and `api.<your-domain>` to the API in Render first, then create DNS-only Cloudflare CNAME records to the corresponding Render hostnames. After Render verifies TLS, rebuild the static site with the API custom URL and redeploy the API with the frontend custom URL in `CORS_ALLOWED_ORIGINS`.

## 6. Add Redis and the worker

Provision Redis first, then create a normal **Web Service** (not Render Background Worker) for `roblyne-worker`:

| Setting | Value |
| --- | --- |
| Build command | `pnpm install --frozen-lockfile --prod=false && pnpm run build:render:worker` |
| Start command | `node --enable-source-maps artifacts/api-server/dist/worker.mjs` |
| Health check | `/healthz` |

Set `NODE_VERSION=22.12.0`, `NODE_ENV=production`, `DATABASE_URL`, and `REDIS_URL` on the worker. Render supplies `PORT`; the worker binds its health endpoint to that port automatically.

Set the same `REDIS_URL` on API. In production, ROBLYNE automatically stops its in-process lifecycle fallback when Redis is configured, requires Redis plus a fresh worker heartbeat for API readiness, and lets the dedicated worker own lifecycle processing. Deploy worker first, wait for its health check, then redeploy API.

## Payments

FlowPay works through the API and does not require a ROBLYNE worker. Configure FlowPay production values only when you are ready for live payments.
