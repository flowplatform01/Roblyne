---
name: Evenum session persistence
description: Sessions are stored in PostgreSQL via connect-pg-simple; in-memory sessions caused 403 on finance endpoints after every server restart.
---

## Rule
Sessions must use the PostgreSQL store (`connect-pg-simple`), not the default in-memory store. In-memory sessions are wiped on every restart, which silently 403s all authenticated org routes.

**Why:** The API server restarts frequently (dev workflow, deploys). In-memory sessions meant every restart logged out all users. Finance/analytics/settings endpoints all require `requireOrgRole`, so they'd all return 403 until users manually re-logged in.

**How to apply:** `app.ts` uses `connect-pg-simple(session)` with `conString: process.env.DATABASE_URL` and `tableName: "session"`. The `session` table must exist in PostgreSQL (created manually via CREATE TABLE; not in drizzle schema — do not add it there to avoid migration conflicts).

## Backfill note
As of 2026-07-23, financial_transactions had 0 rows despite 27 paid votes because `recordTransaction` was added to the vote handler AFTER those votes were submitted. A manual SQL backfill inserted the 27 missing transactions (gross = payment_amount × selection_count × quantity, 5% commission). Future votes flow through correctly — the code in elections.ts calls `recordTransaction` inside the db.transaction callback.
