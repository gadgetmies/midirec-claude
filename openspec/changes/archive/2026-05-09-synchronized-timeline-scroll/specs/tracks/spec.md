## MODIFIED Requirements

### Requirement: Track header renders chevron, swatch, name, sub, and M/S chip

Each track row SHALL render a `.mr-track__hdr` element that spans the full intrinsic timeline width and SHALL split its children into three sticky-zoned wrappers, in left-to-right order:

1. `<div className="mr-track__hdr-left">` — the LEFT label zone, `position: sticky; left: 0; z-index: 1`, containing in order:
   1. `<span className="mr-track__chev">` — chevron glyph. The CSS selector `[data-track-open="false"] .mr-track__chev` rotates it `-90deg` to indicate the collapsed state.
   2. `<span className="mr-track__swatch" style={{background: tr.color, color: tr.color}}>` — 9×9px colored square, with a glowing box-shadow derived from the swatch color via `color-mix`.
   3. `<span className="mr-track__name">{tr.name}</span>` — the track's display name in 11px semibold.
   4. `<span className="mr-track__sub">{tr.channel} · {tr.notes.length} notes</span>` — channel + note count in mono 9px, `var(--mr-text-3)`.
2. `<div className="mr-track__hdr-spacer">` — flex-grow filler. NOT sticky; reveals the header's underlying background as the user scrolls horizontally.
3. `<div className="mr-track__hdr-right">` — the RIGHT controls zone, `position: sticky; right: 0; z-index: 1`, containing exactly one `<MSChip muted={tr.muted} soloed={tr.soloed} onMute={...} onSolo={...} />`.

Both sticky wrappers SHALL carry `background: var(--mr-bg-panel-2)` (the same background as the track header itself) so they visually mask the header content beneath them at any horizontal scroll offset.

Clicking on `.mr-track__hdr` outside the M/S chip SHALL invoke `toggleTrackOpen(tr.id)`. Clicking on the M/S chip SHALL NOT bubble up to the header click handler — chip buttons SHALL `event.stopPropagation()`.

#### Scenario: Header structure includes the three sticky-zoned wrappers

- **WHEN** any track row is rendered
- **THEN** its `.mr-track__hdr` SHALL contain (in this order): one `.mr-track__hdr-left`, one `.mr-track__hdr-spacer`, one `.mr-track__hdr-right`
- **AND** `.mr-track__hdr-left` SHALL contain (in this order): one `.mr-track__chev`, one `.mr-track__swatch`, one `.mr-track__name`, one `.mr-track__sub`
- **AND** `.mr-track__hdr-right` SHALL contain exactly one `.mr-ms` (the MSChip's root)

#### Scenario: Header label zone sticks to the visible left edge

- **WHEN** the user horizontally scrolls `.mr-timeline` so that the natural left edge of `.mr-track__hdr` would scroll out the visible left
- **THEN** `.mr-track__hdr-left` SHALL remain visible at the left edge of `.mr-timeline`'s visible area
- **AND** the chevron, swatch, name, and sub label SHALL stay readable at every scroll offset

#### Scenario: Header M/S zone sticks to the visible right edge

- **WHEN** the user horizontally scrolls `.mr-timeline` so that the natural right edge of `.mr-track__hdr` would scroll out the visible right
- **THEN** `.mr-track__hdr-right` SHALL remain visible at the right edge of `.mr-timeline`'s visible area
- **AND** the M/S chip cluster SHALL stay clickable at every scroll offset

#### Scenario: Sub label format

- **WHEN** a track has `channel: "CH 1"` and `notes.length === 22`
- **THEN** the `.mr-track__sub` text content SHALL be `CH 1 · 22 notes`

#### Scenario: Chevron rotates when collapsed

- **WHEN** a track has `open: false`
- **THEN** the `.mr-track` element SHALL carry `data-track-open="false"`
- **AND** the `.mr-track__chev`'s computed `transform` SHALL be `rotate(-90deg)` (or matrix equivalent)

#### Scenario: Header click toggles open state

- **WHEN** the user clicks on the `.mr-track__hdr` outside the M/S chip
- **THEN** `toggleTrackOpen(tr.id)` SHALL be invoked exactly once

#### Scenario: M/S chip click does not toggle the row open state

- **WHEN** the user clicks the `M` button inside the M/S chip
- **THEN** `toggleTrackMuted(tr.id)` SHALL be invoked
- **AND** `toggleTrackOpen(tr.id)` SHALL NOT be invoked

### Requirement: Open tracks render an embedded PianoRoll; collapsed tracks render a 6px minimap

When a track has `open === true`, the row's body SHALL render a `<div className="mr-track__roll">` containing a `<PianoRoll>` component instantiated with the track's notes and color:

- `notes={tr.notes}`
- `trackColor={tr.color}`
- `marquee` and `selectedIdx`: only the track whose `id === selectedTrackId` receives non-empty values; all other tracks receive `marquee={null}` and `selectedIdx={[]}`.
- `pxPerBeat`, `rowHeight`, `lo`, `hi`, `totalT`, `playheadT`: shared across the stack from the orchestrator's view-window props.

`.mr-track__roll` SHALL NOT carry `overflow: hidden`. Horizontal clipping of the PianoRoll's content beyond the visible timeline area SHALL be performed by the outer `.mr-timeline` scroll container's `overflow-x: auto`. This is required so that the PianoRoll's `position: sticky` keys column can stick to the scroll container's left edge rather than being clipped by an intermediate `overflow: hidden` ancestor.

When a track has `open === false`, the row's body SHALL render a `<div className="mr-track__collapsed">` containing a `.mr-track__minimap` strip — a 6px-tall horizontal bar with one `<span>` per note (filtered by the view window per session-model). Each minimap span:

- Absolute-positioned at `left: ((n.t - viewT0) / totalT) * 100%`.
- Width `((n.dur / totalT) * 100%)`, with a 1px minimum.
- Top/bottom inset 1px, leaving a 4px-tall colored bar.
- Background `tr.color`.
- Opacity `0.5 + n.vel * 0.4`.
- Border-radius `1px`.

`.mr-track__collapsed` SHALL span the full intrinsic timeline width and SHALL NOT carry its own `overflow: hidden`. The minimap's percentage-based positioning means it visually occupies the row's full width regardless of scroll offset; sticky-left labels and sticky-right chips on the surrounding `.mr-track__hdr` overlay it at the row edges.

#### Scenario: Open track renders a PianoRoll without inner overflow clipping

- **WHEN** a track has `open: true`
- **THEN** its `.mr-track__roll` SHALL contain exactly one `.mr-roll` element (the PianoRoll's root)
- **AND** `.mr-track__roll`'s computed `overflow-x` SHALL NOT be `hidden`

#### Scenario: Collapsed track renders a minimap

- **WHEN** a track has `open: false` and `notes.length === 12`
- **THEN** its `.mr-track__collapsed` SHALL contain exactly one `.mr-track__minimap`
- **AND** the minimap SHALL contain up to 12 `<span>` children (filtered by view window)

#### Scenario: Notes outside the view window do not appear in the minimap

- **WHEN** a track has `open: false` and contains a note with `t = 99` (past the view window)
- **AND** the view window is `viewT0 = 0, totalT = 16`
- **THEN** that note's `<span>` SHALL NOT render in the minimap

### Requirement: Stage hosts the MultiTrackStage orchestrator

The `MultiTrackStage` component SHALL be rendered as a child of `.mr-timeline`, between the Ruler (sticky-top) and the CC Lanes block (sticky-bottom) in document order. `.mr-multi-track-stage` SHALL NOT carry `overflow: hidden`; horizontal and vertical clipping is handled by the outer `.mr-timeline`.

The `[data-soloing]` attribute on `.mr-multi-track-stage` SHALL continue to drive the existing `[data-soloing="true"] [data-soloed="false"] .mr-track__roll` and `.mr-track__collapsed` opacity rules — the new layout does not change selectors.

#### Scenario: MultiTrackStage renders inside the timeline scroll container

- **WHEN** the app is rendered
- **THEN** `.mr-multi-track-stage` SHALL be a descendant of `.mr-timeline`
- **AND** `.mr-multi-track-stage` SHALL NOT be a direct grid-row child of `.mr-center`
- **AND** `.mr-multi-track-stage`'s computed `overflow` SHALL NOT clip horizontally
