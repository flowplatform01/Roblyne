# ROBLYNE Hardening Changelog

## 2026-10-29 — final production hardening audit

- **Fixed P1 invite-only event access:** Invite codes were accepted by registration but did not authorize the event/ticket reads needed to reach the registration form; copied links also omitted the code and the page could render blank.
- **Root cause:** Event read endpoints treated all non-public events as organization-member-only, while the registration endpoint separately recognized invite codes.
- **Implementation:** Added narrow matching-code read authorization for non-draft `invite_only` events only; private events remain member-only. Organizer copy/share links now include the invite code, the registration request forwards it, and invalid links show a recovery screen.
- **Regression coverage:** Added `artifacts/api-server/src/lib/event-access.test.mjs`.
- **Compatibility:** No schema migration, public route rename, payment behavior, or role expansion. Existing organizer/member access is unchanged.
- **Deferred:** No candidate nomination/self-registration work, provider replacement, architecture rewrite, or unverified payment/withdrawal behavior changes were introduced.
