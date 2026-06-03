## ADDED Requirements

### Requirement: ActionRoll drag-to-move honors snapAbsoluteOn

The `ActionRoll` component SHALL accept an optional prop `snapAbsoluteOn?: boolean` (defaulting to `false` when omitted). The existing drag-to-move gesture (added by `timeline-drag-move-items`) for `.mr-djtrack__note` (all variants) and `.mr-djtrack__cc` SHALL branch its preview-tick computation on this flag:

- **When `snapAbsoluteOn === true` AND transport `quantizeOn === true`** (absolute-snap mode):
  - For a single event: `finalTick = max(0, round((tick0 + deltaTicksRaw) / snap) * snap)` where `deltaTicksRaw = round(deltaPx / pxPerTick)` and `snap = quantizeGridToTicks(transport.quantizeGrid)`.
  - For a CC group: only the **earliest member** SHALL align to the grid. Compute `earliestFinal = max(0, round((earliestTTicks + deltaTicksRaw) / snap) * snap)`. Set `groupDeltaTicks = earliestFinal - earliestTTicks`. Every member's final tick SHALL be `max(0, originalMemberTTicks + groupDeltaTicks)`. Members other than the earliest SHALL NOT be snapped to the grid independently — relative spacing inside the group SHALL be preserved.
- **Otherwise** (either flag off — delta-snap mode, the default from `timeline-drag-move-items`):
  - The gesture SHALL behave exactly as specified by `timeline-drag-move-items` (delta-snap math for single events; `groupDeltaTicks = snapped delta` applied uniformly to all members for CC groups, also clamped so the earliest member stays at or above 0).

When `quantizeOn === false`, `snapAbsoluteOn` SHALL have no effect on the gesture's behavior.

When `snapAbsoluteOn` is omitted or `false`, the gesture SHALL behave exactly as specified by `timeline-drag-move-items`.

The branching SHALL apply to both the live preview and the values dispatched via `setDJEventTTicks` on `pointerup`.

Orchestration code outside `ActionRoll` SHALL surface `useTransport().snapAbsoluteOn` to the prop wherever `quantizeOn` / `quantizeGrid` are also passed.

#### Scenario: Absolute mode realigns an off-grid single event

- **WHEN** the transport reports `quantizeOn: true`, `quantizeGrid: '1/16'` (snap=120), `snapAbsoluteOn: true`, and the user drags a trigger event from `tTicks=154` by 22 px to the right and releases
- **THEN** `deltaTicksRaw = 120`, `finalTick = round((154 + 120) / 120) * 120 = 240`
- **AND** `setDJEventTTicks` SHALL be called exactly once with `nextTTicks === 240`

#### Scenario: Absolute mode realigns a CC group by its earliest member

- **WHEN** a CC group has members at ticks `[154, 214, 274]` (earliest off-grid by 34), the transport reports `quantizeOn: true`, `quantizeGrid: '1/16'` (snap=120), `snapAbsoluteOn: true`, and the user drags the representative `.mr-djtrack__cc` by `deltaTicksRaw = 120` and releases
- **THEN** `earliestFinal = round((154 + 120) / 120) * 120 = 240`, `groupDeltaTicks = 240 - 154 = 86`
- **AND** `setDJEventTTicks` SHALL be called exactly three times — once per member — with `nextTTicks` values `240`, `300`, and `360` respectively (`originalTTicks + 86`)
- **AND** the group's internal spacing (60-tick gaps) SHALL be preserved
- **AND** only the earliest member SHALL land on the grid; the other members SHALL retain their off-grid offsets from the earliest

#### Scenario: Delta mode preserves off-grid offsets (regression guard)

- **WHEN** the same CC group `[154, 214, 274]` is dragged with `quantizeOn: true`, `quantizeGrid: '1/16'`, `snapAbsoluteOn: false`, by `deltaTicksRaw = 120`
- **THEN** `groupDeltaTicks = round(120 / 120) * 120 = 120` and `setDJEventTTicks` SHALL be called with `nextTTicks` values `274`, `334`, and `394` respectively (matches `timeline-drag-move-items` delta-snap behavior — earliest stays off-grid)

#### Scenario: Absolute mode with on-grid start equals delta mode for single events

- **WHEN** the transport reports `quantizeOn: true`, `quantizeGrid: '1/16'`, and the user drags an event from `tTicks=0` by 27 px and releases
- **THEN** with `snapAbsoluteOn: true`, `setDJEventTTicks` SHALL be called with `nextTTicks === 120`
- **AND** with `snapAbsoluteOn: false`, `setDJEventTTicks` SHALL also be called with `nextTTicks === 120`

#### Scenario: snapAbsoluteOn has no effect when quantize is off

- **WHEN** the transport reports `quantizeOn: false`, `snapAbsoluteOn: true`, and the user drags a single event from `tTicks=154` by 100 px and releases
- **THEN** `setDJEventTTicks` SHALL be called exactly once with `nextTTicks === 154 + round(100 / pxPerTick)` (raw pixel-converted delta, no snapping — identical to `snapAbsoluteOn: false` under `quantizeOn: false`)

#### Scenario: Absolute mode clamps CC group earliest to non-negative

- **WHEN** a CC group has members at ticks `[60, 120]`, the transport reports `quantizeOn: true`, `quantizeGrid: '1/16'`, `snapAbsoluteOn: true`, and the user drags the representative by a deltaPx that yields `deltaTicksRaw = -1000`
- **THEN** `earliestFinal = max(0, round((60 - 1000)/120) * 120) = 0`, `groupDeltaTicks = -60`
- **AND** `setDJEventTTicks` SHALL be called with `nextTTicks` values `0` and `60` respectively
- **AND** no member SHALL receive a negative `nextTTicks`

#### Scenario: Absolute mode commits exactly once per gesture (single events)

- **WHEN** the user performs a multi-`pointermove` drag of a single event with `snapAbsoluteOn: true` and `quantizeOn: true`, then releases
- **THEN** `setDJEventTTicks` SHALL be invoked exactly once on `pointerup`

#### Scenario: Absolute mode commits exactly once per member for CC groups

- **WHEN** the user performs a multi-`pointermove` drag of a CC group with N members, `snapAbsoluteOn: true` and `quantizeOn: true`, then releases
- **THEN** `setDJEventTTicks` SHALL be invoked exactly N times on `pointerup` (once per member), all with the same `groupDeltaTicks`
