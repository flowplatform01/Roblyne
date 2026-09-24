---
name: Evenum S3-compatible image storage
description: Production uploads use provider-neutral S3 presigned URLs, including Cloudflare R2
---

New image uploads go directly from the authenticated browser to an S3-compatible bucket with a short-lived presigned PUT URL. PostgreSQL stores the resulting public/custom-domain URL; legacy data URLs remain readable during migration.

**Why:** Storing image bytes in PostgreSQL duplicated megabytes across list responses and made the database responsible for media delivery.

**How to apply:** Production requires S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_PUBLIC_BASE_URL. Configure bucket CORS for the app origin and PUT requests with Content-Type.