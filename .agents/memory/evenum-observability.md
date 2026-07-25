---
name: Evenum observability
description: Provider-neutral client and server diagnostics for tracing production failures
---

Client failures are reported best-effort to the API with the current route, bounded message/stack context, and a request correlation ID; reporting must never interrupt the user's flow.

**Why:** Production issues can originate in lazy routes, browser APIs, PWAs, or asynchronous work, and browser-console-only errors are difficult to reproduce or correlate with server logs.

**How to apply:** Keep diagnostics provider-agnostic and redact-sensitive by default. Preserve request IDs in API responses and logs so support can trace a client report through the server.