## ADDED Requirements

### Requirement: DJ Output panel exposes output CC number when mapping Control Change

When the selected action row’s output uses **Control Change** (i.e. `outputMap[pitch].cc` is set, or the row is a continuous mixer control per `dj-action-tracks` such that the UI offers CC output), the Output mapping panel SHALL render a `.mr-kv` row with key text **`CC#`** and a numeric `<input type="number" min="0" max="127" class="mr-input">` bound to `outputMap[pitch].cc`. When **`cc` is unset**, the input SHALL show an empty or placeholder state until the user enters a value, at which point `setOutputMapping` creates or updates `cc`. When **`cc`** is set, changing the field SHALL commit per the existing auto-save requirement. Rows that only emit **note** output MAY omit the `CC#` row when `cc` is absent and the action is not mixer-CC-backed; when the product always shows both Pitch and CC#, **Pitch** remains the note output and **CC#** is optional until filled.

#### Scenario: CC row appears for mixer crossfader output mapping

- **WHEN** `djActionSelection` references a mixer `xfade_pos` row and the user edits output
- **THEN** the Inspector body SHALL contain a `.mr-kv` row whose key label is `CC#`
- **AND** editing the value SHALL call `setOutputMapping` with an updated `cc` field

#### Scenario: Mapping persists cc in outputMap

- **WHEN** the user sets `CC#` to `11`
- **THEN** `useStage().setOutputMapping` SHALL be called with a mapping that includes `cc: 11` merged with device/channel/pitch

## MODIFIED Requirements

### Requirement: Output form changes auto-save via setOutputMapping

Every field change on the Output panel SHALL call `useStage().setOutputMapping(trackId, pitch, mergedMapping)` exactly once with the new value merged into the current mapping. When no `outputMap[pitch]` existed before, the first edit SHALL create the entry using the form's current default values (input device, channel 1, input pitch) with the edited field overridden.

The Channel input SHALL clamp values to the inclusive range `1..16`. The Pitch input SHALL clamp values to the inclusive range `0..127`. The **CC# input, when present, SHALL clamp to `0..127`**. Out-of-range input MUST NOT throw or produce invalid persisted state.

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

#### Scenario: CC# clamps out-of-range input

- **WHEN** the user enters `200` in the CC# input
- **THEN** the value passed to `setOutputMapping` SHALL be `127`

## REMOVED Requirements

(none)
