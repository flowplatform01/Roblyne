---
name: API worker build outputs
description: Non-obvious esbuild behavior when the API gains a separate worker entrypoint
---

The API build must use an output directory rather than a single output file.

**Why:** The Pino esbuild plugin adds its own worker entrypoints. Even when the application has one source entrypoint, esbuild sees multiple inputs and rejects `outfile`; using `outdir` preserves the API and worker helper outputs.

**How to apply:** Keep the API and BullMQ worker builds as separate commands that select their source entrypoint, but always emit into the shared API `dist` directory.

Each build command currently cleans the shared `dist` directory before emitting its selected entrypoint. When both processes need to run locally, build the API first and the worker second; restarting either from a clean build may require rebuilding the other entrypoint.