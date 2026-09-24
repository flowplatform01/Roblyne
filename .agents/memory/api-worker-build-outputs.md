---
name: API worker build outputs
description: Non-obvious esbuild behavior when the API gains a separate worker entrypoint
---

The API build must use an output directory rather than a single output file.

**Why:** The Pino esbuild plugin adds its own worker entrypoints. Even when the application has one source entrypoint, esbuild sees multiple inputs and rejects `outfile`; using `outdir` preserves the API and worker helper outputs.

**How to apply:** Keep the API and BullMQ worker builds as separate commands that select their source entrypoint, but always emit into the shared API `dist` directory.