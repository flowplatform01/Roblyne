---
name: Evenum demo seed
description: How to run and maintain the demo seed script that populates Evenum with realistic showcase data
---

# Evenum Demo Seed

**Script:** `scripts/seed-demo.ts`  
**Run:** `DATABASE_URL="$DATABASE_URL" pnpm --filter @workspace/scripts run seed`

## What it does
Fully idempotent. Cleans up placeholder data, enriches existing orgs/users 1–3 and admin 9, then rebuilds:
- 12 users (admin + 4 org owners + 4 org admins + 3 general users)
- 4 organizations (City Council D7, GreenTech Hub, Alumni Network, Meridian Arts Council)
- 4 elections with positions, candidates, realistic votes
- 5 events with ticket types and attendee registrations
- 5 campaigns with submissions/donations

## FK deletion order (critical — violating this causes FK errors)
1. `vote_selections` before `votes` before `positions` (for elections)
2. `tickets` before `ticket_types` (for events)
3. For org cascade deletes: must clear `vote_selections` / `votes` for that org's elections BEFORE deleting the org (candidates FK is not cascade-deleted by vote_selections)

## Idempotency strategy
- At script start: delete new users by email, find+nuke Meridian Arts elections' votes/vote_selections before deleting the org by slug
- For elections 1–3: query existing votes, delete vote_selections then votes, then delete positions

## Password
All demo accounts use: `Evenum2025!`

**Why:** The script needed to be runnable multiple times safely; partial runs leave orphaned data that blocks subsequent runs without this cleanup order.
