## ADDED Requirements

### Requirement: PianoRoll notes support horizontal drag-to-move with quantize-aware snapping

The `PianoRoll` component SHALL accept an optional callback prop `onNoteMove?: (noteIndex: number, nextTTicks: number) => void`. When defined, each rendered `.mr-note` SHALL participate in a pointer-driven horizontal drag gesture in addition to its existing click-to-select behavior.

Gesture semantics:

1. On `pointerdown` on a `.mr-note`, the renderer SHALL record the pointer X (`px0`), the note's current `tTicks` (`tick0`), and the note index, and SHALL call `element.setPointerCapture(event.pointerId)` so subsequent move/up events stay routed to the note element.
2. On `pointermove`, the renderer SHALL compute `deltaPx = currentClientX - px0` and `deltaTicks = round(deltaPx / pxPerTick)`. If `abs(deltaPx) < 3`, the gesture SHALL remain in the "click" pre-state and no preview reposition SHALL occur.
3. Once `abs(deltaPx) >= 3` for the first time, the gesture SHALL transition to "drag" state and the note element SHALL re-render at the snapped preview tick described in (4) on each subsequent move event. Once in "drag" state, the gesture SHALL NOT revert to "click" state for the remainder of the gesture, even if the pointer returns within 3 px of `px0`.
4. The preview tick SHALL be computed by snapping the **delta**, not the absolute final position:
   - `deltaTicksRaw = round(deltaPx / pxPerTick)`
   - If transport `quantizeOn === true`: `deltaTicks = round(deltaTicksRaw / snap) * snap` where `snap = quantizeGridToTicks(transport.quantizeGrid)`.
   - Else: `deltaTicks = deltaTicksRaw`.
   - `finalTick = max(0, tick0 + deltaTicks)`.
   - Snapping the delta (rather than `tick0 + deltaTicksRaw`) preserves the item's original off-grid offset so that a note placed off-grid stays off-grid under drag.
5. On `pointerup`:
   - If the gesture never left "click" pre-state, the existing `onNoteSelect(noteIndex)` callback (if defined) SHALL fire and `onNoteMove` SHALL NOT be invoked.
   - If the gesture entered "drag" state, `onNoteMove(noteIndex, finalTick)` SHALL be invoked exactly once with the final snapped tick, and `onNoteSelect` SHALL NOT additionally fire for this gesture.
6. On `pointercancel`, the gesture SHALL be aborted: no `onNoteMove` or `onNoteSelect` SHALL fire and the preview state SHALL reset so the note re-renders at its committed `tTicks` on the next render.

The gesture SHALL only mutate the horizontal axis. The note's `pitch` SHALL NOT change as a result of this gesture, regardless of vertical pointer motion.

When `onNoteMove` is undefined, `.mr-note` elements SHALL retain existing click-to-select behavior unchanged and SHALL NOT participate in any drag-state machinery.

Orchestration code outside `PianoRoll` SHALL wire `onNoteMove` to the session-level `updateNoteAt(channelId, noteIndex, { tTicks: nextTTicks })` mutator already exposed by `useStage()`.

#### Scenario: Sub-threshold pointer motion is treated as click

- **WHEN** `<PianoRoll onNoteSelect={selectFn} onNoteMove={moveFn} notes={[one note]} />` is rendered and the user presses on the note, moves the pointer 2 px horizontally, and releases
- **THEN** `selectFn` SHALL be called exactly once with the note's index
- **AND** `moveFn` SHALL NOT be called

#### Scenario: Quantize on snaps the delta to grid

- **WHEN** the transport reports `quantizeOn: true` and `quantizeGrid: '1/4'` (TPQ=480 → snap=480), `pxPerTick=0.1833…` (pxPerBeat=88), and the user drags a note starting at `tTicks=0` by 540 px to the right and releases
- **THEN** `onNoteMove` SHALL be called exactly once with `(noteIndex, 2880)` — `deltaTicksRaw = round(540 / 0.1833…) = 2945`, `deltaTicks = round(2945 / 480) * 480 = 2880`, `finalTick = 0 + 2880 = 2880`

#### Scenario: Off-grid item preserves its offset when snap-dragged

- **WHEN** the transport reports `quantizeOn: true` and `quantizeGrid: '1/16'` (snap=120 at TPQ=480), `pxPerTick=0.1833…`, and the user drags a note starting at `tTicks=154` by 22 px to the right and releases
- **THEN** `deltaTicksRaw = round(22 / 0.1833…) = 120`, `deltaTicks = round(120 / 120) * 120 = 120`, `finalTick = 154 + 120 = 274`
- **AND** `onNoteMove` SHALL be called exactly once with `(noteIndex, 274)`
- **AND** the note's original off-grid offset of 34 ticks (154 mod 120) SHALL be preserved in the final position (274 mod 120 === 34)

#### Scenario: Quantize off uses pixel-to-tick conversion

- **WHEN** the transport reports `quantizeOn: false`, `pxPerTick=0.1833…`, and the user drags a note starting at `tTicks=120` by 100 px to the right and releases
- **THEN** `onNoteMove` SHALL be called exactly once with `(noteIndex, 120 + round(100 / 0.1833…))` — `(noteIndex, 120 + 546) = (noteIndex, 666)`

#### Scenario: Drag is clamped to non-negative ticks

- **WHEN** the user drags a note starting at `tTicks=240` by -1000 px to the left and releases (with any quantize state)
- **THEN** `onNoteMove` SHALL be called exactly once with `nextTTicks === 0`

#### Scenario: Pointer cancel aborts the gesture

- **WHEN** the user begins dragging a note past the 3 px threshold and then the browser fires `pointercancel`
- **THEN** neither `onNoteMove` nor `onNoteSelect` SHALL be invoked for the gesture
- **AND** the note's rendered `left` on the next render SHALL match its committed `tTicks * pxPerTick - viewT0Ticks * pxPerTick` value (no leftover preview offset)

#### Scenario: Drag commits exactly once

- **WHEN** the user drags a note across multiple `pointermove` events past the threshold, then releases
- **THEN** `onNoteMove` SHALL be invoked exactly once per gesture (on `pointerup`), regardless of the number of intermediate `pointermove` events

#### Scenario: Pitch is preserved across the gesture

- **WHEN** the user drags a note horizontally and the pointer also moves vertically by any amount
- **THEN** the committed mutation SHALL only change `tTicks`; the note's `pitch` SHALL be unchanged
