## ADDED Requirements

### Requirement: DJ action events support horizontal drag-to-move with quantize-aware snapping

The `ActionRoll` component SHALL implement a pointer-driven horizontal drag gesture on every `.mr-djtrack__note` element (any of its `--trigger`, `--velocity`, `--pressure`, and `--fallback` variants) and on every `.mr-djtrack__cc` element. The gesture SHALL preserve existing click-to-select semantics: a click without sufficient pointer motion SHALL still set `djEventSelection` (and `djActionSelection` as today).

Gesture semantics:

1. On `pointerdown` on a `.mr-djtrack__note` or `.mr-djtrack__cc`, the renderer SHALL record the pointer X (`px0`), the event's current `tTicks` (`tick0`), the event identity (`trackId`, `pitch`, `eventIdx` for single notes; `trackId`, `pitch`, and the full `memberIndices` array for CC groups), and SHALL call `element.setPointerCapture(event.pointerId)`.
2. On `pointermove`, the renderer SHALL compute `deltaPx = currentClientX - px0` and `deltaTicks = round(deltaPx / pxPerTick)` where `pxPerTick = pxPerBeat / DEFAULT_MIDI_TPQ`. If `abs(deltaPx) < 3`, the gesture SHALL remain in "click" pre-state and no preview reposition SHALL occur.
3. Once `abs(deltaPx) >= 3` for the first time, the gesture SHALL transition to "drag" state and the dragged element SHALL re-render at the preview tick computed in (4) on each subsequent move. The transition SHALL be one-way for the lifetime of the gesture.
4. Preview tick — the **delta** is what snaps, not the absolute final position:
   - `deltaTicksRaw = round(deltaPx / pxPerTick)`.
   - If transport `quantizeOn === true`: `deltaTicks = round(deltaTicksRaw / snap) * snap` where `snap = quantizeGridToTicks(transport.quantizeGrid)`. Else: `deltaTicks = deltaTicksRaw`.
   - For a single event: `finalTick = max(0, tick0 + deltaTicks)`.
   - For a CC group: `groupDeltaTicks` SHALL equal `deltaTicks`, clamped upward so that `earliestMemberTTicks + groupDeltaTicks >= 0`. Every member's preview position SHALL be `originalMemberTTicks + groupDeltaTicks`, preserving relative spacing inside the group and any pre-existing off-grid offsets.
   - Snapping the delta (rather than the absolute final tick) preserves each event's original off-grid offset so that a CC point or trigger placed off-grid stays off-grid under drag.
5. On `pointerup`:
   - If still in "click" pre-state: the existing selection handler SHALL fire (`setDJEventSelection`, plus `setDJActionSelection` when the focused row differs) and no `tTicks` mutation SHALL be dispatched.
   - If in "drag" state for a single event: `setDJEventTTicks(trackId, pitch, eventIdx, finalTick)` SHALL be invoked exactly once. Selection state SHALL NOT additionally change as a result of the drag.
   - If in "drag" state for a CC group: `setDJEventTTicks(trackId, pitch, memberEventIdx, memberOriginalTTicks + groupDeltaTicks)` SHALL be invoked once per member in `memberIndices`. All N calls SHALL use the same `groupDeltaTicks`.
6. On `pointercancel`, the gesture SHALL be aborted with no mutation and no selection change; the dragged element SHALL re-render at its committed `tTicks` on the next render.

The gesture SHALL only mutate the horizontal axis. The event's `pitch` SHALL NOT change regardless of vertical pointer motion. The event's `durTicks`, `vel`, and `pressure` SHALL NOT be affected.

`quantizeGridToTicks(grid, tpq?)` SHALL be a pure helper exported from `src/midi/` (the same helper used by `piano-roll`'s drag gesture). The mapping SHALL be:

| `grid` | ticks |
|--------|-------|
| `'1/4'`  | `tpq` |
| `'1/8'`  | `tpq / 2` |
| `'1/16'` | `tpq / 4` |
| `'1/32'` | `tpq / 8` |

When `tpq` is omitted, `DEFAULT_MIDI_TPQ` SHALL be used.

#### Scenario: Sub-threshold pointer motion is treated as click

- **WHEN** the user presses on a `.mr-djtrack__note`, moves the pointer 2 px horizontally, and releases
- **THEN** `setDJEventSelection` SHALL be called with the event's identity (existing click behavior)
- **AND** `setDJEventTTicks` SHALL NOT be called

#### Scenario: Quantize-on drag snaps the delta to grid

- **WHEN** the transport reports `quantizeOn: true` and `quantizeGrid: '1/16'` (TPQ=480 → snap=120), and the user drags a trigger event from `tTicks=0` so that `deltaTicksRaw=145` and releases
- **THEN** `deltaTicks = round(145 / 120) * 120 = 120`, `finalTick = 0 + 120 = 120`
- **AND** `setDJEventTTicks` SHALL be called exactly once with `nextTTicks === 120`

#### Scenario: Off-grid event preserves its offset when snap-dragged

- **WHEN** the transport reports `quantizeOn: true` and `quantizeGrid: '1/16'` (snap=120), and the user drags an event from `tTicks=154` so that `deltaTicksRaw=120` and releases
- **THEN** `deltaTicks = round(120 / 120) * 120 = 120`, `finalTick = 154 + 120 = 274`
- **AND** `setDJEventTTicks` SHALL be called exactly once with `nextTTicks === 274`
- **AND** the event's original 34-tick off-grid offset SHALL be preserved (274 mod 120 === 34)

#### Scenario: Quantize-off drag commits raw pixel-converted ticks

- **WHEN** the transport reports `quantizeOn: false`, `pxPerTick = 88/480 ≈ 0.1833`, and the user drags an event from `tTicks=480` by 50 px to the left and releases
- **THEN** `setDJEventTTicks` SHALL be called exactly once with `nextTTicks === 480 + round(-50 / 0.1833) === 480 - 273 === 207`

#### Scenario: Drag is clamped to non-negative ticks

- **WHEN** the user drags an event from `tTicks=60` by -5000 px to the left and releases
- **THEN** `setDJEventTTicks` SHALL be called exactly once with `nextTTicks === 0`

#### Scenario: CC group drag shifts every member by the same delta

- **WHEN** a CC group has members at ticks `[480, 540, 600]`, the transport reports `quantizeOn: true` and `quantizeGrid: '1/8'` (snap=240), and the user drags the representative `.mr-djtrack__cc` element by `deltaTicksRaw=240` and releases
- **THEN** `deltaTicks = round(240 / 240) * 240 = 240`, `groupDeltaTicks === 240`
- **AND** `setDJEventTTicks` SHALL be called exactly three times — once per member — with `nextTTicks` values `720`, `780`, and `840` respectively (each is `originalTTicks + 240`)
- **AND** no member SHALL be reassigned a tick value derived independently of the others
- **AND** the group's internal spacing (60-tick gaps between members) SHALL be preserved

#### Scenario: Pointer cancel aborts the gesture for both single events and CC groups

- **WHEN** the user begins dragging past the 3 px threshold and the browser fires `pointercancel`
- **THEN** `setDJEventTTicks` SHALL NOT be called
- **AND** `setDJEventSelection` SHALL NOT be called as part of the gesture
- **AND** the dragged element's next render SHALL show its committed `tTicks` (no preview leftover)

#### Scenario: quantizeGridToTicks helper conversions

- **WHEN** `quantizeGridToTicks('1/4', 480)` is called
- **THEN** the return value SHALL be `480`
- **AND** `quantizeGridToTicks('1/8', 480)` SHALL return `240`
- **AND** `quantizeGridToTicks('1/16', 480)` SHALL return `120`
- **AND** `quantizeGridToTicks('1/32', 480)` SHALL return `60`
- **AND** `quantizeGridToTicks('1/16')` (omitted `tpq`) SHALL return `DEFAULT_MIDI_TPQ / 4`

#### Scenario: Pitch and duration are preserved across the gesture

- **WHEN** the user drags an event horizontally and also moves the pointer vertically by any amount
- **THEN** the committed mutation SHALL only change `tTicks`; the event's `pitch`, `durTicks`, `vel`, and `pressure` SHALL be unchanged
