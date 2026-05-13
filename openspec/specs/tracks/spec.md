## Purpose

Define the per-row piano-roll track surface: the track header (chevron + label + M/S chip), the open vs collapsed body (embedded `PianoRoll` or 6px minimap), the marquee/selection scoping rule, and the per-row mute composition. Channels and the global solo dim live in the `channels` capability; this capability defines what one track row looks like and how it composes mute.
## Requirements
### Requirement: Track header renders chevron, swatch, name, sub, and M/S chip

Each track row SHALL render a `.mr-track__hdr` element that spans the full intrinsic timeline width and SHALL split its children into three sticky-zoned wrappers, in left-to-right order:

1. `<div className="mr-track__hdr-left">` — the LEFT label zone, `position: sticky; left: 0; z-index: 1`, containing in order:
   1. `<span className="mr-track__chev">` — chevron glyph. The CSS selector `[data-track-collapsed="true"] .mr-track__chev` rotates it `-90deg` to indicate the collapsed state.
   2. `<span className="mr-track__name">Notes</span>` — fixed label indicating the row is the channel's piano-roll. Channel name is shown by the parent `<ChannelGroup>` header, not duplicated here.
   3. `<span className="mr-track__sub">{roll.notes.length} notes</span>` — note count.

   The header SHALL NOT include a color swatch. The channel-level header (`.mr-channel__hdr`) already displays the channel color; duplicating it on every roll header makes the channel and roll headers visually too similar.
2. `<div className="mr-track__hdr-spacer">` — flex-grow filler. NOT sticky.
3. `<div className="mr-track__hdr-right">` — the RIGHT controls zone, `position: sticky; right: 0; z-index: 1`, containing exactly one `<MSChip muted={roll.muted} soloed={roll.soloed} onMute={...} onSolo={...} />`.

Both sticky wrappers SHALL carry `background: var(--mr-bg-panel-2)` so they visually mask the header content beneath them at any horizontal scroll offset.

Clicking on `.mr-track__hdr` outside the M/S chip SHALL invoke `toggleRollCollapsed(roll.channelId)`. Clicking on the M/S chip SHALL NOT bubble up to the header click handler — chip buttons SHALL `event.stopPropagation()`.

The `.mr-track` element's `data-*` attributes SHALL reflect the roll's state:

- `data-track-collapsed="true"` iff `roll.collapsed === true` (REPLACES the prior `data-track-open="false"` attribute).
- `data-muted="true"` iff `roll.muted === true`.
- `data-soloed="true"` iff `roll.soloed === true`.
- `data-audible` SHALL match the parent `<ChannelGroup>`'s computed audibility for the roll, per the `channels` capability.

#### Scenario: Header structure includes the three sticky-zoned wrappers

- **WHEN** any track row is rendered
- **THEN** its `.mr-track__hdr` SHALL contain (in this order): one `.mr-track__hdr-left`, one `.mr-track__hdr-spacer`, one `.mr-track__hdr-right`
- **AND** `.mr-track__hdr-left` SHALL contain (in this order): one `.mr-track__chev`, one `.mr-track__name`, one `.mr-track__sub`
- **AND** `.mr-track__hdr-left` SHALL NOT contain a `.mr-track__swatch` element
- **AND** `.mr-track__hdr-right` SHALL contain exactly one `.mr-ms` (the MSChip's root)

#### Scenario: Header label zone sticks to the visible left edge

- **WHEN** the user horizontally scrolls `.mr-timeline` so that the natural left edge of `.mr-track__hdr` would scroll out the visible left
- **THEN** `.mr-track__hdr-left` SHALL remain visible at the left edge of `.mr-timeline`'s visible area
- **AND** the chevron, swatch, label, and sub label SHALL stay readable at every scroll offset

#### Scenario: Header M/S zone sticks to the visible right edge

- **WHEN** the user horizontally scrolls `.mr-timeline` so that the natural right edge of `.mr-track__hdr` would scroll out the visible right
- **THEN** `.mr-track__hdr-right` SHALL remain visible at the right edge of `.mr-timeline`'s visible area
- **AND** the M/S chip cluster SHALL stay clickable at every scroll offset

#### Scenario: Sub label format

- **WHEN** a roll has `notes.length === 22`
- **THEN** the `.mr-track__sub` text content SHALL be `22 notes`
- **AND** the text SHALL NOT include the channel name (the channel header carries that)

#### Scenario: Chevron rotates when collapsed

- **WHEN** a roll has `collapsed: true`
- **THEN** the `.mr-track` element SHALL carry `data-track-collapsed="true"`
- **AND** the `.mr-track__chev`'s computed `transform` SHALL be `rotate(-90deg)` (or matrix equivalent)

#### Scenario: Header click toggles collapse via channelId

- **WHEN** the user clicks on the `.mr-track__hdr` outside the M/S chip
- **THEN** `toggleRollCollapsed(roll.channelId)` SHALL be invoked exactly once

#### Scenario: M/S chip click does not toggle the row collapse state

- **WHEN** the user clicks the `M` button inside the M/S chip
- **THEN** `toggleRollMuted(roll.channelId)` SHALL be invoked
- **AND** `toggleRollCollapsed(roll.channelId)` SHALL NOT be invoked

### Requirement: Open tracks render an embedded PianoRoll; collapsed tracks render a 6px minimap

When a roll has `collapsed === false`, the row's body SHALL render a `<div className="mr-track__roll">` containing a `<PianoRoll>` component instantiated with the roll's notes and the parent channel's color:

- `notes={roll.notes}`
- `trackColor={channel.color}`
- `marquee` and `selectedIdx`: only the roll whose `channelId === selectedChannelId` receives non-empty values; all other rolls receive `marquee={null}` and `selectedIdx={[]}`.
- `pxPerBeat`, `rowHeight`, `lo`, `hi`, `totalT`, `playheadT`: shared across the stack from the orchestrator's view-window props.

`.mr-track__roll` SHALL NOT carry `overflow: hidden`. Horizontal clipping of the PianoRoll's content beyond the visible timeline area SHALL be performed by the outer `.mr-timeline` scroll container's `overflow-x: auto`.

When a roll has `collapsed === true`, the row's body SHALL render a `<div className="mr-track__collapsed">` containing a `.mr-track__minimap` strip — a 6px-tall horizontal bar with one `<span>` per note (filtered by the view window per session-model). Each minimap span:

- Absolute-positioned at `left: ((n.t - viewT0) / totalT) * 100%`.
- Width `((n.dur / totalT) * 100%)`, with a 1px minimum.
- Top/bottom inset 1px, leaving a 4px-tall colored bar.
- Background: parent channel's `color`.
- Opacity `0.5 + n.vel * 0.4`.
- Border-radius `1px`.

`.mr-track__collapsed` SHALL span the full intrinsic timeline width and SHALL NOT carry its own `overflow: hidden`.

#### Scenario: Open roll renders a PianoRoll without inner overflow clipping

- **WHEN** a roll has `collapsed: false`
- **THEN** its `.mr-track__roll` SHALL contain exactly one `.mr-roll` element (the PianoRoll's root)
- **AND** `.mr-track__roll`'s computed `overflow-x` SHALL NOT be `hidden`

#### Scenario: Collapsed roll renders a minimap

- **WHEN** a roll has `collapsed: true` and `notes.length === 12`
- **THEN** its `.mr-track__collapsed` SHALL contain exactly one `.mr-track__minimap`
- **AND** the minimap SHALL contain up to 12 `<span>` children (filtered by view window)

#### Scenario: Notes outside the view window do not appear in the minimap

- **WHEN** a roll has `collapsed: true` and contains a note with `t = 99` (past the view window)
- **AND** the view window is `viewT0 = 0, totalT = 16`
- **THEN** that note's `<span>` SHALL NOT render in the minimap

### Requirement: Marquee and selection are scoped to a single roll via selectedChannelId

The orchestrator owning render state (in the `channels` capability) SHALL track a `selectedChannelId: ChannelId | null` value. The marquee rectangle and `selectedIdx` (when non-empty) SHALL be passed only to the `PianoRoll` whose roll's `channelId === selectedChannelId`. All other rolls SHALL receive `marquee={null}` and `selectedIdx={[]}`.

When `selectedChannelId === null`, no roll receives a non-null marquee.

For **`demo=marquee`**, `selectedChannelId` SHALL default to `1` (the Lead channel), matching the prototype's behavior of showing the demo marquee on the first track only. **Instrument-seeded rolls are implied by this flag** (`demo=instrument` not required).

#### Scenario: Demo marquee shows on Lead only

- **WHEN** the app is loaded at `/?demo=marquee`
- **THEN** the `.mr-track` whose `channelId` is `1` (the Lead channel's roll) SHALL contain a `.mr-marquee` element
- **AND** no other roll's `.mr-track__roll` SHALL contain a `.mr-marquee` element

#### Scenario: Optional instrument + marquee behaves like marquee-only

- **WHEN** the app is loaded at `/?demo=instrument&demo=marquee`
- **THEN** the `.mr-track` whose `channelId` is `1` SHALL contain a `.mr-marquee` element
- **AND** no other roll's `.mr-track__roll` SHALL contain a `.mr-marquee` element

#### Scenario: Default load has no marquee on any roll

- **WHEN** the app is loaded at `/`
- **THEN** the rendered DOM SHALL contain zero `.mr-marquee` elements across all rolls

### Requirement: Mute and solo composition follow CSS data-attribute selectors

The codebase SHALL ship `src/components/tracks/Track.css` containing rules:

- `[data-muted="true"] .mr-track__roll { opacity: 0.32; filter: grayscale(0.7); }` — per-row mute.
- The session-global solo-dim selector lives in the `channels` capability stylesheet (uses `.mr-timeline[data-soloing="true"] [data-audible="false"] .mr-track__roll`).
- `.mr-track`, `.mr-track__hdr` (with `:hover` state), `.mr-track__chev` (with rotation rule), `.mr-track__swatch`, `.mr-track__name`, `.mr-track__sub`, `.mr-track__hdr-spacer`, `.mr-track__roll`, `.mr-track__collapsed`, `.mr-track__minimap`.

The previous lane-or-stage-scoped `[data-soloing="true"] [data-soloed="false"] .mr-track__roll` rule SHALL be removed from this stylesheet (its replacement lives in the `channels` capability).

All visual values SHALL resolve through `--mr-*` tokens; the `rgba()` literals already present in the prototype's same lines are accepted.

#### Scenario: Muted roll is faded and grayscaled

- **WHEN** a roll has `muted: true` AND the page is rendered
- **THEN** the `.mr-track__roll` inside that row SHALL have computed `opacity: 0.32`
- **AND** SHALL have computed `filter` containing `grayscale(0.7)`

#### Scenario: Non-audible row dims under timeline-scope data-soloing

- **WHEN** the timeline carries `data-soloing="true"` and a `.mr-track` carries `data-audible="false"`
- **THEN** the `.mr-track__roll` inside that row SHALL have computed `opacity: 0.45`

#### Scenario: Both mute and solo apply when both are set

- **WHEN** a roll has `muted: true` AND another row is soloed (so the timeline carries `data-soloing="true"` and this row carries `data-audible="false"`)
- **THEN** the `.mr-track__roll` SHALL have visible mute effects (`grayscale(0.7)`) AND the cascade SHALL pick whichever of `0.32` or `0.45` opacity is later in source order — implementations MAY rely on either; both values are acceptable, but BOTH effects (filter + reduced opacity) SHALL be visible

#### Scenario: No hex literals or oklch in CSS

- **WHEN** `src/components/tracks/Track.css` is grepped for `#[0-9a-fA-F]{3,8}\b` AND for `oklch\(`
- **THEN** the search SHALL return zero matches in both cases

### Requirement: MSChip is a reusable mute/solo toggle pair

The codebase SHALL expose an `MSChip` React component at `src/components/ms-chip/MSChip.tsx` accepting props:

```ts
interface MSChipProps {
  muted: boolean;
  soloed: boolean;
  onMute?: () => void;
  onSolo?: () => void;
  size?: 'sm' | 'md';  // default 'sm'
}
```

The component SHALL render `<div className="mr-ms" data-size={size}>` containing two `<button>` elements:
- `<button className="mr-ms__btn" data-kind="m" data-on={muted ? "true" : undefined} onClick={...}>M</button>`
- `<button className="mr-ms__btn" data-kind="s" data-on={soloed ? "true" : undefined} onClick={...}>S</button>`

Each button's `onClick` handler SHALL call `event.stopPropagation()` BEFORE calling the corresponding callback (so clicks on the chip don't bubble to a container's click handler).

The codebase SHALL ship `src/components/ms-chip/MSChip.css` containing the rules for `.mr-ms`, `.mr-ms__btn`, and the `[data-on="true"][data-kind="m"|"s"]` variants from `prototype/app.css` lines ~706–735.

#### Scenario: MSChip renders M and S buttons

- **WHEN** `<MSChip muted={false} soloed={false}/>` is rendered
- **THEN** the rendered DOM SHALL contain exactly one `.mr-ms` element
- **AND** SHALL contain exactly two `.mr-ms__btn` children
- **AND** their text content SHALL be `M` and `S`

#### Scenario: data-on reflects state

- **WHEN** `<MSChip muted={true} soloed={false}/>` is rendered
- **THEN** the `M` button SHALL carry `data-on="true"`
- **AND** the `S` button SHALL NOT carry `data-on="true"`

#### Scenario: Click stops propagation

- **WHEN** the user clicks the `M` button inside an MSChip nested in a container with its own click handler
- **THEN** the container's click handler SHALL NOT receive the click event
- **AND** the chip's `onMute` callback SHALL be invoked

### Requirement: Tracks pass layout horizon to PianoRoll shells

`<Track>` (open + collapsed modes) SHALL forward `layoutHorizonBeats` from `ChannelGroup`/App orchestration into `<PianoRoll>` / `<Minimap>` widths so stripe vs minimap extents stay contiguous with ruler math.

#### Scenario: PianoRoll subtree receives propagated horizon prop

- **WHEN** `ChannelGroup` supplies `layoutHorizonBeats` larger than inherited `totalT`
- **THEN** `PianoRoll` mounted inside that channel SHALL consume the wider stripe width derived from horizon while respecting view-window clipping rules

