### Requirement: Single-window shell with six static regions

The app SHALL render a single-window layout containing six regions, in the following arrangement:

- **Titlebar** at the top, full-width, height `var(--mr-h-toolbar)`.
- **Browser Sidebar** on the left of the body, width `var(--mr-w-sidebar)`, full body height.
- **Inspector** on the right of the body, width `var(--mr-w-inspector)`, full body height.
- **Center column** between sidebar and inspector, occupying remaining horizontal space, containing top-to-bottom: Toolstrip, Ruler, Stage, CC Lanes block.
- **Statusbar** at the bottom, full-width.

All region sizes SHALL resolve through `--mr-*` size tokens; no pixel literals duplicating token values are permitted.

#### Scenario: Geometry resolves from tokens

- **WHEN** the app is rendered at a 1440×900 viewport
- **THEN** the titlebar height SHALL equal the computed value of `--mr-h-toolbar`
- **AND** the sidebar width SHALL equal the computed value of `--mr-w-sidebar`
- **AND** the inspector width SHALL equal the computed value of `--mr-w-inspector`

#### Scenario: All six regions are present in the DOM

- **WHEN** the app is rendered
- **THEN** the DOM SHALL contain elements representing Titlebar, Sidebar, Toolstrip, Ruler, Stage, CC Lanes block, Inspector, and Statusbar
- **AND** each region SHALL be uniquely addressable via a `mr-*` class name matching the prototype's class taxonomy (e.g. `.mr-titlebar`, `.mr-sidebar`, `.mr-toolstrip`, `.mr-ruler`, `.mr-stage`, `.mr-cc-lanes`, `.mr-inspector`, `.mr-statusbar`)

### Requirement: CC Lanes block holds three fixed-height lanes

The CC Lanes block at the bottom of the center column SHALL contain exactly three lane slots, each with height `var(--mr-h-cc-lane)`. The slots SHALL be populated by the `cc-lanes` capability — one `<CCLane>` per slot. The Slice-0 placeholder `.mr-cc-slot` divs SHALL NOT appear in the rendered DOM after the `cc-lanes` capability lands.

#### Scenario: Three lane slots present

- **WHEN** the app is rendered
- **THEN** the `.mr-cc-lanes` region SHALL contain exactly three child `.mr-cc-lane` elements
- **AND** each child's computed height SHALL equal `var(--mr-h-cc-lane)`
- **AND** the rendered DOM SHALL NOT contain any `.mr-cc-slot` elements

### Requirement: Ruler region has fixed height

The Ruler region SHALL render at height `var(--mr-h-ruler)` directly above the Stage and below the Toolstrip.

#### Scenario: Ruler slot present at the right height

- **WHEN** the app is rendered
- **THEN** an element with class `.mr-ruler` SHALL exist between the toolstrip and the stage in the center column
- **AND** its computed height SHALL equal `var(--mr-h-ruler)`

### Requirement: Stage region fills remaining vertical space

The Stage region SHALL fill the remaining vertical space in the center column between the Ruler and the CC Lanes block, growing and shrinking with the viewport.

#### Scenario: Stage absorbs vertical slack

- **WHEN** the viewport height changes
- **THEN** the heights of Titlebar, Toolstrip, Ruler, CC Lanes block, and Statusbar SHALL remain constant
- **AND** the Stage's height SHALL absorb the remaining vertical space

### Requirement: Region surfaces use panel tokens

Each region's background SHALL be drawn from the panel surface tokens. Specifically:

- Titlebar, Sidebar, Inspector, Statusbar: `var(--mr-bg-panel)`.
- Toolstrip: `var(--mr-bg-panel)` or `var(--mr-bg-panel-2)` per the prototype's `app.css`.
- Stage timeline canvas: `var(--mr-bg-timeline)`.
- App backdrop (behind the shell): `var(--mr-bg-app)`.

Region dividers SHALL use `var(--mr-line-2)` 1px hairlines.

#### Scenario: Panel surfaces and dividers use tokens

- **WHEN** computed styles are inspected for each region
- **THEN** the `background-color` of Titlebar, Sidebar, Inspector, and Statusbar SHALL match the computed value of `--mr-bg-panel`
- **AND** divider borders between regions SHALL match the computed value of `--mr-line-2` at 1px width

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

### Requirement: Screenshot 01 visual parity

The rendered shell at zero functionality SHALL match `design_handoff_midi_recorder/screenshots/` screenshot 01 in geometry, surface colors, divider weights, and overall composition. Pixel-identical color sampling is the acceptance criterion for surfaces; ±1px tolerance is acceptable for region dimensions.

#### Scenario: Manual screenshot comparison passes

- **WHEN** a developer runs `npm run dev` and opens the app at the screenshot's documented viewport
- **AND** captures a screenshot of the rendered shell
- **THEN** the captured screenshot SHALL match screenshot 01 in region layout, surface colors, and divider weights, within stated tolerances
