## Context

Map Note categories come from `CategoryId`, `DJ_CATEGORIES` key insertion order (`src/data/dj.ts`), and `InputMappingPanel` (`src/components/sidebar/InputMappingPanel.tsx`), which maps `Object.keys(DJ_CATEGORIES)` to chips and tints chips via `catColor` (currently: first template row’s `devColor(first.device)` in that category).

Load Deck 1 / 2 (`load_a`, `load_b`) are today `cat: 'mixer'` but are logically library/load actions while mixer strip rows remain continuous CC-backed controls (`xfade_pos`, volumes, EQ).

## Goals / Non-Goals

**Goals:**

- Introduce `browser` as a first-class category with label **Browser** in `DJ_CATEGORIES`.
- Declare key order **`deck` → `browser` → `mixer` → `fx` → `global`** so Deck stays first, Mixer follows Browser, downstream chips unchanged relative to each other except insertion of Browser.
- Set `DEFAULT_ACTION_MAP` pitches for `load_a` / `load_b` to `cat: 'browser'`; keep **`device: 'mixer'`** (surface color unchanged—still the mixer-colored hardware zone).
- Normalize persisted tracks: rows with `id` in `{ load_a, load_b }` and legacy `cat: 'mixer'` upgrade to **`cat: 'browser'`** on session hydrate (or centralized `normalizeActionMapEntry`/loader) so chips and filters stay aligned.

**Non-Goals:**

- Changing how Load Deck emits MIDI during playback (`OutputMapping`), DJ device enums, or adding a distinct `browser` **`DeviceId`**.
- Moving crossfader / EQ / volume rows out of Mixer.
- Reordering pitches inside `DEFAULT_ACTION_MAP`.

## Decisions

1. **Category key order** — Insert `browser` after `deck`. Rationale: load-to-deck workflows sit between transport/deck cues and mixer processing in common DJ UX; Fx/Global stay at the tail.

2. **Keep `device: 'mixer'` on load rows** — Rationale: “Surface (color)” remains the mixer-colored surface; avoids inventing placeholder devices or re-coloring timelines. Mixer vs Browser differentiation is categorical (Map Note grouping), not a new MIDI device.

3. **Legacy hydration** — On load, rewrite `cat` for rows whose **`id`** is `load_a` or `load_b` from `'mixer'` to `'browser'` if still stale. Narrow keying on `id` avoids touching user-custom rows that reused those pitches for other semantics (unlikely).

4. **`catColor` for Browser** — First row in browser is `load_a` with `device: 'mixer'`, so tint matches Mixer unless overridden. Optional follow-up: special-case **`cat === 'browser'`** with a distinct OKLCH in `catColor` for clearer chip contrast; omit from this slice unless product requests it during implementation review.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Persisted fixtures or tests assume exactly four chips | Update integration/unit tests counting chips or DOM order |
| Older saved maps show Load rows under Mixer until opened | Hydration normalization + one-time migrate on decode |
| Category chip visuals similar for Browser and Mixer (shared device tint) | Document; optional tint override as follow-up |

## Migration Plan

1. Ship `dj.ts` type + defaults + hydrate normalization together.
2. Run existing `dj`/sidebar tests and add/adjust assertions for chip count and Browser label/order.
3. Rollback: revert `DJ_CATEGORIES` and defaults; strip hydration rule (sessions written under new code retain `browser` safely).

## Open Questions

None blocking; optional distinct Browser chip hue if UX review asks for differentiation from Mixer.
