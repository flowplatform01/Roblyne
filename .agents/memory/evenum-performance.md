---
name: Evenum list and discovery performance
description: Public list payloads and concurrent discovery cache misses
---

Public list and discovery endpoints may include remote image URLs, but embedded `data:` media must be removed before serialization. Full media remains available on detail endpoints for page views and editing.

**Why:** Image uploads are currently stored as data URLs. Repeating one large organization logo or event cover in a list response can turn a few-kilobyte request into multiple megabytes and make the whole app feel stalled.

**How to apply:** When adding or changing a list/discovery response, run a payload-size check with seeded data, compact embedded media, and bump any response-cache key when the response shape or size behavior changes.

### Concurrent discovery cache misses
- When identical discovery queries arrive together during a cold cache miss, coalesce only the active database load by normalized query options, then clear the in-flight entry after resolve or reject. Keep the shared response cache as the only result cache.

**Why:** A shared-cache miss can otherwise make every concurrent visitor repeat the same expensive aggregate reads.

**How to apply:** Preserve the complete query variant in the coalescing key and ensure failed loads remove their in-flight entry so later requests can retry.