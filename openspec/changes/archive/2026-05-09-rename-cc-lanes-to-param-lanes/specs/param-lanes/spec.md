## ADDED Requirements

### Requirement: ParamLane renders a header row above a body containing the plot

The `ParamLane` component SHALL render a `<div className="mr-param-lane" data-muted={lane.muted} data-soloed={lane.soloed} data-collapsed={lane.collapsed} data-audible={...}>` laid out as a flex column with two rows, mirroring the `.mr-track` row pattern: a horizontal **header** above a **body** containing the plot.

`.mr-param-lane` SHALL be `display: flex; flex-direction: column; position: relative`. The lane SHALL NOT carry `overflow: clip`.

**Header row** — `.mr-param-lane__hdr` SHALL span the lane's full width and SHALL split its children into three sticky-zoned wrappers in left-to-right order, mirroring `.mr-track__hdr`:

1. `<div className="mr-param-lane__hdr-left">` — `position: sticky; left: 0; z-index: 1; background: var(--mr-bg-panel-2)`. Contains, in order:
   1. `<span className="mr-param-lane__chev">` — chevron glyph; the CSS `[data-collapsed="true"] .mr-param-lane__chev { transform: rotate(-90deg) }` rotates it when the lane is collapsed.
   2. `<span className="mr-param-lane__name">{lane.name}</span>` rendering the lane name in 10px uppercase semibold `var(--mr-text-2)` (matching `.mr-track__name`). For `kind === 'cc'`, the name SHALL be the CC's display name (e.g., "Mod Wheel"). For `kind === 'pb'`, "Pitch Bend". For `kind === 'at'`, "Aftertouch".
   3. `<span className="mr-param-lane__cc">{laneCCLabel(lane)}</span>` rendering a sub-label in 9px monospace `var(--mr-text-3)`, where `laneCCLabel` returns:
      - `kind === 'cc'`: `"CC " + cc` (e.g., `"CC 1"`).
      - `kind === 'pb'`: `"PB"`.
      - `kind === 'at'`: `"AT"`.
2. `<div className="mr-param-lane__hdr-spacer">` — `flex: 1; min-width: 0`. Flex-grow filler. NOT sticky.
3. `<div className="mr-param-lane__hdr-right">` — `position: sticky; right: 0; z-index: 1; background: var(--mr-bg-panel-2)`. Contains exactly one `<MSChip muted={lane.muted} soloed={lane.soloed} onMute={...} onSolo={...} />`.

The header row's height SHALL be 22px (matching `.mr-track__hdr`), with `background: var(--mr-bg-panel-2)`, `position: relative; z-index: 1` to lift the whole header to a stacking context that covers the playhead diamond's overflow into the header's bottom edge, and a 1px bottom border to visually separate it from the body.

**Body row** — `.mr-param-lane__body` SHALL span the lane's full width and SHALL be `display: flex; align-items: stretch; height: var(--mr-h-cc-lane)`. It contains two children:

1. `<div className="mr-param-lane__keys-spacer">` — `position: sticky; left: 0; z-index: 2; width: 56px; flex-shrink: 0; background: var(--mr-bg-panel-2); border-right: 1px solid var(--mr-line-2)`. This 56px sticky-left strip visually continues the piano-roll's keys column into the param band so the plot's left edge aligns with the notes area above.
2. `<div className="mr-param-lane__plot">` — `flex-shrink: 0; position: relative; z-index: 0` with explicit `width: totalT * pxPerBeat` set inline. Contains the SVG plot (which fills the body height with `preserveAspectRatio="none"`), the absolute-positioned playhead, and the absolutely-positioned hover readout span. `z-index: 0` caps the playhead's z=5 inside this stacking context so the diamond cap renders below the sibling keys-spacer (z=2) and the lane header (z=1).

Clicking on `.mr-param-lane__hdr` outside the M/S chip SHALL invoke `toggleLaneCollapsed(lane.channelId, lane.kind, lane.cc)`. M/S chip clicks SHALL `event.stopPropagation()` and SHALL NOT trigger the collapse toggle.

When `lane.collapsed === true`, the lane SHALL replace the body with a thin **collapsed view** mirroring the `.mr-track__collapsed` pattern used by piano-roll tracks: a 18px-tall row containing a 56px sticky-left keys-spacer + a fixed-width minimap + the playhead. The collapsed view structure SHALL be:

1. `<div className="mr-param-lane__keys-spacer">` — same shape as the body's keys-spacer.
2. `<ParamMinimap points={lane.points} color={lane.color} viewT0={...} totalT={...} pxPerBeat={...} />` rendering as `<div className="mr-param-lane__minimap" style={{ width: totalT * pxPerBeat }}>` with one absolute-positioned `<span>` per point inside the view window. Each span SHALL be `width: 1.5px`, `top: 1px`, `bottom: 1px`, positioned at `left: (p.t - viewT0) * pxPerBeat` (PIXEL coordinates, NOT percentages — so the minimap's tick positions match the expanded plot's bar positions in the same horizontal scroll space), with `background: lane.color` and `opacity: 0.5 + p.v * 0.4` (matching the notes-track minimap formula; v=0 is still visibly displayed at opacity 0.5).
3. `<div className="mr-playhead" style={{ left: 56 + playheadT * pxPerBeat }}>` — the playback-position vertical line spanning the full collapsed-row height. The `::before` diamond cap SHALL be hidden in collapsed views.

The collapsed-view row SHALL be `display: flex; align-items: stretch; height: 18px; background: var(--mr-bg-app); position: relative`. The lane's outer height when collapsed SHALL be `22px (header) + 18px (collapsed strip) = 40px`.

#### Scenario: Header row structure for a CC lane

- **WHEN** `<ParamLane lane={{ channelId: 1, kind: 'cc', cc: 1, name: "Mod Wheel", ... }} />` is rendered
- **THEN** the rendered DOM SHALL contain `.mr-param-lane > .mr-param-lane__hdr > .mr-param-lane__hdr-left` containing (in this order): `.mr-param-lane__chev`, `.mr-param-lane__name` with text `"Mod Wheel"`, `.mr-param-lane__cc` with text `"CC 1"`
- **AND** SHALL contain `.mr-param-lane > .mr-param-lane__hdr > .mr-param-lane__hdr-spacer`
- **AND** SHALL contain `.mr-param-lane > .mr-param-lane__hdr > .mr-param-lane__hdr-right > .mr-ms` (the MSChip's root)
- **AND** the rendered DOM SHALL NOT contain any element matching `.mr-cc-lane*` (the old class taxonomy is removed entirely)

#### Scenario: Body row structure

- **WHEN** any `ParamLane` is rendered with `collapsed: false`
- **THEN** the rendered DOM SHALL contain `.mr-param-lane > .mr-param-lane__body` containing (in this order): `.mr-param-lane__keys-spacer`, `.mr-param-lane__plot`
- **AND** the `.mr-param-lane__keys-spacer`'s computed `position` SHALL be `sticky` with `left` resolving to `0` and `width` resolving to `56px`
- **AND** the `.mr-param-lane__plot`'s computed `width` SHALL equal `totalT * pxPerBeat` so the plot's left edge aligns with the `.mr-roll__lanes` left edge in the piano-roll above

#### Scenario: Header structure for a Pitch Bend lane

- **WHEN** `<ParamLane lane={{ channelId: 1, kind: 'pb', name: "Pitch Bend", ... }} />` is rendered
- **THEN** the `.mr-param-lane__cc` element's text content SHALL be `"PB"` (NOT `"CC PB"`)

#### Scenario: Header structure for an Aftertouch lane

- **WHEN** `<ParamLane lane={{ channelId: 1, kind: 'at', name: "Aftertouch", ... }} />` is rendered
- **THEN** the `.mr-param-lane__cc` element's text content SHALL be `"AT"` (NOT `"CC AT"`)

#### Scenario: 'vel' kind is not a valid ParamLane

- **WHEN** code attempts to construct or render a lane with `kind: 'vel'`
- **THEN** the TypeScript type SHALL reject the value at compile time
- **AND** no runtime ParamLane SHALL exist with `kind === 'vel'`

#### Scenario: Collapsed lane shows a minimap of point positions

- **WHEN** `<ParamLane lane={{ ..., points: [{t:1,v:0.5}, {t:5,v:0.7}, {t:10,v:0.3}], collapsed: true }} totalT={16} pxPerBeat={88} playheadT={4} />` is rendered
- **THEN** the rendered `.mr-param-lane` SHALL carry `data-collapsed="true"`
- **AND** the rendered DOM SHALL NOT contain a `.mr-param-lane__body` element
- **AND** the rendered DOM SHALL contain `.mr-param-lane > .mr-param-lane__collapsed > .mr-param-lane__keys-spacer` and `.mr-param-lane > .mr-param-lane__collapsed > .mr-param-lane__minimap`
- **AND** the `.mr-param-lane__minimap` SHALL contain three absolute-positioned `<span>` children at `left: 88px`, `left: 440px`, `left: 880px` (the point positions in pixels: `t * pxPerBeat`)
- **AND** the `.mr-param-lane__collapsed` SHALL contain a `.mr-playhead` element at `left: 56 + 4 * 88 = 408px`
- **AND** the lane's outer height SHALL equal `22px (header) + 18px (collapsed strip) = 40px`

#### Scenario: Empty lane renders no bars and no caps

- **WHEN** `<ParamLane lane={{ ..., points: [] }} />` is rendered (the case after `addParamLane` inserts a fresh lane)
- **THEN** the rendered `.mr-param-lane__plot` SHALL contain zero `<g>` elements (no bar/cap pairs)
- **AND** the only visible content of the plot SHALL be the linear-gradient mid-line background

#### Scenario: Header click toggles collapse

- **WHEN** the user clicks on `.mr-param-lane__hdr` outside the M/S chip
- **THEN** `toggleLaneCollapsed(lane.channelId, lane.kind, lane.cc)` SHALL be invoked exactly once

#### Scenario: M/S click does not toggle collapse

- **WHEN** the user clicks the `M` button inside the lane's header M/S chip
- **THEN** `toggleLaneMuted(lane.channelId, lane.kind, lane.cc)` SHALL be invoked
- **AND** `toggleLaneCollapsed` SHALL NOT be invoked

#### Scenario: Header content sticks to the visible left edge

- **WHEN** the user horizontally scrolls `.mr-timeline`
- **THEN** `.mr-param-lane__hdr-left`'s computed `position` SHALL be `sticky` with `left` resolving to `0`
- **AND** the chevron, name, and sub label SHALL stay readable at every horizontal scroll offset

#### Scenario: Header M/S chip sticks to the visible right edge

- **WHEN** the user horizontally scrolls `.mr-timeline`
- **THEN** `.mr-param-lane__hdr-right`'s computed `position` SHALL be `sticky` with `right` resolving to `0`
- **AND** the M/S chip cluster SHALL stay clickable at every horizontal scroll offset

#### Scenario: Body keys-spacer sticks to the visible left edge

- **WHEN** the user horizontally scrolls `.mr-timeline`
- **THEN** `.mr-param-lane__keys-spacer`'s computed `position` SHALL be `sticky` with `left` resolving to `0`
- **AND** the spacer SHALL visually continue the piano-roll's keys column at every scroll offset

#### Scenario: Lane data attributes mirror lane state

- **WHEN** `<ParamLane lane={{ ..., muted: true, soloed: false, collapsed: false }} />` is rendered
- **THEN** the rendered `.mr-param-lane` SHALL have `data-muted="true"`, `data-soloed="false"`, `data-collapsed="false"`

### Requirement: ParamLane renders a 64-cell discrete-bar SVG plot

The `.mr-param-lane__plot` element SHALL contain an inline `<svg>` with `width="100%" height="72" preserveAspectRatio="none" viewBox={"0 0 ${plotW} 72"}` where `plotW` is the lane's measured plot width in pixels.

The renderer SHALL resample `lane.points` onto a fixed 64-cell grid spanning `[viewT0, viewT0 + totalT]`. For each cell `i` in `[0, 64)`:

- `cellT = totalT / 64`
- `tCenter = (i + 0.5) * cellT + viewT0`
- The cell's `v` SHALL be the `v` of whichever sample in `lane.points` has the smallest `|sample.t - tCenter|` (nearest-sample averaging).

If `lane.points` is empty, the plot SHALL render zero `<g>` elements (no bars, no caps) — only the linear-gradient mid-line background shows.

For non-empty `points`, each cell SHALL render two `<rect>` elements inside the same `<g>`:

1. The bar: `width=1.5`, `height = cell.v * 56`, positioned at `x = i * cellW + (cellW - 1.5)/2`, `y = 8 + (56 - height)`, with `fill = lane.color`, `fill-opacity = 0.78`, `shape-rendering="crispEdges"`. (`cellW = plotW / 64`.)
2. The cap: `width = 1.5 + 1`, `height = 2`, positioned at `x = bar.x - 0.5`, `y = bar.y - 0.5`, with `fill = lane.color`, `opacity = 1`, `shape-rendering="crispEdges"`.

Cells with `v = 0` (within a non-empty `points` array) SHALL still render both rectangles — the bar at `height = 0`, the cap at the bar's top — so the plot maintains a regular 64-event grid even for silent regions.

The plot's background mid-line SHALL be drawn in CSS as a 1px horizontal stripe at 50% height in `rgba(255,255,255,0.04)` via the `.mr-param-lane__plot` rule's `linear-gradient` background.

#### Scenario: 64 bar groups rendered for any non-empty points

- **WHEN** `<ParamLane lane={{ ..., points: [{t:4, v:0.5}, {t:8, v:0.7}] }} totalT={16} />` is rendered
- **THEN** the rendered SVG SHALL contain exactly 64 `<g>` elements at the bar level
- **AND** each `<g>` SHALL contain exactly two `<rect>` elements (bar + cap)

#### Scenario: Empty points render no bars

- **WHEN** `<ParamLane lane={{ ..., points: [] }} totalT={16} />` is rendered
- **THEN** the rendered SVG SHALL contain zero `<g>` elements at the bar level
- **AND** no `<rect>` elements SHALL render inside the plot

#### Scenario: Bars are 1.5px regardless of cell pitch

- **WHEN** `<ParamLane lane={...} totalT={16} />` is rendered into a plot of any width
- **THEN** every bar `<rect>` SHALL have `width="1.5"`
- **AND** every cap `<rect>` SHALL have `width="2.5"`

### Requirement: ParamLane shows a hover scrubbing readout

The `ParamLane` component SHALL maintain a local hover state of type `{ idx: number; v: number } | null` (initial `null`). On `mousemove` over the `.mr-param-lane__plot` element (and only when `lane.points.length > 0`), the renderer SHALL compute `idx = floor((event.offsetX / plotW) * 64)` clamped to `[0, 63]`, look up `v` from the resampled bar array at that index, and set hover state to `{ idx, v }`. On `mouseleave`, hover state SHALL be set back to `null`. When `lane.collapsed` is `true`, hover SHALL be ignored.

While `hover != null`, the SVG SHALL render an additional `<g>` at the end of the children list (so it z-orders above the bars) containing:

- A `<rect>` at `x = hover.idx * cellW`, `y = 8`, `width = cellW`, `height = 56`, `fill = "var(--mr-accent)"`, `opacity = 0.10`, `shape-rendering = "crispEdges"` — the column tint.
- A `<rect>` at `x = hover.idx * cellW + (cellW - 1.5)/2`, `y = 8 + (56 - hover.v * 56)`, `width = 1.5`, `height = hover.v * 56`, `fill = "var(--mr-accent)"`, `opacity = 0.7`, `shape-rendering = "crispEdges"` — the ghost bar.

In the same hover-active branch, the `.mr-param-lane__plot` SHALL also render a sibling `<div className="mr-param-lane__readout">` (outside the SVG) positioned at `style={{ left: hover.idx * cellW + cellW/2, top: 0 }}` with text `Math.round(hover.v * 127)` (a 0–127 integer string). The readout SHALL be styled in 10px monospace `var(--mr-text-2)` with no background fill.

When hover state is `null`, none of the column tint, ghost bar, or readout elements SHALL render.

#### Scenario: Hover renders three overlay elements

- **WHEN** the user mouses over a param lane plot at a position that resolves to cell index 12 (with that cell's `v = 0.4`)
- **THEN** the rendered SVG SHALL contain a column-tint `<rect>` with `x = 12 * cellW`, `width = cellW`, `fill = "var(--mr-accent)"`, `opacity = 0.10`
- **AND** SHALL contain a ghost-bar `<rect>` with `x = 12 * cellW + (cellW - 1.5)/2`, `width = 1.5`, `fill = "var(--mr-accent)"`, `opacity = 0.7`
- **AND** the lane's DOM SHALL contain a `.mr-param-lane__readout` element with text content `"51"` (`Math.round(0.4 * 127)`)

#### Scenario: Mouseleave clears hover state

- **WHEN** the user mouses over the plot then leaves it
- **THEN** the rendered DOM SHALL contain zero column-tint, ghost-bar, or `.mr-param-lane__readout` elements

#### Scenario: Readout uses 0–127 integer formatting, not float

- **WHEN** the hovered cell's `v` is `0.5`
- **THEN** the `.mr-param-lane__readout` text content SHALL be `"64"` (`Math.round(0.5 * 127)`) — NOT `"0.50"`, NOT `"50%"`

### Requirement: ParamLane mute and solo composition

The component's stylesheet SHALL implement:

- `[data-muted="true"] .mr-param-lane__plot, [data-muted="true"] .mr-param-lane__collapsed { opacity: 0.32; filter: grayscale(0.7); }` — muted lanes' plots and collapsed strips are dimmed and desaturated. The selector matches when ANY ancestor (channel, lane) is muted, so channel mute cascades to lane visuals.
- The session-global solo-dim selector lives in the `channels` capability stylesheet (uses `.mr-timeline[data-soloing="true"] .mr-param-lane[data-audible="false"] .mr-param-lane__plot` and `.mr-param-lane__collapsed`, scoped to the immediate row).

The previous lane-block-scoped `[data-soloing="true"] [data-soloed="false"] .mr-cc-lane__plot { opacity: 0.45; }` rule SHALL NOT exist in the new stylesheet.

#### Scenario: Muted lane plot is dimmed and grayscaled

- **WHEN** a `ParamLane` renders with `lane.muted === true`
- **THEN** the computed style of its `.mr-param-lane__plot` (or `.mr-param-lane__collapsed` when collapsed) SHALL have `opacity: 0.32` and `filter: grayscale(0.7)`
- **AND** the computed style of its `.mr-param-lane__hdr` SHALL retain the default `opacity: 1`

#### Scenario: Non-audible lane dims under timeline-scope data-soloing

- **WHEN** the timeline carries `data-soloing="true"` and the lane carries `data-audible="false"`
- **THEN** the lane's `.mr-param-lane__plot` (or `.mr-param-lane__collapsed`) SHALL have computed `opacity: 0.45`

### Requirement: ParamLane forward-compat props for paint and interp are inert

The `ParamLane` component SHALL accept optional `paint?: number[]` and `interp?: { a: number | null; b: number | null }` props for forward-compat with a future paint/interp slice.

In the current slice the parent orchestrator (`<ChannelGroup>`) SHALL NOT pass either prop; both SHALL default to `undefined` at the component boundary. When undefined, `ParamLane` SHALL render no paint trail, no interp endpoints, no interp guide line, and no paint/interp cursor hints — the rendered SVG SHALL be identical to a render with both props omitted.

A future slice may activate these props; until then, type-checking SHALL still pass with `paint` and `interp` set, but no visual behavior SHALL be triggered.

#### Scenario: Paint prop with values renders no trail

- **WHEN** `<ParamLane paint={[5, 6, 7]} ... />` is rendered (despite the orchestrator not passing it)
- **THEN** the rendered SVG SHALL be identical to a render with `paint` omitted in this slice

#### Scenario: Interp prop with endpoints renders no guide line

- **WHEN** `<ParamLane interp={{ a: 4, b: 12 }} ... />` is rendered in this slice
- **THEN** the rendered SVG SHALL contain zero `<line>` elements
- **AND** SHALL contain zero `.mr-param-cursor` elements
