## 1. Data model

- [x] 1.1 In `src/data/dj.ts`, replace `CategoryId` with `'deck' | 'mixer' | 'fx' | 'global'` and rebuild `DJ_CATEGORIES` (key order: `deck`, `mixer`, `fx`, `global`).
- [x] 1.2 Migrate `DEFAULT_ACTION_MAP`: set `cat: 'deck'` for all former `transport`, `cue`, `loop`, and `hotcue` rows; set `cat: 'global'` for Tap Tempo (`tap`); set `.cat` for Load Deck rows to `'mixer'` (was `'deck'`).
- [x] 1.3 Replace `actionMode`'s trigger branch with an explicit predicate (curated `id` set or helper) that preserves today's trigger vs fallback split for Play/Cue/Sync/Rev rows without relying on retired categories; keep loop-style rows on **fallback**.
- [x] 1.4 Update `src/data/dj.test.ts` for new `CategoryId` and `actionMode` expectations.

## 2. Map Note UI

- [x] 2.1 Update `src/components/sidebar/InputMappingPanel.tsx` chip source to the four categories; adjust `catColor` / `actionsInCategory` as needed.
- [x] 2.2 Implement deck Action `<select>` dedupe by `(label, short)` with canonical representative ids (lowest pitch per group) and correct selected-state when `entry.id` is a non-canonical sibling (e.g. `play_b`).
- [x] 2.3 Manually verify: four chips in order Deck / Mixer / FX / Global; Tap Tempo under Global; no duplicate deck action labels; category auto-save still picks first template by pitch when switching chips.

## 3. Tests and fixtures

- [x] 3.1 Update `src/midi/scheduler.test.ts` and any other fixtures still using `'transport'` / `'cue'` / `'hotcue'` / `'loop'` as `cat`.
- [x] 3.2 Run full test suite (`pnpm test` or project equivalent) and fix regressions.

## 4. Spec archive readiness

- [x] 4.1 After code lands, run `/opsx:apply` follow-up to archive: merge deltas from `openspec/changes/map-note-category-tabs/specs/` into `openspec/specs/` per workflow.
