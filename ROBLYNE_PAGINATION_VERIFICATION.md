# ROBLYNE Pagination Verification

## Current contract verification

- `GET /api/discover` enforces a maximum request size of 48 and now has a home-page request size of 12.
- `GET /api/search` enforces a maximum request size of 48 and returns no more than the selected limit after merging engine results.
- `GET /api/elections`, `GET /api/events`, and `GET /api/campaigns` cap responses at 100 and emit `X-Result-Limit: 100`.

## Browser coverage

- `tests/e2e/data-loading.spec.ts` intercepts home discovery and asserts the request includes `limit=12`.
- The same test fixture validates the bounded response shape used by the home route.

## Deliberate non-implementation

No fake pagination control was added. The list APIs do not return a continuation cursor or `hasMore`, so a client-side “Load more” would either repeat records or require loading the full list first.

## Required before adding pagination UI

1. Add cursor schema and result metadata to the API contract.
2. Use deterministic `createdAt DESC, id DESC` ordering in every paginated route.
3. Regenerate `@workspace/api-client-react` from the contract.
4. Add browser tests for first page, next page, exhausted page, and a fresh record inserted between page loads.
