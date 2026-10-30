# ROBLYNE Critical Workflow Verification

| Workflow | Environment | Outcome | Status |
| --- | --- | --- | --- |
| Deployed health/readiness | Public deployed endpoints | Frontend 200; API readiness reports database/Redis/worker healthy | Verified public health only |
| Organization image + settings | Automated browser, controlled API/storage | File input → presign → PUT → PATCH → reload persistence passes | Verified browser behavior, not real storage |
| Organization image + settings | Local API, local DB, real configured storage | Signed PUT, PATCH, persisted readback, and public image GET pass | Verified production-equivalent integration |
| Production image upload | Configured storage preflight | HTTP 403 from deployed frontend origin | **Blocked** |
| Private election link | Automated browser | Existing verification and invalid-link recovery tests pass | Verified controlled browser |
| Reported election crash | Production | Exact route/log/account unavailable | **Not verified** |
| Finance page error recovery | Automated browser | Authoritative-summary failure shows local retry UI | Verified controlled browser |
| Withdrawal creation/rejection | Local API/local DB | Request 201; repeat over-balance request 400; one pending settlement; balances reconcile | Verified local integration |
| Withdrawal provider payout | Production/provider sandbox | No provider transfer attempted; workflow only creates internal settlement request | **Not verified / launch blocker** |

## Required production sign-off sequence

1. Apply R2 CORS, deploy API/frontend, and confirm the deployed revision.
2. With an authorized test organization, save text-only settings; reload and verify persistence.
3. Upload then replace an organization logo; save, reload, and confirm image URL/rendering.
4. Create and reopen a safe test election; capture its API status/request ID if it fails.
5. Perform a provider-authorized sandbox withdrawal lifecycle; reconcile provider outcome with settlement status.
6. Verify cross-organization mutation rejection using two safe test organizations.
