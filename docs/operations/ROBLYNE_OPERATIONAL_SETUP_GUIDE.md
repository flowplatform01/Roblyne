# ROBLYNE Operational Setup Guide

## Service contract

ROBLYNE runs as three portable services: static web, API, and worker. They are not coupled to Render; any host that provides environment variables, HTTPS, a PostgreSQL database, and a Redis-compatible service can run them.

| Service | Required responsibilities |
| --- | --- |
| Web | Builds `artifacts/roblyne`, serves static files, sets `VITE_API_URL` to the public API origin. |
| API | Runs migrations, serves `/api`, owns sessions, OAuth callbacks, webhooks, presigned upload URLs, and readiness at `/api/readyz`. |
| Worker | Runs `artifacts/api-server/dist/worker.mjs`, has its own health server at `/healthz`, consumes BullMQ work, and records the payout-worker heartbeat. |

## Required production environment

### API

`DATABASE_URL`, `SESSION_SECRET`, `CORS_ALLOWED_ORIGINS`, `PUBLIC_WEB_URL`, `PUBLIC_API_URL`, `REDIS_URL`, all `FLOWPAY_*` variables, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`.

Set OAuth variables only as complete pairs. OAuth callback URIs are:

- Google: `https://<api-origin>/api/auth/oauth/google/callback`
- Microsoft: `https://<api-origin>/api/auth/oauth/microsoft/callback`
- LinkedIn: `https://<api-origin>/api/auth/oauth/linkedin/callback`
- Discord: `https://<api-origin>/api/auth/oauth/discord/callback`

Microsoft also needs `MICROSOFT_OAUTH_TENANT`. LinkedIn must have its OpenID Connect product enabled. Discord must grant the `identify` and `email` scopes and return a verified email address.

### Web

Set `VITE_API_URL=https://<api-origin>` at build time. It is public build configuration, not a secret. Do not put API, FlowPay, Brevo, database, or S3 credentials in the web service.

### Worker

Set `DATABASE_URL`, `REDIS_URL`, and the same `FLOWPAY_*` values as the API. The worker must be reachable by its hosting health checker at `/healthz`; it does not need public user traffic.

## Storage and Cloudflare

- The S3/R2 bucket accepts browser PUT requests only through short-lived presigned URLs. Its CORS policy must allow the web origin, `PUT`, and the `Content-Type` header.
- `S3_PUBLIC_BASE_URL` must be the public CDN/object URL that serves uploaded images. It must not be a signed administrative endpoint.
- Cache only public static assets and public object-storage images at the edge. Do not edge-cache `/api`, authentication, webhooks, finance, votes, or other authenticated data.
- Keep immutable cache headers for content-hashed `/assets/*`; keep HTML and public share routes revalidated so new releases and resource metadata are visible.

## Legal publication before launch

1. Sign in as the platform administrator.
2. Go to **Admin → Legal**.
3. Create reviewed draft versions for Terms of Service and Privacy Policy.
4. Preview/edit the drafts, then publish each one.
5. Confirm `/legal/terms` and `/legal/privacy` render the intended policy content.
6. Register a test account and confirm acceptance records exist. If a material revision is published, enable re-acceptance before publishing it.

## Monitoring

- Uptime monitor (API): `GET https://<api-origin>/api/readyz`.
- Uptime monitor (worker): `GET https://<worker-origin>/healthz`.
- Uptime monitor (web): `GET https://<web-origin>/`.
- Alert when API readiness reports database, Redis, or worker degradation; do not use a successful static-web response as API/worker evidence.

## Controlled deployment

1. Run migrations through the API release.
2. Deploy API and worker with identical database/Redis/FlowPay configuration.
3. Wait for API readiness and worker health.
4. Deploy the static web build using the matching API origin.
5. Run the post-deploy smoke tests in the readiness document, including one controlled payout and every enabled OAuth callback.
