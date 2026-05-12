## ADDED Requirements

### Requirement: Sidebar omits legacy device, record filter, and routing panels

The `<Sidebar>` component SHALL NOT render any `.mr-panel` whose visible head title (after stylesheet uppercase treatment) is `MIDI INPUTS`, `MIDI OUTPUTS`, `RECORD FILTER`, or `ROUTING`.

#### Scenario: Legacy panel heads are absent

- **WHEN** the Sidebar is rendered in a typical session layout
- **THEN** the `.mr-sidebar` subtree SHALL NOT contain a `.mr-panel__head-l` whose text content is `MIDI INPUTS`, `MIDI OUTPUTS`, `RECORD FILTER`, or `ROUTING`

## MODIFIED Requirements

### Requirement: Sidebar mounts in the .mr-sidebar aside

The codebase SHALL expose a `<Sidebar>` React component at `src/components/sidebar/Sidebar.tsx`. `AppShell.tsx` SHALL mount exactly one `<Sidebar>` element inside the `.mr-sidebar` aside, replacing the prior `<span class="mr-stub">Sidebar</span>` placeholder.

The Sidebar root SHALL NOT host stage mutations beyond composition of child components; `TrackInputMappingPanel`, `InputMappingPanel`, and `MidiPermissionBanner` own their behaviors per their capabilities. Legacy global MIDI device lists, record filter fixtures, and the routing matrix SHALL NOT be implemented in `Sidebar.tsx`.

#### Scenario: Sidebar replaces the stub

- **WHEN** the app is rendered
- **THEN** the `.mr-sidebar` aside SHALL contain exactly one Sidebar component root element
- **AND** the `.mr-sidebar` aside SHALL NOT contain any `.mr-stub` element
- **AND** the prior placeholder text "Sidebar" SHALL NOT appear

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

## REMOVED Requirements

### Requirement: Sidebar renders four panels in fixed order

**Reason**: The four legacy panels (MIDI Inputs, MIDI Outputs, Record Filter, Routing) are removed from the left aside.

**Migration**: Use `TrackInputMappingPanel`, status bar, and other capabilities for device and filter context; any future global device matrix must be specified under a new or different capability.

### Requirement: Record Filter panel renders six switch rows and a channel chip strip

**Reason**: The Record Filter panel is removed; inert fixtures no longer appear in the sidebar.

**Migration**: When record filtering becomes behavior-driven, specify it under `midi-recording` or a new capability with real state.

### Requirement: Sidebar fixtures are hardcoded inside Sidebar.tsx

**Reason**: Filter and channel-chip fixture arrays existed only for the removed Record Filter panel; `Sidebar.tsx` no longer owns those lists.

**Migration**: Other components keep their own fixtures per their specs (e.g. `InputMappingPanel`, DJ data modules).

### Requirement: MIDI Inputs panel renders rows from useMidiInputs

**Reason**: The MIDI Inputs sidebar panel is removed.

**Migration**: `useMidiInputs` remains for `TrackInputMappingPanel`, pickers, and tests outside this removed panel.

### Requirement: MIDI Outputs panel renders rows from useMidiOutputs

**Reason**: The MIDI Outputs sidebar panel is removed.

**Migration**: `useMidiOutputs` remains for playback and other UI.

### Requirement: Routing panel derives input and output labels from live devices

**Reason**: The decorative routing matrix is removed from the sidebar.

**Migration**: Future per-track or global routing is out of scope for this removal; no routing state was tied to the matrix.
