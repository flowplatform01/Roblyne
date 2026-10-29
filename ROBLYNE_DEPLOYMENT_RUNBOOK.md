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

6. Configure **Bucket Settings -> CORS Policy** before testing browser uploads. Replace the example frontend origin with every real frontend origin that will upload images:

```json
[
  {
    "AllowedOrigins": ["https://roblyne.onrender.com"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Do not use `*` for production origins. Add the eventual `https://app.example.com` origin before switching domains, then remove temporary origins you no longer operate. This CORS rule is required because browsers upload directly to the short-lived R2 presigned URL; it does not expose the R2 credentials.
7. Deploy the API and test an image upload while signed in. Never put either R2 credential in `VITE_*` frontend variables. ROBLYNE signs only PNG, JPEG, GIF, and WebP uploads up to 2 MB. The browser preserves files already under the limit and adaptively resizes/re-encodes supported still images above it; oversized animated GIFs are rejected rather than corrupting their animation.

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

## FlowPay payments

FlowPay is an API integration, not a fourth ROBLYNE service. The browser opens the hosted FlowPay checkout returned by the API; the API creates the payment intent, receives the signed webhook, and finalizes the ticket, campaign contribution, or paid vote only after confirmed payment. The dedicated ROBLYNE worker is not required for this flow.

### Configure the API service

Leave payments unconfigured until FlowPay has supplied and approved production access. The deployed FlowPay account configuration uses these **server-only** variables on `roblyne-api` in Render:

```text
FLOWPAY_API_BASE_URL=<FlowPay production API base URL>
FLOWPAY_CLIENT_ID=<FlowPay client ID>
FLOWPAY_PUBLIC_KEY=<FlowPay public key>
FLOWPAY_SECRET_KEY=<FlowPay secret key>
FLOWPAY_WEBHOOK_SECRET=<FlowPay webhook signing secret>
FLOWPAY_PROVIDER=FAPSHI
FLOWPAY_TIMEOUT_MS=15000
```

- These are the generic variable names ROBLYNE already reads and are valid in production. With `NODE_ENV=production`, ROBLYNE always uses the production payment path; `FLOWPAY_ENVIRONMENT` is not needed and does not override that safety rule.
- `FLOWPAY_PROVIDER` is optional and defaults to `FAPSHI`; set it only if FlowPay has assigned another supported provider.
- `FLOWPAY_TIMEOUT_MS` is optional (default `15000`, maximum `60000`).
- Never add FlowPay credentials to `VITE_*`, the static site, the worker, source control, logs, or support messages.
- `FLOWPAY_CLIENT_SECRET` is not used by the ROBLYNE adapter. Keeping it in Render does not break anything, but it is not a substitute for the required `FLOWPAY_SECRET_KEY`.
- Environment-specific `FLOWPAY_PRODUCTION_*` aliases are also supported for a future separated credential setup, but do not add a second conflicting set today.

Deploy the API after saving the variables. Missing FlowPay configuration does not block API startup, but the first real checkout will fail until the complete matching set is present.

### Register the webhook in FlowPay

In the FlowPay merchant/admin configuration, use this exact public API endpoint (replace the hostname only):

```text
https://<roblyne-api-host>/api/payments/webhooks/flowpay
```

Use the API's Render HTTPS hostname now, then replace it with `https://api.<your-domain>/api/payments/webhooks/flowpay` after your custom domain is active. Configure the same webhook secret in both FlowPay and `FLOWPAY_WEBHOOK_SECRET`.

ROBLYNE expects FlowPay's signed raw JSON webhook with these headers:

```text
x-flowpay-event-id
x-flowpay-event-type
x-flowpay-signature
```

The signature is verified as HMAC-SHA256 over the unmodified request body and accepts hexadecimal, base64, or a `sha256=` prefix. Webhook requests do not use a browser session or CORS. Replays are deduplicated by FlowPay event ID, and payment state changes are idempotent.

### How payment confirmation works

1. ROBLYNE creates a durable pending payment intent and asks FlowPay for a hosted checkout session.
2. The user completes the hosted checkout.
3. **Primary path:** FlowPay sends the signed webhook to the endpoint above. ROBLYNE verifies it and atomically finalizes the ticket, campaign contribution, or vote exactly once.
4. **Safety fallback:** while the checkout sheet is open, the ROBLYNE frontend polls its own payment-status endpoint every two seconds. For a pending payment, the API asks FlowPay for the authoritative checkout-session status and processes a terminal result through the same idempotent finalization path.

The fallback protects an active customer checkout against a delayed or missed webhook, but it is not a substitute for registering the webhook: polling stops when the user closes the checkout or leaves the page. Register the FlowPay webhook before accepting real payments.

### Validate before enabling real payments

1. Confirm `GET https://<roblyne-api-host>/api/readyz` is healthy and the webhook URL is publicly reachable over HTTPS.
2. In FlowPay, send its signed test webhook (or make a provider-approved controlled transaction). Confirm the endpoint returns `200` and the FlowPay dashboard records delivery success.
3. Run one controlled paid ticket, campaign, and paid-vote transaction. Confirm each remains pending until FlowPay reports success, then confirms exactly once after webhook/status processing.
4. Retry or replay a completed webhook from FlowPay. It must return `200` without creating another ticket, vote, contribution, or financial record.
5. Confirm the FlowPay transaction ID, ROBLYNE external reference, and financial record reconcile in the relevant admin/finance records.

Do not enable real paid events, campaigns, or elections for the public until FlowPay confirms its production endpoint, credentials, webhook contract, supported currency/limits, and one controlled live transaction.

### Payment troubleshooting

- **Checkout initialization fails:** verify the five required `FLOWPAY_*` values and the exact FlowPay production base URL. The API adds `/api/v1` automatically only when the supplied URL does not already end in `/api/v1`.
- **Webhook returns `401`:** the event ID/type headers, exact raw payload, or webhook secret do not match. Do not alter or re-sign the body through a proxy.
- **Checkout stays pending:** inspect FlowPay delivery history first, then verify the payment's status from the ROBLYNE UI. Do not mark the local record paid manually.
- **Checkout cannot display in the embedded sheet:** confirm with FlowPay that its hosted checkout permits framing by the ROBLYNE frontend origin; the API/webhook settlement flow remains authoritative.

## Better Stack uptime monitors

Use HTTP monitors with an expected status of `200`:

| Service | Monitor URL | Purpose |
| --- | --- | --- |
| API | `https://<roblyne-api-host>/api/readyz` | Checks API, database, and (when configured) Redis/worker readiness. |
| Worker | `https://<roblyne-worker-host>/healthz` | Checks the worker process and Redis connection. |
| Static frontend | `https://<roblyne-web-host>/` | Optional public-page availability check. Static sites do not sleep. |

For a Render free web service, a Better Stack check every three minutes creates inbound traffic and prevents the 15-minute idle spin-down. It also consumes free instance hours continuously: keeping both API and worker awake for a whole month exceeds Render's 750 free instance-hours per workspace. Monitor the API only if avoiding its cold starts is worth that cost; do not rely on external pings as a production availability solution. A paid always-on instance is the reliable production option.

## Queue operations

With `REDIS_URL` configured, the ROBLYNE worker owns two independent BullMQ lanes:

- `evenum-maintenance`: transitions ended elections, campaigns, and events every 30 seconds.
- `evenum-payment-recovery`: reconciles pending FlowPay checkout sessions after a bounded delay if webhook delivery is delayed or missed. FlowPay webhooks remain the primary settlement mechanism.

The API readiness endpoint requires Redis plus a fresh worker heartbeat. Its Prometheus endpoint, `GET /api/metrics`, includes per-queue waiting, active, delayed, completed, and failed job counts. Alert when payment-recovery jobs remain waiting/active for an extended period or failed jobs increase. Queue metrics expose operational metadata only; do not place payment data in queue job payloads.

The worker starts payment-recovery work at concurrency `5` and a rate limit of `60` checks per minute. Tune these values only after measuring FlowPay API limits, database capacity, and real checkout volume.

## Safe deployment order

1. Deploy API and wait for the migration plus `/api/readyz` to pass.
2. Deploy the static site with the API origin configured.
3. Set the static-site origin in API CORS and redeploy API.
4. Register the first account, complete bootstrap with `PLATFORM_ADMIN_BOOTSTRAP_SECRET`, then remove or rotate that secret.
5. Add custom domains by rebuilding the static site with the API custom origin, then update API CORS with the frontend custom origin.
6. Configure and validate FlowPay as described above before enabling paid workflows.
7. Add Redis and worker only as described above.

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
