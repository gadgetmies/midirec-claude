## Purpose

Define the left-aside Browser Sidebar: its mounting in the `.mr-sidebar` aside, its four fixed-order panels (MIDI Inputs, MIDI Outputs, Record Filter, Routing), the collapsible-panel primitive with chevron + icon + title + optional count, the device-row primitive with LED state and active-row accent stripe, the form primitives (`.mr-row`, `.mr-switch`, `.mr-chip`) shared with the Inspector, the routing-matrix grid, and the rule that fixtures live hardcoded in `Sidebar.tsx` while all colors/sizes/typography resolve through `--mr-*` tokens.
## Requirements
### Requirement: Sidebar mounts in the .mr-sidebar aside

The codebase SHALL expose a `<Sidebar>` React component at `src/components/sidebar/Sidebar.tsx`. `AppShell.tsx` SHALL mount exactly one `<Sidebar>` element inside the `.mr-sidebar` aside, replacing the prior `<span class="mr-stub">Sidebar</span>` placeholder.

The Sidebar root SHALL NOT host stage mutations beyond composition of child components; `TrackInputMappingPanel`, `InputMappingPanel`, and `MidiPermissionBanner` own their behaviors per their capabilities. Legacy global MIDI device lists, record filter fixtures, and the routing matrix SHALL NOT be implemented in `Sidebar.tsx`.

#### Scenario: Sidebar replaces the stub

- **WHEN** the app is rendered
- **THEN** the `.mr-sidebar` aside SHALL contain exactly one Sidebar component root element
- **AND** the `.mr-sidebar` aside SHALL NOT contain any `.mr-stub` element
- **AND** the prior placeholder text "Sidebar" SHALL NOT appear

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

### Requirement: Sidebar primitives resolve through design tokens

All Sidebar CSS SHALL resolve colors, spacing, sizes, and typography through `--mr-*` tokens. No raw hex values, raw pixel values that duplicate a token, or hardcoded color strings SHALL appear in the Sidebar's CSS files.

Specifically:

- `.mr-sidebar` background SHALL use `var(--mr-bg-panel)` and right border SHALL use `var(--mr-line-2)`.
- `.mr-panel` border-bottom SHALL use `var(--mr-line-1)`.
- `.mr-panel__head` height SHALL be `28px` (or a token if available); padding SHALL use `--mr-sp-*`.
- `.mr-panel__head-l` font SHALL use `--mr-fs-10`, `--mr-fw-semibold`, `--mr-tracking-cap`, `--mr-text-2`.
- `.mr-row` minimum-height SHALL use `--mr-h-row` where row chrome is defined in Sidebar-owned or shared form styles.
- `.mr-switch` and `.mr-chip` used in sidebar-mounted panels SHALL follow the same token-driven rules as their shared definitions (e.g. hoisted form styles per the reuse requirement).

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

### Requirement: Sidebar mounts MidiPermissionBanner as its first child

The Sidebar SHALL render `<MidiPermissionBanner />` (from the `midi-runtime` capability) as its first child, above `TrackInputMappingPanel` and `InputMappingPanel`. The banner SHALL be a sibling of other Sidebar children, NOT a `.mr-panel` itself.

#### Scenario: Banner is the Sidebar's first child

- **WHEN** the Sidebar is rendered
- **THEN** the Sidebar's first authored child in the React tree SHALL be `MidiPermissionBanner` (which may render a `.mr-midi-banner` when permission is not `granted`, or nothing when granted)

#### Scenario: Banner does not use panel chrome

- **WHEN** the Sidebar is rendered with the runtime in a non-`granted` state
- **THEN** the `.mr-midi-banner` element SHALL NOT carry the `.mr-panel` class

### Requirement: Sidebar hosts TrackInputMappingPanel

The codebase SHALL mount `TrackInputMappingPanel` from `src/components/sidebar/` inside `<Sidebar>` per the `track-input-mapping` capability, immediately after `MidiPermissionBanner` and before `InputMappingPanel` in the authored JSX order. The panel SHALL use the same `Panel` primitive and visual tokens (`--mr-*`) as other sidebar panels unless a dedicated compact layout is specified in implementation tasks.

#### Scenario: Sidebar contains the panel component

- **WHEN** the app renders `Sidebar`
- **THEN** the React tree SHALL include `TrackInputMappingPanel`

### Requirement: Sidebar omits legacy device, record filter, and routing panels

The `<Sidebar>` component SHALL NOT render any `.mr-panel` whose visible head title (after stylesheet uppercase treatment) is `MIDI INPUTS`, `MIDI OUTPUTS`, `RECORD FILTER`, or `ROUTING`.

#### Scenario: Legacy panel heads are absent

- **WHEN** the Sidebar is rendered in a typical session layout
- **THEN** the `.mr-sidebar` subtree SHALL NOT contain a `.mr-panel__head-l` whose text content is `MIDI INPUTS`, `MIDI OUTPUTS`, `RECORD FILTER`, or `ROUTING`

