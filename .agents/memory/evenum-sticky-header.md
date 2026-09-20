---
name: Evenum sticky header
description: The global header needs a non-scroll-container ancestor for sticky positioning to work reliably.
---

The global navbar uses `position: sticky` and should stay attached to the viewport while page content scrolls. Avoid putting it under an ancestor with `overflow-x-hidden`, because that can create a scroll container and make the navbar move away.

**Why:** The navbar already had sticky positioning, but the layout wrapper’s horizontal overflow rule prevented it from remaining persistent during scrolling.

**How to apply:** Keep horizontal clipping on the layout with `overflow-x-clip` or apply overflow rules below the navbar, and recheck the behavior on long desktop and mobile pages.