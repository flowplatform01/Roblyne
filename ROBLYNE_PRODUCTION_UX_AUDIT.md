# ROBLYNE Production UX Audit

Audit date: 2026-10-29

## Scope and findings

### Image uploads

- The API correctly issues short-lived S3-compatible PUT URLs only to authenticated users and validates MIME type plus the 2 MB request size before signing.
- The previous browser flow rejected every file above 2 MB, despite the upload surface inviting normal phone-camera images. It also gave no preparation state.
- Direct presigned browser uploads require a bucket CORS policy. This was missing from the deployment guidance, so a valid API presign could still fail in the browser before a request reached R2.
- The client now retains small files unchanged, preserves PNG transparency, preserves decoded EXIF orientation where the browser supports `createImageBitmap`, caps source files at 25 MB, and uses bounded quality/resize attempts for JPEG, WebP, and PNG. It intentionally rejects oversized GIFs rather than flattening or silently destroying animation.
- Not performed: a signed production R2 write. This requires a browser session and the real bucket CORS policy. Follow the verification document after deployment; do not treat local type checking as provider evidence.

### Election privacy and invitations

- Private election routes returned `404` to non-members by design, but the vote page converted a missing election into an empty page. That was the observed blank-screen failure.
- Invite-only elections also blocked their own shared links because election, position, and candidate reads required organization membership even when the voter supplied the correct code during ballot submission.
- A valid invite code now grants read access only to its active/non-draft invite-only election. It never opens `private` elections and is not returned to invitees by the API.
- Organizer sharing now copies a complete invite URL. The vote page accepts that URL, prefills the code for ballot submission, and shows a neutral access screen rather than a blank page for invalid, expired, private, or missing-code access.
- Invite codes are reusable ballot access codes, not admin credentials. Organizers should distribute them only to intended voters and create a new election if a code must be invalidated; code rotation is not yet available.

### Onboarding and frontend delivery

- Registration now creates the user and a primary workspace in one database transaction. A failed workspace creation rolls back the account creation, avoiding an account with no usable workspace. Existing users and multiple-workspace creation remain unchanged.
- The Vite PWA setup uses `autoUpdate`, clears outdated caches, and applies a five-minute bounded `NetworkFirst` API cache. No broad cache-policy change was made because authenticated responses must remain fresh.
- The worker/queue architecture was not changed by this UX phase. Upload preparation is browser-side and does not consume queue capacity.

## Residual production risks

- A custom domain shared by frontend and API is still required before broad account use; Render subdomains cannot be treated as reliable first-party session-cookie hosts.
- `r2.dev` is temporary and rate-limited. Use a custom R2 domain when a production domain is available.
- Run migrations from a single controlled release path before horizontally scaling API instances.
- Browser/device image decoding varies. The upload component returns a clear error when a browser cannot decode or reduce an image.
