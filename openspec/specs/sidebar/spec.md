## Purpose

Define the left-aside Browser Sidebar: its mounting in the `.mr-sidebar` aside, its four fixed-order panels (MIDI Inputs, MIDI Outputs, Record Filter, Routing), the collapsible-panel primitive with chevron + icon + title + optional count, the device-row primitive with LED state and active-row accent stripe, the form primitives (`.mr-row`, `.mr-switch`, `.mr-chip`) shared with the Inspector, the routing-matrix grid, and the rule that fixtures live hardcoded in `Sidebar.tsx` while all colors/sizes/typography resolve through `--mr-*` tokens.
## Requirements
### Requirement: Sidebar mounts in the .mr-sidebar aside

The codebase SHALL expose a `<Sidebar>` React component at `src/components/sidebar/Sidebar.tsx`. `AppShell.tsx` SHALL mount exactly one `<Sidebar>` element inside the `.mr-sidebar` aside, replacing the prior `<span class="mr-stub">Sidebar</span>` placeholder.

The Sidebar SHALL NOT mutate stage state in this slice. The Sidebar MAY consume `useStage()` if needed for future state coupling, but the Slice 6a fixtures (devices, filters, routing) SHALL be hardcoded inside `Sidebar.tsx` and not derived from `useStage`.

#### Scenario: Sidebar replaces the stub

- **WHEN** the app is rendered
- **THEN** the `.mr-sidebar` aside SHALL contain exactly one Sidebar component root element
- **AND** the `.mr-sidebar` aside SHALL NOT contain any `.mr-stub` element
- **AND** the prior placeholder text "Sidebar" SHALL NOT appear

### Requirement: Sidebar renders four panels in fixed order

The Sidebar SHALL render exactly four `.mr-panel` children inside the `.mr-sidebar` aside, in this order:

1. MIDI Inputs (icon: mic)
2. MIDI Outputs (icon: route)
3. Record Filter (icon: filter)
4. Routing (icon: route)

Each panel SHALL be a separate `.mr-panel` element. There SHALL NOT be additional sibling content between panels (no separator elements, no stub elements).

#### Scenario: Four panels render in fixed order

- **WHEN** the Sidebar is rendered
- **THEN** the `.mr-sidebar` SHALL contain exactly 4 `.mr-panel` direct-or-near-descendants in DOM order
- **AND** the `.mr-panel__head-l` text content of those panels SHALL be `MIDI INPUTS`, `MIDI OUTPUTS`, `RECORD FILTER`, `ROUTING` in that order (the head treatment uppercases the title via `text-transform: uppercase`)

### Requirement: Each panel has a clickable head that toggles a local data-open boolean

Each `.mr-panel` SHALL expose a `data-open="true" | "false"` attribute reflecting the panel's open state. The panel head (`.mr-panel__head`) SHALL be a `<button>` element (or an element with `role="button"` and keyboard handlers) such that clicking it OR pressing Enter/Space while focused toggles the panel's open state. When `data-open === "false"`, the panel body (`.mr-panel__body`) SHALL NOT render its content (or SHALL render with `display: none`).

The panel head SHALL contain, in order:

- A chevron icon (`.mr-chev`) that rotates 90° via CSS transform when `data-open === "true"`.
- The panel's icon (mic / route / filter) sized at ~14×14px in `--mr-text-2`.
- The panel title in uppercase, `--mr-fs-10` font size, `--mr-fw-semibold`, letter-spacing `--mr-tracking-cap`, color `--mr-text-2`.
- (Optional) A `.mr-panel__count` element on the right with mono font and `--mr-text-3`, when the panel has a count to display.

The panel body SHALL have `padding: 4px var(--mr-sp-5) var(--mr-sp-5)`, `display: flex`, `flex-direction: column`, `gap: var(--mr-sp-3)`.

Panel collapse state SHALL be component-local (a `useState` per `<Panel>` instance) and SHALL NOT be persisted to `useStage`.

#### Scenario: Panel head toggles open state

- **WHEN** the user clicks any panel's head
- **THEN** that panel's `data-open` attribute SHALL flip (from `true` to `false` or vice-versa)
- **AND** the chevron's CSS transform SHALL update accordingly (rotating to 90deg or back to 0deg)
- **AND** the panel body's content SHALL appear or disappear correspondingly

#### Scenario: Panel collapse state is local

- **WHEN** the user collapses one panel
- **THEN** other panels' `data-open` values SHALL remain unchanged
- **AND** no `useStage` action SHALL be dispatched for the collapse

### Requirement: Record Filter panel renders six switch rows and a channel chip strip

The Record Filter panel SHALL ship `data-open="true"` by default. Its head SHALL NOT display a count.

Its body SHALL contain, in order:

1. Six `.mr-row` elements, each containing a `.mr-row-lbl` (label, `--mr-fs-11`, `--mr-text-2`) and a `.mr-switch`. The labels and `data-on` values SHALL be:
   - `Notes` — `data-on="true"`
   - `Control change` — `data-on="true"`
   - `Pitch bend` — `data-on="true"`
   - `Aftertouch` — `data-on="false"`
   - `Program change` — `data-on="false"`
   - `SysEx` — `data-on="false"`
2. A flex-wrap container of channel chips (`.mr-chip` elements). The chips' text content and `data-on` values SHALL be:
   - `CH 1` — `data-on="true"`
   - `CH 2` — `data-on="true"`
   - `CH 3` — `data-on="false"`
   - `CH 4` — `data-on="false"`
   - `CH 10` — `data-on="true"`
   - `+10` — `data-on="false"`

All switches and chips SHALL be visual stubs — clicking a switch or chip SHALL NOT change its `data-on` value.

The `.mr-switch` primitive SHALL be a small pill-shaped toggle: a track element with a thumb that translates between two end positions, animating on `data-on` change. Width and height SHALL match the prototype's `.mr-switch` definition.

#### Scenario: Filter panel renders six switch rows in correct order

- **WHEN** the Sidebar is rendered with the Record Filter panel open
- **THEN** the panel body SHALL contain exactly 6 `.mr-row` elements
- **AND** the first three (`Notes`, `Control change`, `Pitch bend`) SHALL each contain a `.mr-switch` with `data-on="true"`
- **AND** the last three (`Aftertouch`, `Program change`, `SysEx`) SHALL each contain a `.mr-switch` with `data-on="false"`

#### Scenario: Filter panel renders six channel chips with correct on-states

- **WHEN** the Sidebar is rendered with the Record Filter panel open
- **THEN** the panel body SHALL contain exactly 6 `.mr-chip` elements after the switch rows
- **AND** the chips SHALL carry text content `CH 1`, `CH 2`, `CH 3`, `CH 4`, `CH 10`, `+10` in DOM order
- **AND** chips at index 0, 1, 4 SHALL have `data-on="true"`; the others SHALL have `data-on="false"`

### Requirement: Sidebar primitives resolve through design tokens

All Sidebar primitives SHALL resolve their colors, spacing, sizes, and typography through `--mr-*` tokens. No raw hex values, raw pixel values that duplicate a token, or hardcoded color strings SHALL appear in the Sidebar's CSS files.

Specifically:

- `.mr-sidebar` background SHALL use `var(--mr-bg-panel)` and right border SHALL use `var(--mr-line-2)`.
- `.mr-panel` border-bottom SHALL use `var(--mr-line-1)`.
- `.mr-panel__head` height SHALL be `28px` (or a token if available); padding SHALL use `--mr-sp-*`.
- `.mr-panel__head-l` font SHALL use `--mr-fs-10`, `--mr-fw-semibold`, `--mr-tracking-cap`, `--mr-text-2`.
- `.mr-led` colors SHALL resolve from `--mr-cue`, `--mr-play`, `--mr-rec`, `--mr-text-4` per `data-state`.
- `.mr-dev` height SHALL use `--mr-h-row`; hover background SHALL use `--mr-bg-panel-2`; active background SHALL use `--mr-accent-soft`; active stripe color SHALL use `--mr-accent`.
- `.mr-row` minimum-height SHALL use `--mr-h-row`.
- `.mr-routing` background gap SHALL use `--mr-line-1`; cell background SHALL use `--mr-bg-panel`; ON cell fill SHALL use `--mr-accent-soft`; ON cell stroke SHALL use `--mr-accent`.

#### Scenario: No raw color literals in Sidebar CSS

- **WHEN** the Sidebar's CSS files are inspected
- **THEN** no `#` hex colors, no `rgb(`, no `oklch(` literal definitions SHALL appear (every color reference SHALL be `var(--mr-*)`)
- **AND** no border-thickness literal SHALL duplicate `--mr-bw-1` (use the token)

### Requirement: Sidebar component reuses shared primitives where they exist

The Sidebar implementation SHALL reuse existing primitives in the codebase rather than duplicating them. Specifically:

- If `.mr-row` and `.mr-row-lbl` already exist in `src/components/inspector/Inspector.css` from Slice 5, the Sidebar SHALL either import the same definition (by hoisting to a shared CSS file such as `src/styles/forms.css`) or reuse the rule via a shared parent class. Duplicating the rules byte-for-byte across two CSS files is not acceptable.
- If `.mr-chip` already exists for M/S chip rendering or similar, the Sidebar SHALL reuse it directly.
- If `.mr-led` already exists in the codebase (e.g., a transport-titlebar recording indicator), the Sidebar SHALL reuse it directly. The `data-state` value set ([rec, play, midi]) MAY be extended without redefining the base rule.
- If a chevron icon source already exists (e.g., used by `.mr-track__hdr-chev`), the Sidebar SHALL use the same source rather than authoring a new chevron SVG.

#### Scenario: No duplicate primitive rules across CSS files

- **WHEN** the codebase is grepped for `.mr-row {` (or `.mr-chip {`, `.mr-led {`, `.mr-chev {`)
- **THEN** at most one definition SHALL exist for each primitive across all `src/**/*.css` files
- **AND** if two consumers need the same primitive, the rule SHALL live in a shared file (e.g., `src/styles/forms.css`, `src/styles/badges.css`) imported by both

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

