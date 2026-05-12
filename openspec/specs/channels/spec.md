## Purpose

Define the session organization model where channels group a piano-roll track and zero-or-more param lanes. Provide the React orchestrator that renders one channel group per visible channel inside the timeline, and the global solo/mute composition rules that span the channel stack.
## Requirements
### Requirement: Channel data shape

The codebase SHALL define a `Channel` interface with the following shape, exported from `src/hooks/useChannels.ts`:

```ts
type ChannelId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;

interface Channel {
  id: ChannelId;       // 1..16, immutable
  name: string;        // display name (e.g. "Lead")
  color: string;       // CSS color string (used as channel swatch)
  collapsed: boolean;  // when true, hides roll + param lanes; only channel header renders
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
- **AND** the `muted` and `soloed` fields SHALL NOT be derived from any `PianoRollTrack` or `ParamLane` state

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

### Requirement: ParamLane data shape (channel-scoped)

The `ParamLane` interface SHALL be defined to carry `channelId` and a `kind` discriminator, exported from `src/hooks/useChannels.ts`:

```ts
type ParamLaneKind = 'cc' | 'pb' | 'at';

interface ParamLane {
  channelId: ChannelId;
  kind: ParamLaneKind;
  cc?: number;          // 0–127, REQUIRED iff kind === 'cc', otherwise omitted
  name: string;         // display name (e.g. "Mod Wheel", "Pitch Bend", "Aftertouch")
  color: string;
  points: CCPoint[];
  muted: boolean;       // lane-level mute
  soloed: boolean;      // lane-level solo
  collapsed: boolean;   // when true, render the collapsed-minimap strip instead of the full plot
}
```

The interface name SHALL be `ParamLane` (NOT `CCLane`). The discriminator type SHALL be `ParamLaneKind` (NOT `CCLaneKind`). The `CCPoint` point-shape type retains its current name.

The `kind` field SHALL classify the MIDI message type the lane represents:

- `'cc'`: a Control Change stream; `cc` field SHALL be set to the CC number 0–127.
- `'pb'`: a Pitch Bend stream; `cc` SHALL be omitted.
- `'at'`: a channel-Aftertouch stream; `cc` SHALL be omitted.

Code SHALL NOT use string sentinels like `"PB"` or `"AT"` in the `cc` field.

Per-note velocity is intentionally NOT a `ParamLaneKind`. Velocity is a field on each Note On (`0x9n`), not a stream message — it doesn't fit the channel-scoped param-stream model. Per-note velocity editing belongs in the Inspector — Note panel (Slice 5) and a future per-note velocity strip in the piano roll body, neither of which is implemented yet.

#### Scenario: CC kind requires a cc number

- **WHEN** a `ParamLane` is constructed with `kind: 'cc'`
- **THEN** the `cc` field SHALL be set to an integer in `[0, 127]`

#### Scenario: Non-CC kinds omit the cc number

- **WHEN** a `ParamLane` is constructed with `kind: 'pb'` or `'at'`
- **THEN** the `cc` field SHALL be omitted (`undefined`)

#### Scenario: 'vel' is not a ParamLaneKind value

- **WHEN** code attempts to construct `ParamLane { kind: 'vel', ... }`
- **THEN** the TypeScript `ParamLaneKind` union SHALL reject `'vel'` at compile time
- **AND** no source file SHALL include `'vel'` as a `ParamLaneKind` literal

#### Scenario: Codebase contains no CCLane identifier

- **WHEN** the codebase is grepped for `CCLane` (the type name) or `CCLaneKind`
- **THEN** the search SHALL return zero matches in `src/`
- **AND** all type imports SHALL use `ParamLane` / `ParamLaneKind` from `useChannels.ts`

### Requirement: useChannels hook is the single source of session organization

The codebase SHALL expose a `useChannels()` hook at `src/hooks/useChannels.ts` returning:

```ts
interface UseChannelsReturn {
  channels: Channel[];
  rolls: PianoRollTrack[];
  lanes: ParamLane[];
  toggleChannelCollapsed: (id: ChannelId) => void;
  toggleChannelMuted: (id: ChannelId) => void;
  toggleChannelSoloed: (id: ChannelId) => void;
  addChannel: (channelId: ChannelId, name?: string, color?: string) => void;
  toggleRollCollapsed: (channelId: ChannelId) => void;
  toggleRollMuted: (channelId: ChannelId) => void;
  toggleRollSoloed: (channelId: ChannelId) => void;
  toggleLaneCollapsed: (channelId: ChannelId, kind: ParamLaneKind, cc?: number) => void;
  toggleLaneMuted: (channelId: ChannelId, kind: ParamLaneKind, cc?: number) => void;
  toggleLaneSoloed: (channelId: ChannelId, kind: ParamLaneKind, cc?: number) => void;
  addParamLane: (channelId: ChannelId, kind: ParamLaneKind, cc?: number) => void;
  appendNote: (channelId: ChannelId, note: Note) => void;
}
```

`useChannels` SHALL replace `useTracks` and `useCCLanes`. The hooks `useTracks` and `useCCLanes` SHALL NOT be present in the codebase; no compatibility shim SHALL exist.

`addChannel(id, name?, color?)` SHALL insert a new `Channel` with `collapsed: false`, `muted: false`, `soloed: false`, `name` defaulting to `"CH " + id`, `color` defaulting to a deterministic palette value, and SHALL insert a matching `PianoRollTrack` with empty `notes`. If a channel with `id` already exists, the call SHALL be a no-op.

`addParamLane(channelId, kind, cc?)` (renamed from `addCCLane`) SHALL append a new `ParamLane` under the matching channel with `points: []`, `muted: false`, `soloed: false`, `collapsed: false`, and a `name` derived from the kind (and CC number for `kind === 'cc'`). If a lane with the same `(channelId, kind, cc)` triple already exists, the call SHALL be a no-op.

`appendNote(channelId, note)` SHALL append the `note` argument to the `notes` array of the `PianoRollTrack` whose `channelId` matches. If no roll exists for that channel, the call SHALL be a no-op (auto-creating rolls is owned by `addChannel` or the session seed). The action SHALL preserve referential identity for every unchanged roll record — only the targeted roll's reference changes. The action SHALL also preserve referential identity for unchanged channels and lanes arrays.

Toggle actions SHALL flip the corresponding boolean. Calling a toggle with an unknown `(channelId, kind, cc)` triple SHALL be a no-op. Toggle actions SHALL preserve referential identity for unchanged records (the React reconciler relies on `Object.is` equality to skip rerenders).

#### Scenario: useTracks and useCCLanes are removed

- **WHEN** the codebase is grepped for `useTracks` or `useCCLanes` exports
- **THEN** the search SHALL return zero matches in `src/hooks/`
- **AND** no source file SHALL import from `src/hooks/useTracks` or `src/hooks/useCCLanes`

#### Scenario: addCCLane identifier is fully replaced by addParamLane

- **WHEN** the codebase is grepped for `addCCLane`
- **THEN** the search SHALL return zero matches in `src/`
- **AND** the renamed function `addParamLane` SHALL be the single insertion path

#### Scenario: Toggle actions flip the targeted boolean

- **WHEN** `toggleChannelMuted(1)` is called and the prior `channels[ch1].muted === false`
- **THEN** the next render SHALL have `channels[ch1].muted === true`
- **AND** unchanged channels SHALL retain referential identity (`Object.is(prev[chN], next[chN])` for `chN ≠ 1`)

#### Scenario: addParamLane is idempotent on duplicate (channelId, kind, cc)

- **WHEN** `addParamLane(1, 'cc', 1)` is called twice in succession
- **THEN** the resulting `lanes` array SHALL contain exactly one matching lane (channel 1, kind 'cc', cc 1)
- **AND** the second call SHALL be a no-op (returned arrays referentially identical to post-first-call state)

#### Scenario: addParamLane on a channel with existing notes keeps the channel rendered

- **WHEN** the session has `channel 1` with `roll.notes.length === 22` and zero existing param lanes
- **AND** `addParamLane(1, 'cc', 1)` is called
- **THEN** the channel SHALL remain rendered (it had notes before; the new empty lane does not change visibility)
- **AND** the new lane SHALL appear in the channel's lane list with `points: []`

#### Scenario: appendNote pushes a note onto the matching roll

- **GIVEN** the session has channel 1 with `roll.notes.length === 22`
- **WHEN** `appendNote(1, { t: 5, dur: 1, pitch: 60, vel: 90 })` is called
- **THEN** the next render SHALL have `rolls.find(r => r.channelId === 1).notes.length === 23`
- **AND** the appended note SHALL be the last entry in that roll's `notes` array
- **AND** the roll for channel 2 SHALL retain referential identity (`Object.is(prev, next) === true`)

#### Scenario: appendNote on a channel with no roll is a no-op

- **GIVEN** a hypothetical channel 5 exists in `channels` but has no entry in `rolls`
- **WHEN** `appendNote(5, { t: 0, dur: 1, pitch: 60, vel: 100 })` is called
- **THEN** the `rolls` array SHALL be referentially unchanged
- **AND** no entry SHALL be added for channel 5

#### Scenario: appendNote preserves referential identity of unchanged rolls

- **GIVEN** the session has two rolls (channel 1, channel 2)
- **WHEN** `appendNote(1, note)` is called
- **THEN** `Object.is(prev.rolls[1], next.rolls[1])` SHALL be `false` (channel 1 roll changed)
- **AND** `Object.is(prev.rolls[2], next.rolls[2])` SHALL be `true` for the channel 2 roll (unchanged)
- **AND** `Object.is(prev.channels, next.channels)` SHALL be `true`
- **AND** `Object.is(prev.lanes, next.lanes)` SHALL be `true`

#### Scenario: addChannel inserts channel and empty roll

- **GIVEN** the session has channels `[1, 2]` only
- **WHEN** `addChannel(5)` is called
- **THEN** the next `channels` list SHALL include `id === 5`
- **AND** the next `rolls` list SHALL include `{ channelId: 5, notes: [] }`

#### Scenario: addChannel is idempotent

- **WHEN** `addChannel(1)` is called on the default seeded session
- **THEN** the state SHALL be unchanged (`channels` length still 2)

### Requirement: Seeded default session has two channels

The seeded default `useChannels()` value SHALL contain exactly two channels with the following identities:

- `Channel { id: 1, name: "Lead", color: "oklch(72% 0.14 240)", collapsed: false, muted: false, soloed: false }`
  - Roll: `notes: makeNotes(22, 7), muted: false, soloed: false, collapsed: false`
  - Lanes (in order):
    - `{ kind: 'cc', cc: 1, name: "Mod Wheel", color: "var(--mr-cc)", points: ccModWheel(totalT), muted: false, soloed: false, collapsed: false }`
    - `{ kind: 'pb', name: "Pitch Bend", color: "var(--mr-pitch)", points: ccPitchBend(totalT), muted: false, soloed: false, collapsed: false }`
- `Channel { id: 2, name: "Bass", color: "oklch(70% 0.16 30)", collapsed: false, muted: false, soloed: false }`
  - Roll: `notes: makeNotes(16, 11), muted: false, soloed: false, collapsed: false`
  - Lanes: `[]` (deliberately empty so the `+ Add Lane` affordance has an empty case)

The previously-seeded "Note Velocity" lane SHALL NOT be present in the seed output. The `ccVelocity` generator SHALL be removed from `ccPoints.ts`. The remaining `ccPoints.ts` exports are `ccModWheel`, `ccPitchBend`, and `CCPoint` (the type) — those are internal helpers and not subject to this rename.

#### Scenario: Two seeded channels

- **WHEN** `useChannels()` is read on first mount
- **THEN** the returned `channels` array SHALL have length `2`
- **AND** the channel ids SHALL be `[1, 2]` in that order
- **AND** the seeded names SHALL be `["Lead", "Bass"]`

#### Scenario: Channel 1 has two param lanes (Mod Wheel + Pitch Bend)

- **WHEN** `useChannels()` is read on first mount
- **THEN** the lanes filtered by `channelId === 1` SHALL have length `2`
- **AND** the lanes' `kind` values SHALL be `['cc', 'pb']` in that order
- **AND** no seeded lane SHALL have `kind === 'vel'`

#### Scenario: Channel 2 has no param lanes

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
  <Track ... />                       (renders the channel's piano-roll header + roll)
  <ParamLane ... />[]                 (one per lane in this channel)
  <AddParamLaneRow channelId={...} /> (the [+ Add Lane] affordance)
```

The component SHALL NOT reference any `CC`-prefixed component or class name in this rendered tree. Specifically: `<CCLane>`, `<AddCCLaneRow>`, `<AddCCLanePopover>`, and `.mr-cc-lane*` SHALL NOT appear.

`.mr-channel`'s `data-*` attributes SHALL reflect:

- `data-channel="<id>"` — the numeric channel id (1..16).
- `data-channel-collapsed="true"` iff `channel.collapsed === true`.
- `data-muted="true"` iff `channel.muted === true`, else `"false"`.
- `data-soloed="true"` iff `channel.soloed === true`, else `"false"`.
- `data-audible="true"` iff (no soloed flag is set anywhere in the session) OR (`channel.soloed === true`); else `"false"`.

When `channel.collapsed === true`, the roll, lanes, and AddParamLane row SHALL NOT render — only `.mr-channel__hdr` is in the DOM. The chevron in the header SHALL rotate `-90deg` to indicate the collapsed state.

#### Scenario: ChannelGroup renders header plus children when not collapsed

- **WHEN** `<ChannelGroup channel={...} roll={...} lanes={[]} />` is rendered with `channel.collapsed === false`
- **THEN** the rendered `.mr-channel` SHALL contain `.mr-channel__hdr` as its first child
- **AND** SHALL contain a `.mr-track` element (the roll's wrapper)
- **AND** SHALL contain `.mr-param-lanes__add` as its last child (renamed from `.mr-cc-lanes__add`)

#### Scenario: ChannelGroup hides children when collapsed

- **WHEN** `<ChannelGroup channel={{...collapsed: true}} ... />` is rendered
- **THEN** the rendered `.mr-channel` SHALL contain exactly one child: `.mr-channel__hdr`
- **AND** SHALL NOT contain any `.mr-track`, `.mr-param-lane`, or `.mr-param-lanes__add` elements
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

Adding an empty param lane via `addParamLane(channelId, ...)` to a channel that already has notes SHALL keep the channel visible — the lane has empty `points` but the roll has notes, so `hasContent` remains `true`.

#### Scenario: Channel with notes renders even with no param lanes

- **WHEN** the seeded session has channel 2 with notes but zero param lanes
- **THEN** the timeline SHALL contain a `.mr-channel[data-channel="2"]` element

#### Scenario: Channel with no notes and no lane points does not render

- **WHEN** a hypothetical channel 3 has `roll.notes === []` and `lanes === []`
- **THEN** the timeline SHALL NOT contain a `.mr-channel[data-channel="3"]` element

#### Scenario: Adding an empty lane to a non-empty channel keeps the channel visible

- **WHEN** channel 2 has notes and zero lanes, AND `addParamLane(2, 'cc', 7)` is called
- **THEN** the timeline SHALL still contain `.mr-channel[data-channel="2"]`
- **AND** the channel's lanes section SHALL contain a `.mr-param-lane` for the new lane (with empty plot)

### Requirement: Global solo dims via timeline-root data-soloing attribute

`.mr-timeline` (or its inner) SHALL carry `data-soloing="true"` whenever ANY channel, roll, or lane in the session has `soloed === true`; SHALL omit the attribute (or set it to `undefined`/`"false"`) otherwise.

The CSS selectors SHALL target the immediate row element's `data-audible="false"` attribute, NOT any ancestor:

```css
.mr-timeline[data-soloing="true"] .mr-track[data-audible="false"] .mr-track__roll,
.mr-timeline[data-soloing="true"] .mr-track[data-audible="false"] .mr-track__collapsed,
.mr-timeline[data-soloing="true"] .mr-param-lane[data-audible="false"] .mr-param-lane__plot,
.mr-timeline[data-soloing="true"] .mr-param-lane[data-audible="false"] .mr-param-lane__collapsed {
  opacity: 0.45;
}
```

A roll's `data-audible` reflects: `(roll.soloed === true) || (parentChannel.soloed === true)`.
A lane's `data-audible` reflects: `(lane.soloed === true) || (parentChannel.soloed === true)`.
A channel's `data-audible` reflects: `channel.soloed === true`.

#### Scenario: data-soloing reflects any soloed flag in the session

- **WHEN** any channel, roll, or lane in the session has `soloed === true`
- **THEN** the timeline root SHALL carry `data-soloing="true"`

#### Scenario: Channel solo cascades audibility to its roll and lanes

- **WHEN** channel 1 has `soloed: true` and its roll and lanes all have `soloed: false`
- **THEN** the channel's roll element SHALL carry `data-audible="true"`
- **AND** every param lane under channel 1 SHALL carry `data-audible="true"`
- **AND** rolls and lanes under other channels (with no solo flags set) SHALL carry `data-audible="false"`

#### Scenario: Lane solo without channel solo only audibilizes that lane

- **WHEN** a single param lane on channel 1 has `soloed: true` and channel 1 itself has `soloed: false`
- **THEN** that lane SHALL carry `data-audible="true"`
- **AND** the channel 1 roll SHALL carry `data-audible="false"`
- **AND** other lanes on channel 1 SHALL carry `data-audible="false"`

#### Scenario: No solo anywhere clears data-soloing

- **WHEN** every channel, roll, and lane has `soloed: false`
- **THEN** the timeline root SHALL NOT carry `data-soloing="true"` (it MAY be absent or `"false"`)

### Requirement: AddParamLane popover offers standard MIDI CCs and a custom number input

The `param-lanes` capability SHALL expose an `<AddParamLanePopover>` component that opens from the `[+ Add Lane]` button at the end of each channel's lanes block. The popover SHALL render a list of standard MIDI CCs (matching the General MIDI CC table — at minimum: CC 1 Mod Wheel, CC 7 Volume, CC 10 Pan, CC 11 Expression, CC 64 Sustain, CC 71 Resonance, CC 74 Cutoff), plus a `Pitch Bend` row, plus an `Aftertouch` row, plus a `Custom CC#` numeric input (0–127).

The popover SHALL NOT render a "Note Velocity" row. Per-note velocity is not a `ParamLaneKind` and cannot be added via this affordance.

The button label SHALL be exactly `"+ Add Lane"`. The standard-CC rows show "(CC N)" suffixes (those rows really are CCs); the Pitch Bend and Aftertouch rows have no CC suffix.

Selecting a row SHALL invoke `addParamLane(channelId, kind, cc?)` with the appropriate args:
- Standard CC rows: `kind: 'cc'`, `cc: <selected number>`.
- Pitch Bend: `kind: 'pb'`.
- Aftertouch: `kind: 'at'`.
- Custom CC#: `kind: 'cc'`, `cc: <input value>`.

The popover SHALL close on outside-click or Escape. It SHALL anchor visually below the `[+ Add Lane]` button.

#### Scenario: Button label is "+ Add Lane"

- **WHEN** `<AddParamLaneRow>` is rendered
- **THEN** the rendered button text content SHALL be exactly `"+ Add Lane"`
- **AND** the rendered DOM SHALL NOT contain the string `"+ Add CC"`

#### Scenario: Standard CC list contains expected entries

- **WHEN** `<AddParamLanePopover>` is opened
- **THEN** the rendered list SHALL contain rows labelled (in any order): `"Mod Wheel (CC 1)"`, `"Volume (CC 7)"`, `"Pan (CC 10)"`, `"Expression (CC 11)"`, `"Sustain (CC 64)"`, `"Pitch Bend"`, `"Aftertouch"`
- **AND** the rendered list SHALL NOT contain a "Note Velocity" row
- **AND** SHALL contain a numeric `<input>` labelled `"Custom CC#"` accepting integers 0–127

#### Scenario: Selecting a standard CC dispatches addParamLane

- **WHEN** the user clicks the `"Mod Wheel (CC 1)"` row inside the popover anchored to channel 2's button
- **THEN** `addParamLane(2, 'cc', 1)` SHALL be invoked exactly once
- **AND** the popover SHALL close

#### Scenario: Selecting Aftertouch uses kind 'at'

- **WHEN** the user clicks the `"Aftertouch"` row
- **THEN** `addParamLane(<channelId>, 'at')` SHALL be invoked
- **AND** the new lane SHALL render with `name === "Aftertouch"` (no "CC " prefix)

#### Scenario: Outside click closes the popover

- **WHEN** the popover is open and the user clicks outside its anchor and content
- **THEN** the popover SHALL close
- **AND** no `addParamLane` call SHALL be dispatched

### Requirement: Mute and solo composition CSS uses data-audible scoped to the immediate row

The `channels` capability SHALL ship CSS rules implementing the global solo dim. The `[data-audible="false"]` qualifier SHALL be scoped to the IMMEDIATE row element (`.mr-track` or `.mr-param-lane`), NOT to any ancestor:

```css
.mr-timeline[data-soloing="true"] .mr-track[data-audible="false"] .mr-track__roll,
.mr-timeline[data-soloing="true"] .mr-track[data-audible="false"] .mr-track__collapsed,
.mr-timeline[data-soloing="true"] .mr-param-lane[data-audible="false"] .mr-param-lane__plot,
.mr-timeline[data-soloing="true"] .mr-param-lane[data-audible="false"] .mr-param-lane__collapsed {
  opacity: 0.45;
}
```

A free-floating `[data-audible="false"]` (matching any ancestor) is NOT acceptable: a soloed lane lives inside its parent channel, and when only the lane has `soloed === true`, the channel itself has `data-audible="false"` (since the channel is not the soloed item). A descendant selector targeting `[data-audible="false"]` would then dim the soloed lane's plot through its non-audible channel ancestor — visually contradicting the lane's own audibility.

Mute rules apply per-row via `[data-muted="true"]` and SHALL include both expanded and collapsed surfaces:

- `[data-muted="true"] .mr-track__roll`, `[data-muted="true"] .mr-track__collapsed` — opacity 0.32 + grayscale 0.7.
- `[data-muted="true"] .mr-param-lane__plot`, `[data-muted="true"] .mr-param-lane__collapsed` — same.

The `[data-muted="true"]` ancestor selector remains free-floating (matching any ancestor) so a channel-level mute cascades visually to all rolls and lanes inside it.

The string `cc-lane` SHALL NOT appear in any selector inside the channels stylesheet.

#### Scenario: Non-audible row dims under data-soloing="true"

- **WHEN** the timeline carries `data-soloing="true"` and the row's own `.mr-track` or `.mr-param-lane` carries `data-audible="false"`
- **THEN** that row's `.mr-track__roll` / `.mr-track__collapsed` / `.mr-param-lane__plot` / `.mr-param-lane__collapsed` SHALL have computed `opacity: 0.45`

#### Scenario: Audible row stays full opacity under data-soloing

- **WHEN** the timeline carries `data-soloing="true"` and the row's own `.mr-track` or `.mr-param-lane` carries `data-audible="true"`
- **THEN** that row's roll/plot SHALL have computed `opacity: 1` (no soloing dim)

#### Scenario: Soloed lane inside non-audible channel stays bright

- **WHEN** a single param lane has `soloed: true` and its parent channel has `soloed: false` (so the channel carries `data-audible="false"` and the lane carries `data-audible="true"`)
- **THEN** the soloed lane's `.mr-param-lane__plot` (or `.mr-param-lane__collapsed` when collapsed) SHALL have computed `opacity: 1`
- **AND** the dim selector SHALL NOT match the soloed lane through its non-audible channel ancestor

### Requirement: Stage exposes addChannel for recorder

`useStage()` SHALL expose `addChannel` by delegating to the underlying `useChannels()` instance.

#### Scenario: Recorder path uses stage addChannel

- **WHEN** `useStage().addChannel(6)` is called
- **THEN** the session `channels` and `rolls` SHALL update per `useChannels.addChannel`

