# ROBLYNE Cloudflare R2, CDN, and Cache Guide

This guide separates the three things that are easy to confuse:

| Part | What it does | ROBLYNE value |
| --- | --- | --- |
| R2 bucket | Stores uploaded image files. | `roblyne-images-prod` |
| R2 public URL | Makes those stored files readable over HTTPS. | Temporary: the bucket's `r2.dev` URL. |
| CDN custom domain | Gives those same R2 files a stable, branded, Cloudflare-cached hostname. | Recommended: `images.<your-domain>` |

R2 is the storage. The CDN custom domain is the public door to that storage. There is no second image server to create and no Render service for images.

## What to use today

If ROBLYNE has no domain in Cloudflare yet, keep the current R2 development URL as `S3_PUBLIC_BASE_URL`. It is sufficient for uploads and image display. Do **not** create Cloudflare Cache Rules for the `r2.dev` hostname: it is not your zone and cannot be managed as your custom domain.

When you buy or connect a domain, replace only `S3_PUBLIC_BASE_URL` with the R2 custom domain. Existing image object keys stay the same, so previously stored images continue to use their saved URLs; configure the custom domain before the main launch whenever possible.

## One-time R2 bucket setup

1. In Cloudflare, open **R2 Object Storage → `roblyne-images-prod` → Settings**.
2. Keep the bucket private for S3 write access. ROBLYNE writes through short-lived presigned `PUT` URLs; never put S3 access keys in the frontend.
3. Under **Public access**, enable the public development URL only while no custom domain is available. Copy it without a trailing slash.
4. In Render, set API service `S3_PUBLIC_BASE_URL` to that URL. It is public, not a secret.
5. Keep these API-only variables unchanged: `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION=auto`, and `S3_FORCE_PATH_STYLE=false` unless your endpoint explicitly requires otherwise.

## R2 CORS: needed for browser uploads

In **R2 → `roblyne-images-prod` → Settings → CORS Policy**, save this policy. `https://roblyne.com` is the current production web origin. Keep `https://roblyne.onrender.com` only while that Render URL remains an active, supported frontend; remove it after redirecting or retiring it. Add `http://localhost:5173` only while developing locally; do not leave wildcard origins in production.

```json
[
  {
    "AllowedOrigins": [
      "https://roblyne.com",
      "https://roblyne.onrender.com"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

This permits a browser to upload an image to a URL already signed by ROBLYNE. It does not make bucket writing public. As verified on 3 November 2026, `https://media.roblyne.com` accepted this preflight from `https://roblyne.onrender.com` but rejected `https://roblyne.com`; saving the policy above fixes that exact production upload blocker.

## Recommended production image CDN (when you have a domain)

1. Add your domain to Cloudflare and ensure its nameservers are active there.
2. In **R2 → `roblyne-images-prod` → Settings → Custom Domains**, choose **Connect Domain**.
3. Enter a dedicated image hostname, for example `images.example.com`; do not reuse the API hostname.
4. Let Cloudflare create and proxy the DNS record. Wait until the custom domain status is **Active**.
5. Open `https://images.example.com/` followed by the key of a known image to confirm HTTPS access.
6. Change **only the API service** variable `S3_PUBLIC_BASE_URL` to `https://images.example.com`, then redeploy the API.
7. Upload one new profile or campaign image and verify its URL begins with `https://images.example.com/images/`.

ROBLYNE writes each upload to a unique UUID object key and sets `Cache-Control: public, max-age=31536000, immutable`. That is safe because an uploaded object is never overwritten. Cloudflare can cache these image URLs aggressively.

## Cache Rules: exact safe rules

Cache Rules affect a hostname in a Cloudflare-managed zone. Configure them only after the corresponding hostname is proxied through Cloudflare.

### Rule 1: bypass API caching (required if the API is proxied)

In **Rules → Cache Rules → Create rule**:

- **Name:** `ROBLYNE API - bypass dynamic cache`
- **When incoming requests match:** `Hostname equals api.example.com`
- **Then:** Cache eligibility → **Bypass cache**

Replace `api.example.com` with your API hostname. This prevents caching authentication, votes, finance, webhooks, presigned uploads, and every other API response. Do not create a “cache everything” rule for the API.

### Rule 2: cache images (optional; custom image domain only)

The image response already carries a one-year immutable header, so a separate cache rule is optional. If you want an explicit edge rule:

- **Name:** `ROBLYNE images - honor immutable objects`
- **When incoming requests match:** `Hostname equals images.example.com`
- **Then:** Cache eligibility → **Eligible for cache**
- **Edge TTL:** **Respect existing headers**
- **Browser TTL:** **Respect existing headers**

### Rule 3: frontend only when it is moved behind Cloudflare (optional)

If the static frontend remains on `roblyne.onrender.com`, Render already serves the configured cache headers. When a custom frontend hostname is later proxied through Cloudflare:

- Bypass caching for `index.html`, `/sw.js`, `/manifest.webmanifest`, and public page routes such as `/campaigns/*`, `/events/*`, `/elections/*`, `/candidates/*`, and `/organizations/*`.
- Let `/assets/*` respect its existing immutable cache header.

HTML and public share pages can change on a deployment and contain resource-specific social-preview metadata. Caching them for a year would create stale pages and stale previews.

## What never belongs in Cache Rules

Never cache: `api.example.com`, `/api/*`, OAuth callback URLs, FlowPay webhooks, vote requests, financial routes, session/authentication routes, or the Render worker health service. Caching these can expose one user's response to another or break payment and login flows.

## Verify after each change

1. Open an old and a newly uploaded image in a private browser window; both should render.
2. Inspect a new image response. It must have the right `Content-Type` and `Cache-Control: public, max-age=31536000, immutable`.
3. Upload a JPEG, PNG, and WebP from the production web origin. A failed preflight means the R2 CORS origin does not exactly match the frontend URL.
4. Open `https://<api-origin>/api/readyz`; it must remain healthy.
5. Log in and open finance once. Cache rules must not affect these API-backed flows.

## Do not expose

Never paste `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, database URLs, FlowPay secrets, or session secrets into Cloudflare Pages, browser code, screenshots, or documentation. Rotate any secret that has been shown in a screenshot or chat.
