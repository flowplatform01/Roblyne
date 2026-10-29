# ROBLYNE Loading UX Verification

## Progressive rendering

- The home hero and discovery heading render independently of the discovery request; only the discovery content region uses `DiscoveryLoadingSkeleton`.
- Organization routes keep their existing workspace skeleton for required organization metadata, while now deferring inactive engine lists.
- Finance retains its local error/retry panel rather than replacing the entire application when its authoritative summary fails.

## Browser scenarios

- `home shell renders before its bounded discovery request completes` holds `/api/discover` open, verifies the page heading is visible, then releases the response and verifies a rendered result.
- `finance entry does not fetch inactive engine lists` enters the Finance deep link and records any requests to the three unrelated engine-list endpoints.
- Existing tests cover private-election verification/recovery and Finance summary recovery.

## Validation result

`pnpm test:e2e` passes all five Chromium scenarios. This includes both new data-loading scenarios, Finance recovery, and the two private-election verification/recovery scenarios. The checks use intercepted synthetic API responses and do not measure live provider or production latency.
