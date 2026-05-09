## ADDED Requirements

### Requirement: Channel data shape

The codebase SHALL define a `Channel` interface with the following shape, exported from `src/hooks/useChannels.ts`:

```ts
type ChannelId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;

interface Channel {
  id: ChannelId;       // 1..16, immutable
  name: string;        // display name (e.g. "Lead")
  color: string;       // CSS color string (used as channel swatch)
  collapsed: boolean;  // when true, hides roll + CC lanes; only channel header renders
  muted: boolean;      // channel-level mute (independent of roll/lane M/S)
  soloed: boolean;     // channel-level solo (independent of roll/lane M/S)
}
```

`Channel.id` SHALL be a numeric MIDI channel index in the range 1–16. The system SHALL NOT permit duplicate ids in a single session.

#### Scenario: Channel id is numeric 1..16

- **WHEN** code constructs a `Channel` value
- **THEN** the `id` field SHALL be a number in the inclusive range `[1, 16]`
- **AND** the value SHALL NOT be a string like `"CH 1"`

#### Scenario: Channel carries M/S and collapse independently

- **WHEN** a `Channel` is constructed
- **THEN** the value SHALL have all six fields (`id`, `name`, `color`, `collapsed`, `muted`, `soloed`) populated
- **AND** the `muted` and `soloed` fields SHALL NOT be derived from any `PianoRollTrack` or `CCLane` state

### Requirement: PianoRollTrack data shape

The codebase SHALL define a `PianoRollTrack` interface with the following shape, exported from `src/hooks/useChannels.ts`:

```ts
interface PianoRollTrack {
  channelId: ChannelId;  // matches the parent Channel.id
  notes: Note[];         // session notes, per session-model
  muted: boolean;        // roll-level mute
  soloed: boolean;       // roll-level solo
  collapsed: boolean;    // when true, render the existing 6px minimap instead of the full PianoRoll
}
```

`PianoRollTrack` SHALL replace the previous `Track` interface. It SHALL NOT carry `id`, `name`, `channel: string`, `color`, or `open` — `id` is implicit (one roll per channel; key by `channelId`); `name` and `color` belong to the `Channel`; `open` is renamed `collapsed` (with inverted semantics: `collapsed === true` corresponds to the prior `open === false`).

#### Scenario: PianoRollTrack references its channel by id

- **WHEN** code constructs a `PianoRollTrack` value
- **THEN** the value SHALL carry a `channelId` field of type `ChannelId`
- **AND** the value SHALL NOT carry a `channel: string` field
- **AND** the value SHALL NOT carry `id`, `name`, `color`, or `open` fields

#### Scenario: collapsed flag inverts the prior open flag

- **WHEN** a `PianoRollTrack` has `collapsed === true`
- **THEN** the rendered DOM SHALL show the `.mr-track__collapsed` minimap row (matching the prior behavior of `open === false`)

### Requirement: CCLane data shape (channel-scoped)

The `CCLane` interface SHALL be redefined to carry `channelId` and a `kind` discriminator, exported from `src/hooks/useChannels.ts`:

```ts
type CCLaneKind = 'cc' | 'pb' | 'at' | 'vel';

interface CCLane {
  channelId: ChannelId;
  kind: CCLaneKind;
  cc?: number;          // 0–127, REQUIRED iff kind === 'cc', otherwise omitted
  name: string;         // display name (e.g. "Mod Wheel", "Pitch Bend", "Note Velocity")
  color: string;
  points: CCPoint[];
  muted: boolean;       // lane-level mute
  soloed: boolean;      // lane-level solo
  collapsed: boolean;   // when true, only the lane header strip renders (plot is hidden)
}
```

The `kind` field SHALL classify the MIDI message type the lane represents:

- `'cc'`: a Control Change stream; `cc` field SHALL be set to the CC number 0–127.
- `'pb'`: a Pitch Bend stream; `cc` SHALL be omitted.
- `'at'`: a channel-Aftertouch stream; `cc` SHALL be omitted.
- `'vel'`: a per-note Note On velocity stream (NOT a CC); `cc` SHALL be omitted.

Code SHALL NOT use string sentinels like `"PB"`, `"AT"`, or `"VEL"` in the `cc` field.

#### Scenario: CC kind requires a cc number

- **WHEN** a `CCLane` is constructed with `kind: 'cc'`
- **THEN** the `cc` field SHALL be set to an integer in `[0, 127]`

#### Scenario: Non-CC kinds omit the cc number

- **WHEN** a `CCLane` is constructed with `kind: 'pb'`, `'at'`, or `'vel'`
- **THEN** the `cc` field SHALL be omitted (`undefined`)

#### Scenario: Velocity lane uses kind 'vel', not 'cc' with VEL string

- **WHEN** a `CCLane` represents per-note Note On velocity
- **THEN** its `kind` field SHALL be `'vel'`
- **AND** its `cc` field SHALL be omitted
- **AND** its `name` field SHALL be `"Note Velocity"` (NOT `"Velocity"` and NOT prefixed with `"CC "`)

### Requirement: useChannels hook is the single source of session organization

The codebase SHALL expose a `useChannels()` hook at `src/hooks/useChannels.ts` returning:

```ts
interface UseChannelsReturn {
  channels: Channel[];
  rolls: PianoRollTrack[];
  lanes: CCLane[];
  toggleChannelCollapsed: (id: ChannelId) => void;
  toggleChannelMuted: (id: ChannelId) => void;
  toggleChannelSoloed: (id: ChannelId) => void;
  toggleRollCollapsed: (channelId: ChannelId) => void;
  toggleRollMuted: (channelId: ChannelId) => void;
  toggleRollSoloed: (channelId: ChannelId) => void;
  toggleLaneCollapsed: (channelId: ChannelId, kind: CCLaneKind, cc?: number) => void;
  toggleLaneMuted: (channelId: ChannelId, kind: CCLaneKind, cc?: number) => void;
  toggleLaneSoloed: (channelId: ChannelId, kind: CCLaneKind, cc?: number) => void;
  addCCLane: (channelId: ChannelId, kind: CCLaneKind, cc?: number) => void;
}
```

`useChannels` SHALL replace `useTracks` and `useCCLanes`. The hooks `useTracks` and `useCCLanes` SHALL be removed from the codebase; no compatibility shim SHALL exist.

`addCCLane(channelId, kind, cc?)` SHALL append a new `CCLane` under the matching channel with `points: []`, `muted: false`, `soloed: false`, `collapsed: false`, and a `name` derived from the kind (and CC number for `kind === 'cc'`). If a lane with the same `(channelId, kind, cc)` triple already exists, the call SHALL be a no-op.

Toggle actions SHALL flip the corresponding boolean. Calling a toggle with an unknown `(channelId, kind, cc)` triple SHALL be a no-op. Toggle actions SHALL preserve referential identity for unchanged records (the React reconciler relies on `Object.is` equality to skip rerenders).

#### Scenario: useTracks and useCCLanes are removed

- **WHEN** the codebase is grepped for `useTracks` or `useCCLanes` exports
- **THEN** the search SHALL return zero matches in `src/hooks/`
- **AND** no source file SHALL import from `src/hooks/useTracks` or `src/hooks/useCCLanes`

#### Scenario: Toggle actions flip the targeted boolean

- **WHEN** `toggleChannelMuted(1)` is called and the prior `channels[ch1].muted === false`
- **THEN** the next render SHALL have `channels[ch1].muted === true`
- **AND** unchanged channels SHALL retain referential identity (`Object.is(prev[chN], next[chN])` for `chN ≠ 1`)

#### Scenario: addCCLane is idempotent on duplicate (channelId, kind, cc)

- **WHEN** `addCCLane(1, 'cc', 1)` is called twice in succession
- **THEN** the resulting `lanes` array SHALL contain exactly one matching lane (channel 1, kind 'cc', cc 1)
- **AND** the second call SHALL be a no-op (returned arrays referentially identical to post-first-call state)

#### Scenario: addCCLane on a channel with existing notes keeps the channel rendered

- **WHEN** the session has `channel 1` with `roll.notes.length === 22` and zero existing CC lanes
- **AND** `addCCLane(1, 'cc', 1)` is called
- **THEN** the channel SHALL remain rendered (it had notes before; the new empty lane does not change visibility)
- **AND** the new lane SHALL appear in the channel's CC lane list with `points: []`

### Requirement: Seeded default session has two channels

The seeded default `useChannels()` value SHALL contain exactly two channels with the following identities:

- `Channel { id: 1, name: "Lead", color: "oklch(72% 0.14 240)", collapsed: false, muted: false, soloed: false }`
  - Roll: `notes: makeNotes(22, 7), muted: false, soloed: false, collapsed: false`
  - Lanes (in order):
    - `{ kind: 'cc', cc: 1, name: "Mod Wheel", color: "var(--mr-cc)", points: ccModWheel(totalT), muted: false, soloed: false, collapsed: false }`
    - `{ kind: 'pb', name: "Pitch Bend", color: "var(--mr-pitch)", points: ccPitchBend(totalT), muted: false, soloed: false, collapsed: false }`
    - `{ kind: 'vel', name: "Note Velocity", color: "var(--mr-aftertouch)", points: ccVelocity(totalT), muted: true, soloed: false, collapsed: false }`
- `Channel { id: 2, name: "Bass", color: "oklch(70% 0.16 30)", collapsed: false, muted: false, soloed: false }`
  - Roll: `notes: makeNotes(16, 11), muted: false, soloed: false, collapsed: false`
  - Lanes: `[]` (deliberately empty so the `+ Add CC` affordance has an empty case)

The previous third seeded track ("Pads", `t3`) SHALL be removed from the seed. The previous `cc3` lane is preserved in identity (color, points generator, default `muted: true`) but moves under channel 1 with `kind: 'vel'` and the new name.

#### Scenario: Two seeded channels

- **WHEN** `useChannels()` is read on first mount
- **THEN** the returned `channels` array SHALL have length `2`
- **AND** the channel ids SHALL be `[1, 2]` in that order
- **AND** the seeded names SHALL be `["Lead", "Bass"]`

#### Scenario: Channel 1 has three CC lanes including Note Velocity

- **WHEN** `useChannels()` is read on first mount
- **THEN** the lanes filtered by `channelId === 1` SHALL have length `3`
- **AND** the lanes' `kind` values SHALL be `['cc', 'pb', 'vel']` in that order
- **AND** the lane with `kind === 'vel'` SHALL have `name === "Note Velocity"` and `muted === true`

#### Scenario: Channel 2 has no CC lanes

- **WHEN** `useChannels()` is read on first mount
- **THEN** the lanes filtered by `channelId === 2` SHALL have length `0`

### Requirement: ChannelGroup orchestrator renders one channel's roll and lanes

The codebase SHALL expose a `ChannelGroup` React component at `src/components/channels/ChannelGroup.tsx` that takes one channel plus its roll and lanes, and renders a `<div className="mr-channel">` with the following structure:

```
.mr-channel[data-channel="<id>"][data-channel-collapsed][data-muted][data-soloed][data-audible]
  .mr-channel__hdr                  (sticky-left name + sticky-right channel-level M/S)
    chevron + swatch + name + sub
    .mr-channel__hdr-right          (M/S chip cluster)
  ── if !channel.collapsed ──
  <Track ... />                     (renders the channel's piano-roll header + roll)
  <CCLane ... />[]                  (one per lane in this channel)
  <AddCCLaneRow channelId={...} />  (the [+ Add CC] affordance)
```

`.mr-channel`'s `data-*` attributes SHALL reflect:

- `data-channel="<id>"` — the numeric channel id (1..16).
- `data-channel-collapsed="true"` iff `channel.collapsed === true`.
- `data-muted="true"` iff `channel.muted === true`, else `"false"`.
- `data-soloed="true"` iff `channel.soloed === true`, else `"false"`.
- `data-audible="true"` iff (no soloed flag is set anywhere in the session) OR (`channel.soloed === true`); else `"false"`. The audibility predicate is applied per-channel by the orchestrator.

When `channel.collapsed === true`, the roll, lanes, and AddCCLane row SHALL NOT render — only `.mr-channel__hdr` is in the DOM. The chevron in the header SHALL rotate `-90deg` to indicate the collapsed state.

#### Scenario: ChannelGroup renders header plus children when not collapsed

- **WHEN** `<ChannelGroup channel={...} roll={...} lanes={[]} />` is rendered with `channel.collapsed === false`
- **THEN** the rendered `.mr-channel` SHALL contain `.mr-channel__hdr` as its first child
- **AND** SHALL contain a `.mr-track` element (the roll's wrapper)
- **AND** SHALL contain `.mr-cc-lanes__add` as its last child

#### Scenario: ChannelGroup hides children when collapsed

- **WHEN** `<ChannelGroup channel={{...collapsed: true}} ... />` is rendered
- **THEN** the rendered `.mr-channel` SHALL contain exactly one child: `.mr-channel__hdr`
- **AND** SHALL NOT contain any `.mr-track`, `.mr-cc-lane`, or `.mr-cc-lanes__add` elements
- **AND** SHALL carry `data-channel-collapsed="true"`

#### Scenario: data-audible reflects cascade rule

- **WHEN** the session has channel 1 with `soloed: true` and channel 2 with `soloed: false`
- **THEN** the `.mr-channel[data-channel="1"]` SHALL carry `data-audible="true"`
- **AND** the `.mr-channel[data-channel="2"]` SHALL carry `data-audible="false"`

### Requirement: Channel header has sticky-left label zone and sticky-right M/S zone

`.mr-channel__hdr` SHALL split its children into three sticky-zoned wrappers, mirroring `.mr-track__hdr`:

1. `.mr-channel__hdr-left` — `position: sticky; left: 0; z-index: 1`. Contains chevron, color swatch, channel name, and sub-label (`"CH <id>"`).
2. `.mr-channel__hdr-spacer` — `flex: 1`, fills middle.
3. `.mr-channel__hdr-right` — `position: sticky; right: 0; z-index: 1`. Contains exactly one `<MSChip muted={channel.muted} soloed={channel.soloed} ... />`.

Clicking on `.mr-channel__hdr` outside the M/S chip SHALL invoke `toggleChannelCollapsed(channel.id)`. M/S chip clicks SHALL `event.stopPropagation()` and SHALL NOT trigger the collapse toggle.

The chevron rule `[data-channel-collapsed="true"] .mr-channel__chev { transform: rotate(-90deg) }` SHALL apply.

#### Scenario: Channel header sticks to visible left and right edges

- **WHEN** the user horizontally scrolls `.mr-timeline`
- **THEN** `.mr-channel__hdr-left` SHALL remain visible at the left edge of `.mr-timeline`'s visible area
- **AND** `.mr-channel__hdr-right` SHALL remain visible at the right edge of `.mr-timeline`'s visible area

#### Scenario: Header click toggles channel collapse

- **WHEN** the user clicks on `.mr-channel__hdr` outside the M/S chip
- **THEN** `toggleChannelCollapsed(channel.id)` SHALL be invoked exactly once

#### Scenario: M/S click does not collapse the channel

- **WHEN** the user clicks the `M` button inside the channel header's M/S chip
- **THEN** `toggleChannelMuted(channel.id)` SHALL be invoked
- **AND** `toggleChannelCollapsed(channel.id)` SHALL NOT be invoked

### Requirement: Timeline renders channels with content only

The timeline SHALL render one `<ChannelGroup>` per channel for which `roll.notes.length > 0 || lanes.some(l => l.points.length > 0)` is true. Channels failing this predicate SHALL NOT render.

The orchestrator owning `useChannels()` SHALL compute the visible-channel list as `channels.filter(c => hasContent(c))` and pass each to `<ChannelGroup>`.

Adding an empty CC lane via `addCCLane(channelId, ...)` to a channel that already has notes SHALL keep the channel visible — the lane has empty `points` but the roll has notes, so `hasContent` remains `true`.

#### Scenario: Channel with notes renders even with no CC lanes

- **WHEN** the seeded session has channel 2 with notes but zero CC lanes
- **THEN** the timeline SHALL contain a `.mr-channel[data-channel="2"]` element

#### Scenario: Channel with no notes and no lane points does not render

- **WHEN** a hypothetical channel 3 has `roll.notes === []` and `lanes === []`
- **THEN** the timeline SHALL NOT contain a `.mr-channel[data-channel="3"]` element

#### Scenario: Adding an empty lane to a non-empty channel keeps the channel visible

- **WHEN** channel 2 has notes and zero lanes, AND `addCCLane(2, 'cc', 7)` is called
- **THEN** the timeline SHALL still contain `.mr-channel[data-channel="2"]`
- **AND** the channel's CC lanes section SHALL contain a `.mr-cc-lane` for the new lane (with empty plot)

### Requirement: Global solo dims via timeline-root data-soloing attribute

`.mr-timeline` (or its inner) SHALL carry `data-soloing="true"` whenever ANY channel, roll, or lane in the session has `soloed === true`; SHALL omit the attribute (or set it to `undefined`/`"false"`) otherwise.

The CSS selector `.mr-timeline[data-soloing="true"] [data-audible="false"] .mr-track__roll`, `.mr-timeline[data-soloing="true"] [data-audible="false"] .mr-track__collapsed`, and `.mr-timeline[data-soloing="true"] [data-audible="false"] .mr-cc-lane__plot` SHALL apply `opacity: 0.45`.

A roll's `data-audible` reflects: `(roll.soloed === true) || (parentChannel.soloed === true)`.
A lane's `data-audible` reflects: `(lane.soloed === true) || (parentChannel.soloed === true)`.
A channel's `data-audible` reflects: `channel.soloed === true`.

The previous lane-block-scoped `[data-soloing="true"]` attribute on `.mr-cc-lanes` SHALL be removed.

#### Scenario: data-soloing reflects any soloed flag in the session

- **WHEN** any channel, roll, or lane in the session has `soloed === true`
- **THEN** the timeline root SHALL carry `data-soloing="true"`

#### Scenario: Channel solo cascades audibility to its roll and lanes

- **WHEN** channel 1 has `soloed: true` and its roll and lanes all have `soloed: false`
- **THEN** the channel's roll element SHALL carry `data-audible="true"`
- **AND** every CC lane under channel 1 SHALL carry `data-audible="true"`
- **AND** rolls and lanes under other channels (with no solo flags set) SHALL carry `data-audible="false"`

#### Scenario: Lane solo without channel solo only audibilizes that lane

- **WHEN** a single CC lane on channel 1 has `soloed: true` and channel 1 itself has `soloed: false`
- **THEN** that lane SHALL carry `data-audible="true"`
- **AND** the channel 1 roll SHALL carry `data-audible="false"`
- **AND** other lanes on channel 1 SHALL carry `data-audible="false"`

#### Scenario: No solo anywhere clears data-soloing

- **WHEN** every channel, roll, and lane has `soloed: false`
- **THEN** the timeline root SHALL NOT carry `data-soloing="true"` (it MAY be absent or `"false"`)

### Requirement: AddCCLane popover offers standard MIDI CCs and a custom number input

The `cc-lanes` capability SHALL expose an `<AddCCLanePopover>` component that opens from the `[+ Add CC]` button at the end of each channel's CC lanes block. The popover SHALL render a list of standard MIDI CCs (matching the General MIDI CC table — at minimum: CC 1 Mod Wheel, CC 7 Volume, CC 10 Pan, CC 11 Expression, CC 64 Sustain, CC 71 Resonance, CC 74 Cutoff) plus a `Pitch Bend`, `Aftertouch`, and `Note Velocity` row, plus a `Custom CC#` numeric input (0–127).

Selecting a row SHALL invoke `addCCLane(channelId, kind, cc?)` with the appropriate args:
- Standard CC rows: `kind: 'cc'`, `cc: <selected number>`.
- Pitch Bend: `kind: 'pb'`.
- Aftertouch: `kind: 'at'`.
- Note Velocity: `kind: 'vel'`.
- Custom CC#: `kind: 'cc'`, `cc: <input value>`.

The popover SHALL close on outside-click or Escape. It SHALL anchor visually below the `[+ Add CC]` button.

#### Scenario: Standard CC list contains expected entries

- **WHEN** `<AddCCLanePopover>` is opened
- **THEN** the rendered list SHALL contain rows labelled (in any order): `"Mod Wheel (CC 1)"`, `"Volume (CC 7)"`, `"Pan (CC 10)"`, `"Expression (CC 11)"`, `"Sustain (CC 64)"`, `"Pitch Bend"`, `"Aftertouch"`, `"Note Velocity"`
- **AND** SHALL contain a numeric `<input>` labelled `"Custom CC#"` accepting integers 0–127

#### Scenario: Selecting a standard CC dispatches addCCLane

- **WHEN** the user clicks the `"Mod Wheel (CC 1)"` row inside the popover anchored to channel 2's button
- **THEN** `addCCLane(2, 'cc', 1)` SHALL be invoked exactly once
- **AND** the popover SHALL close

#### Scenario: Selecting Note Velocity uses kind 'vel'

- **WHEN** the user clicks the `"Note Velocity"` row
- **THEN** `addCCLane(<channelId>, 'vel')` SHALL be invoked
- **AND** the new lane SHALL render with `name === "Note Velocity"` (no "CC " prefix)

#### Scenario: Outside click closes the popover

- **WHEN** the popover is open and the user clicks outside its anchor and content
- **THEN** the popover SHALL close
- **AND** no `addCCLane` call SHALL be dispatched

### Requirement: Mute and solo composition CSS uses data-audible scoped to the immediate row

The `channels` capability SHALL ship CSS rules implementing the global solo dim. The `[data-audible="false"]` qualifier SHALL be scoped to the IMMEDIATE row element (`.mr-track` or `.mr-cc-lane`), NOT to any ancestor:

```css
.mr-timeline[data-soloing="true"] .mr-track[data-audible="false"] .mr-track__roll,
.mr-timeline[data-soloing="true"] .mr-track[data-audible="false"] .mr-track__collapsed,
.mr-timeline[data-soloing="true"] .mr-cc-lane[data-audible="false"] .mr-cc-lane__plot,
.mr-timeline[data-soloing="true"] .mr-cc-lane[data-audible="false"] .mr-cc-lane__collapsed {
  opacity: 0.45;
}
```

A free-floating `[data-audible="false"]` (matching any ancestor) is NOT acceptable: a soloed lane lives inside its parent channel, and when only the lane has `soloed === true`, the channel itself has `data-audible="false"` (since the channel is not the soloed item). A descendant selector targeting `[data-audible="false"]` would then dim the soloed lane's plot through its non-audible channel ancestor — visually contradicting the lane's own audibility.

The lane-scoped `[data-soloing="true"] [data-soloed="false"] .mr-cc-lane__plot` rule and the stage-scoped `[data-soloing="true"] [data-soloed="false"] .mr-track__roll` rule SHALL be removed.

Mute rules apply per-row via `[data-muted="true"]` and SHALL include both expanded and collapsed surfaces:

- `[data-muted="true"] .mr-track__roll`, `[data-muted="true"] .mr-track__collapsed` — opacity 0.32 + grayscale 0.7.
- `[data-muted="true"] .mr-cc-lane__plot`, `[data-muted="true"] .mr-cc-lane__collapsed` — same.

The `[data-muted="true"]` ancestor selector remains free-floating (matching any ancestor) so a channel-level mute cascades visually to all rolls and lanes inside it.

#### Scenario: Non-audible row dims under data-soloing="true"

- **WHEN** the timeline carries `data-soloing="true"` and the row's own `.mr-track` or `.mr-cc-lane` carries `data-audible="false"`
- **THEN** that row's `.mr-track__roll` / `.mr-track__collapsed` / `.mr-cc-lane__plot` / `.mr-cc-lane__collapsed` SHALL have computed `opacity: 0.45`

#### Scenario: Audible row stays full opacity under data-soloing

- **WHEN** the timeline carries `data-soloing="true"` and the row's own `.mr-track` or `.mr-cc-lane` carries `data-audible="true"`
- **THEN** that row's roll/plot SHALL have computed `opacity: 1` (no soloing dim)

#### Scenario: Soloed lane inside non-audible channel stays bright

- **WHEN** a single CC lane has `soloed: true` and its parent channel has `soloed: false` (so the channel carries `data-audible="false"` and the lane carries `data-audible="true"`)
- **THEN** the soloed lane's `.mr-cc-lane__plot` (or `.mr-cc-lane__collapsed` when collapsed) SHALL have computed `opacity: 1`
- **AND** the dim selector SHALL NOT match the soloed lane through its non-audible channel ancestor
