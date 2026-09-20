---
name: Evenum route middleware scope
description: Router-level authorization middleware must be scoped when routers are mounted alongside public routes.
---

Authorization middleware on a sub-router should be mounted with the route prefix it protects, not globally, when that router is composed with other routers at the same API level.

**Why:** An unscoped admin guard intercepted unrelated payment and public endpoints registered later in the composed router, preventing provider webhooks from reaching signature validation.

**How to apply:** When adding or reviewing router-level guards, verify the router’s mount path and use an explicit prefix such as `/admin`; then test both a protected admin route and an unrelated public route.