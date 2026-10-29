# ROBLYNE Production UX Verification

Audit date: 2026-10-29

## Automated evidence

- `pnpm run typecheck` passed for libraries, API, frontend, sandbox, and scripts.
- `pnpm run test:api` passed: 30 tests, including the new invite-only read-access boundary test.
- `pnpm run build:render:api` and `pnpm run build:render:web` passed. The frontend generated its PWA service worker successfully.
- The check was run locally on Node `18.17.1`; the repository requires Node `>=20.19.0`. Render uses Node `22.12.0`, which remains the required deployment runtime.
- Static analysis covers the new image-preparation helper, invite resource loader, access guard, and transactional onboarding changes.
- The final combined artifact verifier was not rerun after the API build replaced the worker artifact. Before committing/deploying, run `pnpm run build:render:worker && pnpm run verify:render:artifacts` on Node 20.19+ or allow Render to build each service independently. This is an artifact-presence check, not a source-code failure.

## Required deployment checks

### R2 upload matrix

1. In a signed-in production browser, upload a JPEG below 2 MB and confirm its public URL renders after saving the entity.
2. Upload a 2–10 MB JPEG or WebP and confirm the UI shows preparation, completes below 2 MB, and renders correctly.
3. Upload a transparent PNG above 2 MB and confirm transparency remains after saving.
4. Upload an animated GIF above 2 MB and confirm the UI rejects it with an explanation; upload a small animated GIF and confirm it is unchanged.
5. In DevTools, confirm the presign request goes to the API and the PUT goes directly to R2. A CORS failure means the bucket CORS policy does not include the exact frontend origin or `Content-Type` header.
6. Confirm no `S3_*` key is present in static-site environment variables, client bundles, or browser network payloads.

### Election access matrix

1. Create an active public election; its plain vote URL must load for a signed-out user.
2. Create an active private election; the owner can load it, while a signed-out user sees the neutral access page and cannot cast a ballot.
3. Create an active invite-only election; copy the organizer's **Copy Voting Link** result and open it in a signed-out/private browser window. The ballot, positions, and candidates must load and the invite input must be prefilled.
4. Replace the `invite` query value with a wrong code. The same neutral access page must appear with no election details leaked.
5. Submit an invite-only ballot with the valid code, then with a wrong code. Only the valid code may proceed.
6. Verify a draft invite-only election cannot be opened with its code.

### Onboarding and PWA

1. Register a new account. The dashboard must show one workspace named after the account holder without requiring a separate setup step.
2. Create a second workspace and confirm both remain accessible.
3. Open the app, deploy a new frontend build, then reload. Confirm the PWA updates and protected API responses are not shown stale after more than five minutes offline/cache age.

## Sign-off rule

Do not mark image uploads or invitations production-verified until the corresponding browser checks above pass against the deployed API, frontend, and R2 bucket.
