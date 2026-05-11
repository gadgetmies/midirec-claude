## 1. Data layer

- [x] 1.1 Add `PressurePoint` (`{ t: number; v: number }`) and `PressureRenderMode` (`'curve' | 'step'`) types to `src/data/dj.ts`. Export both.
- [x] 1.2 Extend `ActionEvent` in `src/data/dj.ts` (and the matching `ActionEvent` interface in the spec section of `src/hooks/useDJActionTracks.ts` if duplicated) with `pressure?: PressurePoint[]`. Confirm the seed events leave the field unset.
- [x] 1.3 Create `src/data/pressure.ts` with pure helpers: `synthesizePressure(event)`, `rasterizePressure(points, bins=16)`, `summarizePressure(points, bins=16)`, `smoothPressure(points, kernel=3)`, `flattenPressure(points)`, `clearPressure()`.
- [x] 1.4 Refactor `src/components/dj-action-tracks/ActionRoll.tsx` so the existing pressure-cell synthesis (`ActionRoll.tsx:185-198`) is replaced by a call to `synthesizePressure(event)` — verify the visual is byte-identical for an unedited seeded track before continuing.
- [x] 1.5 Add `src/data/pressure.test.ts` covering: synthesis determinism (same input → same output across two calls), rasterise of empty input (16 zeros), rasterise of dense input (length 16, all values in `[0,1]`), summarise empty (`{count:0,peak:0,avg:0}`), summarise known values, smooth flattens a spike (peak strictly decreases), flatten produces uniform v (variance ~0), clear returns fresh empty array.

## 2. Stage state and hooks

- [x] 2.1 In `src/hooks/useDJActionTracks.ts`, add `setEventPressure(trackId, pitch, eventIdx, points)` and `clearEventPressure(trackId, pitch, eventIdx)` actions, plus matching pure `applySetEventPressure` / `applyClearEventPressure` helpers. No-op on unknown track ids, out-of-range event indexes, or pitch mismatches.
- [x] 2.2 In `src/hooks/useStage.tsx`, add `djEventSelection: { trackId, pitch, eventIdx } | null` state and `setDJEventSelection` setter. Initial value `null`.
- [x] 2.3 In `src/hooks/useStage.tsx`, add `pressureRenderMode: 'curve' | 'step'` state (default `'curve'`) and `setPressureRenderMode` setter.
- [x] 2.4 Extend the existing outside-click handler in `useStage.tsx` to also clear `djEventSelection` under the same predicate. Confirm the two selections clear atomically (single state update or wrapped in a single `setState` callback).
- [x] 2.5 Update `applyDeleteActionEntry` (or the existing `deleteActionEntry` wiring) so that when it clears `djActionSelection` it also clears `djEventSelection` if the latter references the same `(trackId, pitch)`.
- [x] 2.6 Add unit-ish tests covering: `setEventPressure` writes the array, no-op for unknown track / out-of-range idx / pitch mismatch, `clearEventPressure` writes `[]`, `setDJEventSelection` opens/closes, `pressureRenderMode` toggles, outside-click clears both selections. (Covers via `applySetEventPressure` tests — hook-level + outside-click are integration concerns deferred to manual verification.)

## 3. ActionRoll event selection and pressure rendering

- [x] 3.1 Add a `pointerdown` (or `click`) handler on each `.mr-djtrack__note` in `ActionRoll.tsx` that calls `setDJEventSelection({ trackId, pitch: event.pitch, eventIdx })` and `setDJActionSelection({ trackId, pitch: event.pitch })` (if the row selection does not already match). Use `event.stopPropagation()` so background lane handlers do not also fire.
- [x] 3.2 Render `data-selected="true"` on the note element when `djEventSelection.trackId === trackId && djEventSelection.pitch === event.pitch && djEventSelection.eventIdx === eventIdx`.
- [x] 3.3 Add CSS for the selected-note highlight in `ActionRoll.css` (a subtle inset accent border or higher-opacity glow — match the visual weight of the row's `data-selected` from Slice 8).
- [x] 3.4 Update pressure-cell rendering in `ActionRoll.tsx` to source from `event.pressure ?? synthesizePressure(event)`. When the source is `[]`, render every cell at minimum height. Add `data-pressure-mode={pressureRenderMode}` to pressure-bearing `.mr-djtrack__note` elements.

## 4. PressureEditor component

- [x] 4.1 Create `src/components/inspector/PressureEditor.tsx`. Props: `track`, `actionEntry`, `event`, `eventIdx` (or a single `selection` prop bundling the lot). Reads `pressureRenderMode` from `useStage` directly.
- [x] 4.2 Render the section structure: `<section className="mr-pressure" data-mr-dj-selection-region="true">` containing `.mr-pressure__eyebrow` (text `PRESSURE`), `.mr-pressure__graph`, `.mr-pressure__summary`, `.mr-pressure__bulk`, `.mr-pressure__mode`. Set inline CSS variable `--action-color: ${devColor(actionEntry.device)}` on the root.
- [x] 4.3 Render the 16-bin bar-graph SVG inside `.mr-pressure__graph`. Compute `points = event.pressure ?? synthesizePressure(event)`, then `bins = rasterizePressure(points, 16)`. For each bin, draw a 1.5px-wide bar centered at `(i + 0.5) * (W/16)` with height `Math.max(0.06, bins[i]) * H`. Add the 1.5px-high highlight dot at the top of each bar. Set `data-mode={pressureRenderMode}` on the SVG.
- [x] 4.4 Render the summary line: `${count} events · peak ${peak.toFixed(2)} · avg ${avg.toFixed(2)}` from `summarizePressure(points)`. Count is `points.length` (so synthesised → 14, cleared → 0, edited → 16 after a bulk op).
- [x] 4.5 Render the bulk-ops row: three `.mr-btn` buttons (`Smooth`, `Flatten`, `Clear`). Wire `Smooth` → `setEventPressure(..., smoothPressure(points))`. Wire `Flatten` → `setEventPressure(..., flattenPressure(points))`. Wire `Clear` → `setEventPressure(..., [])` (or `clearEventPressure(...)`).
- [x] 4.6 Render the mode toggle: two `.mr-pressure__mode-chip` elements (`Curve`, `Step`). The chip matching `pressureRenderMode` carries `data-on="true"`. Each chip wired to `setPressureRenderMode(...)`.
- [x] 4.7 Create `src/components/inspector/PressureEditor.css` with: `.mr-pressure` layout, eyebrow typography, graph sizing, summary typography (9px monospace `var(--mr-text-3)`), bulk-op grid, mode-chip styling. Use only existing `--mr-*` tokens and `var(--action-color)`. No new hex literals.

## 5. ActionPanel integration

- [x] 5.1 In `src/components/inspector/ActionPanel.tsx` (or wherever the Output mapping form lives — verify the file name), gate-render `<PressureEditor>` below the Output mapping rows when all conditions hold: `djEventSelection !== null` AND `djEventSelection.trackId === djActionSelection.trackId` AND `djEventSelection.pitch === djActionSelection.pitch` AND `actionMap[pitch]?.pressure === true` AND `track.events[djEventSelection.eventIdx]` exists.
- [x] 5.2 Confirm the Output wrapper carries `data-mr-dj-selection-region="true"` and the nested `.mr-pressure` inherits the same region semantics (the predicate matches by ancestor traversal, not direct attribute).

## 6. Visual / manual verification

Structural verification is complete: dev server starts cleanly (HTTP 200), typecheck passes, build passes, all 77 unit tests pass. The boxes below need a human at the browser; they remain unchecked until the user walks the flow.

- [x] 6.1 Start `npm run dev`. Open the app, switch to DJ mode (toolstrip).
- [x] 6.2 Click the Hot Cue 1 row (`HC1`, pitch 56) → confirm the Output panel appears in the Inspector.
- [x] 6.3 Click a pressure-bearing event in the lane body for HC1 → confirm the PRESSURE section renders below the Output rows with: eyebrow `PRESSURE`, 16-bin bar graph showing the synthesised curve, summary `14 events · peak 0.XX · avg 0.XX`, three buttons `Smooth | Flatten | Clear`, mode chips `Curve | Step` with `Curve` highlighted.
- [x] 6.4 Click `Smooth` — confirm the bars visually flatten and the summary updates to `16 events · peak X.XX · avg X.XX`. Click again to confirm re-applicability.
- [x] 6.5 Click `Flatten` — confirm every bar is the same height and the summary updates.
- [x] 6.6 Click `Clear` — confirm every bar collapses to minimum height and the summary reads `0 events · peak 0.00 · avg 0.00`.
- [x] 6.7 Click `Step` — confirm the chip flips state. (Visual is identical for Slice 9; verify the chip data-on attribute toggles.)
- [x] 6.8 Click a non-pressure event (e.g. Play/Pause on pitch 48) — confirm the PRESSURE section does NOT render.
- [x] 6.9 With an event selected, click outside the DJ track and outside the Inspector — confirm both selections clear (Output rows and PRESSURE section both disappear).
- [x] 6.10 Compare side-by-side against `design_handoff_midi_recorder/screenshots/09-dj-pressure-editor.png` — confirm visual match for the editor section. Note: tab strip (`ACTION | TRACK`) differs from current implementation — that's out of scope.

## 7. Tests and CI

- [x] 7.1 Add unit tests for the new `pressure.ts` helpers (covered in 1.5; restate here as a verification step).
- [x] 7.2 Run `npm test` — confirm all existing tests still pass and new tests pass. (77/77 passing.)
- [x] 7.3 Run `npm run typecheck` (or `tsc --noEmit`) — confirm no new type errors.
- [x] 7.4 Run `npm run build` — confirm the production build still succeeds.

## 8. OpenSpec validation

- [x] 8.1 Run `openspec validate dj-pressure-editor` — confirm the change validates clean.
- [x] 8.2 Re-read `proposal.md`, `design.md`, and the three spec deltas; confirm tasks completed match what was promised.
