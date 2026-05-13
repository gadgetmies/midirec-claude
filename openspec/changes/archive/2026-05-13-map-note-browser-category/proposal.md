## Why

Load-deck controls are playlist/library workflows, not mixer strip parameters; grouping them under **Mixer** in the Map Note panel misleads users and clutters the mixer tab with note actions that behave differently from EQ and fader rows. Splitting **Browser** into its own category makes the sidebar match how DJs mentally separate track loading from gain/EQ/xfader routing.

## What Changes

- Add a fifth DJ action category, **`browser`**, with Map Note chips ordered **deck → browser → mixer → fx → global** (insert **Browser** after Deck, before Mixer).
- Reclassify template actions **Load Deck 1** (`load_a`) and **Load Deck 2** (`load_b`) from `cat: 'mixer'` to `cat: 'browser'` in defaults and typings.
- Persisted sessions whose rows still carry `cat: 'mixer'` for those ids SHALL be normalized to `browser` on load so the UI and selects stay consistent.
- Mixer category retains crossfader, channel volumes, and EQ bands only.

## Capabilities

### New Capabilities

(none — extends existing categorization.)

### Modified Capabilities

- `dj-action-tracks`: Extend `CategoryId` and `DJ_CATEGORIES` with `browser`; update `DEFAULT_ACTION_MAP` rules so `load_a` / `load_b` use `cat: 'browser'`; tighten category enumeration and scenarios (five tabs, new key order).
- `dj-map-editor`: Update Map Note **Category** chips (count, DOM order, labels) and any scenarios that Hard-code four tabs or Mixer-only listings for Load Deck.

## Impact

- `src/data/dj.ts` — types, `DJ_CATEGORIES`, `DEFAULT_ACTION_MAP`, any validation that assumes four categories only.
- `src/components/sidebar/InputMappingPanel.tsx` — category chip list is driven by `DJ_CATEGORIES` order; verify `catColor` / first-row behavior for the new category; migration hook if loads normalize `load_*` categories.
- Session load path (stage persistence / hydrate) — one-time normalization for legacy `mixer` + `load_a` | `load_b`.
- Tests referencing category counts, chip labels, or `DEFAULT_ACTION_MAP` categories for Load Deck rows.
