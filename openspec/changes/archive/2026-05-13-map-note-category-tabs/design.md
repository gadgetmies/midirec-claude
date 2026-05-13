## Context

Map Note (`InputMappingPanel`) drives `ActionMapEntry.cat` via `DJ_CATEGORIES` and filters the Action `<select>` using `DEFAULT_ACTION_MAP`. Row rendering and `actionMode()` in `src/data/dj.ts` still key trigger-style behavior off legacy categories (`transport`, `cue`, `hotcue`). Collapsing to four user-facing categories requires coordinated updates to data, UI filtering/deduping, and render-mode predicates without changing how MIDI I/O or timeline editing fundamentally works.

## Goals / Non-Goals

**Goals:**

- Four Map Note category chips only: **deck**, **mixer**, **fx**, **global** (DOM order), with labels `Deck`, `Mixer`, `FX`, `Global`.
- Persisted data: migrate `cat` on all `DEFAULT_ACTION_MAP` templates and any in-session entries—former `transport`, `cue`, `loop`, `hotcue` → `deck`; Tap Tempo → `global`; re-home **Load Deck** rows from the old `deck` category to **`mixer`** so “Deck” means deck-surface performance controls only.
- Deck Action dropdown: dedupe by `(label, short)` so paired Deck 1 / Deck 2 templates (e.g. `play` / `play_b`) appear once; selecting an option commits the canonical template `id` stored on that option (implementation picks one representative row per group—lowest pitch—while the separate Device select still lets the user aim at `deck1` vs `deck2`).
- Preserve trigger vs velocity vs pressure vs fallback note rendering after `cat` no longer exposes transport/cue/hotcue/loop.

**Non-Goals:**

- Renaming action `id`s globally (e.g. folding `play_b` into `play`) beyond what the Map Note dedupe UI requires.
- Changing `DJ_DEVICES`, piano-roll output semantics, or migration/version fields for older saved sessions (unless an existing migration hook already runs on load—then extend it if present).

## Decisions

1. **`CategoryId` becomes a four-literal union** (`'deck' | 'mixer' | 'fx' | 'global'`) exported from `src/data/dj.ts`, with `DJ_CATEGORIES` holding exactly those keys in chip order. *Alternatives:* keep seven literals and add a separate “Map Note tab” indirection—rejected as duplicate source of truth.

2. **Load-to-mixer**: `load_a` / `load_b` move from old `cat: 'deck'` to `cat: 'mixer'` because their `device` is `mixer` and the user model places loaders with the mixer bank. *Alternative:* keep under Deck chip—rejected to avoid mixing crossfader/load semantics under “Deck”.

3. **Trigger rendering predicate** replaces `action.cat ∈ {transport, cue, hotcue}` with an explicit helper (e.g. `isTriggerStyleAction(action)`) implemented as membership in a curated `Set` of `id` values derived from actions that were transport/cue without `pad`/`pressure` in the pre-change map, plus any additional trigger-style deck buttons as needed. **Loop** controls were never trigger-class under the old rules (`actionMode` used `fallback` for `loop`); they MUST remain fallback after migration—verified by ensuring their `id`s are **not** in the trigger set. *Alternative:* add a new persisted field—rejected to avoid schema churn.

4. **Deck Action dedupe**: group `DEFAULT_ACTION_MAP` entries with `cat === 'deck'` by `(label, short)`; sort groups by the minimum pitch in the group; for each group expose one `<option>` whose `value` is that row’s `id` (lowest pitch). When the user changes Device afterward, logic stays as today (device select commits independently). If product later wants auto-remapping `id` when Device flips (e.g. `hc1` ↔ `hc1_b`), that is out of scope unless raised in Open Questions.

5. **Category chip colors**: keep `catColor(cat)` behavior by deriving color from `devColor(first.device)` where `first` is the lowest-pitch `DEFAULT_ACTION_MAP` entry for that `cat`—stable and requires no new design tokens.

## Risks / Trade-offs

- **[Risk]** Sessions or tests storing legacy `cat` literals break at type/runtime — **Mitigation:** global find/replace in repo tests/fixtures; add a one-shot normalizer in the session load path if the app already centralizes hydration.
- **[Risk]** `isTriggerStyleAction` drifts from real trigger UX if new deck actions are added — **Mitigation:** co-locate the set beside `DEFAULT_ACTION_MAP` and add a unit test that fails if a former transport/cue row is omitted.
- **[Trade-off]** Deduped Deck Action list shows one representative `id`; Device may still disagree with template defaults until the user aligns them — acceptable per current two-select model.

## Migration Plan

1. Land code+data changes together in one change set.
2. Run `pnpm test` / existing CI.
3. Manually open Map Note on deck-heavy rows: confirm four chips, deduped deck actions, Tap Tempo under Global, trigger notes still 6px wide for Play/Cue/Sync.

## Open Questions

- Should changing Device between `deck1` and `deck2` auto-swap paired `id`s (`play` ↔ `play_b`)? Deferred—current spec preserves independent fields.
