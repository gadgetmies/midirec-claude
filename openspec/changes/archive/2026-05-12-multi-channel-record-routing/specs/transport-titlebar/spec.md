## MODIFIED Requirements

### Requirement: Record button disabled when input or channel is missing

The record button in the Titlebar transport group SHALL be `disabled` only when `useMidiInputs().inputs.length === 0` (no MIDI input device available — runtime ungranted, unsupported, or zero connected inputs).

When disabled, the button's tooltip SHALL read `No MIDI input available`.

When enabled, clicking SHALL dispatch `record()` as today; the `mrPulse` animation engages while recording, and the timecode color flips to `var(--mr-rec)`.

#### Scenario: No input available disables the record button with tooltip

- **WHEN** `useMidiInputs().inputs.length === 0`
- **THEN** the record button SHALL carry the `disabled` attribute
- **AND** its tooltip / `title` SHALL read `No MIDI input available`
- **AND** clicking it SHALL NOT dispatch `record()`

#### Scenario: Input available enables record without channel selection

- **WHEN** `useMidiInputs().inputs.length > 0` AND `useStage().selectedChannelId === null`
- **THEN** the record button SHALL NOT carry `disabled`
- **AND** clicking it SHALL dispatch `record()` (transitioning `mode` to `'record'`)

#### Scenario: Input available with selected channel still enables record

- **WHEN** `useMidiInputs().inputs.length > 0` AND `useStage().selectedChannelId !== null`
- **THEN** the record button SHALL NOT carry `disabled`
