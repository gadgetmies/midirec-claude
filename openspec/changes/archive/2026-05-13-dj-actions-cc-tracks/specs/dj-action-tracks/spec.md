## MODIFIED Requirements

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
- A `<ActionRoll>` component — `.mr-djtrack__lanes` container with lanes, beat ticks, per-event **note** elements, and per-event **CC automation** elements for CC-output rows. See the `ActionRoll component renders lanes, ticks, and notes` requirement for content.

The placeholder `<div className="mr-djtrack__placeholder">Action body — Slice 7b</div>` from the 7a shell SHALL be removed. The body's caption is gone.

When `track.collapsed === true`, only the header SHALL render. The body SHALL NOT exist in the DOM.

When `track.muted === true`, the body SHALL be visually dimmed via `[data-muted="true"] .mr-djtrack__body { opacity: 0.4 }` (or equivalent rule).

The action-label keys column (`<ActionKeys>`), action lane rows, beat ticks, the note-rendering modes (trigger / velocity-sensitive / pressure-bearing), **CC automation strips** for rows whose effective MIDI output is Control Change, AND the per-row M/S chips are now part of `<DJActionTrack>` in this slice — Slice 7b ships all of them.

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

### Requirement: ActionRoll component renders lanes, ticks, and notes

The `<ActionRoll>` component at `src/components/dj-action-tracks/ActionRoll.tsx` SHALL render the lane side of the dj-action-track body — a `.mr-djtrack__lanes` container that contains, in stacking order from bottom to top:

1. One `.mr-djtrack__lane` per pitch in `track.actionMap`, in ascending pitch order. Each lane element SHALL match the vertical position and height of its corresponding `.mr-actkey` in the keys column. Each lane SHALL carry `data-row-muted` and `data-row-soloed` attributes mirroring its keys-row counterpart, and SHALL carry `data-audible={rowAudible ? 'true' : 'false'}` per the row audibility predicate (defined in a separate requirement).
2. Beat ticks rendered as absolutely-positioned vertical lines, one per integer beat in the timeline's bar range. Tick at every 4th beat SHALL be visually accented (higher opacity / wider) matching the channel-track piano-roll convention.
3. For each event in `track.events` whose `pitch` is a key in `track.actionMap`, the component SHALL render exactly one **lane event element**, positioned at `top = laneTop` for that pitch and `left = event.t * pxPerBeat`:
   - **CC-output row** — A row whose resolved output uses Control Change (per `track.outputMap[pitch].cc` when defined, otherwise the implementation’s default CC for the action when that exists — e.g. mixer template defaults) SHALL render a **CC automation element** (root class `.mr-djtrack__cc`), NOT a `.mr-djtrack__note`. The element SHALL encode `event.dur` as horizontal extent and `event.vel` as a normalized value (0–1) for the automation visualization (discrete bars or equivalent param-lane-style strip), using `devColor(action.device)` for the fill. The element SHALL carry `data-audible` and `data-selected` under the same rules as note elements.
   - **Non-CC-output row** — The element SHALL be a `.mr-djtrack__note` per the existing note-mode requirement. Its width and visual style SHALL be determined by the row's rendering mode.

The lanes SHALL share the timeline's `pxPerBeat` constant (or equivalent) so beat 0 in the dj-action-track aligns with beat 0 in every channel-track.

#### Scenario: Lane count matches action map

- **WHEN** the default `<DJActionTrack>` renders with a 4-entry `actionMap`
- **THEN** `.mr-djtrack__lanes` SHALL contain exactly 4 `.mr-djtrack__lane` elements
- **AND** the lanes SHALL be in ascending pitch order (48, 56, 60, 71 from bottom-most to top-most)

#### Scenario: Notes render only for events with matching action map keys

- **WHEN** the seeded track renders with its seeded events
- **THEN** `.mr-djtrack__lanes` SHALL contain one `.mr-djtrack__note` per event whose pitch is a key in `actionMap` **and** whose row is not CC-output
- **AND** `.mr-djtrack__lanes` SHALL contain one `.mr-djtrack__cc` per event whose pitch is a key in `actionMap` **and** whose row is CC-output
- **AND** no `.mr-djtrack__note` SHALL render for a CC-output row event
- **AND** no `.mr-djtrack__note` SHALL render for an event whose pitch is not in `actionMap`

#### Scenario: Beat ticks span the visible timeline

- **WHEN** the dj-action-track renders
- **THEN** `.mr-djtrack__lanes` SHALL contain at least one `.mr-djtrack__tick` element
- **AND** ticks at every 4th beat (bar boundaries) SHALL carry a visual treatment distinguishing them from off-beat ticks (e.g. higher opacity)

### Requirement: Action notes render in three modes per action.cat / pad / pressure flags

Each `.mr-djtrack__note` SHALL select its rendering mode based on the corresponding `actionMap[event.pitch]` entry **only when that row is not a CC-output row**. CC-output rows SHALL use `.mr-djtrack__cc` automation elements instead and SHALL NOT use the modes below.

For non-CC-output rows:

- **trigger** mode applies when `action` satisfies the codebase's trigger-style predicate for deck transport buttons (the predicate that replaces the retired rule `action.cat ∈ {'transport', 'cue', 'hotcue'}`), AND `action.pressure !== true`. The note SHALL render as a 6px-wide rectangle with `background: devColor(action.device)` and a soft outer glow (`box-shadow: 0 0 6px color-mix(in oklab, ${devColor} 60%, transparent)`). The note's width SHALL NOT depend on `event.dur`.
- **velocity-sensitive** mode applies when `action.pad === true` AND `action.pressure !== true`. The note SHALL render as a variable-width bar of width `max(3, event.dur * pxPerBeat)` with background `color-mix(in oklab, ${devColor} ${40 + event.vel * 50}%, transparent)` (encoding velocity into opacity). A single 2px-wide white tick SHALL render at the note's left edge with opacity `0.4 + event.vel * 0.5` to indicate velocity at note-on.
- **pressure-bearing** mode applies when `action.pressure === true`. The note SHALL render as a wider bar (typically `> 30px`) with background `color-mix(in oklab, ${devColor} 85%, transparent)`. The note's interior SHALL render an SVG containing pressure cells; each cell SHALL be a vertical rect representing the pressure value at that horizontal sample. An "AT" badge SHALL render at the top-right of the note element when the note's rendered width exceeds 30px.

Pressure-cell rendering SHALL source values from the event's `pressure` field if defined, OR from `synthesizePressure(event)` if `event.pressure` is `undefined`. The number of rendered cells SHALL match the length of the source curve (14 for the synthesised default; for stored pressure the renderer rasterises via `rasterizePressure(event.pressure, cellCount)` where `cellCount` SHALL be the same value used today, 14, so the visual cadence is unchanged).

When `useStage().pressureRenderMode === 'step'`, the cells SHALL render unchanged. When the mode is `'curve'`, the cells SHALL render unchanged for Slice 9 (a future polyline overlay is deferred). The `.mr-djtrack__note` SHALL carry `data-pressure-mode={pressureRenderMode}` on pressure-bearing notes so future render branches and tests can read the mode from the DOM.

When an action satisfies more than one mode's predicate (e.g. `pressure: true` AND `pad: true` — the prototype's `Hot Cue 1` on deck1 does), **pressure-bearing** SHALL take precedence over velocity-sensitive, and velocity-sensitive SHALL take precedence over trigger.

#### Scenario: Trigger mode rendering

- **WHEN** a `.mr-djtrack__note` renders for an event whose action uses `DEFAULT_ACTION_MAP` pitch `48` (Play / Pause on Deck 1: `id === 'play'`, `cat === 'deck'`) with no `pressure` and no `pad`
- **THEN** the note's rendered width SHALL be 6px
- **AND** the note SHALL carry the class `.mr-djtrack__note--trigger` (or equivalent data-mode attribute)
- **AND** the note SHALL NOT contain an `svg` child

#### Scenario: Velocity-sensitive mode rendering

- **WHEN** a `.mr-djtrack__note` renders for an event whose action has `pad: true` AND no `pressure` AND the row is not CC-output
- **THEN** the note's rendered width SHALL be `max(3, event.dur * pxPerBeat)` pixels
- **AND** the note SHALL contain a velocity tick element at its left edge

#### Scenario: Pressure-bearing mode rendering uses stored or synthesised data

- **WHEN** a `.mr-djtrack__note` renders for an event whose action has `pressure: true` AND `event.pressure === undefined`
- **THEN** the note SHALL contain an `svg` child with at least 10 `rect` elements representing pressure cells, drawn from `synthesizePressure(event)`
- **AND** if the note's rendered width is greater than 30px, an "AT" badge SHALL be visible at the top-right of the note
- **AND** the note SHALL carry `data-pressure-mode` equal to `'curve'` or `'step'`

- **WHEN** a `.mr-djtrack__note` renders for an event whose action has `pressure: true` AND `event.pressure` is a non-empty array
- **THEN** the cells' heights SHALL be derived from `rasterizePressure(event.pressure, cellCount)`

- **WHEN** a `.mr-djtrack__note` renders for an event whose action has `pressure: true` AND `event.pressure === []`
- **THEN** every cell SHALL render with the minimum visible height (or zero height)

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

The `.mr-djtrack__lane` element SHALL carry `data-audible="false"` when `rowAudible` evaluates to false. CSS SHALL dim lane event elements via `[data-audible="false"] .mr-djtrack__note, [data-audible="false"] .mr-djtrack__cc { opacity: 0.4 }` (or equivalent). The dim SHALL NOT apply to the lane background or to the keys-row label — only to the events inside the lane.

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

### Requirement: Clicking an action event in ActionRoll selects the event

The `<ActionRoll>` component SHALL register a `pointerdown` (or `click`) handler on each `.mr-djtrack__note` element and on each `.mr-djtrack__cc` automation element. When the user activates an event by primary pointer click, the handler SHALL:

1. Call `useStage().setDJEventSelection({ trackId, pitch: event.pitch, eventIdx })`, where `eventIdx` is the index of the event in `track.events`.
2. Call `useStage().setDJActionSelection({ trackId, pitch: event.pitch })` if `djActionSelection` does not already match — so the Output panel opens (or stays open) for the row that contains the event.

The handler SHALL stop event propagation so the click does not also fire the lane's background handlers.

The activated element (`.mr-djtrack__note` or `.mr-djtrack__cc`) SHALL carry `data-selected="true"` when `djEventSelection.trackId === trackId && djEventSelection.pitch === event.pitch && djEventSelection.eventIdx === eventIdx`, so CSS can render a persistent highlight on the selected event. The attribute SHALL be removed when the condition ceases.

#### Scenario: Clicking an event sets djEventSelection

- **WHEN** the user clicks the `.mr-djtrack__note` corresponding to `track.events[2]` on track `dj1` (with `event.pitch === 56`), and `djEventSelection === null`
- **THEN** `setDJEventSelection` SHALL be called once with `{ trackId: 'dj1', pitch: 56, eventIdx: 2 }`
- **AND** `setDJActionSelection` SHALL be called once with `{ trackId: 'dj1', pitch: 56 }` (because `djActionSelection` did not match)
- **AND** the next render SHALL have the clicked note element carry `data-selected="true"`
- **AND** other `.mr-djtrack__note` elements SHALL NOT carry `data-selected="true"`

#### Scenario: Clicking a different event retargets the selection

- **WHEN** `djEventSelection === { trackId: 'dj1', pitch: 56, eventIdx: 2 }` and the user clicks the `.mr-djtrack__note` for `track.events[3]` (with `event.pitch === 56`)
- **THEN** `setDJEventSelection` SHALL be called with `{ trackId: 'dj1', pitch: 56, eventIdx: 3 }`
- **AND** the note for `events[2]` SHALL NOT carry `data-selected="true"`
- **AND** the note for `events[3]` SHALL carry `data-selected="true"`

#### Scenario: Clicking an event on a different row updates both selections

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 56 }` AND `djEventSelection === { trackId: 'dj1', pitch: 56, eventIdx: 2 }`, and the user clicks the `.mr-djtrack__note` for an event whose `event.pitch === 60`
- **THEN** `setDJActionSelection` SHALL be called with `{ trackId: 'dj1', pitch: 60 }`
- **AND** `setDJEventSelection` SHALL be called with a value whose `pitch === 60`

#### Scenario: Clicking a CC automation event selects the event

- **WHEN** a row is CC-output and the user clicks the `.mr-djtrack__cc` for `track.events[k]`
- **THEN** `setDJEventSelection` SHALL be called with `{ trackId, pitch: event.pitch, eventIdx: k }`
- **AND** the clicked `.mr-djtrack__cc` SHALL carry `data-selected="true"`
