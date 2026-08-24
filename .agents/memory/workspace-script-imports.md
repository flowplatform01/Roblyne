---
name: Workspace script imports
description: TypeScript scripts must consume shared workspace libraries through package exports.
---

Utility scripts should import shared libraries through their `@workspace/*` package exports and declare those workspace packages as dependencies, rather than importing source files by relative path.

**Why:** Relative source imports pull files outside the script project root and can make the canonical workspace typecheck fail with TS6059.

**How to apply:** When adding or repairing scripts, use the package export (for example, `@workspace/db/schema`) and keep the workspace dependency and lockfile synchronized.