---
name: Evenum production review
description: Audit findings and fixes applied across multiple sessions; tracks what's resolved vs. what remains
---

## Resolved in first session
- Stubs replaced with real data (org summary, finance section, settings mutation)
- OG meta tags, ShareButton, BrandedHero, AccentColorPicker added
- Tab URL persistence added
- Upload UX improved
- Settings save mutation wired

## Financial infrastructure (second session)
Backend commission engine, financial_transactions, settlements, commission_configs — fully implemented.
Admin finance dashboard (FinanceAdminSection) and Org finance section (FinanceSection) — fully built.

## Field name bugs & fixes (third session)
The generated API client keeps snake_case field names (total_platform_revenue, not totalPlatformRevenue).
AdminDashboard.tsx had camelCase field accesses that were all wrong. Fixed:
- stats.total_platform_revenue, total_commission_collected, revenue_today, revenue_this_week, revenue_this_month, total_transactions
- stats.pendingSettlements.total_amount / .count (nested object, not flat fields)
- ob.org_id, ob.org_name, ob.total_earnings, ob.pending_balance, ob.released_balance

**Why:** orval codegen preserves snake_case when schema defines it that way. Never assume camelCase in the frontend for these fields.

## OrgBalance released_balance gap (third session)
Backend org-balances query was missing released_balance. Added:
`SUM(CASE WHEN settlement_status = 'completed' THEN org_earnings ELSE 0 END) AS released_balance`

## Org Analytics endpoint (third session)
Added GET /api/organizations/:orgId/analytics to financial.ts router.
Returns { elections[], events[], campaigns[] } with per-pillar performance data.
- Elections: totalVotes, paidVotes, freeVotes, revenue
- Events: ticketsSold, capacity, capacityUtilization, checkedIn, checkInRate, revenue
- Campaigns: submissionsCount, paidContributors, avgContribution, amountRaised, goalAmount, goalCompletion

Added OrgAnalytics schema to openapi.yaml, ran codegen → useGetOrgAnalytics hook generated.

## OrganizationWorkspace Analytics tab (third session)
Added "Analytics" tab with AnalyticsSection component.
Shows 3 summary KPIs + 3 per-pillar tables with performance metrics.
Tab slug: 'analytics' — included in the URL persistence allowlist.

## Admin dashboard improvements (third session)
- Added "Revenue This Month" KPI card (6th card, grid changed to 6 cols)
- Added "Export All Transactions" button → opens /api/admin/finance/export
- Removed invalid `limit` param from useListAdminSettlements (not in ListAdminSettlementsParams type)
- Added DialogDescription import (was missing, causing TS error)
