---
name: Workspace Zod peer alignment
description: Resolve form type errors caused by different Zod versions in a pnpm workspace.
---

When form schemas and `@hookform/resolvers` resolve different Zod major versions, the resulting type errors can affect many unrelated forms. Verify the versions selected by the workspace and align the consuming app's Zod dependency before adding casts or rewriting schemas.

**Why:** The resolver's declarations can bind to a workspace-level Zod peer while the app imports another Zod major, causing widespread resolver incompatibilities even when the production bundle still builds.

**How to apply:** Inspect the lockfile and the actual resolved package paths, align the app-level Zod version with the resolver, then run the workspace type check and the frontend production build.
