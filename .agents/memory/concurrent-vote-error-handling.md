---
name: Concurrent vote error handling
description: Database error-shape constraint for duplicate vote races
---

When a concurrent vote loses a database unique-index race, treat PostgreSQL `23505` as a normal duplicate-vote outcome even when the ORM wraps the original error under one or more `cause` properties.

**Why:** A live race showed that checking only the top-level error code converted valid duplicate submissions into HTTP 500 responses, despite the unique index correctly preventing duplicate rows.

**How to apply:** Keep the unique index as the source of truth, and classify bounded nested causes for `23505` in the vote route. Return the same safe duplicate response as the optimistic pre-check.