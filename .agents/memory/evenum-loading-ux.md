---
name: Evenum loading UX
description: Loading-state conventions for preserving layout, accessibility, and action progress across Evenum
---

Initial page and predictable list loads use structural skeletons that match the loaded layout rather than centered full-page spinners. Skeleton regions expose an accessible status label and use the shared muted, bordered surface treatment.

**Why:** Mature Evenum screens contain dense cards, tables, hero sections, and responsive navigation; replacing those regions with a spinner causes layout jumps and makes the product feel slower.

**How to apply:** Reuse the loading components in `components/loading/LoadingStates.tsx` for route, dashboard, workspace, management-detail, public, ballot, participation, results, and table/list states. Keep compact progress indicators for mutations, payments, uploads, exports, QR check-in, and other operations whose duration is indeterminate.