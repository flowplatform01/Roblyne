# ROBLYNE Upload System Audit

## Architecture

All identified image contexts use `ImageUpload`: organization logo/cover/hero, user profile, event cover/branding, election branding/candidates, and campaign cover/branding. The component validates/prepares a local image, requests `POST /api/uploads/presign`, then issues a direct signed `PUT` to S3-compatible storage. The caller saves the returned public URL in its own resource mutation.

## Limits and controls

- Allowed MIME types: PNG, JPEG, GIF, WebP.
- Maximum uploaded object: 2 MiB; larger non-GIF inputs are locally optimized, with a 25 MiB source ceiling.
- Presigning requires an authenticated session; object keys are random UUIDs under `images/YYYY-MM-DD/`.
- Resource ownership is enforced by the subsequent organization/event/election/campaign mutation, not by the generic presign route.

## Confirmed execution

| Stage | Result |
| --- | --- |
| Local registration/session | HTTP 201 |
| API presign | HTTP 200 |
| Real configured signed PUT | HTTP 200 |
| Organization URL update | HTTP 200 |
| Readback after update | HTTP 200; URL persisted |
| Public object read | HTTP 200; `image/png` |
| R2 browser preflight from deployed frontend origin | **HTTP 403** |

## Root causes and fixes

1. **Component self-abort (fixed in source):** the preview-dependent effect cleanup aborted the active controller after `setPreviewUrl`. The component now performs abort cleanup only on unmount and explicitly clears preview references.
2. **R2 CORS (operator action required):** the storage provider must allow the deployed static-site origin to preflight and `PUT` `Content-Type`. This cannot be corrected in application code.

## Required R2 CORS policy

Configure bucket CORS with the exact deployed origin; keep only origins you actually use:

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

After saving, rerun a signed `OPTIONS` check and require a non-403 response with `Access-Control-Allow-Origin: https://roblyne.onrender.com` before testing in the deployed browser. Add a future custom frontend domain to `AllowedOrigins` before switching domains.

## Still required

- Authenticated production browser upload/save/reload/replacement after CORS correction and deployment.
- Production checks for every caller despite their shared component.
- Failure, privacy, and cross-organization verification against a real deployed account.
