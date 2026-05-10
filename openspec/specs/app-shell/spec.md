## Purpose

Define the single-window app shell: the static six-region layout (Titlebar, Sidebar, Toolstrip, Timeline, Inspector, Statusbar), the timeline scroll container that hosts the Ruler and channel groups, the panel-token surface palette, and the empty-region rule that gates content per implementation slice.

## Requirements

### Requirement: Single-window shell with six static regions

The app SHALL render a single-window layout containing six regions, in the following arrangement:

- **Titlebar** at the top, full-width, height `var(--mr-h-toolbar)`.
- **Browser Sidebar** on the left of the body, width `var(--mr-w-sidebar)`, full body height.
- **Inspector** on the right of the body, width `var(--mr-w-inspector)`, full body height.
- **Center column** between sidebar and inspector, occupying remaining horizontal space, containing top-to-bottom: Toolstrip, Timeline (which itself contains the Ruler and a vertical stack of channel groups).
- **Statusbar** at the bottom, full-width.

All region sizes SHALL resolve through `--mr-*` size tokens; no pixel literals duplicating token values are permitted.

#### Scenario: Geometry resolves from tokens

- **WHEN** the app is rendered at a 1440×900 viewport
- **THEN** the titlebar height SHALL equal the computed value of `--mr-h-toolbar`
- **AND** the sidebar width SHALL equal the computed value of `--mr-w-sidebar`
- **AND** the inspector width SHALL equal the computed value of `--mr-w-inspector`

#### Scenario: All regions are present in the DOM

- **WHEN** the app is rendered
- **THEN** the DOM SHALL contain elements representing Titlebar, Sidebar, Toolstrip, Timeline (with Ruler + channel groups), Inspector, and Statusbar
- **AND** each region SHALL be uniquely addressable via a `mr-*` class name matching the prototype's class taxonomy (e.g. `.mr-titlebar`, `.mr-sidebar`, `.mr-toolstrip`, `.mr-ruler`, `.mr-timeline`, `.mr-channel`, `.mr-inspector`, `.mr-statusbar`)

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

The center column SHALL contain a `.mr-timeline` element that fills the remaining vertical space between the Toolstrip and the bottom of the center column, growing and shrinking with the viewport. `.mr-timeline` SHALL have `overflow-x: auto` and `overflow-y: auto`, providing a single shared horizontal scrollbar for all timelines (Ruler + every channel group's roll + every param lane plot) and a vertical scrollbar for the channel stack when its content exceeds the available vertical space.

The browser scrollbar SHALL be hidden via `scrollbar-width: none` and the WebKit `::-webkit-scrollbar { display: none }` pseudo so that no reserved-track gap appears at the timeline's right or bottom edge.

`.mr-timeline` replaces the prior structure where `.mr-stage` (occupying `1fr`) and `.mr-cc-lanes` (occupying `auto`) were separate sibling rows of `.mr-center`. The timeline body — between the sticky-top Ruler and the timeline's bottom — SHALL host one `<ChannelGroup>` (`.mr-channel` element) per visible channel, in numeric ascending order of `Channel.id`. There SHALL NOT be a separate `.mr-multi-track-stage` orchestrator element nor a separate `.mr-cc-lanes` block element at this level (the `.mr-cc-lanes` class is removed entirely from the codebase as part of the rename to `param-lanes`).

`.mr-timeline` (or `.mr-timeline__inner`) SHALL carry the global `data-soloing="true"` attribute when any channel/roll/lane in the session has `soloed === true`, per the `channels` capability.

#### Scenario: Timeline fills remaining vertical space

- **WHEN** the viewport height changes
- **THEN** the heights of Titlebar, Toolstrip, and Statusbar SHALL remain constant
- **AND** the height of `.mr-timeline` SHALL absorb the remaining vertical space inside `.mr-center` (after the Toolstrip)

#### Scenario: Timeline owns the shared horizontal scrollbar

- **WHEN** the timeline content's intrinsic width (`KEYS_COLUMN_WIDTH + totalT * pxPerBeat ≈ 1464px` at default zoom) exceeds `.mr-timeline`'s visible width
- **THEN** exactly one horizontal scrollbar SHALL appear, attached to `.mr-timeline`
- **AND** dragging that scrollbar (or wheel/touch scroll) SHALL scroll the Ruler ticks, every channel's `.mr-track__roll`'s lane area, and every `.mr-param-lane__plot` in lockstep
- **AND** no other element in the shell SHALL show its own horizontal scrollbar

#### Scenario: Browser scrollbar is hidden

- **WHEN** the timeline overflows horizontally or vertically
- **THEN** no visible scrollbar track SHALL appear inside `.mr-timeline` (`scrollbar-width: none` is set; `::-webkit-scrollbar` is `display: none`)
- **AND** there SHALL NOT be a black gap on the right or bottom of `.mr-timeline` corresponding to a reserved scrollbar track

#### Scenario: Timeline body hosts channel groups

- **WHEN** the rendered DOM is inspected
- **THEN** there SHALL NOT be a `.mr-stage` element as a direct grid-row child of `.mr-center`
- **AND** there SHALL NOT be a `.mr-multi-track-stage` element inside `.mr-timeline`
- **AND** there SHALL NOT be a standalone `.mr-cc-lanes` block element anywhere (the class is removed entirely as part of the rename to `param-lanes`)
- **AND** the timeline body SHALL contain one `<div className="mr-channel">` per visible channel, between the Ruler and the bottom of the timeline

#### Scenario: data-soloing is on the timeline root

- **WHEN** any channel/roll/lane in the session has `soloed === true`
- **THEN** `.mr-timeline` (or `.mr-timeline__inner`) SHALL carry `data-soloing="true"`
- **AND** no `.mr-multi-track-stage` or other intermediate orchestrator element SHALL carry `data-soloing` (those elements no longer exist as orchestrators)

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

Regions of the shell that have not yet been claimed by an implementation slice SHALL contain no transport buttons, no real param lane bars, no statusbar meters. Each such empty region MAY contain a faint placeholder label (in `var(--mr-text-3)` or dimmer) solely to make geometry visible during development. As of this change, the **Titlebar** is populated by the `transport-titlebar` capability, the **Timeline** (Ruler + channel groups) is populated by the `ruler`, `channels`, `tracks`, `piano-roll`, and `param-lanes` capabilities, the **Inspector** is populated by the `inspector` capability, the **Sidebar** is populated by the `sidebar` capability, and these regions are NOT subject to this rule. The remaining empty regions are: Toolstrip, Statusbar.

#### Scenario: Empty regions contain no functional controls

- **WHEN** the app is rendered
- **THEN** the Toolstrip and Statusbar regions SHALL NOT contain `<button>` or `<input>` elements as direct functional controls
- **AND** any text content inside those regions SHALL be a non-interactive placeholder string

#### Scenario: Titlebar may contain functional controls

- **WHEN** the app is rendered
- **THEN** the Titlebar region MAY contain `<button>` elements (transport buttons, quantize toggle, etc.) per the `transport-titlebar` capability

#### Scenario: Timeline may contain channel groups

- **WHEN** the app is rendered
- **THEN** `.mr-timeline` MAY contain one or more `<div className="mr-channel">` elements per the `channels` capability
- **AND** each `.mr-channel` MAY contain a `<Track>` (`tracks` capability) with its `<PianoRoll>` (`piano-roll` capability) and zero-or-more `<ParamLane>` elements (`param-lanes` capability)
- **AND** `.mr-timeline` MAY contain `<button>` elements inside channel headers, track headers, lane headers, and the `+ Add Lane` affordance

#### Scenario: Timeline may contain bar/beat ticks

- **WHEN** the app is rendered
- **THEN** `.mr-timeline` MAY contain `.mr-ruler__tick` and `.mr-ruler__lbl` elements per the `ruler` capability, inside the sticky-top `.mr-ruler` element

#### Scenario: Inspector may contain tabs and panel content

- **WHEN** the app is rendered
- **THEN** the `.mr-inspector` aside MAY contain `.mr-insp-tabs` and `.mr-insp-tab` elements per the `inspector` capability
- **AND** the `.mr-inspector` aside MAY contain `<button>` elements (bulk-action buttons in the multi-select Note panel)
- **AND** the `.mr-inspector` aside SHALL NOT contain a `.mr-stub` placeholder element

#### Scenario: Sidebar may contain panels and form controls

- **WHEN** the app is rendered
- **THEN** the `.mr-sidebar` aside MAY contain `.mr-panel` elements per the `sidebar` capability
- **AND** each `.mr-panel` MAY contain `.mr-panel__head` (a clickable element toggling collapse), `.mr-panel__body`, `.mr-dev` rows, `.mr-row` form rows, `.mr-switch` toggles, `.mr-chip` channel chips, and a `.mr-routing` matrix
- **AND** the `.mr-sidebar` aside MAY contain `<button>` elements (panel heads, channel chips)
- **AND** the `.mr-sidebar` aside SHALL NOT contain a `.mr-stub` placeholder element

### Requirement: Screenshot 01 visual parity

The rendered shell at zero functionality SHALL match `design_handoff_midi_recorder/screenshots/` screenshot 01 in geometry, surface colors, divider weights, and overall composition. Pixel-identical color sampling is the acceptance criterion for surfaces; ±1px tolerance is acceptable for region dimensions.

#### Scenario: Manual screenshot comparison passes

- **WHEN** a developer runs `npm run dev` and opens the app at the screenshot's documented viewport
- **AND** captures a screenshot of the rendered shell
- **THEN** the captured screenshot SHALL match screenshot 01 in region layout, surface colors, and divider weights, within stated tolerances
