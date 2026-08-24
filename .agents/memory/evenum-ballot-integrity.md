---
name: Evenum ballot integrity
description: Server-side invariants required to keep crafted or stale vote submissions valid
---

Vote submission must validate the complete ballot against the election's current positions and candidates at the API boundary. UI selection rules are only a convenience and cannot protect against crafted requests or stale clients.

**Why:** Voting is a high-risk business operation, and invalid position/candidate relationships or bypassed selection limits would corrupt results even when the normal interface behaves correctly.

**How to apply:** Before writing vote selections, verify positions belong to the election, candidates belong to both the election and submitted position, positions are not duplicated, candidate IDs are unique per position, and each position's maxSelections is respected.