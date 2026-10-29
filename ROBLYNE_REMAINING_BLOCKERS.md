# ROBLYNE Remaining Production Blockers

## External verification required

| Blocker | Why it matters | Exact action | Owner |
| --- | --- | --- | --- |
| Empty production-like PostgreSQL database | Confirms migrations, permissions, API readiness, and clean initialization. | Provision an isolated database; set a non-secret test `DATABASE_URL`; run the API migration/start sequence twice and inspect `/api/readyz`. | External infrastructure access |
| S3-compatible bucket credentials | API deliberately refuses production startup without object storage. | Create bucket and least-privilege credentials; set all required `S3_*` values on API; test an upload with non-sensitive data. | External infrastructure access |
| Redis and worker resources | Required only when enabling multi-instance queue-backed lifecycle processing. | Provision TLS-capable Redis; deploy worker first with identical `REDIS_URL`; then set it on API and verify both health endpoints. | External infrastructure access |
| Render service configuration | Local verification cannot prove dashboard values, build cache state, domains, or health checks. | Configure exactly as `ROBLYNE_DEPLOYMENT_RUNBOOK.md`; clear build cache; confirm the deploy uses the latest commit and each health endpoint passes. | Render dashboard access |
| Cross-origin browser and FlowPay sandbox tests | Confirms actual cookie policy, CORS, and payment callbacks. | Use test domains and provider sandbox credentials; run registration/login/logout plus safe payment callback scenarios. | External domain/provider access |

No repository-only build or type/test failures remain from this audit.
