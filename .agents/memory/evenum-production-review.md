---
name: Evenum Production Review
description: Key decisions and lessons from the production readiness pass on Evenum
---

## Architecture
- React+Vite frontend (`artifacts/evenum`) + Express API (`artifacts/api-server`) in pnpm monorepo
- Drizzle ORM + PostgreSQL, session auth, Zod validation
- Orval-generated React Query hooks from OpenAPI spec in `lib/api-client-react/src/generated/api.ts`

## Key Decisions Made

### Design Subagent + Main Agent Split
When both agents work on the same file, the design subagent adds duplicate declarations (schemas, form instances, handler functions, dialogs). Always grep for duplicates after a design subagent run on any file it touched.

**Why:** The design subagent reads the file as it was at dispatch time, applies its changes, and the main agent's concurrent edits create collisions.

**How to apply:** After any design subagent run that touches existing files (not just new ones), grep for duplicate `const` declarations in modified files: `grep -n "const candidateForm\|const handleCreate" file.tsx`.

### Terminology
"Engines" was the internal name for the three product modules (voting, events, campaigns). It was removed from all user-facing copy. The i18n key `sidebar.engines` now maps to "Activities" (EN) / "Outils" (FR). Dashboard copy changed to "workspaces and activities".

### Trust Proxy Fix
Added `app.set("trust proxy", 1)` to `artifacts/api-server/src/app.ts` before the rate limiter middleware to fix `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` errors in production-proxied environments.

### Search
`useSearch` hook exists in the generated client. Call pattern: `useSearch({ q: string }, { query: { enabled: !!q } })`. The home page search uses a 350ms debounce via `useCallback`+`setTimeout`.

### Candidate Management
Full CRUD for candidates is wired in `ElectionDetail.tsx`. Hooks: `useCreateCandidate`, `useDeleteCandidate`, `getListCandidatesQueryKey`. Dialog opens per-position via `openCandidateDialog(positionId)`. Delete uses AlertDialog for confirmation.

### Submission Data Viewer
`CampaignDetail.tsx` now has a `viewingSubmission` state that opens a Dialog showing all form field key-value pairs from `submission.data` (JSON object).

### Settings Page
Created at `artifacts/evenum/src/pages/Settings.tsx` with tabs: Profile, Security, Notifications, Language. Routed at `/settings`. Linked from Navbar dropdown and AppSidebar.

### Image Upload Component
Created `artifacts/evenum/src/components/ui/image-upload.tsx` — converts File to base64 data URL (no object storage needed). Used in `CreateOrganization.tsx`.

## Files That Were Collision-Prone
- `ElectionDetail.tsx` — had 3 duplicate declarations after design subagent: candidateSchema, candidateForm, handleCreateCandidate, and a second Dialog block. All removed.
- `Home.tsx` — design subagent left unclosed `<div className="flex-1">` and missing `)}` for the conditional section. Both fixed.
