## ADDED Requirements

### Requirement: DJActionTrack carries synthetic action events

The `DJActionTrack` data shape SHALL include an `events: ActionEvent[]` field. `ActionEvent` SHALL have the shape:

```ts
interface ActionEvent {
  pitch: number;  // MIDI pitch — must correspond to a key in actionMap to render
  t: number;      // start time in beats
  dur: number;    // duration in beats (used for non-trigger rendering modes)
  vel: number;    // velocity 0..1 (used for velocity-sensitive rendering mode)
}
```

`ActionEvent` SHALL be structurally identical to `Note` from `src/components/piano-roll/notes.ts`. The renderer SHALL treat events as ground-truth — events whose `pitch` is not a key in the containing track's `actionMap` SHALL be filtered out at render time without error.

The default seeded track (`id === 'dj1'`) SHALL include an `events` array of length ≥ 10 with deterministic content sufficient to demonstrate all three note-rendering modes (trigger, velocity-sensitive, pressure-bearing). Every event's `pitch` SHALL be a key in the seeded `actionMap`.

#### Scenario: Events field exists on the seeded track

- **WHEN** the app first renders
- **THEN** `useStage().djActionTracks[0].events` SHALL be an array
- **AND** the array SHALL have length ≥ 10
- **AND** every entry SHALL be a valid `ActionEvent` (`pitch`, `t`, `dur`, `vel` all defined)
- **AND** every entry's `pitch` SHALL be a key in `useStage().djActionTracks[0].actionMap`

#### Scenario: Events outside the action map are filtered at render time

- **WHEN** a `<DJActionTrack>` is rendered with an `events` array containing an entry whose `pitch` is not present in `track.actionMap`
- **THEN** that entry SHALL NOT render any `.mr-djtrack__note` element
- **AND** no error SHALL be logged or thrown
- **AND** other valid entries SHALL render unaffected

### Requirement: Per-row M/S state on DJActionTrack

The `DJActionTrack` data shape SHALL include two arrays of MIDI pitches representing per-row mute and solo state:

- `mutedRows: number[]` — pitches of rows in this track whose events are muted.
- `soloedRows: number[]` — pitches of rows in this track whose events are soloed.

Membership in `mutedRows` SHALL be local to the track: a row's mute state only affects that row's events within its own track. Membership in `soloedRows` SHALL contribute to the session-wide `soloing` flag.

The default seeded track SHALL initialize both arrays as `[]`.

#### Scenario: Default seeded track has empty row M/S arrays

- **WHEN** the app first renders
- **THEN** `useStage().djActionTracks[0].mutedRows` SHALL be `[]`
- **AND** `useStage().djActionTracks[0].soloedRows` SHALL be `[]`

### Requirement: Stage exposes per-row M/S toggle actions

The `StageState` interface returned by `useStage()` SHALL expose two new actions:

- `toggleDJTrackRowMuted(trackId: DJTrackId, pitch: number): void` — flips the pitch's membership in `mutedRows` on the named track. No-op if `trackId` is unknown OR `pitch` is not a key in the track's `actionMap`.
- `toggleDJTrackRowSoloed(trackId: DJTrackId, pitch: number): void` — flips the pitch's membership in `soloedRows` on the named track. Same no-op conditions.

Each action SHALL produce a referentially-new array when it modifies state, and SHALL return the existing array (referentially identical) when the call is a no-op.

#### Scenario: toggleDJTrackRowMuted adds and removes pitches

- **WHEN** `toggleDJTrackRowMuted('dj1', 48)` is called while `mutedRows === []`
- **THEN** the next render SHALL have `mutedRows` containing `48`
- **WHEN** `toggleDJTrackRowMuted('dj1', 48)` is called again
- **THEN** the next render SHALL have `mutedRows` not containing `48`

#### Scenario: Unknown trackId is a no-op

- **WHEN** `toggleDJTrackRowMuted('nonexistent', 48)` is called
- **THEN** `djActionTracks` SHALL be referentially equal across renders
- **AND** no error SHALL be thrown

#### Scenario: Pitch not in actionMap is a no-op

- **WHEN** `toggleDJTrackRowMuted('dj1', 99)` is called and `99` is not a key in `djActionTracks[0].actionMap`
- **THEN** `djActionTracks` SHALL be referentially equal across renders
- **AND** no error SHALL be thrown

### Requirement: ActionKeys component renders one row per configured action

The `<ActionKeys>` component at `src/components/dj-action-tracks/ActionKeys.tsx` SHALL render a sticky-left `.mr-djtrack__keys` column inside the dj-action-track body. The column SHALL have width 56px (matching the channel-track keys column width via `KEYS_COLUMN_WIDTH` from `src/components/piano-roll/PianoRoll.tsx`).

The column SHALL contain one `.mr-actkey` per pitch in `track.actionMap`, in **descending pitch order top-to-bottom** (DOM-first is the highest pitch) so that each row aligns with its corresponding `.mr-djtrack__lane` in `<ActionRoll>` — which places the highest pitch at top via absolute positioning. Each `.mr-actkey` SHALL contain:

1. A `<span className="mr-actkey__label">` with text content equal to `action.short` (NOT `action.label`). The short codes (PLAY, CUE, HC1, HC2, ON, X◀, etc.) are 2–4 ASCII-or-narrow characters and fit comfortally in the 56px row without any JS or CSS truncation. The full `action.label` SHALL be exposed via the `title` attribute on the row element for tooltip accessibility — users hovering a row see the long-form name (e.g. "Hot Cue 1" for the HC1 row). CSS SHALL still apply `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` to the label as a defensive fallback in case a future action defines an unusually long `short` value.
2. A compact M/S chip (a `size="xs"` variant of `MSChip`) wired to `onToggleRowMuted(pitch)` and `onToggleRowSoloed(pitch)`. The chip SHALL receive `muted={track.mutedRows.includes(pitch)}` and `soloed={track.soloedRows.includes(pitch)}`. The chip SHALL be wrapped in a `<div className="mr-actkey__chip">` overlay that is hidden at rest (`opacity: 0; pointer-events: none`) and visible when the row is hovered or contains keyboard focus (`.mr-actkey:hover .mr-actkey__chip, .mr-actkey:focus-within .mr-actkey__chip { opacity: 1; pointer-events: auto }`). The wrapper SHALL use absolute positioning so the label retains its full natural width at rest — the chip overlays on top of the label's right end when shown rather than reflowing the label.

The `.mr-actkey` element SHALL NOT carry a colored left border. Device color SHALL NOT appear in the keys column; it SHALL be rendered only in the action-note elements inside the lanes.

Each `.mr-actkey` SHALL carry `data-row-muted={mutedRows.includes(pitch) ? 'true' : undefined}` and `data-row-soloed={soloedRows.includes(pitch) ? 'true' : undefined}` data attributes so CSS can drive visual state (e.g. dimming labels for muted rows, accent-coloring labels for soloed rows). These row-state visuals SHALL be visible at rest — the user can read mute/solo state from the label styling without hovering.

#### Scenario: Keys render action.short, tooltip carries action.label

- **WHEN** the default `<DJActionTrack>` renders with its seeded `actionMap` (pitches 48, 49, 56, 57, 60, 71)
- **THEN** the `.mr-actkey__label` for each pitch SHALL contain the action's `short` field as-is
- **AND** the `.mr-actkey` for pitch 48 SHALL have label text `"PLAY"` and `title="Play / Pause"`
- **AND** the `.mr-actkey` for pitch 49 SHALL have label text `"CUE"` and `title="Cue"`
- **AND** the `.mr-actkey` for pitch 56 SHALL have label text `"HC1"` and `title="Hot Cue 1"`
- **AND** the `.mr-actkey` for pitch 57 SHALL have label text `"HC2"` and `title="Hot Cue 2"`
- **AND** the `.mr-actkey` for pitch 60 SHALL have label text `"ON"` and `title="FX 1 On"`
- **AND** the `.mr-actkey` for pitch 71 SHALL have label text `"X◀"` and `title="Crossfade ◀"`

#### Scenario: CSS includes a defensive ellipsis fallback

- **WHEN** any `.mr-actkey__label` is rendered
- **THEN** its computed CSS SHALL include `overflow: hidden`, `text-overflow: ellipsis`, and `white-space: nowrap`
- **AND** for the seeded short codes (2–4 chars), no visible ellipsis SHALL appear (the codes fit pixel-wise)
- **AND** if a future short value is long enough to overflow, the browser SHALL render an ellipsis

#### Scenario: M/S chip is hidden at rest and revealed on hover

- **WHEN** an `.mr-actkey` is rendered and not being hovered or focused
- **THEN** the `.mr-actkey__chip` element SHALL be present in the DOM
- **AND** the chip SHALL have computed `opacity: 0` and `pointer-events: none`
- **WHEN** the row is hovered or contains keyboard focus
- **THEN** the chip SHALL have computed `opacity: 1` and `pointer-events: auto`

#### Scenario: M/S chip reflects row state when shown

- **WHEN** `track.mutedRows` includes pitch 48 AND the `.mr-actkey` for pitch 48 is hovered
- **THEN** the M/S chip in that row SHALL carry the muted visual state (matching the existing `MSChip`'s `[data-on="true"]` styling on the M button)

#### Scenario: Muted row is visible at rest via label styling

- **WHEN** `track.mutedRows` includes pitch 48 AND the `.mr-actkey` for pitch 48 is not being hovered
- **THEN** the `.mr-actkey__label` SHALL render in a dimmed color/opacity (per the `[data-row-muted="true"] .mr-actkey__label` rule)
- **AND** the M/S chip SHALL NOT be visible

#### Scenario: Soloed row is visible at rest via label styling

- **WHEN** `track.soloedRows` includes pitch 48 AND the `.mr-actkey` for pitch 48 is not being hovered
- **THEN** the `.mr-actkey__label` SHALL render in the solo accent color (per the `[data-row-soloed="true"] .mr-actkey__label` rule using `var(--mr-solo)`)
- **AND** the M/S chip SHALL NOT be visible

#### Scenario: No color stripe in keys

- **WHEN** any `.mr-actkey` is rendered
- **THEN** its computed `border-left` SHALL be either `none` or `0` (no 3px color stripe)
- **AND** no inline `style="border-left..."` SHALL be present

### Requirement: ActionRoll component renders lanes, ticks, and notes

The `<ActionRoll>` component at `src/components/dj-action-tracks/ActionRoll.tsx` SHALL render the lane side of the dj-action-track body — a `.mr-djtrack__lanes` container that contains, in stacking order from bottom to top:

1. One `.mr-djtrack__lane` per pitch in `track.actionMap`, in ascending pitch order. Each lane element SHALL match the vertical position and height of its corresponding `.mr-actkey` in the keys column. Each lane SHALL carry `data-row-muted` and `data-row-soloed` attributes mirroring its keys-row counterpart, and SHALL carry `data-audible={rowAudible ? 'true' : 'false'}` per the row audibility predicate (defined in a separate requirement).
2. Beat ticks rendered as absolutely-positioned vertical lines, one per integer beat in the timeline's bar range. Tick at every 4th beat SHALL be visually accented (higher opacity / wider) matching the channel-track piano-roll convention.
3. One `.mr-djtrack__note` per event in `track.events` whose `pitch` is a key in `track.actionMap`. Notes SHALL be absolutely positioned at `top = laneTop`, `left = event.t * pxPerBeat`. The note's width and visual style SHALL be determined by the row's rendering mode (defined in a separate requirement).

The lanes SHALL share the timeline's `pxPerBeat` constant (or equivalent) so beat 0 in the dj-action-track aligns with beat 0 in every channel-track.

#### Scenario: Lane count matches action map

- **WHEN** the default `<DJActionTrack>` renders with a 4-entry `actionMap`
- **THEN** `.mr-djtrack__lanes` SHALL contain exactly 4 `.mr-djtrack__lane` elements
- **AND** the lanes SHALL be in ascending pitch order (48, 56, 60, 71 from bottom-most to top-most)

#### Scenario: Notes render only for events with matching action map keys

- **WHEN** the seeded track renders with its seeded events
- **THEN** `.mr-djtrack__lanes` SHALL contain one `.mr-djtrack__note` per event whose pitch is a key in `actionMap`
- **AND** no `.mr-djtrack__note` SHALL render for an event whose pitch is not in `actionMap`

#### Scenario: Beat ticks span the visible timeline

- **WHEN** the dj-action-track renders
- **THEN** `.mr-djtrack__lanes` SHALL contain at least one `.mr-djtrack__tick` element
- **AND** ticks at every 4th beat (bar boundaries) SHALL carry a visual treatment distinguishing them from off-beat ticks (e.g. higher opacity)

### Requirement: Action notes render in three modes per action.cat / pad / pressure flags

Each `.mr-djtrack__note` SHALL select its rendering mode based on the corresponding `actionMap[event.pitch]` entry:

- **trigger** mode applies when `action.cat ∈ {'transport', 'cue', 'hotcue'}` AND `action.pressure !== true`. The note SHALL render as a 6px-wide rectangle with `background: devColor(action.device)` and a soft outer glow (`box-shadow: 0 0 6px color-mix(in oklab, ${devColor} 60%, transparent)`). The note's width SHALL NOT depend on `event.dur`.
- **velocity-sensitive** mode applies when `action.pad === true` AND `action.pressure !== true`. The note SHALL render as a variable-width bar of width `max(3, event.dur * pxPerBeat)` with background `color-mix(in oklab, ${devColor} ${40 + event.vel * 50}%, transparent)` (encoding velocity into opacity). A single 2px-wide white tick SHALL render at the note's left edge with opacity `0.4 + event.vel * 0.5` to indicate velocity at note-on.
- **pressure-bearing** mode applies when `action.pressure === true`. The note SHALL render as a wider bar (typically `> 30px`) with background `color-mix(in oklab, ${devColor} 85%, transparent)`. The note's interior SHALL render an SVG containing pressure cells synthesized at render time from a deterministic seed (the prototype's pattern in `dj.jsx`'s `ActionRollUnit`); each cell SHALL be a vertical rect representing the pressure value at that horizontal sample. An "AT" badge SHALL render at the top-right of the note element when the note's rendered width exceeds 30px.

When an action satisfies more than one mode's predicate (e.g. `pressure: true` AND `pad: true` — the prototype's `Hot Cue 1` on deck1 does), **pressure-bearing** SHALL take precedence over velocity-sensitive, and velocity-sensitive SHALL take precedence over trigger.

#### Scenario: Trigger mode rendering

- **WHEN** a `.mr-djtrack__note` renders for an event whose action has `cat === 'transport'` and no `pressure` and no `pad`
- **THEN** the note's rendered width SHALL be 6px
- **AND** the note SHALL carry the class `.mr-djtrack__note--trigger` (or equivalent data-mode attribute)
- **AND** the note SHALL NOT contain an `svg` child

#### Scenario: Velocity-sensitive mode rendering

- **WHEN** a `.mr-djtrack__note` renders for an event whose action has `pad: true` AND no `pressure`
- **THEN** the note's rendered width SHALL be `max(3, event.dur * pxPerBeat)` pixels
- **AND** the note SHALL contain a velocity tick element at its left edge

#### Scenario: Pressure-bearing mode rendering

- **WHEN** a `.mr-djtrack__note` renders for an event whose action has `pressure: true`
- **THEN** the note SHALL contain an `svg` child with at least 10 `rect` elements representing pressure cells
- **AND** if the note's rendered width is greater than 30px, an "AT" badge SHALL be visible at the top-right of the note

#### Scenario: Mode precedence

- **WHEN** an action has both `pressure: true` AND `pad: true` (e.g. Hot Cue 1 on deck1)
- **THEN** notes for that action SHALL render in **pressure-bearing** mode
- **AND** the note SHALL contain the SVG pressure cells

### Requirement: Row audibility model extends solo dimming to per-row level

A dj-action-track row (`.mr-djtrack__lane` for a given pitch) SHALL be considered **audible** under the following predicate:

```
rowAudible(track, pitch, soloing) =
  !track.mutedRows.includes(pitch)           // row not muted
  && trackAudible(track, soloing)            // track itself audible
  && (!soloing                                // either no session-wide solo,
      || track.soloedRows.includes(pitch)    // OR this row is soloed,
      || (track.soloed && track.soloedRows.length === 0))
                                              // OR track soloed and no rows soloed in it
```

Where `trackAudible(track, soloing)` is the existing track-level audibility predicate (the track is audible iff `!soloing || track.soloed`).

The `.mr-djtrack__lane` element SHALL carry `data-audible="false"` when `rowAudible` evaluates to false. CSS SHALL dim the lane's note elements via `[data-audible="false"] .mr-djtrack__note { opacity: 0.4 }` (or equivalent). The dim SHALL NOT apply to the lane background or to the keys-row label — only to the events inside the lane.

#### Scenario: Row mute dims only that row's notes

- **WHEN** `track.mutedRows` includes pitch 48 and no row or track is soloed
- **THEN** the `.mr-djtrack__lane` for pitch 48 SHALL carry `data-audible="false"`
- **AND** notes inside that lane SHALL render dimmed
- **AND** other lanes in the same track SHALL carry `data-audible="true"`
- **AND** notes inside other lanes SHALL render at full opacity
- **AND** other tracks SHALL be unaffected (`data-soloing` SHALL be unchanged)

#### Scenario: Row solo flips session-wide solo flag

- **WHEN** `track.soloedRows` includes pitch 48 and no other channel/roll/lane/track is soloed
- **THEN** `useStage().soloing` SHALL be `true`
- **AND** `.mr-timeline` SHALL carry `data-soloing="true"`
- **AND** all other channel-tracks SHALL render with `data-audible="false"`
- **AND** all other dj-action-tracks SHALL render with `data-audible="false"`
- **AND** within the soloed-row's track, the lane for pitch 48 SHALL carry `data-audible="true"`
- **AND** all other lanes in the same track SHALL carry `data-audible="false"`

#### Scenario: Track-level solo with no row solo audibilizes all rows in track

- **WHEN** `track.soloed === true` AND `track.soloedRows === []`
- **THEN** every lane in that track SHALL carry `data-audible="true"`
- **AND** other tracks SHALL carry `data-audible="false"`

## MODIFIED Requirements

### Requirement: DJActionTrack data shape

The `dj-action-tracks` capability SHALL define the following types:

```ts
type DJTrackId = string;

// TODO(routing-ui-slice): expand the routing shape with pitch ranges and CC selectors
// when the routing-configuration UI is built. For Slice 7a the channel list is
// the only field we commit to.
interface DJTrackRouting {
  channels: ChannelId[];
}

interface ActionEvent {
  pitch: number;
  t: number;
  dur: number;
  vel: number;
}

interface DJActionTrack {
  id: DJTrackId;
  name: string;
  color: string;
  actionMap: Record<number, ActionMapEntry>;
  events: ActionEvent[];
  inputRouting: DJTrackRouting;
  outputRouting: DJTrackRouting;
  collapsed: boolean;
  muted: boolean;
  soloed: boolean;
  mutedRows: number[];
  soloedRows: number[];
}
```

`inputRouting` SHALL declare which incoming MIDI messages feed this track's action map. `outputRouting` SHALL declare where the track's actions emit on playback. Both fields exist on every dj-action-track; their full selector shapes (pitch ranges, CC selectors) are deferred to the routing-configuration slice.

The `actionMap` field SHALL be **the set of actions actively configured on this track** — NOT a reference to a catalog of all possible actions. The track's body SHALL render exactly one row per entry in `actionMap`. Adding an action to the track means inserting a new entry into `actionMap` (typically via a future routing/add-action UI); the catalog of available actions a user can pick from lives in `DEFAULT_ACTION_MAP` (exported from `src/data/dj.ts`), which is a SOURCE for the picker, not a track's actionMap.

The `events` field SHALL be the list of action events associated with this track. In Slice 7b these are synthetic demo events seeded on the track; a future routing slice MAY replace this with events derived from channel-track notes via `inputRouting`. The renderer treats the field as ground-truth — events whose `pitch` is not a key in `actionMap` are filtered out at render time.

The `mutedRows` and `soloedRows` fields SHALL track per-row M/S state. `mutedRows.includes(pitch)` means the row for that pitch is muted (its events are silenced and dimmed within the track). `soloedRows.includes(pitch)` means the row is soloed (it folds into the session-wide `soloing` flag, exactly like channel/roll/lane/track solo). Both arrays MAY be empty.

The default seeded track SHALL contain a small demo subset of `DEFAULT_ACTION_MAP` (4 entries — pitches 48, 56, 60, 71 — spanning 3 devices) so the shell has visible rows to demo against, plus a synthetic `events` array of length ≥ 10 with deterministic content covering all three rendering modes, plus empty `mutedRows: []` and `soloedRows: []`. Future tracks created via the routing/add-action UI MAY start empty; an empty `actionMap` is a valid state and SHALL render the track header with body content sized to zero rows.

#### Scenario: Default seeded track has the expected fields

- **WHEN** the app first renders
- **THEN** `useStage().djActionTracks` SHALL be an array of length 1
- **AND** the entry SHALL have `id === 'dj1'`, `name === 'DJ'`, `color === DJ_DEVICES.global.color`
- **AND** `Object.keys(actionMap)` SHALL have length 4 (the demo subset)
- **AND** the seeded pitches SHALL be `48`, `56`, `60`, `71` — each mapped to the matching entry from `DEFAULT_ACTION_MAP`
- **AND** `inputRouting.channels` SHALL be `[]`
- **AND** `outputRouting.channels` SHALL be `[]`
- **AND** `events.length` SHALL be ≥ 10
- **AND** every event's `pitch` SHALL be a key in `actionMap`
- **AND** `mutedRows` SHALL be `[]`
- **AND** `soloedRows` SHALL be `[]`
- **AND** `collapsed`, `muted`, `soloed` SHALL all be `false`

### Requirement: Stage exposes dj-action-track state and per-track toggles

The `StageState` interface returned by `useStage()` SHALL expose:

- `djActionTracks: DJActionTrack[]` — the current list of dj-action-tracks. Default seed contains exactly one entry per the data-shape requirement above.
- `toggleDJTrackCollapsed(id: DJTrackId): void` — flips the `collapsed` flag on the named track. No-op if the id is unknown.
- `toggleDJTrackMuted(id: DJTrackId): void` — flips `muted`. No-op for unknown ids.
- `toggleDJTrackSoloed(id: DJTrackId): void` — flips `soloed`. No-op for unknown ids.
- `toggleDJTrackRowMuted(id: DJTrackId, pitch: number): void` — flips the pitch's membership in the named track's `mutedRows`. No-op for unknown ids or pitches not in the track's `actionMap`.
- `toggleDJTrackRowSoloed(id: DJTrackId, pitch: number): void` — flips the pitch's membership in the named track's `soloedRows`. Same no-op conditions.

The state SHALL persist across re-renders in `useState` keyed off the `useDJActionTracks` hook. It SHALL NOT reset on Toolstrip state changes, dialog opens, or any other unrelated state transitions.

#### Scenario: toggleDJTrackMuted flips the muted flag

- **WHEN** `toggleDJTrackMuted('dj1')` is called while `djActionTracks[0].muted === false`
- **THEN** the next render SHALL have `djActionTracks[0].muted === true`
- **AND** other fields on the track SHALL be unchanged

#### Scenario: Unknown id is a no-op for any toggle

- **WHEN** any of the five toggle actions is called with an unknown `id`
- **THEN** `djActionTracks` SHALL be unchanged (referentially equal across renders)
- **AND** no error SHALL be thrown

### Requirement: Soloing flag combines channel and dj-action-track solo

The `soloing` flag returned by `useStage()` SHALL be `true` when ANY of the following holds:

- Any channel in `state.channels` has `soloed === true`.
- Any roll in `state.rolls` has `soloed === true`.
- Any lane in `state.lanes` has `soloed === true`.
- Any track in `state.djActionTracks` has `soloed === true`.
- Any track in `state.djActionTracks` has `soloedRows.length > 0` (any row solo within any dj-action-track).

The flag is track-kind-independent and granularity-independent. Solo state set on a dj-action-track row contributes to the same global flag as channel/roll/lane/track solo. `.mr-timeline` (or `.mr-timeline__inner`) SHALL carry `data-soloing="true"` whenever `soloing` is `true`, per the existing `app-shell` capability rule.

#### Scenario: dj-action-track solo lights up data-soloing

- **WHEN** `toggleDJTrackSoloed('dj1')` is called while no channel/roll/lane/row is soloed
- **THEN** the next render SHALL have `useStage().soloing === true`
- **AND** `.mr-timeline` SHALL carry `data-soloing="true"`

#### Scenario: dj-action-track row solo lights up data-soloing

- **WHEN** `toggleDJTrackRowSoloed('dj1', 48)` is called while no channel/roll/lane/track/row is soloed
- **THEN** the next render SHALL have `useStage().soloing === true`
- **AND** `.mr-timeline` SHALL carry `data-soloing="true"`

#### Scenario: Mixed solo state across kinds and granularities

- **WHEN** a channel is soloed AND a dj-action-track is also soloed AND a row in a third dj-action-track is also soloed
- **THEN** `useStage().soloing` SHALL be `true`
- **AND** un-soloed channels, un-soloed dj-action-tracks, and un-soloed rows SHALL all render with `data-audible="false"` and dim per the existing solo-dim rule

### Requirement: DJActionTrack component renders header and placeholder body

The `<DJActionTrack>` component at `src/components/dj-action-tracks/DJActionTrack.tsx` SHALL render a `.mr-djtrack` element with the following data attributes:

- `data-track-collapsed={track.collapsed ? 'true' : undefined}`
- `data-muted={track.muted ? 'true' : undefined}`
- `data-soloed={track.soloed ? 'true' : undefined}`
- `data-audible` matching the channel-track convention: under `data-soloing="true"`, only soloed tracks are audible.

The header (`.mr-djtrack__hdr`) SHALL split its children into three sticky-zoned wrappers, in left-to-right order, mirroring the existing `<Track>` header layout:

1. `<div className="mr-djtrack__hdr-left">` — sticky-left zone (`position: sticky; left: 0; z-index: 1`), background `var(--mr-bg-panel-2)`, containing in order:
   1. `<span className="mr-djtrack__chev">` — chevron glyph. CSS rule `[data-track-collapsed="true"] .mr-djtrack__chev` rotates it `-90deg`.
   2. `<span className="mr-djtrack__swatch">` — color box matching the channel/track header swatch convention, painted in `track.color`.
   3. `<span className="mr-djtrack__name">` — text `track.name`, with inline `color: track.color` to match the track's chosen color.
   4. `<span className="mr-djtrack__sub">` — text `"{Object.keys(track.actionMap).length} actions"`.
2. `<div className="mr-djtrack__hdr-spacer">` — flex-grow filler, NOT sticky.
3. `<div className="mr-djtrack__hdr-right">` — sticky-right zone (`position: sticky; right: 0; z-index: 1`), background `var(--mr-bg-panel-2)`, containing exactly one `<MSChip muted={track.muted} soloed={track.soloed} onMute={onToggleMuted} onSolo={onToggleSoloed} />` (reused from the existing `tracks` capability — track-header size, NOT the compact row variant).

Clicking on `.mr-djtrack__hdr` outside the M/S chip SHALL invoke `onToggleCollapsed`. Clicking on the M/S chip SHALL NOT bubble — the existing `MSChip` component handles `event.stopPropagation()`.

When `track.collapsed === false`, the body (`.mr-djtrack__body`) SHALL render below the header. The body SHALL contain:

- A `<ActionKeys>` component (sticky-left, 56px wide) — one `.mr-actkey` per pitch in `actionMap`, ascending pitch order. See the `ActionKeys component renders one row per configured action` requirement for content.
- A `<ActionRoll>` component — `.mr-djtrack__lanes` container with lanes, beat ticks, and action-note elements. See the `ActionRoll component renders lanes, ticks, and notes` requirement for content.

The placeholder `<div className="mr-djtrack__placeholder">Action body — Slice 7b</div>` from the 7a shell SHALL be removed. The body's caption is gone.

When `track.collapsed === true`, only the header SHALL render. The body SHALL NOT exist in the DOM.

When `track.muted === true`, the body SHALL be visually dimmed via `[data-muted="true"] .mr-djtrack__body { opacity: 0.4 }` (or equivalent rule).

The action-label keys column (`<ActionKeys>`), action lane rows, beat ticks, the three note-rendering modes (trigger / velocity-sensitive / pressure-bearing), AND the per-row M/S chips are now part of `<DJActionTrack>` in this slice — Slice 7b ships all of them.

#### Scenario: Header structure includes the four sticky-zoned wrappers

- **WHEN** a `<DJActionTrack>` is rendered with the default seeded track
- **THEN** the rendered DOM SHALL contain `.mr-djtrack > .mr-djtrack__hdr` with children matching the order: `.mr-djtrack__hdr-left`, `.mr-djtrack__hdr-spacer`, `.mr-djtrack__hdr-right`
- **AND** `.mr-djtrack__hdr-left` SHALL contain (in this order): `.mr-djtrack__chev`, `.mr-djtrack__swatch`, `.mr-djtrack__name`, `.mr-djtrack__sub`
- **AND** `.mr-djtrack__hdr-right` SHALL contain exactly one `.mr-ms` (the track-header MSChip's root)

#### Scenario: Sub label format

- **WHEN** the seeded track is rendered with its default 4-entry `actionMap`
- **THEN** the `.mr-djtrack__sub` text content SHALL be `4 actions`
- **AND** if a track's `actionMap` is empty, the text SHALL be `0 actions`

#### Scenario: Expanded body renders ActionKeys and ActionRoll

- **WHEN** a `<DJActionTrack>` is rendered with `track.collapsed === false` AND `Object.keys(track.actionMap).length > 0`
- **THEN** the rendered DOM SHALL contain `.mr-djtrack > .mr-djtrack__body`
- **AND** `.mr-djtrack__body` SHALL contain a `.mr-djtrack__keys` element (rendered by `<ActionKeys>`)
- **AND** `.mr-djtrack__body` SHALL contain a `.mr-djtrack__lanes` element (rendered by `<ActionRoll>`)
- **AND** the body SHALL NOT contain a `.mr-djtrack__placeholder` element

#### Scenario: Empty actionMap renders zero rows

- **WHEN** a `<DJActionTrack>` is rendered with `track.collapsed === false` AND `track.actionMap = {}`
- **THEN** `.mr-djtrack__body` SHALL exist
- **AND** `.mr-djtrack__keys` SHALL contain zero `.mr-actkey` children
- **AND** `.mr-djtrack__lanes` SHALL contain zero `.mr-djtrack__lane` children
- **AND** the body's intrinsic height SHALL collapse to zero (modulo any beat-tick overlay); only the header is visible

#### Scenario: Collapsed body is absent from the DOM

- **WHEN** a `<DJActionTrack>` is rendered with `track.collapsed === true`
- **THEN** `.mr-djtrack > .mr-djtrack__body` SHALL NOT exist in the DOM

#### Scenario: Header click toggles collapse

- **WHEN** the user clicks `.mr-djtrack__hdr` outside the M/S chip
- **THEN** `onToggleCollapsed` SHALL be invoked exactly once

#### Scenario: M/S chip click does not toggle collapse

- **WHEN** the user clicks the `M` button inside the track-header M/S chip
- **THEN** `onToggleMuted` SHALL be invoked
- **AND** `onToggleCollapsed` SHALL NOT be invoked

#### Scenario: Muted track dims the body

- **WHEN** `track.muted === true` and `track.collapsed === false`
- **THEN** `.mr-djtrack` SHALL carry `data-muted="true"`
- **AND** the `.mr-djtrack__body` element's computed opacity SHALL be visibly less than 1 (per the `[data-muted="true"] .mr-djtrack__body` rule)
