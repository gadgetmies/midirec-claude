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

The CC Lanes block at the bottom of the timeline SHALL contain exactly three lane slots, each with height `var(--mr-h-cc-lane)`. The slots SHALL be populated by the `cc-lanes` capability — one `<CCLane>` per slot. The Slice-0 placeholder `.mr-cc-slot` divs SHALL NOT appear in the rendered DOM.

The CC Lanes block SHALL render as the LAST child of `.mr-timeline` and SHALL carry `position: sticky; bottom: 0`, so it stays visible at the bottom of the visible timeline area while the multi-track stack scrolls vertically.

#### Scenario: Three lane slots present

- **WHEN** the app is rendered
- **THEN** the `.mr-cc-lanes` region SHALL contain exactly three child `.mr-cc-lane` elements
- **AND** each child's computed height SHALL equal `var(--mr-h-cc-lane)`
- **AND** the rendered DOM SHALL NOT contain any `.mr-cc-slot` elements

#### Scenario: CC Lanes block sticks to the bottom of the timeline

- **WHEN** the multi-track stack's content extends below the visible vertical area and the user scrolls vertically
- **THEN** `.mr-cc-lanes` SHALL remain at the bottom edge of `.mr-timeline`'s visible area (its computed `bottom` offset relative to the viewport SHALL stay constant at the timeline area's bottom edge)

### Requirement: Ruler region has fixed height

The Ruler region SHALL render at height `var(--mr-h-ruler)` directly above the timeline scroll container's content. The Ruler element SHALL be the first child of `.mr-timeline` and SHALL participate in the timeline's shared horizontal scroll axis. While `.mr-timeline` scrolls vertically, the Ruler SHALL remain pinned at the top of the visible timeline area via `position: sticky; top: 0`.

#### Scenario: Ruler slot present at the right height

- **WHEN** the app is rendered
- **THEN** an element with class `.mr-ruler` SHALL exist as the first child of `.mr-timeline`
- **AND** its computed height SHALL equal `var(--mr-h-ruler)`
- **AND** its computed `position` SHALL be `sticky` with `top` resolving to `0`

#### Scenario: Ruler stays visible during vertical scroll

- **WHEN** the user vertically scrolls `.mr-timeline` so that earlier track rows would scroll out the top
- **THEN** the Ruler SHALL remain visible at the top of the timeline area (its computed `top` offset relative to the viewport SHALL stay constant at the timeline area's top edge)

### Requirement: Stage region fills remaining vertical space

The center column SHALL contain a `.mr-timeline` element that fills the remaining vertical space between the Toolstrip and the bottom of the center column, growing and shrinking with the viewport. `.mr-timeline` SHALL have `overflow-x: auto` and `overflow-y: auto`, providing a single shared horizontal scrollbar for all timelines (Ruler, multi-track stack, CC lanes block) and a vertical scrollbar for the multi-track stack when its content exceeds the available vertical space.

`.mr-timeline` replaces the prior structure where `.mr-stage` (occupying `1fr`) and `.mr-cc-lanes` (occupying `auto`) were separate sibling rows of `.mr-center`. Under this requirement, `.mr-stage` no longer exists as a center-column grid row; the multi-track stack renders as a CHILD of `.mr-timeline` between the Ruler and the CC lanes block.

#### Scenario: Timeline fills remaining vertical space

- **WHEN** the viewport height changes
- **THEN** the heights of Titlebar, Toolstrip, and Statusbar SHALL remain constant
- **AND** the height of `.mr-timeline` SHALL absorb the remaining vertical space inside `.mr-center` (after the Toolstrip)

#### Scenario: Timeline owns the shared horizontal scrollbar

- **WHEN** the timeline content's intrinsic width (`KEYS_COLUMN_WIDTH + totalT * pxPerBeat ≈ 1464px` at default zoom) exceeds `.mr-timeline`'s visible width
- **THEN** exactly one horizontal scrollbar SHALL appear, attached to `.mr-timeline`
- **AND** dragging that scrollbar SHALL scroll the Ruler ticks, every `.mr-track__roll`'s lane area, and every `.mr-cc-lane__plot` in lockstep
- **AND** no other element in the shell (not `.mr-stage`, not `.mr-multi-track-stage`, not `.mr-track__roll`, not `.mr-cc-lanes`, not `.mr-cc-lane__plot`) SHALL show its own horizontal scrollbar

#### Scenario: Stage grid row is removed

- **WHEN** the rendered DOM is inspected
- **THEN** there SHALL NOT be a `.mr-stage` element as a direct grid-row child of `.mr-center`
- **AND** the multi-track stack (`.mr-multi-track-stage`) SHALL appear as a descendant of `.mr-timeline`, between the Ruler and the CC lanes block in document order

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

Regions of the shell that have not yet been claimed by an implementation slice SHALL contain no transport buttons, no real CC lane bars, no inspector tabs, no statusbar meters. Each such empty region MAY contain a faint placeholder label (in `var(--mr-text-3)` or dimmer) solely to make geometry visible during development. As of this change, the **Titlebar** is populated by the `transport-titlebar` capability, the **Timeline** (Ruler + multi-track stack + CC Lanes block) is populated by the `ruler`, `tracks`, `piano-roll`, and `cc-lanes` capabilities, and these regions are NOT subject to this rule. The remaining empty regions are: Sidebar, Toolstrip, Inspector, Statusbar.

#### Scenario: Empty regions contain no functional controls

- **WHEN** the app is rendered
- **THEN** the Sidebar, Toolstrip, Inspector, and Statusbar regions SHALL NOT contain `<button>` or `<input>` elements as direct functional controls
- **AND** any text content inside those regions SHALL be a non-interactive placeholder string

#### Scenario: Titlebar may contain functional controls

- **WHEN** the app is rendered
- **THEN** the Titlebar region MAY contain `<button>` elements (transport buttons, quantize toggle, etc.) per the `transport-titlebar` capability

#### Scenario: Timeline may contain a multi-track stack of piano-roll renderers

- **WHEN** the app is rendered
- **THEN** `.mr-timeline` MAY contain the `MultiTrackStage` orchestrator (the `tracks` capability), which in turn contains one or more `.mr-roll` elements (`piano-roll` capability) — one per open track
- **AND** `.mr-timeline` MAY contain `<button>` elements inside track headers (chevron toggles, M/S chips per the `tracks` capability)

#### Scenario: Timeline may contain bar/beat ticks

- **WHEN** the app is rendered
- **THEN** `.mr-timeline` MAY contain `.mr-ruler__tick` and `.mr-ruler__lbl` elements per the `ruler` capability, inside the sticky-top `.mr-ruler` element

#### Scenario: Timeline may contain CCLane components

- **WHEN** the app is rendered
- **THEN** `.mr-timeline` MAY contain the `.mr-cc-lanes` block with `.mr-cc-lane` elements per the `cc-lanes` capability
- **AND** `.mr-timeline` MAY contain `<button>` elements inside lane headers (M/S chips per the `cc-lanes` capability)

### Requirement: Screenshot 01 visual parity

The rendered shell at zero functionality SHALL match `design_handoff_midi_recorder/screenshots/` screenshot 01 in geometry, surface colors, divider weights, and overall composition. Pixel-identical color sampling is the acceptance criterion for surfaces; ±1px tolerance is acceptable for region dimensions.

#### Scenario: Manual screenshot comparison passes

- **WHEN** a developer runs `npm run dev` and opens the app at the screenshot's documented viewport
- **AND** captures a screenshot of the rendered shell
- **THEN** the captured screenshot SHALL match screenshot 01 in region layout, surface colors, and divider weights, within stated tolerances
