# ROBLYNE Operational Setup Guide

## Service contract

ROBLYNE runs as three portable services: static web, API, and worker. They are not coupled to Render; any host that provides environment variables, HTTPS, a PostgreSQL database, and a Redis-compatible service can run them.

| Service | Required responsibilities |
| --- | --- |
| Web | Builds `artifacts/roblyne`, serves static files, sets `VITE_API_URL` to the public API origin. |
| API | Runs migrations, serves `/api`, owns sessions, OAuth callbacks, webhooks, presigned upload URLs, and readiness at `/api/readyz`. |
| Worker | Runs `artifacts/api-server/dist/worker.mjs`, has its own health server at `/healthz`, consumes BullMQ work, and records the payout-worker heartbeat. |

## Local development workflow

1. Install the exact Node version in `.node-version` (`22.12.0`) and ensure `node --version` reports it in every terminal. Vite 7 does not support Node 18.
2. Run `pnpm install --frozen-lockfile` from the repository root.
3. Start PostgreSQL and create the database named by `DATABASE_URL`; start Redis and set `REDIS_URL`. The dedicated worker cannot start without both.
4. Copy `.env.example` to `.env`, set only local values, then run `pnpm run migrate`.
5. In separate terminals, run:

   ```powershell
   pnpm --filter @workspace/api-server run dev
   pnpm --filter @workspace/evenum run dev
   pnpm --filter @workspace/api-server run build:worker
   pnpm --filter @workspace/api-server run start:worker
   ```

6. Set `LOCAL_API_ORIGIN=http://127.0.0.1:8080` (or the API's chosen `PORT`) so Vite proxies `/api` correctly. Check `http://127.0.0.1:8080/api/readyz`, `http://127.0.0.1:8091/healthz`, and `http://127.0.0.1:5173`.

Do not point a local browser at production services to compensate for missing local PostgreSQL or Redis: it invalidates local integration testing and can write real data.

## Required production environment

### Environment-variable ownership matrix

Set values only in the service listed below. A static-site variable is compiled into the web build and is therefore public; never place a secret there.

| Variable | Consumer / deployment target | Required | Purpose and notes |
| --- | --- | --- | --- |
| `VITE_API_URL` | **Web static service**, build time | Yes when web and API use different origins | Public API origin, e.g. `https://api.example.com`. A value change requires a new web build/deploy. This is the only browser-exposed integration variable. |
| `API_ORIGIN` or `LOCAL_API_ORIGIN` | Local Vite process only | Local development | Selects Vite's `/api` proxy target; use one, not both. Neither belongs in a production static build. |
| `WEB_PORT`, `BASE_PATH` | Local Vite process only | Optional | Override Vite's port (default `5173`) or base path. |
| `NODE_ENV` | API and worker | Yes in production | Set `production`. Controls production safeguards, cookies, FlowPay mode, and email behavior. |
| `PORT` | API and worker host runtime | Host-provided / local optional | API defaults to `8080`; worker uses `PORT` when supplied by its host. Do not set the same local port for both processes. |
| `WORKER_HEALTH_PORT` | Worker | Local optional | Worker health port when host `PORT` is absent; defaults to `8091`. |
| `DATABASE_URL` | API and worker | Yes | PostgreSQL connection. The API migration command uses this same value. Do not expose it to web. |
| `DATABASE_POOL_MAX`, `DATABASE_POOL_IDLE_TIMEOUT_MS`, `DATABASE_POOL_CONNECTION_TIMEOUT_MS` | API and worker | Optional | Database pool tuning; defaults are `5`, `30000`, and `8000`. Size for all API and worker replicas together. |
| `SESSION_SECRET` | API only | Yes in production | Strong random session-cookie signing secret. Never add to worker or web. |
| `CORS_ALLOWED_ORIGINS` | API only | Yes in production | Comma-separated browser origins only, without paths, e.g. `https://roblyne.com`. It must match the deployed web origin exactly. |
| `PUBLIC_WEB_URL` | **API and web static service**, build time on web | Yes in production | Canonical frontend origin for OAuth returns, share links, previews, and generated canonical URLs, sitemap entries, and static public-page metadata. A value change requires an API deploy and a new web build/deploy. |
| `PUBLIC_API_URL` | API only | Required when OAuth is enabled | Canonical API origin used to construct provider callback URLs. |
| `REDIS_URL` | API and worker | Required for worker; required in practice for production | BullMQ, worker heartbeat, distributed rate limits, and cache. API can start without it but production loses cross-instance safety; worker refuses to start. |
| `INSTANCE_ID` | API only | Optional | Stable maintenance-scheduler lock identity; generated if absent. |
| `LOG_LEVEL` | API and worker | Optional | Pino log level; defaults to `info`. |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL` | API only | All required in production | S3/R2 direct-upload configuration. `S3_PUBLIC_BASE_URL` is public; the access key and secret are server-only. |
| `S3_REGION`, `S3_FORCE_PATH_STYLE` | API only | Optional | Defaults are `auto` and `false`; use the R2-compatible values required by the endpoint. |
| `ROBLYNE_PAYMENT_MODE` | Local API / worker | Optional locally | `simulation` is the local default; use `flowpay` only for non-production integration testing. Production always uses FlowPay. |
| `FLOWPAY_API_BASE_URL`, `FLOWPAY_CLIENT_ID`, `FLOWPAY_PUBLIC_KEY`, `FLOWPAY_SECRET_KEY`, `FLOWPAY_WEBHOOK_SECRET` | API and worker | Yes in production | Current generic FlowPay configuration. Both services must use identical values. |
| `FLOWPAY_PROVIDER`, `FLOWPAY_TIMEOUT_MS` | API and worker | Optional | Provider defaults to `FAPSHI`; timeout is bounded and defaults to `15000` ms. |
| `FLOWPAY_ENVIRONMENT` | Local API / worker | Optional locally | Selects sandbox behavior outside production. Production always resolves to production credentials. |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | API only | Optional pair | Enables Google button only when both are present. `GOOGLE_OAUTH_CLIENT_ID` must be the bare client ID (`<number>-<hash>.apps.googleusercontent.com`) with no `https://` prefix or host; a prefixed value is passed to Google verbatim and fails with `401 invalid_client`. Use a **Web application** OAuth client and register the callback below as an authorized redirect URI. Callback: `https://<api-origin>/api/auth/oauth/google/callback`. |
| `MICROSOFT_OAUTH_CLIENT_ID`, `MICROSOFT_OAUTH_CLIENT_SECRET`, `MICROSOFT_OAUTH_TENANT` | API only | Optional set | All three enable Microsoft. Callback: `https://<api-origin>/api/auth/oauth/microsoft/callback`. |
| `LINKEDIN_OAUTH_CLIENT_ID`, `LINKEDIN_OAUTH_CLIENT_SECRET` | API only | Optional pair | Enables LinkedIn. The LinkedIn OpenID Connect product is also required. Callback: `https://<api-origin>/api/auth/oauth/linkedin/callback`. |
| `DISCORD_OAUTH_CLIENT_ID`, `DISCORD_OAUTH_CLIENT_SECRET` | API only | Optional pair | Enables Discord. Discord must return a verified email and grant `identify` and `email`. Callback: `https://<api-origin>/api/auth/oauth/discord/callback`. |
| `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` | API only | Required for production password-reset email | Enables real Brevo reset delivery only in production. |
| `BREVO_SENDER_NAME` | API only | Optional | Display name; defaults to `ROBLYNE`. |
| `LOCAL_EMAIL_OTP_DEBUG` | Local API only | Optional | Returns a reset code only outside production. It is rejected in production. |
| `PLATFORM_ADMIN_BOOTSTRAP_SECRET` | API only | Required only to create the first admin | One-time setup secret; retain securely until an administrator exists, then rotate/remove under the operator's change process. |
| `ROBYNE_SEED_TARGET`, `ROBYNE_SEED_SAMPLES` | Development seed command only | Optional | Both must be `development` and `1` to run the guarded sample-data script. They are rejected for production use. |

### Variables to remove, relocate, or not expect

- The frontend does **not** receive social-provider credentials or a social feature flag. It asks the API at `/api/auth/providers`; buttons appear only for providers whose API credentials are complete. q

- `PUBLIC_WEB_URL` must have the same canonical origin in the API and static-web build. It is public build configuration on the static service, not a secret.
- `FLOWPAY_CLIENT_SECRET` appears in an existing local `.env` but is not consumed by the current FlowPay code. Do not add it to new deployments.
- `FACEBOOK_OAUTH_CLIENT_ID` and `FACEBOOK_OAUTH_CLIENT_SECRET` remain in `.env.example` but Facebook OAuth has no implementation. Do not configure them.
- `EVENUM_PAYMENT_MODE` is a legacy fallback. Use `ROBLYNE_PAYMENT_MODE` for any new local configuration.
- Environment-prefixed FlowPay variables such as `FLOWPAY_SANDBOX_*` and `FLOWPAY_PRODUCTION_*` are accepted as fallbacks, but the generic `FLOWPAY_*` names above are the Render contract and must stay identical between API and worker.

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

### Static-web deployment verification

The deployed `roblyne-web` service must build the same commit that the API deploys. In Render, confirm all of the following before declaring a frontend release complete:

1. Service type is **Static Site**, branch is `main`, and automatic deploy is enabled (or manually deploy the commit intentionally).
2. Build command is `pnpm install --frozen-lockfile --prod=false && pnpm run build:render:web`.
3. Publish directory is `artifacts/roblyne/dist/public`.
4. Build-time `VITE_API_URL` is the canonical API origin.
5. After deployment, open `/login` and `/register` in a private window and check browser Network for `GET /api/auth/providers` and `GET /api/legal/requirements`.

If the API exposes a feature endpoint but the browser never requests it, inspect the JavaScript asset served by the static site and deploy the current web commit; changing API environment variables cannot update an old static bundle.

## SEO and search operations

### Indexing boundary

- **Indexable:** the homepage plus public, non-draft organization profiles, campaign participation pages, event registration pages, election voting pages, and candidate profiles returned by `GET /api/seo/public-pages`.
- **Excluded:** legal, authentication, password reset, dashboard, settings, admin, creation, development-payment, invite-only/private, missing, and failed-resource views. The static host applies `X-Robots-Tag: noindex, nofollow, noarchive` to fixed private routes, while the client keeps every route no-indexed until verified public resource data has loaded.
- **Not an SEO landing page:** election results remain no-indexed. They can still be shared and visited directly when the product permits it.

### Build dependency and release sequence

The static web build fetches the API's public-resource list and writes one HTML document per public page, plus `/sitemap.xml` and `/robots.txt`. This gives crawlers resource-specific titles, descriptions, canonical URLs, Open Graph tags, and truthful JSON-LD before JavaScript runs.

Because this is a static snapshot, publishing or changing public resource metadata requires a web deployment before that change can appear in the sitemap or initial HTML. Deploy in this order:

1. Deploy the API and wait for `GET /api/readyz`.
2. Confirm `GET https://<api-origin>/api/seo/public-pages` returns only the public pages expected for indexing.
3. Deploy the static web service with `PUBLIC_WEB_URL=https://<web-origin>` and `VITE_API_URL=https://<api-origin>`.
4. Verify a public resource directly in a non-authenticated browser: its HTML must contain its own canonical URL and title, not homepage metadata.
5. Verify `/sitemap.xml`, `/robots.txt`, `/login`, and `/dashboard` over HTTPS. The first two must be reachable; the private routes must return the `X-Robots-Tag` exclusion header after the host applies `render.yaml`.

Do not expose a resource in search merely by sharing a private or invite-only URL. Make it public intentionally, add a descriptive title and summary, and use a public HTTPS image when an image preview is desired.

### Search Console and ongoing checks

1. Add the production domain as a Google Search Console **Domain property** using its DNS verification record. If only a Render hostname exists, use a URL-prefix property for that exact HTTPS origin until a custom domain is available.
2. Submit `https://<web-origin>/sitemap.xml` once after a successful static deployment. Re-submit after material URL changes; ordinary content updates are discovered through the sitemap once the web build has been redeployed.
3. Weekly, review Indexing for excluded/error URLs, Performance for impressions/clicks/CTR and search queries, and Core Web Vitals for mobile regressions. Investigate a new canonical, crawl, or mobile issue before expanding indexed content.
4. Test representative public links with a raw HTTP request and a browser: title, description, canonical, `robots`, Open Graph image, and JSON-LD must describe that exact resource. A generic ROBLYNE fallback is correct only when the resource has no eligible public image.

The repository does not include a Search Console, analytics, or field Core Web Vitals credential. Those reports cannot be measured until the owner connects the property and grants the relevant access outside this repository.

### Worker

Set `DATABASE_URL`, `REDIS_URL`, and the same `FLOWPAY_*` values as the API. The worker must be reachable by its hosting health checker at `/healthz`; it does not need public user traffic.

## Storage and Cloudflare

- The S3/R2 bucket accepts browser PUT requests only through short-lived presigned URLs. Its CORS policy must allow the web origin, `PUT`, and the `Content-Type` header.
- `S3_PUBLIC_BASE_URL` must be the public CDN/object URL that serves uploaded images. It must not be a signed administrative endpoint.
- Cache only public static assets and public object-storage images at the edge. Do not edge-cache `/api`, authentication, webhooks, finance, votes, or other authenticated data.
- Keep immutable cache headers for content-hashed `/assets/*`; keep HTML and public share routes revalidated so new releases and resource metadata are visible.

## Legal publication before launch

1. On API startup, ROBLYNE creates and publishes its built-in initial Terms of Service and Privacy Policy only when the database has no usable published document for that document type **and language**. Documents are stored per language (`en`, `fr`); seeding occurs after database migration and needs no manual seed command.
2. The initial documents cover accounts, organizations, elections, events, campaigns, payments, withdrawals, privacy, third-party services, suspension and user rights. They are operational defaults, **not legal advice or a claim of legal review**.
3. Before launch, have qualified legal counsel confirm or replace the operator identity, support/privacy contact, governing law, dispute forum, lawful bases, retention periods and jurisdiction-specific disclosures.
4. Sign in as the platform administrator, go to **Admin → Legal**, and create a reviewed new draft for each replacement. Choose the document language (EN or FR) when creating a document; the language is fixed for the life of that document. Publishing archives the prior version of the same type and language; it never edits or overwrites a previously accepted version.
5. Confirm `/legal/terms` and `/legal/privacy` render the intended published content in the selected interface language (English UI shows the English document, French UI shows the French document). When the reader's language has no published version, the other language is shown with a clearly identified fallback notice — never an empty page or a mislabeled language. A customized published document takes precedence over the built-in default and is not replaced by startup seeding.
6. Register a password account and a new social-login account in each language. Both flows must display current documents, require acceptance before account creation, and record document type, version and acceptance timestamp. If a material revision is published, enable re-acceptance before publishing it.

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
