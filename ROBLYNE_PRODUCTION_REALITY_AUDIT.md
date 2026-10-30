# ROBLYNE Production Reality Audit

Assessment date: 2026-10-30

## Evidence levels

- **Deployed public check:** `https://roblyne.onrender.com` and the API actually embedded in its public bundle (`https://roblynebnapi01.onrender.com`) are reachable. API `/api/readyz` reported database, Redis, queue, and worker healthy.
- **Real configured integration:** a disposable local account completed API presign, real configured object-storage PUT, organization update, persisted readback, and public image read.
- **Automated browser:** local Vite browser tests exercised file selection, presign, PUT, setting save/reload, upload failure recovery, and withdrawal UI states with controlled responses.
- **Not performed:** authenticated production browser, production organization mutation, production provider payout, or production database/log inspection.

## Initial findings

| Area | Observed symptom | Confirmed root cause | Evidence | Severity | Next action |
| --- | --- | --- | --- | --- | --- |
| Browser image upload | Reported indefinite upload | Shared component aborted its current upload whenever its preview state changed, then retained the spinner for the aborted request | Lifecycle inspection and new browser regression | Critical | Deploy shared component fix |
| Production storage upload | Production browser upload cannot complete | Configured R2 bucket rejects preflight from `https://roblyne.onrender.com` with HTTP 403 | Real signed URL `OPTIONS` check | Critical | Apply exact R2 CORS policy and recheck |
| Organization settings | Reported `Updating…` | Upload failure could leave the parent settings operation waiting for a URL that never arrived; the settings PATCH itself persists correctly in controlled/local integration | Browser save/reload plus real API/DB update | High | Deploy upload fix; verify authenticated production save |
| Election journey | Reported unexpected error | Unknown; no exact route, account, or production log was available | Source and existing browser invite coverage only | High | Reproduce with route/request ID after deployment |
| Finance withdrawal | Reported unexpected error | Unknown in production; local API workflow is functioning as a **settlement request**, not a provider transfer | Disposable local DB transaction and browser regression | Launch blocker until production reproduction/verification |

## Fixed source defect

`ImageUpload` now only aborts when unmounted, not when the preview state changes. It keeps a separate preview reference for object-URL cleanup. This removes the self-abort that caused the upload transfer to be cancelled and the loading state to remain active.

## Launch decision

**BLOCKED.** Do not describe uploads or withdrawals as production-verified. Apply the R2 CORS correction, deploy this commit, then execute the authenticated production matrix in `ROBLYNE_CRITICAL_WORKFLOW_VERIFICATION.md`.
