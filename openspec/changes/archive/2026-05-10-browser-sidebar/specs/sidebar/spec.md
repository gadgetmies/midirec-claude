## ADDED Requirements

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

### Requirement: MIDI Inputs panel renders three device rows with LEDs and active stripe

The MIDI Inputs panel SHALL ship `data-open="true"` by default. Its head SHALL display the count `2 / 3`. Its body SHALL contain exactly three `.mr-dev` rows, in this order:

1. `Korg minilogue xd` — channel `CH·1`, LED `data-state="midi"`, `data-active="true"`.
2. `Arturia KeyStep Pro` — channel `CH·1–4`, LED `data-state="midi"`, `data-active="true"`.
3. `IAC Driver Bus 1` — channel `—`, LED with no `data-state` (dim), no `data-active`.

Each `.mr-dev` row SHALL contain, in order: a `.mr-led` element (8×8 circle), a `.mr-dev__name` element (truncating with text-overflow ellipsis, `--mr-fs-11`), and a `.mr-dev__ch` element (mono, `--mr-fs-10`, `--mr-text-3`).

The LED color SHALL resolve from the `data-state` attribute: `midi` → `--mr-cue`, `play` → `--mr-play`, `rec` → `--mr-rec`, no `data-state` → `--mr-text-4`.

A row with `data-active="true"` SHALL render with `--mr-accent-soft` background, `--mr-text-1` foreground, and a 2px-wide accent stripe along its left edge (drawn via `::before` pseudo-element positioned at `left: 0; top: 4px; bottom: 4px; width: 2px; background: var(--mr-accent)`). A row without `data-active` SHALL render with no background tint and SHALL NOT show the stripe.

All device rows in this slice SHALL be visual stubs — clicking a row SHALL NOT toggle its active state.

#### Scenario: Inputs panel renders three rows with correct attributes

- **WHEN** the Sidebar is rendered with the MIDI Inputs panel open
- **THEN** the panel body SHALL contain exactly 3 `.mr-dev` elements
- **AND** the first two SHALL carry `data-active="true"`
- **AND** the third SHALL NOT carry `data-active="true"`
- **AND** the first two SHALL have a `.mr-led` element with `data-state="midi"`
- **AND** the third SHALL have a `.mr-led` element with no `data-state` attribute

#### Scenario: Active rows show the accent stripe

- **WHEN** computed styles are inspected for an active `.mr-dev` row
- **THEN** the row's background-color SHALL match `--mr-accent-soft`
- **AND** the row's `::before` pseudo-element SHALL have a 2px width with `--mr-accent` background

### Requirement: MIDI Outputs panel renders two device rows

The MIDI Outputs panel SHALL ship `data-open="true"` by default. Its head SHALL display the count `1`. Its body SHALL contain exactly two `.mr-dev` rows, in this order:

1. `Logic Pro · Track 4` — channel `CH·1`, LED `data-state="play"`, `data-active="true"`.
2. `Korg minilogue xd` — channel `CH·1`, LED with no `data-state`, no `data-active`.

The same row markup, LED color resolution, and active-stripe rendering rules from the MIDI Inputs requirement SHALL apply.

#### Scenario: Outputs panel renders two rows with correct attributes

- **WHEN** the Sidebar is rendered with the MIDI Outputs panel open
- **THEN** the panel body SHALL contain exactly 2 `.mr-dev` elements
- **AND** the first SHALL carry `data-active="true"` and have a `.mr-led` element with `data-state="play"`
- **AND** the second SHALL NOT carry `data-active="true"` and SHALL have a `.mr-led` element with no `data-state` attribute

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

### Requirement: Routing panel renders a 3-input by 3-output checkbox matrix

The Routing panel SHALL ship `data-open="true"` by default. Its head SHALL NOT display a count.

Its body SHALL contain a single `.mr-routing` element styled as a CSS grid with `grid-template-columns: 70px repeat(3, 1fr)` (or equivalent class-based rule). The grid SHALL contain 16 cells in row-major order:

- Row 0 (header row): an empty cell, then three header cells with text content `Logic Tr 4`, `minilogue`, `File`.
- Row 1 (minilogue): a label cell with text `minilogue`, then three checkbox cells: ON, OFF, OFF.
- Row 2 (KeyStep): a label cell with text `KeyStep`, then three checkbox cells: ON, ON, OFF.
- Row 3 (IAC 1): a label cell with text `IAC 1`, then three checkbox cells: OFF, OFF, ON.

Each checkbox cell SHALL render a 14×14 element with a 1px border in `--mr-line-2`. ON cells SHALL fill with `--mr-accent-soft` background AND render an SVG check-path in `--mr-accent`. OFF cells SHALL show a transparent background and no check-path.

Header cells SHALL use `--mr-fs-9` (or equivalent small uppercase size), `text-transform: uppercase`, `letter-spacing: 0.06em`, `--mr-text-2` color, and `text-align: center`. Label cells (the leftmost column from row 1 onward) SHALL use `--mr-fs-10`, mono font (`--mr-font-mono`), `--mr-text-2` color.

The matrix grid SHALL have a 1px gap rendered as `background: var(--mr-line-1)` on the grid container with `padding: 1px`, so the 1px gap between cells reads as a hairline divider.

All matrix cells SHALL be visual stubs — clicking a cell SHALL NOT toggle its on/off state.

#### Scenario: Routing panel renders the 4×4 grid with correct on-cells

- **WHEN** the Sidebar is rendered with the Routing panel open
- **THEN** the panel body SHALL contain exactly one `.mr-routing` grid element
- **AND** the grid SHALL contain exactly 16 direct-cell elements (4 rows × 4 columns)
- **AND** exactly 4 of those cells SHALL render as ON checkboxes (cells at row 1 col 1, row 2 col 1, row 2 col 2, row 3 col 3 — corresponding to minilogue→Logic, KeyStep→Logic, KeyStep→minilogue, IAC 1→File)
- **AND** the remaining checkbox cells SHALL render as OFF (no check-path SVG, transparent background)

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

In Slice 6a, the Sidebar's device list, filter state, channel-chip set, and routing matrix SHALL be hardcoded as `const` arrays at the top of `Sidebar.tsx`. They SHALL NOT be moved to a separate fixtures module. They SHALL NOT be derived from `useStage` or any hook.

A comment near the fixtures SHALL note the upstream source (`design_handoff_midi_recorder/prototype/components.jsx Sidebar()`) so future maintainers know where to look when synchronizing changes.

#### Scenario: Fixtures live in Sidebar.tsx

- **WHEN** the codebase is inspected
- **THEN** the device, filter, chip, and routing fixtures SHALL appear as `const` declarations in `src/components/sidebar/Sidebar.tsx`
- **AND** there SHALL NOT be a `Sidebar.fixtures.ts` file or similar
- **AND** the fixtures SHALL include a comment referencing the prototype's source location
