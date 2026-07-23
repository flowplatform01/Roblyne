---
name: Evenum production hardening
description: Full engineering audit to make Evenum production-grade — N+1 fixes, security, concurrency, code splitting
---

## Summary of changes (all applied)

### Backend — N+1 query elimination

**elections.ts** — complete rewrite:
- List: single JOIN + 3 correlated subqueries (posCount, candCount, totalVotes) instead of O(n×3) calls
- Candidates list: single GROUP BY JOIN (elections×positions×vote_selections×votes)
- Position detail: single aggregated query for candidates with vote counts
- Results: two parallel queries (totalVotes + per-candidate grouped aggregation) instead of nested N+1 per position/candidate
- Analytics: three parallel queries (total, votes-by-hour, per-position counts) instead of O(n) per position
- Export: single GROUP BY query (positions+candidates+votes) instead of O(n×m) nested loops
- Eligible voters: batch `INSERT ... ON CONFLICT DO NOTHING` instead of sequential check-then-insert loop

**organizations.ts** — complete rewrite:
- Members list: single LEFT JOIN to users table (was: N separate user lookups via `memberRow()` helper)
- Organization list: DISTINCT query including both owned + member orgs in one shot
- Org stats: single query with correlated subqueries for all counts
- Public profile: parallel fetch of counts + 3 recent-item queries

**financial.ts** — org analytics endpoint:
- Was: sequential for-each per election, event, and campaign (2–3 queries each = O(3n) total)
- Now: 3 parallel queries each using LEFT JOIN aggregation (GROUP BY per entity_id)
- Settlement PATCH/POST: added proper type checking on req.body instead of unsafe casting

**campaigns.ts, events.ts, discover.ts** — fixed in prior sessions

### Backend — concurrency / correctness

**events.ts**: ticket oversell check moved inside transaction with `FOR UPDATE` row lock;
check-in is a single conditional UPDATE (was: read-then-write race)

**campaigns.ts**: submit (response insert + currentAmount update) wrapped in a single DB transaction

**elections.ts**: vote submission uses ON CONFLICT to detect duplicate votes even under concurrency;
`INSERT ... ON CONFLICT DO NOTHING` for eligible-voter bulk add

### Security

**app.ts**: SESSION_SECRET validation at startup:
- Production: `process.exit(1)` if missing or is the dev default
- Development: warn to console

**rateLimit.ts**: added `searchLimiter` (60 req/min in prod) applied to `/api/search` and `/api/discover` in app.ts

**financial.ts**: settlement body fields validated with type checks instead of raw casting

### Frontend

**App.tsx**: all 15+ route components converted to `React.lazy()` + `<Suspense>` for code splitting

**QueryClient**: production-grade defaults:
- `staleTime: 30_000` (30s)
- `gcTime: 5 * 60_000` (5min)
- `refetchOnWindowFocus: false`
- `retry`: returns false on 4xx, max 2 retries on 5xx/network
- `mutations.retry: false`

**ErrorBoundary**: added class component in `src/components/ErrorBoundary.tsx`, wired into `main.tsx`

### DB schema

**organizations**: added `organizations_owner_id_idx` index on `owner_id` column
(critical for "list orgs by user" access pattern)

## Key constraints

- `db.execute(sql`...`)` returns `{ rows: [...] }` — must use `.rows[0]` not destructuring `[first]`
- Drizzle ORM correlated subqueries in `.select()` work cleanly; use `sql<number>` cast with `::int`
- `INSERT ... ON CONFLICT DO NOTHING` requires the conflicting column to have a UNIQUE constraint
- Rate limiters must be registered BEFORE `app.use("/api", router)` to intercept matching routes first
