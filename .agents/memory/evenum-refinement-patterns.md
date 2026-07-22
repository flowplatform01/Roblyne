---
name: Evenum refinement patterns
description: Key patterns established in the comprehensive 12-area refinement of the Evenum platform
---

## OG Meta Tag Pattern
All public-facing pages use an inline `setMeta` helper inside `useEffect` to write `<title>` + OG meta tags:
```tsx
useEffect(() => {
  if (entity) {
    document.title = `${entity.title} | Evenum`;
    const setMeta = (name, content, prop = false) => {
      const attr = prop ? 'property' : 'name';
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.content = content;
    };
    setMeta('og:title', ..., true);
    // ...
  }
}, [entity, shareUrl]);
```

## ShareButton
Import from `@/components/branding/ShareButton`. Props: `url`, `title`, `description`, `variant` ('button'|'icon'), `className`. For dark hero backgrounds, use: `className="bg-transparent border-background/30 text-background hover:bg-background/10 ..."`.

## Organization Settings
`useUpdateOrganization` mutate signature: `{ orgId: number, data: { name?, description?, website?, logoUrl?, coverImageUrl?, heroImageUrl?, accentColor?, theme? } }`. Invalidate with `getGetOrganizationQueryKey(orgId)` on success. The backend PATCH handler uses `.set(bodyParsed.data)` so all validator fields are written correctly.

## BrandedHero Usage
`BrandedHero` from `@/components/branding/BrandedHero`. Key props: `title`, `subtitle`, `org` (any entity with accentColor/theme), `imageUrl` (hero or cover), `logoUrl`, `badge`, `actions`. Falls back to dark dot-grid when no imageUrl.

## AccentColorPicker
`AccentColorPicker` from `@/components/branding/AccentColorPicker`. Props: `value: string`, `onChange: (color: string) => void`, `className?`.

## Tab URL Persistence
OrganizationWorkspace uses `window.history.pushState` to sync `?tab=X` in URL. Adding a new tab requires: (1) add to allowed list in `handleTabChange`, (2) add TabsTrigger, (3) add TabsContent, (4) add the component.

**Why:** Tab state is URL-driven for shareability and browser back/forward support.

## Paid participation governance
Paid voting is governed at the platform level: use election/position-level pricing (never candidate-level pricing), keep the active currency platform-approved, and store purchased quantity on the ballot so displayed entitlements and results remain aligned.

**Why:** Candidates competing for one position must face identical financial conditions, while participants need a transparent amount-to-entitlement relationship.

**How to apply:** Keep payment presentation mode and supported currencies in platform settings; do not reintroduce per-candidate payment controls into public voting or organization election setup.
