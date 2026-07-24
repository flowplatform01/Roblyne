---
name: Evenum sharing & OG metadata
description: Rich link preview system, usePageMeta hook, ShareButton, and Vite OG middleware plugin
---

## Architecture

### Bot-detection OG middleware (Vite plugin)
File: `artifacts/evenum/plugins/og-prerender.ts`

- Runs as `configureServer` middleware in the Vite dev server
- Detects crawler bots via User-Agent (WhatsApp, Telegram, Facebook, Slack, Discord, etc.)
- For bot requests on known public routes → fetches entity data from the API server at `http://localhost:8080/api/...`
- Returns server-rendered HTML with full OG + Twitter Card meta; regular users get the SPA
- **Critical**: Uses HTTP calls to the API server — NOT direct DB import. The `@workspace/db` package exports raw TypeScript source (not compiled JS), so it cannot be imported in the Vite Node.js context. Always use `http://localhost:8080/api/...` for server-to-server calls.
- Registered in `vite.config.ts` as the first plugin so it runs before Vite's own middleware

### Routes covered by OG middleware
- `/elections/:id`, `/elections/:id/vote`, `/elections/:id/results`
- `/events/:id`, `/events/:id/register`
- `/campaigns/:id`, `/campaigns/:id/participate`
- `/candidates/:electionId/:candidateId`
- `/organizations/:id/public`

### `usePageMeta` hook
File: `artifacts/evenum/src/hooks/usePageMeta.ts`

- Centralized client-side meta tag management
- Sets `document.title`, `og:*`, `twitter:*`, canonical link
- Resets to default Evenum meta on component unmount
- Used in all public pages: ElectionVote, ElectionResults, EventRegister, CampaignParticipate, CandidateProfile, OrganizationPublic
- Accepts `null` to skip (useful when data is still loading)

### `ShareButton` component
File: `artifacts/evenum/src/components/branding/ShareButton.tsx`

- On mobile: triggers native OS share sheet (`navigator.share`)
- On desktop: shows a popover with WhatsApp, Telegram, Copy Link options
- Props: `url`, `title`, `description`, `ctaLabel` (default "Share"), `variant` ("button" | "icon")
- Used in ElectionDetail, EventDetail, CampaignDetail, CandidateProfile, OrganizationPublic

## Key constraint
`@workspace/db` package.json exports `./src/index.ts` (TypeScript source), not compiled JS.
Never try to import it in a Vite plugin or any other Node.js context — it will fail silently.
Use the REST API at `http://localhost:8080/api/...` for any server-side data fetching.

## API server port
Always port 8080 (defined in `artifacts/api-server/.replit-artifact/artifact.toml`).
