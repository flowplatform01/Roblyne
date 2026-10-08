---
name: Evenum fee estimates
description: Keep organizer net-revenue estimates aligned with configurable pillar commissions
---

Organizer-facing estimates must use the effective commission rate for the relevant pillar. Do not assume a fixed 5% fee; if the rate cannot be loaded, omit the numeric estimate. Payment processing remains authoritative and recalculates the commission server-side.

**Why:** Platform administrators can change rates by pillar, so a hardcoded estimate can mislead organizers even while settlement records the correct amount.

**How to apply:** Use the public commission-rate response only for estimates and display it as approximate. Continue using the commission engine for every financial transaction.
