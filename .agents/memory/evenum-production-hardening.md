---
name: Evenum production hardening
description: Full audit and polish applied across terminology, hidden UI, i18n, results discovery, BASE_URL fixes, and PWA setup
---

## Completed hardening areas

### Terminology cleanup
- `OrganizationWorkspace.tsx`: "Latest items across your engines" → "Latest activity across your workspace"
- `AdminDashboard.tsx`: "System Operational" → "All systems operational"
- FR locale `sidebar.engines`: "Outils" → "Activités"

### Hidden / inaccessible UI
- `ElectionDetail.tsx`: Candidate delete button was `opacity-0 group-hover:opacity-100` — changed to always-visible `text-muted-foreground/50 hover:text-destructive` for mobile safety

### BASE_URL fix
- `ElectionVote.tsx`: Platform-settings fetch used bare `/api/admin/platform-settings/public` — fixed to prepend `import.meta.env.BASE_URL` (strips trailing slash first)

### Results discovery
- `ElectionVote.tsx`: Added subtle "View current standings →" link (with BarChart2 icon) on the landing step when `election.status === 'active' && hasLiveData`. Had to add `BarChart2` to lucide imports.

### i18n completeness
- Both locales: added `sidebar.settings` key
- FR locale: fixed `addingCandidatesComingSoon` (was still "coming soon" phrasing), added full candidate form translations (`addCandidateTitle`, `candidateName`, `candidateBio`, etc.) — these were missing from fr.json entirely
- `AppSidebar.tsx`: "Settings" footer link now uses `t('sidebar.settings')`

### PWA setup
- Installed `vite-plugin-pwa` as devDependency in evenum
- `vite.config.ts`: Added VitePWA plugin with `registerType: 'autoUpdate'`, `generateSW`, NetworkFirst runtime caching for `/api/`, `devOptions.enabled: false`
- Manifest configured with `start_url` and `scope` using `basePath`, icon paths prefixed with `basePath`
- Icons generated from `favicon.svg` via ImageMagick `convert` → `public/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`
- `index.html`: Added `<link rel="manifest">`, `<link rel="apple-touch-icon">`, `<meta name="theme-color">`, Apple PWA meta tags

**Why:** Dynamic `basePath` env means all PWA manifest paths must be prefixed at config time, not hardcoded as root-relative.

### N+1 / session persistence
- Documented in separate topic files (evenum-session-persistence.md, evenum-production-hardening.md)
