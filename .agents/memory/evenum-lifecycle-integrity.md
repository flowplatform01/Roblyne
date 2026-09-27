---
name: Evenum lifecycle integrity
description: Lifecycle enforcement architecture across all three public pillars (elections, events, campaigns). Covers server-side rules, client-side clock, and how they converge.
---

## Rules

### Server-side enforcement (authoritative)
- **Elections** (`POST /elections/:id/vote`): checks `status === "active"`, then `startsAt > now` (not-yet-open), then `endsAt <= now` (expired). All three gates use `<=` for the expiry boundary (not `<`).
- **Events** (`POST /events/:id/register`): outer checks for `status !== "published"` and `endsAt <= now` before entering the transaction. Inside the Drizzle transaction the event row is re-locked with `FOR UPDATE` to atomically guard status, endsAt, and the event-level `capacity` field (ticket count vs `events.capacity`). Ticket-type `FOR UPDATE` lock also re-checks `sale_starts_at`/`sale_ends_at` windows inside the same transaction.
- **Campaigns** (`POST /campaigns/:id/submit`): checks `status === "active"`, `endsAt <= now`, and `startsAt > now`. All use `<=` boundary.
- **Lifecycle sweeper**: runs every 30 s in `artifacts/api-server/src/index.ts`, calling `sweepExpiredLifecycles()` from `artifacts/api-server/src/lib/lifecycle.ts`. Transitions active → ended for elections and campaigns, published → completed for events.

### Client-side clock (`artifacts/evenum/src/hooks/useLifecycle.ts`)
- `useCountdown(targetDate)` — visibility-refresh-aware interval; cleans up on unmount; exports `{ days, hours, minutes, seconds, expired, now }` where `now` is the last tick timestamp.
- `getLifecycleState(startsAt, endsAt, now)` — returns `"upcoming" | "live" | "ended"`. No server round-trip.
- Used by all three public pages; `now` from the countdown is passed into `getLifecycleState` so both derive from the same clock tick.

### Client/server convergence
- Pages use `lifecycleState` to show upcoming/ended states proactively and disable submission buttons client-side.
- The server is always the final authority; any clock skew or stale tab still receives a 403.
- Payment flow in `ElectionVote` (delayed `setTimeout`) gains an expiry guard: `submitBallot` checks `countdown.expired` before submitting.
- `EventRegister` countdown now tracks `event.endsAt` (registration deadline), not `event.startsAt` (event start). Label changed to "Registration closes in".
- Ticket tier cards show "Sales Not Open" / "Sales Closed" badges when their own sale window is inactive; tiers become unselectable and the submit button is disabled if the selected tier's window closes.

### Election structure locking
- Candidate removal and ballot writes must serialize on the election row with `FOR UPDATE`. The ballot structure must be re-read after the lock; pre-lock candidate validation can become stale if an admin deletes a candidate concurrently.
- Paid election finalization must acquire the same election-row lock before inserting vote selections, because payment creation and ballot recording happen in separate requests.

**Why:** Without the `startsAt` check an election that hasn't opened accepts votes if status was set to `active` early. Without the atomic capacity lock, events could oversell when concurrent registrations pass the pre-transaction count. Without expiry guards in delayed flows a voter who lingers on the payment screen past `endsAt` could still cast a ballot.

**How to apply:** Any new public submission endpoint must perform (1) status gate, (2) `startsAt > now` gate, (3) `endsAt <= now` gate, all with `<=` on the expiry boundary. Transactional atomic checks must be re-evaluated inside `FOR UPDATE` locks for any quantity-limited resource.
