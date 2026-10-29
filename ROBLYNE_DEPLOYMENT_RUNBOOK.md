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

## Cloudflare R2 image storage

ROBLYNE uploads PNG, JPEG, GIF, and WebP images (up to 2 MB) directly to S3-compatible object storage using short-lived presigned upload URLs. It then stores the corresponding public object URL. Therefore the R2 bucket must be publicly readable for image delivery, while write credentials stay only on the API service.

### Create ROBLYNE's R2 resources now

1. In Cloudflare, open **Storage & databases -> R2 -> Create bucket**. Create a separate lowercase bucket such as `roblyne-images-prod`; do not reuse the Airfyl bucket.
2. Open **R2 -> Overview -> Manage in API Tokens -> Create API Token**. Grant **Object Read & Write** and restrict the token to only `roblyne-images-prod`. Save the displayed Access Key ID and Secret Access Key immediately; the secret is shown once.
3. Copy the R2 S3 API endpoint from Cloudflare. Its format is `https://<CLOUDFLARE_ACCOUNT_ID>.r2.cloudflarestorage.com`.
4. In the bucket **Settings**, enable **Public Development URL** and copy its `https://<bucket>.<random>.r2.dev` URL. This is acceptable as a temporary development/testing public URL only; do not create your own CNAME to it.
5. Set these API-service environment values in Render (and, if needed, your local `.env`):

```text
S3_ENDPOINT=https://<CLOUDFLARE_ACCOUNT_ID>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=roblyne-images-prod
S3_ACCESS_KEY_ID=<R2 access key ID>
S3_SECRET_ACCESS_KEY=<R2 secret access key>
S3_PUBLIC_BASE_URL=https://<bucket>.<random>.r2.dev
S3_FORCE_PATH_STYLE=true
```

6. Deploy the API and test an image upload. Never put either R2 credential in `VITE_*` frontend variables.

### Replace the temporary R2 URL when you own a domain

Cloudflare marks `r2.dev` URLs as development-only and rate-limited. Once you buy a domain and add it to the same Cloudflare account, open the R2 bucket **Settings -> Custom Domains -> Add**, attach a dedicated hostname such as `media.example.com`, wait until it is active, then change only `S3_PUBLIC_BASE_URL` to `https://media.example.com` and redeploy the API. You do not manually create that R2 custom-domain DNS record; Cloudflare creates it during the bucket-domain connection.

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

## Domains and Cloudflare

### Render subdomains are not sufficient for browser login

Render supplies HTTPS for `onrender.com` URLs, so they can be used for build, health-check, and public-read testing. `onrender.com` is a public suffix, so browsers treat the frontend-to-API session cookie as cross-site. ROBLYNE sets `Secure`, `SameSite=None`, and `Partitioned` cookies in production to support current Chromium browsers during this temporary phase.

Partitioned-cookie support is not universal and users can disable third-party cookies. Before enabling real account use broadly, obtain one domain and put both public services under that same registrable domain, for example `app.example.com` and `api.example.com`.

Before enabling real account use, obtain one domain and put both public services under that same registrable domain, for example `app.example.com` and `api.example.com`. Do not add arbitrary Cloudflare DNS records for an `onrender.com` address; Render owns that DNS zone.

### Add Cloudflare later, after buying a domain

1. Buy one domain from any registrar. Add that domain as a Cloudflare zone and change the registrar nameservers to the two Cloudflare nameservers assigned to the zone. Wait until Cloudflare marks the zone active.
2. Choose separate names under the same domain, for example `app.example.com` for the static site and `api.example.com` for the API. Do not expose the worker with a custom domain.
3. In each Render service, add the matching custom domain **before** creating DNS records. Copy the Render service's exact `onrender.com` hostname.
4. In Cloudflare, set **SSL/TLS -> Overview** to **Full**. Create a `CNAME` for `app` to the static site's Render hostname and another for `api` to the API's Render hostname. Set both records to **DNS only** (gray cloud) until Render verifies them and issues certificates. Remove conflicting `AAAA` records.
5. In Render, verify both custom domains and wait until TLS is active. Cloudflare proxying is optional after verification; keep DNS-only initially for the simplest operation.
6. Update the static-site build variable to `VITE_API_URL=https://api.example.com` and redeploy it. Then update the API variable to `CORS_ALLOWED_ORIGINS=https://app.example.com` and redeploy it.
7. Test registration, login, logout, a protected route, and an upload over the custom domains before advertising them. Keep the Render subdomains enabled until this succeeds.

## Validation and recovery

- For any changed build configuration, use **Manual Deploy -> Clear build cache & deploy**.
- Confirm the build log uses `pnpm`, never `npm install`, and the build command includes `--prod=false`. This is required because Vite, esbuild, and Drizzle Kit are build dependencies.
- API success: `GET /api/healthz` returns `200`, then `GET /api/readyz` returns `200` after PostgreSQL is ready.
- Worker success: `GET /healthz` returns `200` only after Redis connectivity succeeds.
- A failed migration stops API startup. Fix the migration or database permission issue; do not use schema push or manually edit production tables as a workaround.
- Do not put credentials in frontend `VITE_*` variables, source control, logs, or support tickets.
