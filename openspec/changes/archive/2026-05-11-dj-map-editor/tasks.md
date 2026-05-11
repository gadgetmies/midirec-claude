## 1. Data model

- [x] 1.1 Add `TriggerMode` type and optional `trigger?: TriggerMode` on `ActionMapEntry` in `src/data/dj.ts`.
- [x] 1.2 Add `OutputMapping` type in `src/data/dj.ts`.
- [x] 1.3 Extend `dj.test.ts` to assert `DEFAULT_ACTION_MAP[*].trigger === undefined`, `TriggerMode` accepts both values, and `ActionMapEntry` accepts an explicit trigger.

## 2. Hook actions + state

- [x] 2.1 Add `outputMap: Record<number, OutputMapping>` field to `DJActionTrack`; seed default to `{}`.
- [x] 2.2 Add pure helpers `applySetActionEntry`, `applyDeleteActionEntry`, `applySetOutputMapping`, `applyDeleteOutputMapping` in `useDJActionTracks.ts`.
- [x] 2.3 Wire the helpers via `setActionEntry`, `deleteActionEntry`, `setOutputMapping`, `deleteOutputMapping` callbacks on the hook return.
- [x] 2.4 `applyDeleteActionEntry` also prunes the matching `outputMap` entry alongside `mutedRows`/`soloedRows`.
- [x] 2.5 Add `djActionSelection` state + `setDJActionSelection` setter to `useStage`. Wire `deleteActionEntry` in `useStage` to clear `djActionSelection` when it matches the deleted pitch.
- [x] 2.6 Expose `setOutputMapping` / `deleteOutputMapping` through `useStage`.
- [x] 2.7 Tests in `useDJActionTracks.test.ts` cover set/delete on both maps (new pitch, replace, no-op on unknown ids, no-op on absent pitch, pruning on action delete).

## 3. ActionKeys interaction

- [x] 3.1 Each `.mr-actkey` is focusable (`tabIndex={0}`).
- [x] 3.2 Click handler sets `djActionSelection` (skipped when the click lands on the M/S chip).
- [x] 3.3 `Enter` / `Space` keyboard handler mirrors the click.
- [x] 3.4 `data-selected="true"` attribute reflects the current selection on each row.
- [x] 3.5 CSS rule `.mr-actkey[data-selected="true"]` paints a tinted accent background + inset accent border.

## 4. Sidebar Map Note panel

- [x] 4.1 Create `src/components/sidebar/InputMappingPanel.tsx`. Returns `null` when no selection, no track, or no entry resolves.
- [x] 4.2 Render via the existing `<Panel>` primitive with title `Map Note`, wrapped in `data-mr-dj-selection-region="true"`.
- [x] 4.3 Header row: 24×24 swatch tinted by `devColor(entry.device)`, label + `pitchLabel(pitch) · note <pitch>` subtitle. Header label is `— unmapped —` when entry has no label.
- [x] 4.4 Category section: chips for each `DJ_CATEGORIES` key, active chip gets `data-on="true"` + category-color tinting via inline `borderColor` / `color` / `background: color-mix(...)`.
- [x] 4.5 Action section: full-width `<select class="mr-select">` filtered by `entry.cat`, sorted by numeric pitch.
- [x] 4.6 Two-column grid: Device select (all `DJ_DEVICES`), Trigger select (`momentary` / `toggle`).
- [x] 4.7 Footer: `Delete mapping` button with `data-danger="true"`.
- [x] 4.8 Auto-save semantics — every interaction commits via `setActionEntry` immediately, no Done/Cancel buttons.
- [x] 4.9 Category change overwrites `id`/`label`/`short`/`pad`/`pressure` from the first action in the new category.
- [x] 4.10 Action change overwrites `id`/`label`/`short`/`device`/`pad`/`pressure` from the matched template.
- [x] 4.11 Delete button calls `deleteActionEntry`; selection auto-clears because the entry no longer resolves.
- [x] 4.12 New `.mr-map-form__*` rules in `Sidebar.css`.

## 5. Sidebar mount

- [x] 5.1 `Sidebar.tsx` imports and mounts `<InputMappingPanel />` as the first child (above MIDI Inputs).

## 6. Inspector Output panel

- [x] 6.1 Inspector's Note tab branches on `djActionSelection`; renders the Output panel when set, falls back to the channel/roll Note panel otherwise.
- [x] 6.2 Panel wrapper carries `data-mr-dj-selection-region="true"`.
- [x] 6.3 Header: 28×28 swatch tinted by input `devColor`, label, `in <pitchLabel> · note <pitch>` subtitle.
- [x] 6.4 Eyebrow `Output` followed by a hint string when no `outputMap[pitch]` exists yet.
- [x] 6.5 Three `.mr-kv` rows: Device select, Channel `<input type="number" min="1" max="16">`, Pitch `<input type="number" min="0" max="127">` + readout via `pitchLabel`.
- [x] 6.6 `Delete output` button visible only when the mapping exists; calls `deleteOutputMapping`.
- [x] 6.7 Auto-save: every field change calls `setOutputMapping(trackId, pitch, merged)`. Channel + Pitch clamp via a local `clampInt` helper.
- [x] 6.8 New `.mr-insp__hint` / `.mr-insp__field` / `.mr-insp__pitch-row` / `.mr-insp__edit-action-row` rules in `Inspector.css`.

## 7. Outside-click blurs selection

- [x] 7.1 `useStage` registers a window `pointerdown` listener while `djActionSelection !== null`.
- [x] 7.2 Listener keeps selection when target is inside `.mr-djtrack` or `[data-mr-dj-selection-region]`; clears `djActionSelection` otherwise.
- [x] 7.3 Listener detaches when selection becomes null (no idle listener cost).

## 8. CSS primitives

- [x] 8.1 Added `.mr-select` primitive to `src/styles/forms.css` (ported from prototype).

## 9. Spec sync and validation

- [x] 9.1 `openspec validate dj-map-editor --strict` clean.
- [x] 9.2 `yarn typecheck` clean.
- [x] 9.3 `yarn test` clean (55 tests pass).
- [x] 9.4 `yarn build` succeeds.
- [x] 9.5 Manual visual verification: clicking an action row opens both panels; clicking outside blurs selection; auto-save commits on each field change; Delete on either side cleans up its half of the map; deleteAction also clears outputMap; trigger/output round-trip correctly.

## 10. Design documentation

- [x] 10.1 Add deviation #19 to `design/deviations-from-prototype.md` covering the Deck → Device label swap.
- [x] 10.2 The prototype-overlay→two-panel restructure is documented in `design.md` Decision 1 (no separate deviation entry needed; the prototype overlay is intentionally not ported).
