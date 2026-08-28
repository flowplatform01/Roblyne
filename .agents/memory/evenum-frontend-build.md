---
name: Evenum frontend build
description: Environment values required when running the Evenum Vite production build outside its managed workflow.
---

The Evenum frontend build requires both `PORT` and `BASE_PATH` to be present; the root-mounted artifact uses `BASE_PATH=/`.

**Why:** The Vite configuration intentionally fails fast when either value is missing, while the managed workflow supplies them automatically.

**How to apply:** For standalone verification, provide the workflow-equivalent port and the artifact’s configured base path without changing the project configuration.