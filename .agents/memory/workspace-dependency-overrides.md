---
name: Workspace dependency overrides
description: Where to add dependency security pins without losing repository-wide pnpm safeguards
---

Dependency overrides belong in `pnpm-workspace.yaml`, alongside the existing platform-specific and build-tool overrides.

**Why:** Putting a `pnpm` override block in the root package manifest makes pnpm regenerate the lockfile without the workspace’s existing platform exclusions and build-tool pins, producing broad unrelated lockfile churn.

**How to apply:** Add narrowly scoped patched transitive versions to the workspace override map, regenerate the lockfile, and confirm the diff changes only the intended packages.