# ROBLYNE Data-Loading Audit

## Scope

This audit covers public discovery/search, organization workspaces, route loading, and list endpoint result bounds. It does not represent a load test or a live-production measurement.

## Confirmed behavior

- Route modules are lazy-loaded and show `RouteLoadingShell` while their code chunk arrives.
- React Query retains read data for five minutes, treats it as fresh for 30 seconds, and does not refetch merely because the browser tab regains focus.
- Public discovery uses Redis caching, a ten-second server cache TTL, in-flight request coalescing, and short browser/proxy cache directives.
- Discovery, search, and organization list routes use bounded SQL reads and aggregated count subqueries instead of per-card count queries.

## Changes in this revision

- The home route explicitly requests 12 discovery records instead of relying on the API default of 24. The API still supplies featured and trending selections, while the general grid no longer repeats highlighted cards.
- Search now defaults to 24 results and trims the final cross-engine response to the requested cap. Previously each of three engine queries could contribute up to the limit, returning as many as 144 records for a `limit=48` request.
- Workspace engine-list queries are enabled only for Overview or their matching tab. Opening Finance, Team, Analytics, or Settings no longer fetches Elections, Events, and Campaigns only to leave them unused.
- The workspace tab is initialized from the URL before the first render, avoiding a transient Overview fetch when opening a deep link such as `?tab=finance`.

## Pagination assessment

- Public discovery and search are bounded, but neither has a complete cursor/offset contract yet. A pagination UI would be misleading without a stable continuation token and an accurate `hasMore` indicator.
- Organization engine-list endpoints are hard-capped at 100 records and expose `X-Result-Limit`; they do not yet accept pagination parameters. This is a deliberate follow-up for organizations that can exceed the cap, not a behavior silently hidden by the UI.
- The next API evolution should add keyset pagination (`createdAt`, `id`) and return `{ items, nextCursor }`. Update the Zod/OpenAPI source, regenerate the client, then adopt `useInfiniteQuery` for the matching workspace list only. Do not use offset pagination for mutable high-volume lists.

## Remaining scale work

- Add database-level query plans and index verification with representative production-sized data.
- Add list cursors before an organization can reliably exceed 100 objects per engine.
- Establish RUM or server timing telemetry before making latency claims about real users.
