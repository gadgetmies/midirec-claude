# dj-action-tracks Specification

## Purpose
TBD - created by archiving change dj-mode-shell. Update Purpose after archive.
## Requirements
### Requirement: DJ data tables are exported as typed constants

The codebase SHALL expose a `src/data/dj.ts` module exporting:

- `DJ_CATEGORIES: Record<CategoryId, { label: string }>` — verbatim from the prototype's `dj.jsx`. Keys: `'transport' | 'cue' | 'hotcue' | 'loop' | 'fx' | 'deck' | 'mixer'`.
- `DJ_DEVICES: Record<DeviceId, { label: string; short: string; color: string }>` — verbatim. Keys: `'deck1' | 'deck2' | 'deck3' | 'deck4' | 'fx1' | 'fx2' | 'mixer' | 'global'`. Each entry's `color` is an OKLCH string.
- `DEFAULT_ACTION_MAP: Record<number, ActionMapEntry>` — verbatim. Keys are MIDI pitch numbers from 48 (C3) to 75 (D♯5). 28 entries.
- `TriggerMode` type: `'momentary' | 'toggle'`.
- `ActionMapEntry` type: `{ id: string; cat: CategoryId; label: string; short: string; device: DeviceId; pad?: boolean; pressure?: boolean; trigger?: TriggerMode }`.
- `OutputMapping` type: `{ device: DeviceId; channel: number; pitch: number }`. `channel` is in the inclusive range `1..16`; `pitch` is in the inclusive range `0..127`.
- Helpers `devColor(d: DeviceId): string`, `devShort(d: DeviceId): string`, `devLabel(d: DeviceId): string`, `pitchLabel(p: number): string`.

The data SHALL be declared `as const` so TypeScript narrows the literal types; the helpers SHALL fall back to the `'global'` device for unknown ids, matching the prototype's `(DJ_DEVICES[device] || DJ_DEVICES.global)` pattern.

The `trigger` field SHALL be optional on every `ActionMapEntry`. When absent (as it is in every entry of `DEFAULT_ACTION_MAP`), readers SHALL treat the field as `'momentary'`. Writers (the Map Note panel) SHALL always persist an explicit value to support deterministic round-tripping.

#### Scenario: Module is importable and typed

- **WHEN** another file imports `DJ_CATEGORIES`, `DJ_DEVICES`, `DEFAULT_ACTION_MAP`, `TriggerMode`, `ActionMapEntry`, `OutputMapping`, or any helper from `src/data/dj.ts`
- **THEN** TypeScript SHALL resolve the import without errors
- **AND** `DJ_DEVICES.deck1.color` SHALL be the literal string `"oklch(72% 0.16 200)"`
- **AND** `DEFAULT_ACTION_MAP[48].label` SHALL be the literal string `"Play / Pause"`

#### Scenario: pitchLabel formats correctly

- **WHEN** `pitchLabel(48)` is called
- **THEN** it SHALL return `"C3"`
- **AND** `pitchLabel(60)` SHALL return `"C4"`
- **AND** `pitchLabel(57)` SHALL return `"A3"`

#### Scenario: trigger field is optional and reads as momentary when absent

- **WHEN** a reader inspects `DEFAULT_ACTION_MAP[48].trigger`
- **THEN** the value SHALL be `undefined`
- **AND** the reader SHALL treat the absence as the value `'momentary'`
- **AND** `TriggerMode` SHALL be the literal union type `'momentary' | 'toggle'`

#### Scenario: OutputMapping fields are typed and bounded

- **WHEN** a reader inspects an `OutputMapping` value
- **THEN** its `device` SHALL be a `DeviceId`
- **AND** its `channel` and `pitch` SHALL be numbers (consumer-side clamping enforces `1..16` and `0..127` respectively)

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
  midiChannel: number;
  actionMap: Record<number, ActionMapEntry>;
  outputMap: Record<number, OutputMapping>;
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

The `midiChannel` field SHALL be a MIDI channel number in the inclusive range `1..16`. It is the track's intrinsic output channel — the channel byte each event emits on by default during playback, conceptually mirroring how `Channel.id` serves as a channel-roll's intrinsic channel byte. The default seeded track SHALL set `midiChannel: 16`. Per-row `outputMap[pitch].channel` overrides `midiChannel` when present; see the `midi-playback` capability for the resolution rule.

`inputRouting` SHALL declare which incoming MIDI messages feed this track's action map. `outputRouting` SHALL declare the set of channel-roll channels that contribute notes to the track's action map at recording time. Both fields exist on every dj-action-track; their full selector shapes (pitch ranges, CC selectors) are deferred to the routing-configuration slice.

The `actionMap` field SHALL be **the set of input bindings actively configured on this track** — NOT a reference to a catalog of all possible actions. The track's body SHALL render exactly one row per entry in `actionMap`. The catalog of available actions a user can pick from lives in `DEFAULT_ACTION_MAP` (exported from `src/data/dj.ts`), which is a SOURCE for the picker, not a track's actionMap.

The `outputMap` field SHALL hold per-pitch **optional output-mapping overrides**, keyed by the same pitch keys that drive `actionMap`. When `outputMap[pitch]` is present, its `channel` and `pitch` override `track.midiChannel` and the event's row pitch for emission, respectively. When absent, the event emits with `track.midiChannel` as the channel and the event's own `pitch` as the output pitch. Deleting an action via `deleteActionEntry` SHALL also remove the matching `outputMap` entry. Initial seed sets `outputMap` to `{}`.

The `events` field SHALL be the list of action events associated with this track. In Slice 7b these are synthetic demo events seeded on the track; a future routing slice MAY replace this with events derived from channel-track notes via `inputRouting`.

The `mutedRows` and `soloedRows` fields SHALL track per-row M/S state, exactly as in Slice 7b.

The default seeded track SHALL contain a small demo subset of `DEFAULT_ACTION_MAP` (4 entries — pitches 48, 56, 60, 71 — spanning 3 devices), a synthetic `events` array of length ≥ 10 with deterministic content covering all three rendering modes, an empty `outputMap: {}`, and empty `mutedRows: []` / `soloedRows: []`.

#### Scenario: Default seeded track has the expected fields

- **WHEN** `useStage()` is first called
- **THEN** `djActionTracks[0]` SHALL have `id === 'dj1'`
- **AND** `djActionTracks[0].midiChannel` SHALL be `16`
- **AND** `djActionTracks[0].outputMap` SHALL be an empty object
- **AND** `Object.keys(djActionTracks[0].actionMap).length` SHALL be ≥ 4
- **AND** `djActionTracks[0].events.length` SHALL be ≥ 10

### Requirement: Stage exposes dj-action-track state and per-track toggles

The `StageState` interface returned by `useStage()` SHALL expose:

- `djActionTracks: DJActionTrack[]` — the current list of dj-action-tracks. Default seed contains exactly one entry per the data-shape requirement above.
- `toggleDJTrackCollapsed(id: DJTrackId): void` — flips the `collapsed` flag on the named track. No-op if the id is unknown.
- `toggleDJTrackMuted(id: DJTrackId): void` — flips `muted`. No-op for unknown ids.
- `toggleDJTrackSoloed(id: DJTrackId): void` — flips `soloed`. No-op for unknown ids.
- `toggleDJTrackRowMuted(id: DJTrackId, pitch: number): void` — flips the pitch's membership in the named track's `mutedRows`. No-op for unknown ids or pitches not in the track's `actionMap`.
- `toggleDJTrackRowSoloed(id: DJTrackId, pitch: number): void` — flips the pitch's membership in the named track's `soloedRows`. Same no-op conditions.
- `setActionEntry(id: DJTrackId, pitch: number, entry: ActionMapEntry): void` — writes `entry` to the named track's `actionMap[pitch]`, replacing whatever was previously there (or adding if absent). No-op for unknown track ids.
- `deleteActionEntry(id: DJTrackId, pitch: number): void` — removes the pitch key from the named track's `actionMap` AND removes the pitch from `outputMap`, `mutedRows`, `soloedRows`. No-op for unknown track ids or absent pitches. If `djActionSelection` references the deleted `(trackId, pitch)`, it SHALL be cleared to `null`. If `djEventSelection` references the same `(trackId, pitch)`, it SHALL also be cleared to `null`.
- `setOutputMapping(id: DJTrackId, pitch: number, mapping: OutputMapping): void` — writes `mapping` to the named track's `outputMap[pitch]`. No-op for unknown track ids. The pitch MAY be a key that did not previously have an outputMap entry; this is how new output bindings are added.
- `deleteOutputMapping(id: DJTrackId, pitch: number): void` — removes the pitch key from the named track's `outputMap`. No-op for unknown track ids or absent pitches.
- `setEventPressure(trackId: DJTrackId, pitch: number, eventIdx: number, points: PressurePoint[]): void` — writes `points` to `track.events[eventIdx].pressure` provided `track.events[eventIdx]` exists AND `track.events[eventIdx].pitch === pitch`. No-op for unknown track ids, out-of-range event indexes, or pitch mismatches.
- `clearEventPressure(trackId: DJTrackId, pitch: number, eventIdx: number): void` — equivalent to `setEventPressure(trackId, pitch, eventIdx, [])`. Provided as a separate action for clarity at the call site.
- `djActionSelection: { trackId: DJTrackId; pitch: number } | null` — the currently-selected DJ action row, surfaced to the Sidebar's Map Note panel and the Inspector's Output panel. Initial value `null`.
- `setDJActionSelection(target: { trackId: DJTrackId; pitch: number } | null): void` — sets or clears the dj-action selection.
- `djEventSelection: { trackId: DJTrackId; pitch: number; eventIdx: number } | null` — the currently-selected DJ action *event*, surfaced to the Inspector's pressure editor. Initial value `null`. Orthogonal to `djActionSelection`; both MAY be set simultaneously (in fact, the typical case for the pressure editor).
- `setDJEventSelection(target: { trackId: DJTrackId; pitch: number; eventIdx: number } | null): void` — sets or clears the dj-event selection.
- `pressureRenderMode: 'curve' | 'step'` — session-level preference for how pressure data renders, both in the editor and in the action-track lane bodies. Default `'curve'`.
- `setPressureRenderMode(mode: 'curve' | 'step'): void` — sets the render mode.

The state SHALL persist across re-renders in `useState` keyed off the `useDJActionTracks` hook (for the track list) and `useStage` itself (for selections and render mode). It SHALL NOT reset on Toolstrip state changes, dialog opens, or any other unrelated state transitions.

#### Scenario: toggleDJTrackMuted flips the muted flag

- **WHEN** `toggleDJTrackMuted('dj1')` is called while `djActionTracks[0].muted === false`
- **THEN** the next render SHALL have `djActionTracks[0].muted === true`
- **AND** other fields on the track SHALL be unchanged

#### Scenario: Unknown id is a no-op for any toggle

- **WHEN** any of the five toggle actions is called with an unknown `id`
- **THEN** `djActionTracks` SHALL be unchanged (referentially equal across renders)
- **AND** no error SHALL be thrown

#### Scenario: setActionEntry adds a new entry

- **WHEN** `setActionEntry('dj1', 72, entry)` is called and `djActionTracks[0].actionMap[72]` was previously `undefined`
- **THEN** the next render SHALL have `djActionTracks[0].actionMap[72]` equal to `entry`
- **AND** the count of keys in `actionMap` SHALL have increased by exactly 1

#### Scenario: setActionEntry replaces an existing entry

- **WHEN** `setActionEntry('dj1', 56, newEntry)` is called and `djActionTracks[0].actionMap[56]` was previously the seeded "Hot Cue 1" entry
- **THEN** the next render SHALL have `djActionTracks[0].actionMap[56]` equal to `newEntry`
- **AND** the count of keys in `actionMap` SHALL be unchanged

#### Scenario: setActionEntry is a no-op for unknown track id

- **WHEN** `setActionEntry('nonexistent', 60, entry)` is called
- **THEN** `djActionTracks` SHALL be unchanged (referentially equal across renders)
- **AND** no error SHALL be thrown

#### Scenario: deleteActionEntry removes the key and prunes derived state

- **WHEN** `deleteActionEntry('dj1', 56)` is called and `actionMap[56]` exists AND `outputMap[56]` is set AND `mutedRows.includes(56) === true`
- **THEN** the next render SHALL have `actionMap[56] === undefined`
- **AND** `outputMap[56] === undefined`
- **AND** `mutedRows.includes(56) === false`

#### Scenario: deleteActionEntry clears djActionSelection when it matches

- **WHEN** `deleteActionEntry('dj1', 56)` is called and `djActionSelection === { trackId: 'dj1', pitch: 56 }`
- **THEN** the next render SHALL have `djActionSelection === null`

#### Scenario: deleteActionEntry also clears djEventSelection when it matches

- **WHEN** `deleteActionEntry('dj1', 56)` is called and `djEventSelection === { trackId: 'dj1', pitch: 56, eventIdx: 2 }`
- **THEN** the next render SHALL have `djEventSelection === null`

#### Scenario: deleteActionEntry leaves djActionSelection unchanged when it does not match

- **WHEN** `deleteActionEntry('dj1', 60)` is called and `djActionSelection === { trackId: 'dj1', pitch: 56 }`
- **THEN** `djActionSelection` SHALL be unchanged

#### Scenario: deleteActionEntry is a no-op for unknown pitch

- **WHEN** `deleteActionEntry('dj1', 99)` is called and `actionMap[99]` was already absent
- **THEN** `djActionTracks` SHALL be unchanged (referentially equal across renders)

#### Scenario: setOutputMapping adds a new entry

- **WHEN** `setOutputMapping('dj1', 56, { device: 'deck2', channel: 3, pitch: 64 })` is called and `outputMap[56]` was previously `undefined`
- **THEN** the next render SHALL have `outputMap[56]` equal to that mapping

#### Scenario: setOutputMapping replaces an existing entry

- **WHEN** `setOutputMapping('dj1', 56, newMapping)` is called and `outputMap[56]` was a different mapping
- **THEN** the next render SHALL have `outputMap[56]` equal to `newMapping`
- **AND** the count of keys in `outputMap` SHALL be unchanged

#### Scenario: setOutputMapping is a no-op for unknown track id

- **WHEN** `setOutputMapping('nonexistent', 56, mapping)` is called
- **THEN** `djActionTracks` SHALL be unchanged (referentially equal across renders)

#### Scenario: deleteOutputMapping removes the key

- **WHEN** `deleteOutputMapping('dj1', 56)` is called and `outputMap[56]` was set
- **THEN** the next render SHALL have `outputMap[56] === undefined`

#### Scenario: deleteOutputMapping is a no-op when pitch is absent

- **WHEN** `deleteOutputMapping('dj1', 56)` is called and `outputMap[56]` was already absent
- **THEN** `djActionTracks` SHALL be unchanged (referentially equal across renders)

#### Scenario: setDJActionSelection opens and closes the selection

- **WHEN** `setDJActionSelection({ trackId: 'dj1', pitch: 56 })` is called while `djActionSelection === null`
- **THEN** the next render SHALL have `djActionSelection === { trackId: 'dj1', pitch: 56 }`
- **WHEN** `setDJActionSelection(null)` is then called
- **THEN** the next render SHALL have `djActionSelection === null`

#### Scenario: setDJEventSelection opens and closes the event selection

- **WHEN** `setDJEventSelection({ trackId: 'dj1', pitch: 56, eventIdx: 2 })` is called while `djEventSelection === null`
- **THEN** the next render SHALL have `djEventSelection === { trackId: 'dj1', pitch: 56, eventIdx: 2 }`
- **WHEN** `setDJEventSelection(null)` is then called
- **THEN** the next render SHALL have `djEventSelection === null`

#### Scenario: setEventPressure writes the points array

- **WHEN** `setEventPressure('dj1', 56, 2, [{ t: 0, v: 0.5 }])` is called and `track.events[2]` exists with `pitch === 56`
- **THEN** the next render SHALL have `track.events[2].pressure` deep-equal `[{ t: 0, v: 0.5 }]`
- **AND** other fields on `track.events[2]` SHALL be unchanged

#### Scenario: setEventPressure is a no-op for out-of-range eventIdx

- **WHEN** `setEventPressure('dj1', 56, 9999, [])` is called and `track.events.length < 9999`
- **THEN** `djActionTracks` SHALL be referentially equal across renders
- **AND** no error SHALL be thrown

#### Scenario: setEventPressure is a no-op when pitch does not match the event

- **WHEN** `setEventPressure('dj1', 60, 2, [])` is called and `track.events[2].pitch === 56` (not 60)
- **THEN** `djActionTracks` SHALL be referentially equal across renders

#### Scenario: clearEventPressure writes an empty array

- **WHEN** `clearEventPressure('dj1', 56, 2)` is called for a valid event
- **THEN** the next render SHALL have `track.events[2].pressure === []`

#### Scenario: pressureRenderMode default and toggle

- **WHEN** the app first renders
- **THEN** `useStage().pressureRenderMode` SHALL be `'curve'`
- **WHEN** `setPressureRenderMode('step')` is called
- **THEN** the next render SHALL have `pressureRenderMode === 'step'`

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

### Requirement: Timeline renders dj-action-tracks below channel groups

The AppShell's timeline body (inside `.mr-timeline__inner`, after the `<Ruler>`) SHALL render channel groups followed by dj-action-tracks, in this order:

1. `<Ruler>` (sticky top).
2. One `<ChannelGroup>` per entry in `stage.visibleChannels`, in numeric ascending order of `Channel.id` (per the `channels` capability — unchanged).
3. One `<DJActionTrack>` per entry in `stage.djActionTracks`, in array order.

Both kinds SHALL share the timeline's horizontal scroll axis. Both kinds SHALL appear in the vertical scroll axis when the timeline overflows.

DJ action tracks SHALL NOT be rendered inside any channel group. They are siblings of channel groups, both direct children of `.mr-timeline__inner`.

#### Scenario: Default session renders both kinds

- **WHEN** the app first renders with the default seed (2 channels with content, 1 dj-action-track)
- **THEN** `.mr-timeline__inner` SHALL contain (in order): one `.mr-ruler`, two `.mr-channel` elements, one `.mr-djtrack` element
- **AND** the `.mr-djtrack` SHALL appear below all `.mr-channel` elements in the DOM

#### Scenario: dj-action-track is not nested in a channel group

- **WHEN** the rendered DOM is inspected
- **THEN** `.mr-channel .mr-djtrack` SHALL match zero elements
- **AND** `.mr-djtrack` SHALL be a direct child of `.mr-timeline__inner`

### Requirement: DJActionTrack rendering respects real-time correctness

The dj-action-tracks capability introduces the heaviest visual surface in the codebase to date: each track lays out one row per pitch in its action map (28 rows for the default seed), and Slice 7b will add per-action-event painting on top. The components in this capability SHALL be implemented in a way that does not foreclose the real-time guarantees documented in `design/real-time-correctness.md`:

- No incoming MIDI message SHALL be dropped, delayed, or timestamp-offset because of a layout/paint triggered by `<DJActionTrack>` mount, expand/collapse, M/S toggle, or any other render path in this capability.
- The eventual audio engine (Slice 10) SHALL be free to capture and emit messages off the React render path; this capability's hooks (`useDJActionTracks`) and components (`<DJActionTrack>`) SHALL NOT introduce patterns that gate MIDI handling on a `setState` cycle.
- See `design/real-time-correctness.md` for the cross-cutting constraint, the rationale, and the implementation patterns to avoid (per-message React re-renders, render-gated playback emit, `Date.now()`-based capture timestamps).

This requirement is forward-looking — the audio engine itself is Slice 10's work. The constraint is recorded here so that visual-only slices (7a, 7b, 8, 9) do not paint the architecture into a corner.

#### Scenario: Component implementation does not gate MIDI on React state

- **WHEN** a code review or static analysis inspects `src/hooks/useDJActionTracks.ts` and `src/components/dj-action-tracks/DJActionTrack.tsx`
- **THEN** there SHALL NOT be any path that processes raw `MIDIMessageEvent` data inside a React render or `useEffect`
- **AND** there SHALL NOT be any code that triggers `setState` on a per-message basis (the audio engine's eventual ring-buffer pattern is the right surface — direct `setState`-per-message is not)

### Requirement: DJActionTrack carries synthetic action events

The `DJActionTrack` data shape SHALL include an `events: ActionEvent[]` field. `ActionEvent` SHALL have the shape:

```ts
interface ActionEvent {
  pitch: number;                // MIDI pitch — must correspond to a key in actionMap to render
  t: number;                    // start time in beats
  dur: number;                  // duration in beats (used for non-trigger rendering modes)
  vel: number;                  // velocity 0..1 (used for velocity-sensitive rendering mode)
  pressure?: PressurePoint[];   // per-event aftertouch curve; absence means "use synthesised default"
}
```

`ActionEvent` SHALL be a superset of `Note` from `src/components/piano-roll/notes.ts` — the additional `pressure` field is optional and does not appear on `Note`. The renderer SHALL treat events as ground-truth — events whose `pitch` is not a key in the containing track's `actionMap` SHALL be filtered out at render time without error.

The `pressure` field has three meaningful states:

- `undefined` — never edited. Renderers (both `ActionRoll` and the Inspector's pressure editor) SHALL compute the visible curve via `synthesizePressure(event)` from `src/data/pressure.ts`.
- `[]` — explicitly cleared. Renderers SHALL draw no pressure data (flat at zero); the editor's summary SHALL report `0 events · peak 0.00 · avg 0.00`.
- non-empty `PressurePoint[]` — stored points. Renderers SHALL rasterise these via `rasterizePressure` and draw the result.

The default seeded track (`id === 'dj1'`) SHALL include an `events` array of length ≥ 10 with deterministic content sufficient to demonstrate all three note-rendering modes (trigger, velocity-sensitive, pressure-bearing). Every event's `pitch` SHALL be a key in the seeded `actionMap`. Seeded events SHALL leave `pressure` unset (i.e. `undefined`) so the synthesised curve continues to render for unedited events.

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

#### Scenario: Seeded events have undefined pressure

- **WHEN** the app first renders
- **THEN** for every entry in `useStage().djActionTracks[0].events`, the `pressure` field SHALL be `undefined`

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
- **pressure-bearing** mode applies when `action.pressure === true`. The note SHALL render as a wider bar (typically `> 30px`) with background `color-mix(in oklab, ${devColor} 85%, transparent)`. The note's interior SHALL render an SVG containing pressure cells; each cell SHALL be a vertical rect representing the pressure value at that horizontal sample. An "AT" badge SHALL render at the top-right of the note element when the note's rendered width exceeds 30px.

Pressure-cell rendering SHALL source values from the event's `pressure` field if defined, OR from `synthesizePressure(event)` if `event.pressure` is `undefined`. The number of rendered cells SHALL match the length of the source curve (14 for the synthesised default; for stored pressure the renderer rasterises via `rasterizePressure(event.pressure, cellCount)` where `cellCount` SHALL be the same value used today, 14, so the visual cadence is unchanged).

When `useStage().pressureRenderMode === 'step'`, the cells SHALL render unchanged. When the mode is `'curve'`, the cells SHALL render unchanged for Slice 9 (a future polyline overlay is deferred). The `.mr-djtrack__note` SHALL carry `data-pressure-mode={pressureRenderMode}` on pressure-bearing notes so future render branches and tests can read the mode from the DOM.

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

### Requirement: Clicking an action row selects it

The `<ActionKeys>` component SHALL register a `pointerdown` (or `click`) handler on each `.mr-actkey` element. When the user activates a row by primary pointer click, the handler SHALL call `useStage().setDJActionSelection({ trackId, pitch })` for that row's pitch and the enclosing track's id.

The handler SHALL NOT fire when the click target is the M/S chip (a child of `.mr-actkey__chip`). Clicks on the M/S chip continue to flow to the chip's own toggle handlers, unchanged.

The handler SHALL also be wired to keyboard activation: pressing `Enter` or `Space` while an `.mr-actkey` has keyboard focus SHALL produce the same effect. The `.mr-actkey` element SHALL be focusable (`tabindex="0"`) to support this.

The `.mr-actkey` element SHALL carry `data-selected="true"` when `djActionSelection.trackId === trackId && djActionSelection.pitch === pitch`, so CSS can render a persistent "this row is the current target" highlight (a tinted accent background with inset accent border). The attribute SHALL be removed when the condition ceases.

#### Scenario: Clicking an action row selects it

- **WHEN** the user clicks the `.mr-actkey` for pitch 56 on the seeded track `dj1`, and `djActionSelection === null`
- **THEN** `setDJActionSelection` SHALL be called once with `{ trackId: 'dj1', pitch: 56 }`
- **AND** the next render SHALL have `djActionSelection === { trackId: 'dj1', pitch: 56 }`
- **AND** the `.mr-actkey` for pitch 56 SHALL carry `data-selected="true"`

#### Scenario: Clicking the M/S chip does not change selection

- **WHEN** the user clicks the M (Mute) button inside an `.mr-actkey__chip`
- **THEN** `setDJActionSelection` SHALL NOT be called
- **AND** `djActionSelection` SHALL be unchanged

#### Scenario: Clicking a different row retargets selection

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 56 }` and the user clicks the `.mr-actkey` for pitch 60
- **THEN** `setDJActionSelection` SHALL be called with `{ trackId: 'dj1', pitch: 60 }`
- **AND** the `.mr-actkey` for pitch 60 SHALL carry `data-selected="true"`
- **AND** the `.mr-actkey` for pitch 56 SHALL NOT carry `data-selected="true"`

#### Scenario: Keyboard activation selects the row

- **WHEN** an `.mr-actkey` has keyboard focus and the user presses `Enter`
- **THEN** `setDJActionSelection` SHALL be called once with that row's `{ trackId, pitch }`

#### Scenario: Action rows are focusable

- **WHEN** any `.mr-actkey` is rendered
- **THEN** the element SHALL carry `tabindex="0"`

### Requirement: Outside-click blurs the selection

While `djActionSelection !== null`, the stage SHALL register a window-level `pointerdown` handler that calls `setDJActionSelection(null)` when the click target is NEITHER inside a `.mr-djtrack` element NOR inside an element marked `[data-mr-dj-selection-region="true"]`. The handler SHALL be detached when the selection becomes `null`, OR when the component unmounts.

Surfaces that should retain the selection on clicks SHALL declare `data-mr-dj-selection-region="true"` on a wrapping element. In Slice 8 the two known regions are:

- The Sidebar's `<InputMappingPanel>` wrapper (the Map Note panel).
- The Inspector's Output action panel wrapper.

#### Scenario: Click outside both regions and outside any DJ track blurs selection

- **WHEN** `djActionSelection !== null` and the user clicks on the ruler element (which is not `.mr-djtrack` and not inside any `[data-mr-dj-selection-region]`)
- **THEN** the next render SHALL have `djActionSelection === null`

#### Scenario: Click inside a DJ track keeps selection

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 56 }` and the user clicks on the DJ track's lane area (inside `.mr-djtrack` but not on an `.mr-actkey`)
- **THEN** `djActionSelection` SHALL be unchanged

#### Scenario: Click inside the Map Note panel keeps selection

- **WHEN** `djActionSelection !== null` and the user clicks on the Sidebar's Map Note panel (inside a `[data-mr-dj-selection-region]`)
- **THEN** `djActionSelection` SHALL be unchanged

#### Scenario: Click inside the Inspector's Output panel keeps selection

- **WHEN** `djActionSelection !== null` and the user clicks the Channel input in the Inspector's Output panel
- **THEN** `djActionSelection` SHALL be unchanged

#### Scenario: Handler is inactive when selection is null

- **WHEN** `djActionSelection === null` and the user clicks anywhere
- **THEN** no `setDJActionSelection` SHALL be called by the outside-click handler

### Requirement: Clicking an action event in ActionRoll selects the event

The `<ActionRoll>` component SHALL register a `pointerdown` (or `click`) handler on each `.mr-djtrack__note` element. When the user activates a note by primary pointer click, the handler SHALL:

1. Call `useStage().setDJEventSelection({ trackId, pitch: event.pitch, eventIdx })`, where `eventIdx` is the index of the event in `track.events`.
2. Call `useStage().setDJActionSelection({ trackId, pitch: event.pitch })` if `djActionSelection` does not already match — so the Output panel opens (or stays open) for the row that contains the event.

The handler SHALL stop event propagation so the click does not also fire the lane's background handlers.

The `.mr-djtrack__note` element SHALL carry `data-selected="true"` when `djEventSelection.trackId === trackId && djEventSelection.pitch === event.pitch && djEventSelection.eventIdx === eventIdx`, so CSS can render a persistent highlight on the selected event. The attribute SHALL be removed when the condition ceases.

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

### Requirement: Clicking outside the DJ track blurs djEventSelection

The existing outside-click handler that clears `djActionSelection` (per the "Outside-click blurs the selection" requirement) SHALL also clear `djEventSelection` under the same predicate: a `pointerdown` whose target is NOT inside any `.mr-djtrack` AND NOT inside any `[data-mr-dj-selection-region="true"]` SHALL set both selections to `null`.

The two selections SHALL be cleared atomically (within the same render cycle); there SHALL NOT be an intermediate render where one is `null` and the other is not.

#### Scenario: Outside click clears both selections

- **WHEN** `djActionSelection !== null` AND `djEventSelection !== null` AND the user clicks the ruler (which is not `.mr-djtrack` and not inside any `[data-mr-dj-selection-region]`)
- **THEN** the next render SHALL have both `djActionSelection === null` AND `djEventSelection === null`

#### Scenario: Click inside the Pressure section keeps both selections

- **WHEN** `djActionSelection !== null` AND `djEventSelection !== null` AND the user clicks inside the Inspector's `.mr-pressure` element (which carries `data-mr-dj-selection-region="true"`)
- **THEN** both selections SHALL be unchanged

