# ROBLYNE scalability and performance report

## Strategic target (1M registered users)

**Target definition:** up to **1,000,000 registered accounts** in PostgreSQL, with architecture that can scale **API and worker replicas** horizontally as **daily/monthly active users** and **peak concurrency** grow.

**Not claimed:** 1M simultaneous users, 1M RPS, or empirically validated million-user load in this pass.

### Workload dimensions to plan separately

| Dimension | Planning note |
|-----------|---------------|
| Registered users | Table size, index bloat, admin list pagination |
| DAU/MAU | Drives session rows, discover/search QPS |
| Peak concurrent users | Drives API replicas, Redis, connection pool totals |
| Write peaks | Elections (vote bursts), ticket sales, campaign responses |
| Background load | One `lifecycle-sweep` every 30s per queue (serialized) |

**Assumption set (until production metrics exist):**

- Peak **500–2,000** concurrent authenticated users during a large election event.
- Discover/search **50–200 RPS** aggregate at peak (CDN + cache absorb much public read traffic).
- Vote/register writes **10–100 RPS** short bursts per hot election.

## Architecture readiness (code review)

| Area | Status | Notes |
|------|--------|-------|
| Three deployable processes | **PASS** | Separate build/start for web, API, worker |
| Stateless API (sessions in PG) | **PASS** | |
| Shared rate limits | **PARTIAL** | Needs Redis in multi-instance deploy |
| Read caching (discover) | **PASS** | Redis + HTTP `Cache-Control` |
| DB indexes for discovery pillars | **PASS** | Composite `*_public_discovery_idx` on events/elections/campaigns |
| Search bounded result sets | **PASS** | Per-pillar `LIMIT` (default 40, max 100) |
| Discover cache invalidation | **PASS** | Writes + lifecycle sweeps invalidate Redis discover keys |
| Scheduler lock (multi-API) | **PASS** | One API registers BullMQ repeat job via Redis lock |
| Startup config validation | **PASS** | API/worker derive queue behavior from Redis configuration without separate feature-toggle variables |
| Graceful DB pool shutdown | **PASS** | API/worker call `closeDatabasePool()` on SIGTERM |
| Connection pool configurability | **PASS** | `DATABASE_POOL_*` env vars |
| Worker job retries | **PASS** | BullMQ attempts/backoff on repeatable job |
| Payment/vote correctness | **PASS** | Synchronous verification paths preserved (no queue offload) |

## Optimizations implemented (this pass)

1. **API lifecycle fallback** disabled in production when `REDIS_URL` is set — avoids duplicate sweeps on every API replica.
2. **Worker health HTTP** on `WORKER_HEALTH_PORT` for orchestration.
3. **Configurable PostgreSQL pool** per process.
4. **Search query bounds** to prevent unbounded ILIKE result sets.
5. **BullMQ job options** — retries and retention for maintenance jobs.

## Load testing

### Tooling

- `scripts/perf-baseline.ts` — HTTP scenarios + optional DB stats (`PERF_*` env vars). See `SETUP.md`.

### Execution in this environment

| Test | Result | Notes |
|------|--------|-------|
| API unit tests (`pnpm --filter @workspace/api-server run test`) | See final acceptance section in chat summary | No DB required |
| Workspace `pnpm run typecheck` | See final acceptance section | |
| `perf-baseline` against live API | **NOT TESTED** unless API+DB running locally | Requires operator to start stack |
| Staging soak / spike tests | **BLOCKED** | Requires deployed infrastructure and authorization |

### Recommended staging profile (safe)

1. Warmup: 5 min at 20 RPS mixed `GET /api/discover`, `GET /api/healthz`.
2. Ramp: 60 RPS discover for 10 min (multiple API instances + Redis).
3. Spike: 150 RPS for 2 min.
4. Write path: isolated election fixture, 30 RPS vote attempts with integrity harness (`CONCURRENCY_*`, **non-production DB only**).

Record p50/p95/p99, error rate, PG `pg_stat_activity`, Redis memory, BullMQ lag.

## Bottlenecks identified (evidence-based)

| Bottleneck | Severity | Mitigation |
|------------|----------|------------|
| ILIKE search without trigram indexes | Medium at large catalog | Add `pg_trgm` indexes if search latency grows; monitor first |
| Correlated COUNT subqueries on discover lists | Medium | Redis cache (10s); consider materialized counts later |
| Per-process rate limits without Redis | High for multi-API | Require Redis in production multi-instance |
| Connection pool × replicas | High if misconfigured | Use formula in runbook; raise PG `max_connections` or PgBouncer |
| Single maintenance queue | Low | Adequate for current single job type |
| Large Vite PWA precache | UX on first load | Documented in founder assessment; not throughput-critical for API |

## Capacity statement

| Claim | Level |
|-------|-------|
| Architecturally prepared for horizontal scaling of web/API/worker | **Yes**, with Redis for shared limits/cache in multi-API setups |
| Validated for 1M registered users | **NOT TESTED** — requires staging data volume + query benchmarks |
| Validated for peak concurrent load | **NOT TESTED** — requires load tests above |

## Next validation steps

1. Deploy three services to staging with Redis configured on API and worker.
2. Run `perf-baseline` and capture report JSON.
3. Seed ≥100k synthetic public events/elections row subset (disposable DB) and re-run discover/search latency.
4. Enable PgBouncer transaction pooling if connection count approaches provider limits.
5. Collect 30 days of production metrics (RPS, p95, queue lag) before final capacity sign-off.
