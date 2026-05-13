## Why

Map Note currently exposes seven category chips (Transport, Cue, Hot Cue, Loop, FX, Deck, Mixer), which splits deck-centric controls across four tabs and duplicates the same labeled actions for Deck 1 and Deck 2 in the Action dropdown. Collapsing to four tabs—Deck, Mixer, FX, and Global—matches how users think about controller layout, reduces noise in the Action list, and places Tap Tempo alongside other non-deck global controls.

## What Changes

- Replace Map Note category chips with exactly four keys: **deck**, **mixer**, **fx**, and **global**, in that DOM order, with human-readable labels aligned to the existing `DJ_DEVICES` naming style where sensible (e.g. Deck, Mixer, FX, Global).
- Re-tag every action that today uses `transport`, `cue`, `loop`, or `hotcue` to the **deck** category in persisted `ActionMapEntry.cat` (and in `DEFAULT_ACTION_MAP` templates). Move **Tap Tempo** to **global** (`cat: 'global'`).
- **Deck Action dropdown**: when the active category is deck, the Action `<select>` SHALL list each logical control at most once (deduplicated vs. today’s paired `_b` / deck-two templates), with a defined rule for choosing the template row (`id`, `pad`, `pressure`, etc.) when the user picks an option—typically matching the current row’s target `device` when a deck-specific variant exists.
- Update `actionMode` / DJ action-track rendering rules that key off `cat ∈ {transport, cue, hotcue}` so trigger-style notes still behave correctly after categories collapse to `deck` (e.g. derive trigger mode from action identity or flags, not the old category names).
- **BREAKING** for documents and code that assume the old seven `CategoryId` literals: session data, specs, and tests referencing `transport`/`cue`/`hotcue`/`loop` as `cat` values need migration or updates.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `dj-map-editor`: Map Note category chip set, chip order/labels, Action select filtering and deduplication for deck, auto-save rules when changing category, and chip color mapping for the four tabs.
- `dj-action-tracks`: `CategoryId` / `DJ_CATEGORIES` shape, `DEFAULT_ACTION_MAP` category assignments, exported type documentation, and trigger/fallback rendering rules that reference category (including `actionMode` and note-width behavior).
- `midi-playback`: Scenario examples and any normative text that cite `actionMap[…].cat === 'transport'` (or other retired categories) SHALL be updated to the post-migration category model.

## Impact

- `src/data/dj.ts` — types, `DJ_CATEGORIES`, `DEFAULT_ACTION_MAP`, `actionMode`.
- `src/components/sidebar/InputMappingPanel.tsx` — category keys, `actionsInCategory` / deck dedupe logic, `catColor` sources.
- `src/data/dj.test.ts`, `src/midi/scheduler.test.ts`, and any fixture using old `cat` values.
- Downstream rendering/tests in DJ action tracks that branch on `action.cat`.
