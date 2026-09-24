---
name: Evenum list payload performance
description: Public list responses must not repeat embedded data-URL media across cards
---

Public list and discovery endpoints may include remote image URLs, but embedded `data:` media must be removed before serialization. Full media remains available on detail endpoints for page views and editing.

**Why:** Image uploads are currently stored as data URLs. Repeating one large organization logo or event cover in a list response can turn a few-kilobyte request into multiple megabytes and make the whole app feel stalled.

**How to apply:** When adding or changing a list/discovery response, run a payload-size check with seeded data, compact embedded media, and bump any response-cache key when the response shape or size behavior changes.