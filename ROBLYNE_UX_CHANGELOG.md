# ROBLYNE UX Changelog

## 2026-10-29 — Production improvement phase

- Added browser-side adaptive image preparation for oversized still images, with cancellation, progress states, bounded resource use, and clear file-format errors.
- Added the missing Cloudflare R2 browser-upload CORS requirement to both Render deployment guides.
- Repaired invite-only voting links: a valid code now authorizes only read access required to load that invite-only ballot, and organizer sharing includes the code in the copied link.
- Replaced the private/invite missing-data blank screen with a neutral access and code-entry screen.
- Created a primary workspace atomically with each new account while preserving the ability to create and use additional organizations.
- Recorded verified checks, required production checks, and remaining operational limits in the production UX audit and verification documents.
