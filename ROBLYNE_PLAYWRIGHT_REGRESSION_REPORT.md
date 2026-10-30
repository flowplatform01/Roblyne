# ROBLYNE Playwright Regression Report

## Executed

- `tests/e2e/upload-settings.spec.ts`: 2 passed.
  - Image selection → presign → storage PUT → organization save → reload persistence.
  - Storage PUT failure clears loading state and a subsequent upload can succeed.
- `tests/e2e/finance-withdrawal.spec.ts`: 2 passed.
  - Rejected withdrawal shows failure and no success notification.
  - Successful settlement request is sent exactly once and shown as pending.

## Limitations

These browser tests use the real application UI but controlled API/storage responses. They prove the repaired client lifecycle and feedback behavior; they do **not** prove Cloudflare R2 browser CORS or production deployment behavior. The real configured-storage integration is separately recorded in `ROBLYNE_UPLOAD_SYSTEM_AUDIT.md`.
