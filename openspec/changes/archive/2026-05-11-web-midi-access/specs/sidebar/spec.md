## ADDED Requirements

### Requirement: Sidebar mounts MidiPermissionBanner as its first child

The Sidebar SHALL render `<MidiPermissionBanner />` (from the `midi-runtime` capability) as its first child, above `<InputMappingPanel />`. The banner SHALL be a sibling of the four `.mr-panel` children, NOT a `.mr-panel` itself, so it does not count toward the "four panels in fixed order" requirement.

#### Scenario: Banner is the Sidebar's first child

- **WHEN** the Sidebar is rendered
- **THEN** the Sidebar's first DOM child SHALL be a `.mr-midi-banner` element (when the runtime state is not `granted`) or render nothing (when granted) — but the banner JSX MUST be authored as the first child of the Sidebar component's return value

#### Scenario: Banner does not count toward the four-panel total

- **WHEN** the Sidebar is rendered with the runtime in a non-`granted` state
- **THEN** the Sidebar SHALL still contain exactly four `.mr-panel` direct-or-near-descendants
- **AND** the `.mr-midi-banner` element SHALL NOT carry the `.mr-panel` class

### Requirement: MIDI Inputs panel renders rows from useMidiInputs

The MIDI Inputs panel SHALL ship `data-open="true"` by default. Its head SHALL display a count derived from `useMidiInputs()` of the form `<connected> / <total>` (where `connected` counts devices with `state === 'connected'`). Its body SHALL render one `.mr-dev` row per entry returned by `useMidiInputs().inputs`, in the order returned by the hook.

When `useMidiInputs().inputs` is empty (no devices, or runtime state is `unsupported` / `requesting` / `denied`), the body SHALL render a single hint element with text `No MIDI inputs` and class `mr-dev mr-dev--empty` (no `.mr-led`, no channel chip; rendered in `var(--mr-text-3)`).

Each `.mr-dev` row SHALL contain, in order: a `.mr-led` element (8×8 circle), a `.mr-dev__name` element (truncating with text-overflow ellipsis, `--mr-fs-11`), and a `.mr-dev__ch` element (mono, `--mr-fs-10`, `--mr-text-3`).

For this slice the `.mr-led` SHALL carry no `data-state` (idle) for every row — runtime message activity will set `data-state="midi"` in the recording slice. The `.mr-dev__ch` element SHALL render `—` (em-dash) for every row in this slice — incoming-channel data lands with recording. A row SHALL carry `data-active="true"` only when the underlying `MidiDevice.state === 'connected'`; disconnected ports SHALL NOT carry `data-active`.

The LED color SHALL resolve from the `data-state` attribute: `midi` → `--mr-cue`, `play` → `--mr-play`, `rec` → `--mr-rec`, no `data-state` → `--mr-text-4`.

A row with `data-active="true"` SHALL render with `--mr-accent-soft` background, `--mr-text-1` foreground, and a 2px-wide accent stripe along its left edge (drawn via `::before` pseudo-element positioned at `left: 0; top: 4px; bottom: 4px; width: 2px; background: var(--mr-accent)`). A row without `data-active` SHALL render with no background tint and SHALL NOT show the stripe.

All device rows in this slice SHALL be visual stubs — clicking a row SHALL NOT toggle its active state. Selection / picker behaviour lands in the pickers slice.

#### Scenario: Inputs panel renders one row per live device

- **GIVEN** `useMidiInputs()` returns `{ status: 'granted', inputs: [<two connected devices>] }`
- **WHEN** the Sidebar is rendered with the MIDI Inputs panel open
- **THEN** the panel body SHALL contain exactly 2 `.mr-dev` elements
- **AND** both SHALL carry `data-active="true"`
- **AND** the panel head count SHALL display `2 / 2`

#### Scenario: Inputs panel shows empty hint when no devices

- **GIVEN** `useMidiInputs()` returns `{ status: 'granted', inputs: [] }`
- **WHEN** the Sidebar is rendered with the MIDI Inputs panel open
- **THEN** the panel body SHALL contain exactly one `.mr-dev.mr-dev--empty` element
- **AND** the element's text content SHALL include `No MIDI inputs`
- **AND** the panel head count SHALL display `0 / 0`

#### Scenario: Disconnected port renders without active stripe

- **GIVEN** `useMidiInputs()` returns one entry with `state: 'connected'` and one entry with `state: 'disconnected'`
- **WHEN** the panel renders
- **THEN** exactly one `.mr-dev` element SHALL carry `data-active="true"`
- **AND** the disconnected row SHALL NOT carry `data-active`
- **AND** the panel head count SHALL display `1 / 2`

### Requirement: MIDI Outputs panel renders rows from useMidiOutputs

The MIDI Outputs panel SHALL ship `data-open="true"` by default. Its head SHALL display a count derived from `useMidiOutputs()` of the form `<connected> / <total>`. Its body SHALL render one `.mr-dev` row per entry returned by `useMidiOutputs().outputs`, in the order returned by the hook.

When `useMidiOutputs().outputs` is empty, the body SHALL render a single hint element with text `No MIDI outputs` and class `mr-dev mr-dev--empty` (same rendering rule as the inputs empty state).

The same row markup, LED color resolution, and active-stripe rendering rules from the MIDI Inputs requirement SHALL apply. For this slice the `.mr-led` carries no `data-state` for every row (playback activity will set `data-state="play"` in the playback slice). `data-active="true"` follows `MidiDevice.state === 'connected'`. The `.mr-dev__ch` SHALL render `—` for every row in this slice; per-channel output routing lands in a later slice.

#### Scenario: Outputs panel renders one row per live device

- **GIVEN** `useMidiOutputs()` returns `{ status: 'granted', outputs: [<one connected device>] }`
- **WHEN** the Sidebar is rendered with the MIDI Outputs panel open
- **THEN** the panel body SHALL contain exactly 1 `.mr-dev` element
- **AND** it SHALL carry `data-active="true"`
- **AND** the panel head count SHALL display `1 / 1`

#### Scenario: Outputs panel shows empty hint when no devices

- **GIVEN** `useMidiOutputs()` returns `{ status: 'granted', outputs: [] }`
- **WHEN** the Sidebar is rendered with the MIDI Outputs panel open
- **THEN** the panel body SHALL contain exactly one `.mr-dev.mr-dev--empty` element
- **AND** the element's text content SHALL include `No MIDI outputs`

### Requirement: Routing panel derives input and output labels from live devices

The Routing panel SHALL ship `data-open="true"` by default. Its head SHALL NOT display a count.

Its body SHALL contain a single `.mr-routing` element styled as a CSS grid. The grid's column count SHALL be `1 + <output count>` and the row count SHALL be `1 + <input count>`, where `<input count>` is `useMidiInputs().inputs.length` and `<output count>` is `useMidiOutputs().outputs.length`.

The first row SHALL be a header row: an empty corner cell, then one header cell per output device labelling the device by `MidiDevice.name`. Subsequent rows SHALL each correspond to one input device: a label cell rendering the input device's `MidiDevice.name`, then one checkbox cell per output. In this slice every checkbox cell SHALL render in the OFF state (transparent background, no check-path SVG). Per-channel routing semantics — making cells reflect actual routing state — land in the per-channel-routing slice.

When either input or output list is empty, the matrix SHALL render a hint element with text `Routing unavailable — connect MIDI devices to configure routes.` in `var(--mr-text-3)` instead of the grid. The hint element SHALL NOT carry the `.mr-routing` class.

Each checkbox cell SHALL render a 14×14 element with a 1px border in `--mr-line-2` and a transparent background. (ON-cell rendering rules — `--mr-accent-soft` fill with an SVG check-path in `--mr-accent` — remain in the spec for use by the later per-channel-routing slice, but no cell renders ON in this slice.)

Header cells SHALL use `--mr-fs-9` (or equivalent small uppercase size), `text-transform: uppercase`, `letter-spacing: 0.06em`, `--mr-text-2` color, and `text-align: center`. Label cells SHALL use `--mr-fs-10`, mono font (`--mr-font-mono`), `--mr-text-2` color.

The matrix grid SHALL have a 1px gap rendered as `background: var(--mr-line-1)` on the grid container with `padding: 1px`, so the 1px gap between cells reads as a hairline divider.

All matrix cells SHALL be visual stubs in this slice — clicking a cell SHALL NOT toggle its on/off state.

#### Scenario: Matrix uses live device names as labels

- **GIVEN** `useMidiInputs()` returns two connected devices named `Korg minilogue xd` and `Arturia KeyStep Pro`
- **AND** `useMidiOutputs()` returns one connected device named `Logic Pro · Track 4`
- **WHEN** the Routing panel renders
- **THEN** the grid SHALL contain exactly 6 cells (3 rows × 2 columns: corner + 1 header, then 2 input rows × (label + 1 cell))
- **AND** the first row's second cell SHALL contain the text `Logic Pro · Track 4`
- **AND** the second row's first cell SHALL contain the text `Korg minilogue xd`
- **AND** the third row's first cell SHALL contain the text `Arturia KeyStep Pro`

#### Scenario: Matrix shows hint when device lists are empty

- **GIVEN** either `useMidiInputs().inputs` or `useMidiOutputs().outputs` is empty
- **WHEN** the Routing panel renders
- **THEN** the panel body SHALL NOT contain a `.mr-routing` element
- **AND** the panel body SHALL contain an element whose text includes `Routing unavailable`

#### Scenario: All checkbox cells render OFF in this slice

- **GIVEN** the matrix renders with at least one input and one output
- **WHEN** the grid is rendered
- **THEN** zero cells SHALL render an SVG check-path
- **AND** every checkbox cell SHALL have a transparent background

## MODIFIED Requirements

### Requirement: Sidebar fixtures are hardcoded inside Sidebar.tsx

The Sidebar's filter switch list (`FILTERS`), channel chip list (`CHANNEL_CHIPS`), and any other non-device fixture data SHALL be hardcoded as `const` arrays at the top of `Sidebar.tsx`. They SHALL NOT be moved to a separate fixtures module. They SHALL NOT be derived from `useStage`.

Device data — the inputs panel's rows, the outputs panel's rows, and the routing matrix's input/output column labels — SHALL be sourced from `useMidiInputs()` / `useMidiOutputs()` (from the `midi-runtime` capability), NOT hardcoded. The previous `INPUTS`, `OUTPUTS`, and `ROUTING.inputs` / `ROUTING.outputs` arrays SHALL be removed from `Sidebar.tsx`. The `ROUTING.grid` array (cell selection state), if kept at all, MAY remain hardcoded until per-channel routing lands.

A comment near the remaining fixtures SHALL note the upstream source (`design_handoff_midi_recorder/prototype/components.jsx Sidebar()`) so future maintainers know where to look when synchronizing changes.

#### Scenario: Non-device fixtures live in Sidebar.tsx

- **WHEN** the codebase is inspected
- **THEN** the filter switch and channel-chip fixtures SHALL appear as `const` declarations in `src/components/sidebar/Sidebar.tsx`
- **AND** there SHALL NOT be a `Sidebar.fixtures.ts` file or similar
- **AND** the fixtures SHALL include a comment referencing the prototype's source location

#### Scenario: Device fixtures are removed from Sidebar.tsx

- **WHEN** the codebase is inspected
- **THEN** `src/components/sidebar/Sidebar.tsx` SHALL NOT contain a top-level `const INPUTS` or `const OUTPUTS` declaration with hardcoded device names
- **AND** the Routing matrix's input column and output column labels SHALL be derived from `useMidiInputs()` and `useMidiOutputs()` rather than from a hardcoded `ROUTING.inputs` or `ROUTING.outputs` array

## REMOVED Requirements

### Requirement: MIDI Inputs panel renders three device rows with LEDs and active stripe

**Reason**: Replaced by "MIDI Inputs panel renders rows from useMidiInputs" — the three-row count and the hardcoded device list (`Korg minilogue xd`, `Arturia KeyStep Pro`, `IAC Driver Bus 1`) no longer match the live Web MIDI data source.

**Migration**: Rows now come from `useMidiInputs().inputs`. The row primitive, LED color rules, and `data-active` accent stripe are preserved verbatim in the new requirement; only the source of the row data changed.

### Requirement: MIDI Outputs panel renders two device rows

**Reason**: Replaced by "MIDI Outputs panel renders rows from useMidiOutputs" — the two-row count and the hardcoded device list (`Logic Pro · Track 4`, `Korg minilogue xd`) no longer match the live Web MIDI data source.

**Migration**: Rows now come from `useMidiOutputs().outputs`. Same primitive and styling rules as inputs.

### Requirement: Routing panel renders a 3-input by 3-output checkbox matrix

**Reason**: Replaced by "Routing panel derives input and output labels from live devices" — the 3×3 grid shape and the hardcoded device labels (`minilogue` / `KeyStep` / `IAC 1` / `Logic Tr 4` / `minilogue` / `File`) and ON-cells no longer match a live device list whose dimensions vary per session.

**Migration**: The grid's dimensions and row/column labels are derived from `useMidiInputs()` / `useMidiOutputs()`. All cells render OFF in this slice; per-channel routing semantics (ON cells reflecting actual routing state) lands in a later slice. An empty-device hint replaces the grid when either device list is empty.
