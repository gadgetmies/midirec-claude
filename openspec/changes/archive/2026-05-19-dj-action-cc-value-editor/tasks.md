## 1. Data model: add OutputMapping.out discriminator

- [x] 1.1 Extend the `OutputMapping` interface in `src/data/dj.ts` with `out?: 'note' | 'cc' | 'pb'`
- [x] 1.2 Add a small derivation helper (`resolveOutKind(mapping): 'note' | 'cc' | 'pb'`) that returns the explicit `out` when set, otherwise `'cc'` when `cc !== undefined`, otherwise `'note'` — co-located with `OutputMapping` so all readers share it
- [x] 1.3 Unit-test the derivation helper across all combinations: `{ out: 'pb' }`, `{ out: 'cc' }`, `{ out: 'note' }`, legacy `{ cc: 7 }` (no `out`), bare `{}` (no `cc`, no `out`), and the mixed-stale case `{ cc: 7, out: 'note' }` → returns `'note'`

## 2. Scheduler: emit Pitch-bend on PB rows

- [x] 2.1 Add `emitPitchBend(channelByte: number, vel: number, ts: number)` to `src/midi/scheduler.ts` — converts `vel` to a 14-bit value (`Math.round(vel * 16383)`, clamped to `0..16383`), splits LSB/MSB, calls `output.send([0xE0 | channelByte, lsb, msb], ts)`
- [x] 2.2 In the unified DJ dispatch loop, branch on `resolveOutKind(outputMap[event.pitch])`:
  - `'pb'` → call `emitPitchBend(...)`; do NOT enqueue note-on/note-off; do NOT enqueue CC; do NOT add to `activeNoteOns`; DO register `(outputId, channelByte)` in `channelsActivated` so the All-Notes-Off broadcast still fires for the channel
  - `'cc'` → existing CC-out path (with the back-compat clarification: `out === 'cc'` AND `cc` absent/out-of-range → silently skip; `out === 'note'` with stale `cc` → take the note path)
  - `'note'` → existing note-mode path (unchanged)
- [x] 2.3 Unit-test the branch matrix with seeded events: PB row emits one `0xE_`, CC row emits one `0xB_`, note row emits the note-on/note-off pair; verify `activeNoteOns` only gains keys for the note path; verify back-compat for legacy `{ cc: 7 }` (no `out`)
- [x] 2.4 Unit-test PB value coverage: `vel === 0` → `[0xE_, 0x00, 0x00]`; `vel === 0.5` → `[0xE_, 0x00, 0x40]`; `vel === 1` → `[0xE_, 0x7F, 0x7F]`

## 3. Scheduler: tick-0 PB center and PB-center panic

- [x] 3.1 At play start (transport `mode` → `'play'`), before the first scheduled event dispatches, compute the set of `(outputId, channelByte)` pairs that have at least one row with `resolveOutKind === 'pb'` across the session; emit one `output.send([0xE0 | channelByte, 0x00, 0x40], <now>)` per pair
- [x] 3.2 Track those pairs (re-use or extend the existing `channelsActivated` structure with a per-pair "has-PB-row" flag) so the panic flush can broadcast PB center later
- [x] 3.3 Extend the panic flush in `src/midi/scheduler.ts`:
  1. Note-offs for `activeNoteOns` (existing)
  2. All-Notes-Off (`0xB_ 0x7B 0x00`) for every `(outputId, channelByte)` in `channelsActivated` (existing)
  3. **NEW**: PB-center (`0xE_ 0x00 0x40`) for every `(outputId, channelByte)` flagged as "has-PB-row"
  4. Clear state (existing)
- [x] 3.4 Unit-test play-start tick-0 emits: PB-only session → one `0xE_` per channel; CC-only session → no `0xE_`; mixed session → `0xE_` only for the PB channels
- [x] 3.5 Unit-test panic ordering: note-offs first, then `0xB_ 0x7B`, then `0xE_ 0x00 0x40`; verify PB-center fires even when the session emitted no PB events (row existence is enough)

## 4. New value-editor component scaffold

- [x] 4.1 Create `src/components/dj-value-editor/DJValueEditor.tsx` with a stub that renders `null` until selection-derived mode is non-hidden
- [x] 4.2 Create `src/components/dj-value-editor/DJValueEditor.css` with the editor root (`.mr-dj-value-editor`), header strip (`.mr-dj-value-editor__hdr`), close chip (`.mr-dj-value-editor__close`), canvas (`.mr-dj-value-editor__canvas`), bulk-op strip (`.mr-dj-value-editor__bulk`), and legend (`.mr-dj-value-editor__legend`); colors use existing `var(--mr-*)` tokens only
- [x] 4.3 Implement `deriveEditorMode(stage): { kind: 'cc' | 'pb' | 'at' | 'hidden'; target?: ... }` as a pure function exported from the component module (or a sibling `mode.ts`); use `resolveOutKind` from step 1
- [x] 4.4 Wire the component into `src/components/shell/AppShell.tsx` so it mounts as a direct child of `.mr-shell` between the center column and `.mr-statusbar`, only when `deriveEditorMode(...).kind !== 'hidden'`
- [x] 4.5 Unit-test `deriveEditorMode` across the full selection matrix (CC row, PB row, legacy CC row with no `out`, AT event, trigger-only row, multi-item, neither selected)

## 5. Editor canvas: scroll mirror + sizing

- [x] 5.1 Locate the timeline scroll container ref (a `useRef<HTMLDivElement>` on `.mr-timeline` or equivalent); expose it via a shared ref store / context so the editor can read `scrollLeft` from outside the timeline
- [x] 5.2 In the editor canvas, subscribe to the timeline's `scroll` event with `{ passive: true }`; rAF-batch the read and apply `transform: translateX(-scrollLeft)` to the inner content
- [x] 5.3 Read `pxPerBeat` from the same source the timeline uses (likely `useStage` or `useTransport`); derive `pxPerTick = pxPerBeat / DEFAULT_MIDI_TPQ`
- [x] 5.4 Implement resize: 24px header strip top edge with `cursor: row-resize`; pointer-drag adjusts the canvas height (clamped `48..400`); persist to `localStorage['mr.dj-value-editor.heightPx']` debounced ~200ms; restore on mount with the same clamp
- [x] 5.5 Unit-test the localStorage round-trip (mount with no value → 96; mount with stored value `180` → 180; resize to 600 → clamped to 400 → persisted as `400`)

## 6. Editor canvas: render bars

- [x] 6.1 Render the header strip's left label: track name + row label/pitch + output specifier (`CC #<n>` for CC, `PB` for PB, `Pressure · event <i+1>/<count>` for AT)
- [x] 6.2 Render the close chip; wire its click handler to call `setDJEventSelection(null)` in AT mode and `setDJActionSelection(null)` in CC/PB mode
- [x] 6.3 Render the canvas with quantize-grid lines at `quantizeGridToTicks(quantizeGrid)` (faint stroke); in PB mode also draw a 1px dashed horizontal center line at `y = canvasHeight / 2`
- [x] 6.4 CC/PB mode: for each `ActionEvent` on the selected row inside the visible tick window, render one bar at `event.tTicks * pxPerTick` with height proportional to `event.vel`; reuse the existing bar-rendering primitive from `ParamLane` where possible
- [x] 6.5 AT mode: render the 16-bin bar-graph computed via `rasterizePressure(currentPressurePoints, 16)` positioned across the event span; render the window-mask overlay outside the span
- [x] 6.6 Render the bulk-op strip (`Smooth`, `Flatten`, `Clear` chips) and the value-scale legend (`0`/`0.5`/`1` for CC/AT, `−`/`0`/`+` for PB)

## 7. Editor gestures: paint and shift-interpolate

- [x] 7.1 Create `src/components/dj-value-editor/gestures.ts` with pure helpers: `snapTickForWrite(clientX, canvasRect, scrollLeft, pxPerTick, quantizeOn, quantizeGrid, snapAbsoluteOn)`, `clientYToVel(clientY, canvasRect)`, `cellsBetween(t0, t1, gridTicks)`
- [x] 7.2 Unit-test `snapTickForWrite` for `quantizeOn === false` (no snap), `quantizeOn === true && snapAbsoluteOn === true` (nearest grid cell), `quantizeOn === true && snapAbsoluteOn === false` (floor to grid cell)
- [x] 7.3 Implement the pointer state machine in `DJValueEditor.tsx`:
  - `pointerdown` (button 0): record `(t0, v0)`; if shift-anchor exists AND shift held → branch to interpolate (step 7.5); otherwise write one point and set shift-anchor to `(t0, v0)`; `setPointerCapture(pointerId)`
  - `pointermove` (during paint): compute new snapped tick + value; if snapped tick differs from previous frame → write/replace point at the new cell; if same cell → replace its `vel` with the current cursor value
  - `pointerup`: set shift-anchor to last painted cell; release pointer capture
- [x] 7.4 Implement right-click delete (`pointerdown` button 2): suppress `contextmenu` via `preventDefault`; delete point at snapped tick; on `pointermove` delete every cell crossed; right-click SHALL NOT modify the shift-anchor
- [x] 7.5 Implement shift+click interpolation: compute cells between anchor and new endpoint at the active grid; write interpolated `vel` at each cell; remove pre-existing points strictly inside `(min(t0,t1), max(t0,t1))` that don't fall on a written cell; set new anchor to `(t1, v1)`
- [x] 7.6 Wire the writes:
  - CC/PB mode: dispatch to `track.events` via the existing `setDJEvent...` mutators (or extend with a new `upsertDJEvent(trackId, pitch, tTicks, vel)` action if the existing mutators don't support upsert-by-tick); compute the new `events` array such that re-rendering produces the painted state
  - AT mode: convert each write's `tTicks → noteRelativeT`; dispatch `setEventPressure(trackId, pitch, eventIdx, nextPoints)` once per write
- [x] 7.7 Tests covering: single click writes one event; click-and-drag across three cells writes three events; backwards motion does not delete cells; re-crossing rewrites `vel`; shift+click interpolates with the documented endpoint set; shift+click without anchor falls back to single click; interpolation removes off-grid points strictly inside the range; right-click on empty cell is a no-op; right-click on existing point removes it; right-drag deletes multiple cells; AT-mode outside-span clicks are no-ops; AT-mode boundary click clamps to `t === 1.0`

## 8. Bulk-op chips

- [x] 8.1 Create `src/components/dj-value-editor/bulkOps.ts` with helpers: `rasterizeRowEvents(events, rowPitch, rangeStart, rangeEnd, bins=16)`, `smoothRangeInPlace(events, rowPitch, rangeStart, rangeEnd)`, `flattenRangeInPlace(events, rowPitch, rangeStart, rangeEnd)`, `clearRangeInPlace(events, rowPitch, rangeStart, rangeEnd)` — pure functions returning new arrays
- [x] 8.2 Wire the Smooth chip: in CC/PB mode, replace events in the viewport range with 16 evenly-spaced events at the smoothed values; in AT mode, dispatch `setEventPressure(..., smoothPressure(currentPressurePoints))` (materialising `synthesizePressure(event)` first when `pressure === undefined`)
- [x] 8.3 Wire the Flatten chip with the same range semantics; for AT mode use `flattenPressure`
- [x] 8.4 Wire the Clear chip: CC/PB removes events in the viewport; AT writes `setEventPressure(..., [])`
- [x] 8.5 Tests: Smooth in CC mode produces 16 evenly-spaced events in the viewport and leaves events outside untouched; Flatten in AT produces a 16-point uniform array; Clear in CC removes only in-viewport events; Clear in AT writes empty array

## 9. Retire Inspector PressureEditor

- [x] 9.1 Remove the pressure section JSX from `src/components/inspector/ActionPanel.tsx` (the `.mr-pressure` block and its `Smooth`/`Flatten`/`Clear`/`Curve`/`Step` controls)
- [x] 9.2 Delete `src/components/inspector/PressureEditor.css`
- [x] 9.3 Remove `summarizePressure` and `clearPressure` exports from `src/data/pressure.ts` (keep `synthesizePressure`, `rasterizePressure`, `smoothPressure`, `flattenPressure`)
- [x] 9.4 Find and remove every caller of `summarizePressure` / `clearPressure` in the codebase (grep first; the only known caller is the Inspector pressure section being removed in 9.1)
- [x] 9.5 Remove or rewrite tests asserting against `.mr-pressure` / `.mr-pressure__graph` / `.mr-pressure__summary` / `.mr-pressure__bulk` / `.mr-pressure__mode` DOM
- [x] 9.6 If no remaining consumer of `useStage().pressureRenderMode` / `setPressureRenderMode` exists, mark them for removal in a follow-up — keep them in this change to avoid scope creep; lane-body rendering in `ActionRoll` continues to read the value

## 10. OpenSpec archive

- [x] 10.1 After `openspec apply` finalises, move `openspec/specs/dj-pressure-editor/spec.md` under `openspec/specs/_archived/` (preserving the directory structure: `_archived/dj-pressure-editor/spec.md`); commit the move in the same change
- [ ] 10.2 Verify the new `openspec/specs/dj-value-editor/spec.md` exists with the migrated type-contract and helper-purity requirements — deferred until `openspec archive` runs; capability spec currently lives at `openspec/changes/dj-action-cc-value-editor/specs/dj-value-editor/spec.md`
- [x] 10.3 Run `openspec status` and confirm `dj-pressure-editor` no longer appears in the active capability list — verified via `openspec list --specs`

## 11. Manual verification

- [ ] 11.1 Start dev server. Confirm the editor footer is hidden with no DJ selection
- [ ] 11.2 Select a CC-output row (e.g. mixer crossfader via Inspector mapping): editor mounts in CC mode; close `✕` clears the selection and unmounts the editor
- [ ] 11.3 Paint a few CC values via single click; verify the in-lane `cc-group` strip in `ActionRoll` updates in lockstep
- [ ] 11.4 Drag-paint across a span; verify every quantize cell gains a point; backwards drag does not delete
- [ ] 11.5 Shift+click from a previous point; verify a linear ramp materialises and any prior off-grid points strictly inside the range are removed
- [ ] 11.6 Right-click + right-drag; verify points delete and no browser context menu appears
- [ ] 11.7 Toggle `quantizeOn` mid-paint; new writes follow the new grid, old points stay put
- [ ] 11.8 Add a PB-output row (set `outputMap[pitch].out = 'pb'` via Inspector form once available, or via a temporary seed); editor switches to PB mode with the center-line dash; paint values and verify pitch-bend messages reach the connected MIDI output (use a MIDI monitor to confirm `0xE_ LSB MSB`); on stop, verify the receiver returns to PB center
- [ ] 11.9 Select an event on a `pressure: true` row; editor switches to AT mode with the window-mask; paint values inside the span; verify clicks outside the span are ignored
- [ ] 11.10 Trigger the Smooth/Flatten/Clear chips in all three modes and confirm the documented range semantics
- [ ] 11.11 Resize the editor by dragging the header strip's top edge; reload the page and confirm the persisted height returns; resize past 400 to confirm the clamp
