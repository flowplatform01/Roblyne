---
name: Evenum payment status access and retained history
description: Security and retention rules for anonymous payment polling and organization deletion.
---

Public payment-status polling must require an unguessable per-payment capability token and return only the minimum result needed by the payer. Hard deletion of an organization with financial or participant activity must be rejected rather than cascading away that history.

**Why:** Payment identifiers can be enumerated, and an unauthenticated status response can expose attendee or contributor data. Organization foreign-key cascades can also erase financial ledgers, settlements, and submitted participation records.

**How to apply:** Preserve these protections in any new payment callback or status route and in any organization deletion or archival flow; add regression coverage when those paths change.
