## MODIFIED Requirements

### Requirement: Note tab renders an Output mapping panel when a DJ action row is selected

The Inspector's Note tab body SHALL render an **Output mapping panel** when `useStage().djActionSelection !== null` AND the active tab is `Note`. The panel SHALL replace the channel/roll-based Note panel content (no concurrent rendering of both). The three render states defined by the prior `Inspector renders three states based on resolvedSelection` requirement (none, single, multi) SHALL apply only when `djActionSelection === null`.

The Output mapping panel SHALL be wrapped in an element carrying `data-mr-dj-selection-region="true"` so the outside-click handler treats clicks inside it as "keep selection".

If `djActionSelection` references a `(trackId, pitch)` whose `actionMap[pitch]` is no longer present (because it was deleted), the panel SHALL render an empty body (no header, no rows, no buttons). This mirrors the safety guard in the Sidebar's Map Note panel.

The panel SHALL render, in DOM order:

1. A header row with a 28×28px swatch element whose `background` is `devColor(entry.device)` (resolved from the **input** binding), and a two-line label group containing the action's `label` on top (e.g. `Hot Cue 1`) and a mono-font subtitle of the form `in <pitchLabel> · note <pitch>` (e.g. `in G♯3 · note 56`). The `in` prefix signals that the displayed pitch is the input pitch, not the output pitch.
2. An eyebrow row with the uppercase text `Output`.
3. When `track.outputMap[pitch]` is `undefined`, a hint line with the text `No output configured. Editing any field below will create the mapping.` (placed below the eyebrow, above the input rows).
4. A `.mr-kv` row with key text `Device` and a value that is a `<select class="mr-select">` populated with the keys of `DJ_DEVICES` in declared order; each option's text is `devLabel(key)`. The select's current value SHALL be the existing `outputMap[pitch].device` if set, otherwise the input binding's `entry.device`.
5. A `.mr-kv` row with key text `Channel` and a value that is an `<input type="number" min="1" max="16" class="mr-input">`. The current value SHALL be the existing `outputMap[pitch].channel` if set, otherwise `1`.
6. A `.mr-kv` row with key text `Pitch` and a value that contains an `<input type="number" min="0" max="127" class="mr-input">` followed by a `<span>` showing `pitchLabel(currentPitch)`. The input's current value SHALL be the existing `outputMap[pitch].pitch` if set, otherwise the input binding's `pitch`.
7. When `outputMap[pitch]` is set (i.e. the mapping has been created), a footer row containing a single button with `data-danger="true"` and text content `Delete output`.
8. When ALL of the following hold — `djEventSelection !== null`, the event selection refers to the same `(trackId, pitch)` as `djActionSelection`, `actionMap[pitch]?.pressure === true`, and `track.events[djEventSelection.eventIdx] !== undefined` — a Pressure section SHALL render below the Output rows (see the `dj-pressure-editor` capability for the section's internal layout). When any of those conditions is false, the Pressure section SHALL NOT render.

#### Scenario: Output panel renders for a selected DJ action row with no existing outputMap

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 56 }`, the seeded track has `actionMap[56].label === 'Hot Cue 1'` and `actionMap[56].device === 'deck1'`, and `outputMap[56] === undefined`
- **AND** the active Inspector tab is `Note`
- **THEN** the Inspector body SHALL contain the hint text `No output configured. Editing any field below will create the mapping.`
- **AND** the body's header SHALL contain the text `Hot Cue 1`
- **AND** the body's header SHALL contain the text `in G♯3 · note 56`
- **AND** the Device `<select>` SHALL have current value `deck1` (matches the input device)
- **AND** the Channel `<input>` SHALL have current value `1`
- **AND** the Pitch `<input>` SHALL have current value `56` and its readout SHALL contain the text `G♯3`
- **AND** the body SHALL NOT contain a button with text `Delete output`

#### Scenario: Output panel renders existing outputMap values when set

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 56 }` and `outputMap[56] === { device: 'deck2', channel: 5, pitch: 64 }`
- **THEN** the Device `<select>` SHALL have current value `deck2`
- **AND** the Channel `<input>` SHALL have current value `5`
- **AND** the Pitch `<input>` SHALL have current value `64` and its readout SHALL contain `E4`
- **AND** the body SHALL contain a button with text `Delete output`

#### Scenario: Output panel handles missing actionMap entry safely

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 56 }` but `actionMap[56]` is `undefined`
- **THEN** the Inspector body SHALL contain no `.mr-kv` rows
- **AND** the Inspector body SHALL contain no `Device` / `Channel` / `Pitch` inputs

#### Scenario: Output panel wrapper carries the selection-region attribute

- **WHEN** the Output panel is rendered
- **THEN** the wrapper element SHALL carry `data-mr-dj-selection-region="true"`

#### Scenario: Pressure section renders below Output rows when an event is selected on a pressure-bearing action

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 56 }` AND `djEventSelection === { trackId: 'dj1', pitch: 56, eventIdx: 2 }` AND `actionMap[56].pressure === true` AND `track.events[2]` exists
- **THEN** the Inspector body SHALL contain exactly one `.mr-pressure` element
- **AND** that `.mr-pressure` element SHALL be a child of the same wrapper that contains the Output `.mr-kv` rows

#### Scenario: Pressure section absent when event is not selected

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 56 }` AND `djEventSelection === null`
- **THEN** the Inspector body SHALL contain the Output rows
- **AND** the Inspector body SHALL NOT contain any `.mr-pressure` element

#### Scenario: Pressure section absent when action does not support pressure

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 48 }` AND `djEventSelection === { trackId: 'dj1', pitch: 48, eventIdx: 0 }` AND `actionMap[48].pressure !== true`
- **THEN** the Inspector body SHALL contain the Output rows for the action
- **AND** the Inspector body SHALL NOT contain any `.mr-pressure` element
