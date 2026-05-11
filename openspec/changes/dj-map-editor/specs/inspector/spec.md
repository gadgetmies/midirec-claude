## ADDED Requirements

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

### Requirement: Output form changes auto-save via setOutputMapping

Every field change on the Output panel SHALL call `useStage().setOutputMapping(trackId, pitch, mergedMapping)` exactly once with the new value merged into the current mapping. When no `outputMap[pitch]` existed before, the first edit SHALL create the entry using the form's current default values (input device, channel 1, input pitch) with the edited field overridden.

The Channel input SHALL clamp values to the inclusive range `1..16`. The Pitch input SHALL clamp values to the inclusive range `0..127`. Out-of-range input MUST NOT throw or produce invalid persisted state.

#### Scenario: Editing the Channel input commits immediately

- **WHEN** the panel is open for `pitch: 56` with no existing outputMap entry, and the user changes the Channel input from `1` to `5`
- **THEN** `setOutputMapping` SHALL be called once with `(trackId, 56, { device, channel: 5, pitch })` where `device` matches the input's device and `pitch` matches the input pitch
- **AND** after the next render, the panel SHALL show the `Delete output` button (because the entry now exists)

#### Scenario: Editing the Pitch input updates the readout

- **WHEN** the user changes the Pitch input from `56` to `60`
- **THEN** `setOutputMapping` SHALL be called with a mapping whose `pitch === 60`
- **AND** the pitch readout SHALL contain the text `C4`

#### Scenario: Channel clamps out-of-range input

- **WHEN** the user enters `99` in the Channel input
- **THEN** the value passed to `setOutputMapping` SHALL be `16`

### Requirement: Delete output button removes the outputMap entry

The `Delete output` button SHALL call `useStage().deleteOutputMapping(trackId, pitch)` when clicked. After deletion the panel re-renders with the no-mapping hint and the button SHALL no longer be present. The `djActionSelection` SHALL be unchanged by this action.

#### Scenario: Delete output clears the entry and re-shows the hint

- **WHEN** the panel is open for `pitch: 56` with an existing outputMap entry and the user clicks `Delete output`
- **THEN** `deleteOutputMapping` SHALL be called once with `(trackId, 56)`
- **AND** after the next render the Inspector body SHALL contain the hint text `No output configured. Editing any field below will create the mapping.`
- **AND** the body SHALL NOT contain a button with text `Delete output`
- **AND** `useStage().djActionSelection` SHALL be unchanged

### Requirement: Output panel and channel/roll Note panel are mutually exclusive

When `djActionSelection !== null`, the Inspector SHALL NOT render the channel/roll Note panel content (none/single/multi). Conversely, when `djActionSelection === null`, the Output panel SHALL NOT render — the inspector reverts to the existing `resolvedSelection`-driven Note panel.

This rule preserves the Slice 5 contract for channel/roll selection and does not change the three-tab strip's behavior.

#### Scenario: DJ selection suppresses channel-roll Note panel

- **WHEN** `useStage().djActionSelection === { trackId: 'dj1', pitch: 56 }` AND `useStage().resolvedSelection === { channelId: 1, indexes: [3] }`
- **THEN** the Inspector body SHALL contain the Output panel
- **AND** the Inspector body SHALL NOT contain the single-select channel/roll header rows for the channel note (no `Start` / `Length` `.mr-kv` rows from that panel)

#### Scenario: Clearing DJ selection restores channel-roll Note panel

- **WHEN** `djActionSelection` transitions from `{ trackId: 'dj1', pitch: 56 }` to `null` AND `resolvedSelection === { channelId: 1, indexes: [3] }`
- **THEN** the Inspector body SHALL contain the single-select channel/roll Note panel (four `.mr-kv` rows: `Start`, `Length`, `Velocity`, `Channel`)
- **AND** the Inspector body SHALL NOT contain the `Device` / `Channel` / `Pitch` inputs from the Output panel
