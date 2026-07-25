---
name: Evenum voting pillar architecture & refinements
description: Architecture decisions and UX patterns for the public voting experience
---

## Core files
- `artifacts/evenum/src/pages/ElectionVote.tsx` — state machine with steps: landing | number | review | payment | success
- `artifacts/evenum/src/pages/ElectionResults.tsx` — results with bar chart, winner highlight, activity chart
- `artifacts/evenum/src/pages/CandidateProfile.tsx` — deep-links back to ElectionVote with ?positionId=&candidateId=

## State machine (ElectionVote)
Steps: `'landing' | 'payment' | number | 'review' | 'success'`
- `number` = position index in the wizard (0 to totalPositions-1)
- URL params `?positionId=X&candidateId=Y` deep-link from CandidateProfile into wizard mid-step

## Key UX decisions made
- **Single-select auto-deselect**: When `maxSelections === 1` and user picks another candidate, silently switch (no error). Only show destructive toast for genuine multi-select overflow.
- **Sticky wizard navigation**: Fixed bottom bar with prev/next buttons + position quick-jump dots. Content has `pb-36` to avoid overlap.
- **Position chip nav**: Shown when `totalPositions > 4` — sticky horizontal scrollable pills below Navbar, uses `scrollIntoView` via `positionRefs`.
- **Layout toggle**: List (default) and Grid views on landing. Grid shows portrait-aspect photo cards. Both support candidate numbering and live percentages.
- **Candidate numbering**: `#N` display toggle on landing and in wizard. Off by default, toggled via `showNumbers` state.
- **Live percentages**: `useGetElectionResults` added to ElectionVote landing. Shows `X% of votes` when results data exists. Avoids unnecessary call — data is cached by React Query.
- **Success screen**: Full ballot summary shown after vote, animated pulse ring, security assurance line, Share Results button.
- **Org discoverability**: Org name+logo in election hero links to `/organizations/:orgId/public`. Same in ElectionResults hero. Uses `(election as any).orgId` since TypeScript type may not include it.

## Data patterns
- `(election as any).orgId` — orgId is in API response but may not be in TS type
- `(election as any).heroImageUrl` — same pattern for extra fields not in type
- `(election as any).organizationLogoUrl` — org logo joined from organizations table
- Live results: `liveResults.positions[].candidates[].candidateId` + `.voteCount`

## CSS utilities added
- `.no-scrollbar` in `index.css` — hides scrollbar for the position chip nav

## ElectionResults additions
- Winners at a Glance: compact grid of winner cards (only shown when election is `ended`)
- Org name/logo in hero links to org public profile

**Why:** Preserves existing architecture (no DB changes), improves scalability for large elections, and adds org discoverability without routing changes.
