## MODIFIED Requirements

### Requirement: CC Lanes block holds three fixed-height lanes

The CC Lanes block at the bottom of the center column SHALL contain exactly three lane slots, each with height `var(--mr-h-cc-lane)`. The slots SHALL be populated by the `cc-lanes` capability — one `<CCLane>` per slot. The Slice-0 placeholder `.mr-cc-slot` divs SHALL NOT appear in the rendered DOM after the `cc-lanes` capability lands.

#### Scenario: Three lane slots present

- **WHEN** the app is rendered
- **THEN** the `.mr-cc-lanes` region SHALL contain exactly three child `.mr-cc-lane` elements
- **AND** each child's computed height SHALL equal `var(--mr-h-cc-lane)`
- **AND** the rendered DOM SHALL NOT contain any `.mr-cc-slot` elements

### Requirement: Empty regions ship empty until their slices populate them

Regions of the shell that have not yet been claimed by an implementation slice SHALL contain no transport buttons, no real CC lane bars, no inspector tabs, no statusbar meters. Each such empty region MAY contain a faint placeholder label (in `var(--mr-text-3)` or dimmer) solely to make geometry visible during development. As of this change, the **Titlebar** is populated by the `transport-titlebar` capability, the **Stage** is populated by the `tracks` capability (which composes the `piano-roll` capability per track), the **Ruler** is populated by the `ruler` capability, and the **CC Lanes block** is populated by the `cc-lanes` capability — none of these regions are subject to this rule. The remaining empty regions are: Sidebar, Toolstrip, Inspector, Statusbar.

#### Scenario: Empty regions contain no functional controls

- **WHEN** the app is rendered
- **THEN** the Sidebar, Toolstrip, Inspector, and Statusbar regions SHALL NOT contain `<button>` or `<input>` elements as direct functional controls
- **AND** any text content inside those regions SHALL be a non-interactive placeholder string

#### Scenario: Titlebar may contain functional controls

- **WHEN** the app is rendered
- **THEN** the Titlebar region MAY contain `<button>` elements (transport buttons, quantize toggle, etc.) per the `transport-titlebar` capability

#### Scenario: Stage may contain a multi-track stack of piano-roll renderers

- **WHEN** the app is rendered
- **THEN** the Stage region MAY contain the `MultiTrackStage` orchestrator (the `tracks` capability), which in turn contains one or more `.mr-roll` elements (`piano-roll` capability) — one per open track
- **AND** the Stage region MAY contain `<button>` elements inside track headers (chevron toggles, M/S chips per the `tracks` capability)

#### Scenario: Ruler may contain bar/beat ticks

- **WHEN** the app is rendered
- **THEN** the Ruler region MAY contain `.mr-ruler__tick` and `.mr-ruler__lbl` elements per the `ruler` capability

#### Scenario: CC Lanes block may contain CCLane components

- **WHEN** the app is rendered
- **THEN** the CC Lanes block (`.mr-cc-lanes`) MAY contain `.mr-cc-lane` elements with their headers and SVG plots per the `cc-lanes` capability
- **AND** the CC Lanes block MAY contain `<button>` elements inside lane headers (M/S chips per the `cc-lanes` capability)
