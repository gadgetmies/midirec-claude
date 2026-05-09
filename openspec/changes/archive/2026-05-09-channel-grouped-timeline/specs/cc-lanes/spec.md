## REMOVED Requirements

### Requirement: CCLane data shape

**Reason**: The `CCLane` interface is replaced by the channel-scoped version defined in the `channels` capability. The new shape adds `channelId` and a `kind` discriminator (`'cc' | 'pb' | 'at' | 'vel'`), replacing the free-form `cc: string` (which conflated CC numbers with `"PB"` / `"VEL"` string sentinels).

**Migration**: Replace `CCLane` imports with the redefined interface from `src/hooks/useChannels.ts`. String `cc: "01"` becomes `kind: 'cc', cc: 1`; `cc: "PB"` becomes `kind: 'pb'`; `cc: "VEL"` becomes `kind: 'vel'` with `name: "Note Velocity"`.

### Requirement: useCCLanes hook is the source of CC lane state

**Reason**: `useCCLanes` is replaced by `useChannels` (defined in the `channels` capability), which owns the entire session organization including all CC lanes.

**Migration**: Replace `useCCLanes()` calls with `useChannels()`. The `lanes` field is now keyed by `(channelId, kind, cc?)` rather than an opaque id; toggle actions take that triple. `addCCLane(channelId, kind, cc?)` is the new affordance for inserting lanes.

### Requirement: CCLanesBlock renders all lanes and owns lane-scoped solo flag

**Reason**: The `CCLanesBlock` orchestrator is replaced by `<ChannelGroup>` rendering inside the `channels` capability. CC lanes render inline under their channel rather than as a single sticky-bottom band. The `data-soloing` attribute moves from `.mr-cc-lanes` to the timeline root and reflects session-global solo (channel-or-roll-or-lane), per the `channels` capability.

**Migration**: Delete `src/components/cc-lanes/CCLanesBlock.tsx`. The per-lane render concerns (`<CCLane>` itself) remain in this capability; orchestration moves to `<ChannelGroup>`.

## MODIFIED Requirements

### Requirement: CCLane renders a 56px header strip with right-aligned M/S chips

The `CCLane` component SHALL render a `<div className="mr-cc-lane" data-muted={lane.muted} data-soloed={lane.soloed} data-collapsed={lane.collapsed} data-audible={...}>` laid out as a flex column with two rows, mirroring the `.mr-track` row pattern: a horizontal **header** above a **body** containing the plot.

`.mr-cc-lane` SHALL be `display: flex; flex-direction: column`. The lane SHALL NOT carry `overflow: clip`; with the new structure, neither the header nor the body has flex content that overflows the lane's intrinsic width.

**Header row** — `.mr-cc-lane__hdr` SHALL span the lane's full width and SHALL split its children into three sticky-zoned wrappers in left-to-right order, mirroring `.mr-track__hdr`:

1. `<div className="mr-cc-lane__hdr-left">` — `position: sticky; left: 0; z-index: 1; background: var(--mr-bg-panel-2)`. Contains, in order:
   1. `<span className="mr-cc-lane__chev">` — chevron glyph; the CSS `[data-collapsed="true"] .mr-cc-lane__chev { transform: rotate(-90deg) }` rotates it when the lane is collapsed.
   2. `<span className="mr-cc-lane__name">{lane.name}</span>` rendering the lane name in 10px uppercase semibold `var(--mr-text-2)` (matching `.mr-track__name`). For `kind === 'cc'`, the name SHALL be the CC's display name (e.g., "Mod Wheel"). For `kind === 'pb'`, "Pitch Bend". For `kind === 'at'`, "Aftertouch". For `kind === 'vel'`, "Note Velocity".
   3. `<span className="mr-cc-lane__cc">{labelFor(lane)}</span>` rendering a sub-label in 9px monospace `var(--mr-text-3)`, where `labelFor` returns:
      - `kind === 'cc'`: `"CC " + cc` (e.g., `"CC 1"`).
      - `kind === 'pb'`: `"PB"`.
      - `kind === 'at'`: `"AT"`.
      - `kind === 'vel'`: `"VEL"` (NOT `"CC VEL"`).
2. `<div className="mr-cc-lane__hdr-spacer">` — `flex: 1; min-width: 0`. Flex-grow filler. NOT sticky.
3. `<div className="mr-cc-lane__hdr-right">` — `position: sticky; right: 0; z-index: 1; background: var(--mr-bg-panel-2)`. Contains exactly one `<MSChip muted={lane.muted} soloed={lane.soloed} onMute={...} onSolo={...} />`.

The header row's height SHALL be 22px (matching `.mr-track__hdr`), with `background: var(--mr-bg-panel-2)` and a 1px bottom border to visually separate it from the body.

**Body row** — `.mr-cc-lane__body` SHALL span the lane's full width and SHALL be `display: flex; align-items: stretch; height: var(--mr-h-cc-lane)`. It contains two children:

1. `<div className="mr-cc-lane__keys-spacer">` — `position: sticky; left: 0; z-index: 2; width: 56px; flex-shrink: 0; background: var(--mr-bg-panel-2); border-right: 1px solid var(--mr-line-2)`. This 56px sticky-left strip visually continues the piano-roll's keys column into the CC band so the plot's left edge aligns with the notes area above.
2. `<div className="mr-cc-lane__plot">` — `flex-shrink: 0; position: relative` with explicit `width: totalT * pxPerBeat` set inline. Contains the SVG plot (which fills the body height with `preserveAspectRatio="none"`) and the absolutely-positioned hover readout span.

Clicking on `.mr-cc-lane__hdr` outside the M/S chip SHALL invoke `toggleLaneCollapsed(lane.channelId, lane.kind, lane.cc)`. M/S chip clicks SHALL `event.stopPropagation()` and SHALL NOT trigger the collapse toggle.

When `lane.collapsed === true`, the lane SHALL replace the body with a thin **collapsed view** mirroring the `.mr-track__collapsed` pattern used by piano-roll tracks: a 18px-tall row containing a 56px sticky-left keys-spacer + a fixed-width minimap + the playhead. The collapsed view structure SHALL be:

1. `<div className="mr-cc-lane__keys-spacer">` — `position: sticky; left: 0; z-index: 2; width: 56px; flex-shrink: 0; background: var(--mr-bg-panel-2); border-right: 1px solid var(--mr-line-2)`. Visually continues the piano-roll keys column so the minimap's left edge aligns with the expanded plot's left edge above.
2. `<CCMinimap points={lane.points} color={lane.color} viewT0={...} totalT={...} pxPerBeat={...} />` rendering as `<div className="mr-cc-lane__minimap" style={{ width: totalT * pxPerBeat }}>` with one absolute-positioned `<span>` per CC point inside the view window. Each span SHALL be `width: 1.5px`, `top: 1px`, `bottom: 1px`, positioned at `left: (p.t - viewT0) * pxPerBeat` (PIXEL coordinates, NOT percentages — so the minimap's tick positions match the expanded plot's bar positions in the same horizontal scroll space), with `background: lane.color` and `opacity: 0.5 + p.v * 0.4` (matching the notes-track minimap formula; v=0 is still visibly displayed at opacity 0.5).
3. `<div className="mr-playhead" style={{ left: 56 + playheadT * pxPerBeat }}>` — the playback-position vertical line spanning the full collapsed-row height. The `::before` diamond cap SHALL be hidden in collapsed views (only the line shows; the diamond is for expanded plots).

The collapsed-view row SHALL be `display: flex; align-items: stretch; height: 18px; background: var(--mr-bg-app); position: relative` (relative for the absolute playhead). It SHALL NOT carry horizontal padding — the keys-spacer aligns with the piano-roll's keys column at x=0..56 in the timeline's inner coordinate system.

The lane's outer height when collapsed SHALL be `22px (header) + 18px (collapsed strip) = 40px`.

#### Scenario: Header row structure for a CC lane

- **WHEN** `<CCLane lane={{ channelId: 1, kind: 'cc', cc: 1, name: "Mod Wheel", ... }} />` is rendered
- **THEN** the rendered DOM SHALL contain `.mr-cc-lane > .mr-cc-lane__hdr > .mr-cc-lane__hdr-left` containing (in this order): `.mr-cc-lane__chev`, `.mr-cc-lane__name` with text `"Mod Wheel"`, `.mr-cc-lane__cc` with text `"CC 1"`
- **AND** SHALL contain `.mr-cc-lane > .mr-cc-lane__hdr > .mr-cc-lane__hdr-spacer`
- **AND** SHALL contain `.mr-cc-lane > .mr-cc-lane__hdr > .mr-cc-lane__hdr-right > .mr-ms` (the MSChip's root)

#### Scenario: Body row structure

- **WHEN** any `CCLane` is rendered with `collapsed: false`
- **THEN** the rendered DOM SHALL contain `.mr-cc-lane > .mr-cc-lane__body` containing (in this order): `.mr-cc-lane__keys-spacer`, `.mr-cc-lane__plot`
- **AND** the `.mr-cc-lane__keys-spacer`'s computed `position` SHALL be `sticky` with `left` resolving to `0` and `width` resolving to `56px`
- **AND** the `.mr-cc-lane__plot`'s computed `width` SHALL equal `totalT * pxPerBeat` so the plot's left edge aligns with the `.mr-roll__lanes` left edge in the piano-roll above

#### Scenario: Header structure for a Pitch Bend lane

- **WHEN** `<CCLane lane={{ channelId: 1, kind: 'pb', name: "Pitch Bend", ... }} />` is rendered
- **THEN** the `.mr-cc-lane__cc` element's text content SHALL be `"PB"` (NOT `"CC PB"`)

#### Scenario: Header structure for a Note Velocity lane

- **WHEN** `<CCLane lane={{ channelId: 1, kind: 'vel', name: "Note Velocity", ... }} />` is rendered
- **THEN** the `.mr-cc-lane__name` element's text content SHALL be `"Note Velocity"`
- **AND** the `.mr-cc-lane__cc` element's text content SHALL be `"VEL"` (NOT `"CC VEL"`)

#### Scenario: Collapsed lane shows a minimap of CC point positions

- **WHEN** `<CCLane lane={{ ..., points: [{t:1,v:0.5}, {t:5,v:0.7}, {t:10,v:0.3}], collapsed: true }} totalT={16} pxPerBeat={88} playheadT={4} />` is rendered
- **THEN** the rendered `.mr-cc-lane` SHALL carry `data-collapsed="true"`
- **AND** the rendered DOM SHALL NOT contain a `.mr-cc-lane__body` element
- **AND** the rendered DOM SHALL contain `.mr-cc-lane > .mr-cc-lane__collapsed > .mr-cc-lane__keys-spacer` and `.mr-cc-lane > .mr-cc-lane__collapsed > .mr-cc-lane__minimap`
- **AND** the `.mr-cc-lane__minimap` SHALL contain three absolute-positioned `<span>` children at `left: 88px`, `left: 440px`, `left: 880px` (the point positions in pixels: `t * pxPerBeat`)
- **AND** the `.mr-cc-lane__collapsed` SHALL contain a `.mr-playhead` element at `left: 56 + 4 * 88 = 408px`
- **AND** the lane's outer height SHALL equal `22px (header) + 18px (collapsed strip) = 40px`

#### Scenario: Empty lane renders no bars and no caps

- **WHEN** `<CCLane lane={{ ..., points: [] }} />` is rendered (the case after `addCCLane` inserts a fresh lane)
- **THEN** the rendered `.mr-cc-lane__plot` SHALL contain zero `<g>` elements (no bar/cap pairs)
- **AND** the only visible content of the plot SHALL be the linear-gradient mid-line background

#### Scenario: Header click toggles collapse

- **WHEN** the user clicks on `.mr-cc-lane__hdr` outside the M/S chip
- **THEN** `toggleLaneCollapsed(lane.channelId, lane.kind, lane.cc)` SHALL be invoked exactly once

#### Scenario: M/S click does not toggle collapse

- **WHEN** the user clicks the `M` button inside the lane's header M/S chip
- **THEN** `toggleLaneMuted(lane.channelId, lane.kind, lane.cc)` SHALL be invoked
- **AND** `toggleLaneCollapsed` SHALL NOT be invoked

#### Scenario: Header content sticks to the visible left edge

- **WHEN** the user horizontally scrolls `.mr-timeline`
- **THEN** `.mr-cc-lane__hdr-left`'s computed `position` SHALL be `sticky` with `left` resolving to `0`
- **AND** the chevron, name, and CC label SHALL stay readable at every horizontal scroll offset

#### Scenario: Header M/S chip sticks to the visible right edge

- **WHEN** the user horizontally scrolls `.mr-timeline`
- **THEN** `.mr-cc-lane__hdr-right`'s computed `position` SHALL be `sticky` with `right` resolving to `0`
- **AND** the M/S chip cluster SHALL stay clickable at every horizontal scroll offset

#### Scenario: Body keys-spacer sticks to the visible left edge

- **WHEN** the user horizontally scrolls `.mr-timeline`
- **THEN** `.mr-cc-lane__keys-spacer`'s computed `position` SHALL be `sticky` with `left` resolving to `0`
- **AND** the spacer SHALL visually continue the piano-roll's keys column at every scroll offset

#### Scenario: Lane data attributes mirror lane state

- **WHEN** `<CCLane lane={{ ..., muted: true, soloed: false, collapsed: false }} />` is rendered
- **THEN** the rendered `.mr-cc-lane` SHALL have `data-muted="true"`, `data-soloed="false"`, `data-collapsed="false"`

### Requirement: CCLane mute and solo composition matches data-attribute rules

The component's stylesheet SHALL implement:

- `[data-muted="true"] .mr-cc-lane__plot { opacity: 0.32; filter: grayscale(0.7); }` — muted lanes' plots are dimmed and desaturated.
- The session-global solo-dim selector lives in the `channels` capability stylesheet (uses `.mr-timeline[data-soloing="true"] [data-audible="false"] .mr-cc-lane__plot`).

The previous lane-block-scoped `[data-soloing="true"] [data-soloed="false"] .mr-cc-lane__plot { opacity: 0.45; }` rule SHALL be removed from this stylesheet.

#### Scenario: Muted lane plot is dimmed and grayscaled

- **WHEN** a `CCLane` renders with `lane.muted === true`
- **THEN** the computed style of its `.mr-cc-lane__plot` SHALL have `opacity: 0.32` and `filter: grayscale(0.7)`
- **AND** the computed style of its `.mr-cc-lane__hdr` SHALL retain the default `opacity: 1`

#### Scenario: Non-audible lane dims under timeline-scope data-soloing

- **WHEN** the timeline carries `data-soloing="true"` and the lane carries `data-audible="false"`
- **THEN** the lane's `.mr-cc-lane__plot` SHALL have computed `opacity: 0.45`
