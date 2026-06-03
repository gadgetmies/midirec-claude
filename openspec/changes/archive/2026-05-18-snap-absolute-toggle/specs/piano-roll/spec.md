## ADDED Requirements

### Requirement: PianoRoll drag-to-move honors snapAbsoluteOn

The `PianoRoll` component SHALL accept an optional prop `snapAbsoluteOn?: boolean` (defaulting to `false` when omitted). The existing drag-to-move gesture (added by `timeline-drag-move-items`) SHALL branch its preview-tick computation on this flag:

- **When `snapAbsoluteOn === true` AND transport `quantizeOn === true`** (absolute-snap mode):
  - `deltaTicksRaw = round(deltaPx / pxPerTick)`
  - `snap = quantizeGridToTicks(transport.quantizeGrid)`
  - `finalTick = max(0, round((tick0 + deltaTicksRaw) / snap) * snap)`
- **Otherwise** (either flag off, i.e. delta-snap mode — the default established by `timeline-drag-move-items`):
  - `deltaTicksRaw = round(deltaPx / pxPerTick)`
  - If `quantizeOn === true`: `deltaTicks = round(deltaTicksRaw / snap) * snap`
  - Else: `deltaTicks = deltaTicksRaw`
  - `finalTick = max(0, tick0 + deltaTicks)`

The two branches SHALL collapse to identical results when `tick0` is already on the grid, so on-grid notes behave identically in both modes.

When `quantizeOn === false`, `snapAbsoluteOn` SHALL have no effect on the gesture's behavior.

When `snapAbsoluteOn` is omitted or `false`, the gesture SHALL behave exactly as specified by `timeline-drag-move-items` (delta-snap).

The branching SHALL apply to both the live preview tick and the value passed to `onNoteMove` on `pointerup`.

Orchestration code outside `PianoRoll` SHALL surface `useTransport().snapAbsoluteOn` to the prop wherever `quantizeOn` / `quantizeGrid` are also passed.

#### Scenario: Absolute mode realigns an off-grid note to the grid

- **WHEN** the transport reports `quantizeOn: true`, `quantizeGrid: '1/16'` (TPQ=480 → snap=120), `snapAbsoluteOn: true`, `pxPerTick = 88/480`, and the user drags a note starting at `tTicks=154` by 22 px to the right and releases
- **THEN** `deltaTicksRaw = round(22 / (88/480)) = 120`, `finalTick = max(0, round((154 + 120) / 120) * 120) = round(274/120)*120 = 2*120 = 240`
- **AND** `onNoteMove` SHALL be called exactly once with `(noteIndex, 240)`
- **AND** the note's original 34-tick off-grid offset SHALL NOT be preserved (this is the point of absolute mode)

#### Scenario: Delta mode preserves off-grid offset (regression guard)

- **WHEN** the transport reports `quantizeOn: true`, `quantizeGrid: '1/16'`, `snapAbsoluteOn: false`, and the user drags a note from `tTicks=154` by 22 px and releases
- **THEN** `onNoteMove` SHALL be called exactly once with `(noteIndex, 274)` — the off-grid offset (34 ticks) SHALL be preserved (matches `timeline-drag-move-items` delta-snap behavior)

#### Scenario: Absolute mode with on-grid start equals delta mode

- **WHEN** the transport reports `quantizeOn: true`, `quantizeGrid: '1/4'` (snap=480), and the user drags a note starting at `tTicks=0` by 540 px to the right and releases
- **THEN** with `snapAbsoluteOn: true`, `onNoteMove` SHALL be called with `(noteIndex, 2880)`
- **AND** with `snapAbsoluteOn: false`, `onNoteMove` SHALL also be called with `(noteIndex, 2880)`

#### Scenario: snapAbsoluteOn has no effect when quantize is off

- **WHEN** the transport reports `quantizeOn: false`, `snapAbsoluteOn: true`, and the user drags a note from `tTicks=154` by 100 px to the right and releases
- **THEN** `onNoteMove` SHALL be called exactly once with `(noteIndex, 154 + round(100 / pxPerTick))` — the raw pixel-converted delta with no snapping (identical to `snapAbsoluteOn: false` behavior under `quantizeOn: false`)

#### Scenario: Absolute mode clamps to non-negative ticks

- **WHEN** the transport reports `quantizeOn: true`, `quantizeGrid: '1/16'`, `snapAbsoluteOn: true`, and the user drags a note from `tTicks=60` by -5000 px to the left and releases
- **THEN** `onNoteMove` SHALL be called exactly once with `(noteIndex, 0)`

#### Scenario: Absolute mode commits exactly once

- **WHEN** the user performs a multi-`pointermove` drag with `snapAbsoluteOn: true` and `quantizeOn: true`, then releases
- **THEN** `onNoteMove` SHALL be invoked exactly once per gesture (on `pointerup`)
