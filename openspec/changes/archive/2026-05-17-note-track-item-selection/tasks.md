## 1. Stage selection state & wiring

- [x] 1.1 Move `selectedChannelId`, `marquee`, `selectedIdx` off pure demo literals when `demo=marquee` / `demo=note` absent; add `useState`-backed interaction model that preserves existing demo branching when those flags fire.
- [x] 1.2 Export stable setters/handlers (`selectNote`, or inline callback) consumed by timeline rows; ensure `resolvedSelection` recomputes and DJ selection precedence rules unchanged.
- [x] 1.3 Decide demo vs interactive precedence for `/` versus `demo=` URLs; document briefly in hook comment if non-obvious.

## 2. Piano-roll rendering & stylesheet

- [x] 2.1 Extend `PianoRoll` props with optional `onNoteSelect`; attach `click`/`pointerdown` + `stopPropagation` on `.mr-note` tiles.
- [x] 2.2 Replace `--mr-note-sel` exclusivity branch with velocity/track background for all `.mr-note` rows; derive `effectiveSel`; set **`data-sel`** and **`data-selected`** booleans appropriately.
- [x] 2.3 Duplicate `.mr-djtrack__note[data-selected="true"]` `box-shadow` stack onto **`PianoRoll.css` `.mr-note[data-selected="true"]`** verbatim; bump z-index/stacking parity with DJ lanes if clipped.
- [x] 2.4 Add **`cursor:pointer`** semantics when clickable.

## 3. Tracks / shell plumbing

- [x] 3.1 Forward `onNoteSelect` through `Track`/`ChannelGroup`/`AppShell` so each roll invokes stage handler with `{ channelId, noteIndex }` translation.
- [x] 3.2 Optionally align `setSelectedTimelineTrack({ kind:'channel', ... })` on note clicks for Inspector parity.

## 4. Tests & verification

- [x] 4.1 Update `PianoRoll` / `.mr-note` assertions that insisted on **`var(--mr-note-sel)`** backgrounds when selected.
- [x] 4.2 Add interaction test (Vitest/`@testing-library`) covering click → `selectedIdx`/DOM attributes (**`data-selected="true"`**).
- [x] 4.3 Spot-check **`/?demo=marquee`** and **`/?demo=note`** still satisfy scenarios (seven vs one selected notes).
