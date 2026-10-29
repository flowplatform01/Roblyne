# ROBLYNE Performance Comparison

## What changed

| Area | Previous behavior | Current behavior |
| --- | --- | --- |
| Home discovery request | API default of 24 items | Explicit 12-item initial request |
| Home card rendering | Highlighted cards could repeat in the general grid | Highlighted cards are omitted from the general grid |
| Search aggregation | Up to three engine limits could be returned | Final response is capped to the requested limit |
| Finance deep link | Also fetched three inactive engine lists | Fetches only organization, stats, and Finance data |

## Expected impact

- Lower initial discovery payload and card work on the public home route.
- At most the selected search limit reaches the browser after cross-engine aggregation.
- Three unnecessary requests are removed when a workspace starts on Finance, Team, Analytics, or Settings.
- No claim is made about real-world latency, throughput, or cloud cost without production telemetry and representative data.

## Measurement method

The new Playwright scenarios use controlled API interception to count requests and delay discovery deliberately. The final `pnpm test:e2e` run passed all five scenarios. This validates request intent and progressive rendering, not network performance.
