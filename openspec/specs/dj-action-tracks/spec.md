# dj-action-tracks Specification

## Purpose
TBD - created by archiving change dj-mode-shell. Update Purpose after archive.
## Requirements
### Requirement: DJ data tables are exported as typed constants

The codebase SHALL expose a `src/data/dj.ts` module exporting:

- `DJ_CATEGORIES: Record<CategoryId, { label: string }>`. Keys: `'deck' | 'browser' | 'mixer' | 'fx' | 'global'` in that insertion order.
- `DJ_DEVICES: Record<DeviceId, { label: string; short: string; color: string }>` — verbatim. Keys: `'deck1' | 'deck2' | 'deck3' | 'deck4' | 'fx1' | 'fx2' | 'mixer' | 'global'`. Each entry's `color` is an OKLCH string.
- `DEFAULT_ACTION_MAP: Record<number, ActionMapEntry>` — same pitch coverage as today; every entry's `cat` SHALL be one of the five `CategoryId` literals. Former transport/cue/loop/hotcue semantics are represented with `cat: 'deck'` except where noted below. Tap Tempo SHALL use `cat: 'global'`. Load Deck actions (`load_a`, `load_b`) SHALL use `cat: 'browser'` (their `device` remains `mixer` unless a future device split is specified). Continuous mixer controls (crossfader, per-channel volumes, per-channel EQ bands) in `DEFAULT_ACTION_MAP` SHALL remain `cat: 'mixer'` with `pad: true` as today; implementations SHALL pair them with **default output CC numbers** (see `design.md` in change `mixer-dj-cc-messages`) so playback targets CC without per-user configuration in the common case.
- `TriggerMode` type: `'momentary' | 'toggle'`.
- `ActionMapEntry` type: `{ id: string; cat: CategoryId; label: string; short: string; device: DeviceId; pad?: boolean; pressure?: boolean; trigger?: TriggerMode; midiInputCc?: number }`. The optional `midiInputCc` field, when present, SHALL be in the inclusive range `0..127` and SHALL select **incoming Control Change** as the record trigger for this row (see `midi-recording`).
- `OutputMapping` type: `{ device: DeviceId; channel: number; pitch: number; cc?: number }`. `channel` is in the inclusive range `1..16`; `pitch` is in the inclusive range `0..127`. The optional `cc` field, when present, SHALL be in the inclusive range `0..127` and SHALL mean **playback emits Control Change** with that controller number on the resolved MIDI channel instead of note-on/note-off (see `midi-playback`).
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
- **AND** when `cc` is present, it SHALL be an integer in `0..127`

#### Scenario: Category keys match Map Note tabs

- **WHEN** a reader enumerates `Object.keys(DJ_CATEGORIES)` in insertion order
- **THEN** it SHALL yield exactly `deck`, `browser`, `mixer`, `fx`, `global`

#### Scenario: Load Deck templates use browser category

- **WHEN** a reader inspects `DEFAULT_ACTION_MAP` entries whose `id` is `load_a` or `load_b`
- **THEN** each `entry.cat` SHALL be `'browser'`

#### Scenario: Tap Tempo is categorized as global

- **WHEN** a reader inspects the `DEFAULT_ACTION_MAP` entry whose `id` is `tap`
- **THEN** `entry.cat` SHALL be `'global'`

#### Scenario: ActionMapEntry accepts optional incoming CC

- **WHEN** a persisted `ActionMapEntry` includes `midiInputCc: 12`
- **THEN** it SHALL be valid for `useStage().setActionEntry` and SHALL be stored verbatim (clamped to `0..127` on write)
- **AND** record-time matching SHALL prefer this CC binding over note-based matching when both could apply (see `midi-recording`)

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

interface OutputMapping {
  device: string;
  channel: number;
  pitch: number;
  cc?: number;
  out?: 'note' | 'cc' | 'pb';
  midiOutputDeviceId?: string;
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

The `midiChannel` field SHALL be a MIDI channel number in the inclusive range `1..16`. It is the track's intrinsic output channel — the channel byte each event emits on by default during playback, conceptually mirroring how `Channel.id` serves as a channel-roll's intrinsic channel byte. The **DJ demo seeded** track (when `demo=dj` is active at first render) SHALL set `midiChannel: 16`. Per-row `outputMap[pitch].channel` overrides `midiChannel` when present; see the `midi-playback` capability for the resolution rule.

`inputRouting` SHALL declare which incoming MIDI messages feed this track's action map. `outputRouting` SHALL declare the set of channel-roll channels that contribute notes to the track's action map at recording time. Both fields exist on every dj-action-track; their full selector shapes (pitch ranges, CC selectors) are deferred to the routing-configuration slice.

The `actionMap` field SHALL be **the set of input bindings actively configured on this track** — NOT a reference to a catalog of all possible actions. The track's body SHALL render exactly one row per entry in `actionMap`. The catalog of available actions a user can pick from lives in `DEFAULT_ACTION_MAP` (exported from `src/data/dj.ts`), which is a SOURCE for the picker, not a track's actionMap.

The `outputMap` field SHALL hold per-pitch **optional output-mapping overrides**, keyed by the same pitch keys that drive `actionMap`. The **`out` discriminator** SHALL determine which MIDI message family playback emits for events on that row:

| `out` value | Behavior |
|---|---|
| `'note'` | Note-on / note-off using `outputMap[pitch].channel` / `outputMap[pitch].pitch` as overrides; the `cc` field is ignored. |
| `'cc'` | Control Change on `outputMap[pitch].cc` (which MUST be `0..127` for this branch to dispatch); the `pitch` field is persisted for UI/migration but ignored for emit. |
| `'pb'` | Pitch-bend (`0xE_`); the `cc` field is ignored; the `pitch` field is persisted for UI/migration but ignored for emit. |

When `out` is **unset**: legacy data SHALL be interpreted by the `cc` field's presence — `cc !== undefined` means CC out, `cc === undefined` means note out. New writes SHOULD set `out` explicitly; readers SHALL accept both legacy and explicit forms identically.

The `midiOutputDeviceId` field, when present and non-empty, SHALL identify the Web MIDI output port for events on this row (see `midi-playback`). When absent or empty, the track-level `defaultMidiOutputDeviceId` (or the session-wide fallback) applies.

Deleting an action via `deleteActionEntry` SHALL also remove the matching `outputMap` entry. When a DJ demo track is seeded, initial `outputMap` SHALL be `{}`.

The `events` field SHALL be the list of action events associated with this track. In Slice 7b these are synthetic demo events seeded **only when `demo=dj` is enabled** at first render; a future routing slice MAY replace this with events derived from channel-track notes via `inputRouting`. For CC-out and PB-out rows, each `ActionEvent` represents one continuous-value sample: `event.vel` carries the normalized `0..1` value the scheduler expands to a 7-bit CC data byte (`Math.round(vel * 127)`) or a 14-bit pitch-bend value (`Math.round(vel * 16383)`) at emit time.

The `mutedRows` and `soloedRows` fields SHALL track per-row M/S state, exactly as in Slice 7b.

When **`demo=dj` is active** at first render, exactly one seeded track SHALL appear with the subset of `DEFAULT_ACTION_MAP` and synthetic `events` array used before this change (`SEEDED_PITCHES`: six pitches as implemented — 48, 49, 56, 57, 60, 71), deterministic `events` of length ≥ 10 covering all three rendering modes, an empty `outputMap: {}`, and empty `mutedRows: []` / `soloedRows: []`.

When **no** `demo=dj` flag is present at first render, `useDJActionTracks()` SHALL initialize `djActionTracks` to the empty array `[]`.

#### Scenario: Baseline load has no DJ tracks

- **WHEN** the app first renders with no `demo=dj` flag
- **THEN** `useStage().djActionTracks` SHALL be an empty array

#### Scenario: DJ demo seeded track has the expected fields

- **WHEN** the app first renders with `demo=dj` present
- **THEN** `useStage().djActionTracks.length` SHALL be `1`
- **AND** `djActionTracks[0]` SHALL have `id === 'dj1'`
- **AND** `djActionTracks[0].midiChannel` SHALL be `16`
- **AND** `djActionTracks[0].outputMap` SHALL be an empty object
- **AND** `Object.keys(djActionTracks[0].actionMap).length` SHALL equal the implementation's seeded pitch count (`6`)
- **AND** `djActionTracks[0].events.length` SHALL be ≥ 10

#### Scenario: outputMap with out:'cc' emits Control Change

- **WHEN** `outputMap[80]` exists as `{ device: 'mixer', channel: 2, pitch: 80, cc: 7, out: 'cc' }` for a mixer volume row
- **THEN** playback SHALL emit Control Change on CC 7 (not note-on for pitch 80) when that row dispatches, subject to `midi-playback` CC rules

#### Scenario: outputMap with out:'pb' emits Pitch-bend

- **WHEN** `outputMap[80]` exists as `{ device: 'mixer', channel: 2, pitch: 80, out: 'pb' }` for a pitch-bend row
- **THEN** playback SHALL emit Pitch-bend (`0xE_ LSB MSB`) on channel 2 when that row dispatches, subject to the `midi-playback` PB rules
- **AND** the `pitch` field SHALL be persisted but ignored for the wire-level emit

#### Scenario: Legacy outputMap with cc but no out is interpreted as CC out

- **WHEN** `outputMap[80]` exists as `{ device: 'mixer', channel: 2, pitch: 80, cc: 7 }` with no `out` field
- **THEN** playback SHALL emit Control Change on CC 7 (back-compat behavior)
- **AND** the row SHALL be treated as a CC-output row by selection-derived consumers (e.g. the DJ value editor)

### Requirement: Stage exposes dj-action-track state and per-track toggles

The `StageState` interface returned by `useStage()` SHALL expose:

- `djActionTracks: DJActionTrack[]` — the current list of dj-action-tracks. Without `demo=dj` at initial load this array SHALL be empty. With `demo=dj`, it SHALL contain exactly one entry matching the DJ demo seeded data-shape requirement above.
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

#### Scenario: DJ demo exposes one track in Stage state

- **WHEN** `demo=dj` is present at first render
- **THEN** `useStage().djActionTracks.length` SHALL be `1`

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

### Requirement: Timeline renders dj-action-tracks below channel groups

The AppShell's timeline body (inside `.mr-timeline__inner`, after the `<Ruler>`) SHALL render channel groups followed by dj-action-tracks, in this order:

1. `<Ruler>` (sticky top).
2. One `<ChannelGroup>` per entry in `stage.visibleChannels`, in numeric ascending order of `Channel.id` (per the `channels` capability — unchanged).
3. One `<DJActionTrack>` per entry in `stage.djActionTracks`, in array order.

Both kinds SHALL share the timeline's horizontal scroll axis. Both kinds SHALL appear in the vertical scroll axis when the timeline overflows.

DJ action tracks SHALL NOT be rendered inside any channel group. They are siblings of channel groups, both direct children of `.mr-timeline__inner`.

#### Scenario: Baseline session renders channels only

- **WHEN** the app first renders at `/` with an empty DJ list
- **THEN** `.mr-timeline__inner` SHALL contain (in order): one `.mr-ruler`, two `.mr-channel` elements
- **AND** SHALL contain zero `.mr-djtrack` elements

#### Scenario: DJ demo renders one dj-action-track

- **WHEN** the app first renders with `demo=dj` (and baseline channel rows)
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

When `demo=dj` is active, the **`dj1`** track SHALL include an `events` array of length ≥ 10 with deterministic content sufficient to demonstrate all three note-rendering modes (trigger, velocity-sensitive, pressure-bearing). Every event's `pitch` SHALL be a key in that track's seeded `actionMap`. Seeded events SHALL leave `pressure` unset (i.e. `undefined`) so the synthesised curve continues to render for unedited events.

#### Scenario: Events field exists on the seeded DJ demo track

- **WHEN** the app first renders with `demo=dj`
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

- **WHEN** the app first renders with `demo=dj`
- **THEN** for every entry in `useStage().djActionTracks[0].events`, the `pressure` field SHALL be `undefined`

### Requirement: Per-row M/S state on DJActionTrack

The `DJActionTrack` data shape SHALL include two arrays of MIDI pitches representing per-row mute and solo state:

- `mutedRows: number[]` — pitches of rows in this track whose events are muted.
- `soloedRows: number[]` — pitches of rows in this track whose events are soloed.

Membership in `mutedRows` SHALL be local to the track: a row's mute state only affects that row's events within its own track. Membership in `soloedRows` SHALL contribute to the session-wide `soloing` flag.

The **DJ demo** seeded track SHALL initialize both arrays as `[]`.

#### Scenario: DJ demo seeded track has empty row M/S arrays

- **WHEN** the app first renders with `demo=dj`
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

While `djActionSelection !== null`, the stage SHALL register a window-level `pointerdown` handler that calls `setDJActionSelection(null)` when the click target is NONE of the following:

- inside a `.mr-djtrack` element, OR
- inside an element marked `[data-mr-dj-selection-region="true"]`, OR
- inside any of the chrome region roots: `.mr-titlebar`, `.mr-toolstrip`, `.mr-sidebar`, `.mr-inspector`, `.mr-statusbar` (per the app-shell "Chrome regions preserve timeline-domain selections" requirement).

The handler SHALL be detached when the selection becomes `null`, OR when the component unmounts.

Surfaces inside `.mr-timeline` that should retain the selection on clicks SHALL declare `data-mr-dj-selection-region="true"` on a wrapping element. Surfaces inside the chrome regions are exempt by class and do NOT need the data attribute. Known opt-in regions:

- The Sidebar's `<InputMappingPanel>` wrapper (the Map Note panel) — also covered by the `.mr-sidebar` chrome exemption.
- The Inspector's Output action panel wrapper — also covered by the `.mr-inspector` chrome exemption.

#### Scenario: Click outside all regions and outside any DJ track blurs selection

- **WHEN** `djActionSelection !== null` and the user clicks on the ruler element (which is not `.mr-djtrack`, not inside any `[data-mr-dj-selection-region]`, and not inside any chrome region)
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

#### Scenario: Click on the titlebar keeps selection

- **WHEN** `djActionSelection !== null` and the user clicks any element inside `.mr-titlebar`
- **THEN** `djActionSelection` SHALL be unchanged
- **AND** `djEventSelection` SHALL be unchanged

#### Scenario: Click on the toolstrip keeps selection

- **WHEN** `djActionSelection !== null` and the user clicks any element inside `.mr-toolstrip`
- **THEN** `djActionSelection` SHALL be unchanged
- **AND** `djEventSelection` SHALL be unchanged

#### Scenario: Click on the sidebar outside any DJ-selection region keeps selection

- **WHEN** `djActionSelection !== null` and the user clicks inside `.mr-sidebar` on an element that is NOT inside `[data-mr-dj-selection-region]`
- **THEN** `djActionSelection` SHALL be unchanged

#### Scenario: Click on the inspector outside any DJ-selection region keeps selection

- **WHEN** `djActionSelection !== null` and the user clicks inside `.mr-inspector` on an element that is NOT inside `[data-mr-dj-selection-region]`
- **THEN** `djActionSelection` SHALL be unchanged

#### Scenario: Click on the statusbar keeps selection

- **WHEN** `djActionSelection !== null` and the user clicks any element inside `.mr-statusbar`
- **THEN** `djActionSelection` SHALL be unchanged

#### Scenario: Handler is inactive when selection is null

- **WHEN** `djActionSelection === null` and the user clicks anywhere
- **THEN** no `setDJActionSelection` SHALL be called by the outside-click handler

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

### Requirement: Clicking outside the DJ track blurs djEventSelection

The existing outside-click handler that clears `djActionSelection` (per the "Outside-click blurs the selection" requirement) SHALL also clear `djEventSelection` under the same predicate: a `pointerdown` whose target is NOT inside any `.mr-djtrack` AND NOT inside any `[data-mr-dj-selection-region="true"]` SHALL set both selections to `null`.

The two selections SHALL be cleared atomically (within the same render cycle); there SHALL NOT be an intermediate render where one is `null` and the other is not.

#### Scenario: Outside click clears both selections

- **WHEN** `djActionSelection !== null` AND `djEventSelection !== null` AND the user clicks the ruler (which is not `.mr-djtrack` and not inside any `[data-mr-dj-selection-region]`)
- **THEN** the next render SHALL have both `djActionSelection === null` AND `djEventSelection === null`

#### Scenario: Click inside the Pressure section keeps both selections

- **WHEN** `djActionSelection !== null` AND `djEventSelection !== null` AND the user clicks inside the Inspector's `.mr-pressure` element (which carries `data-mr-dj-selection-region="true"`)
- **THEN** both selections SHALL be unchanged

### Requirement: DJActionTrack carries Web MIDI inputSources

Each `DJActionTrack` SHALL include `inputSources: TrackInputListenRow[]` using the same type as `Channel` (defined in `channels` / `track-input-mapping`). Seeded tracks SHALL default to `inputSources: []`.

#### Scenario: Default seed has empty inputSources

- **WHEN** the app loads with the default session
- **THEN** every `DJActionTrack` SHALL have `inputSources` equal to `[]`

### Requirement: Stage exposes DJ input source and event-append actions

`StageState` from `useStage()` SHALL expose:

- `appendDJActionEvent(trackId: DJTrackId, event: ActionEvent): void` — appends `event` to `djActionTracks` entry matching `trackId`. No-op for unknown ids.
- `setDJTrackInputSourceChannels(trackId: DJTrackId, inputDeviceId: string, channels: ChannelId[]): void` — upserts or removes (when empty) a `TrackInputListenRow` on that DJ track. No-op for unknown ids.

#### Scenario: appendDJActionEvent adds to events array

- **GIVEN** track `dj1` exists
- **WHEN** `appendDJActionEvent('dj1', { pitch: 60, t: 0, dur: 0.5, vel: 100 })` is called
- **THEN** `djActionTracks` SHALL contain the new event on that track’s `events` array

#### Scenario: setDJTrackInputSourceChannels updates only the targeted track

- **WHEN** `setDJTrackInputSourceChannels('dj1', 'dev-a', [1])` is called
- **THEN** only `dj1`’s `inputSources` SHALL change

### Requirement: Instrument channel match precedence over DJ match

When a single inbound note would match both an instrument `Channel` `inputSources` row and a `DJActionTrack` `inputSources` row, the recorder SHALL route to the instrument channel unless `design.md` directs otherwise for the current `selectedTimelineTrack` bias.

#### Scenario: Documented precedence is stable

- **WHEN** both an instrument channel and a DJ track list the same `(inputDeviceId, MIDI channel)` pair
- **THEN** the `midi-recording` capability’s note-on requirement SHALL define a single deterministic resolution order

### Requirement: DJ timeline header selection clears row and event mapping selections

`StageState` from `useStage()` SHALL expose `selectDJTimelineTrack(trackId: DJTrackId): void`.

Calling `selectDJTimelineTrack(trackId)` SHALL:

1. Set `selectedTimelineTrack` to `{ kind: 'dj', trackId }`.
2. Set `djActionSelection` to `null`.
3. Set `djEventSelection` to `null`.

The DJ track timeline header click path in `AppShell.tsx` SHALL invoke `selectDJTimelineTrack` for that track’s id (not a raw `setSelectedTimelineTrack` call that omits the clears).

#### Scenario: Header click clears mapping selections but keeps DJ timeline selection

- **GIVEN** `djActionSelection !== null` OR `djEventSelection !== null`
- **WHEN** the user activates the DJ track’s `.mr-djtrack__hdr` (not the chevron) such that `selectDJTimelineTrack('dj1')` runs
- **THEN** the next render SHALL have `selectedTimelineTrack === { kind: 'dj', trackId: 'dj1' }`
- **AND** `djActionSelection === null`
- **AND** `djEventSelection === null`

#### Scenario: Chevron does not invoke timeline selection helper

- **WHEN** the user clicks only `.mr-djtrack__chev-btn` to toggle collapsed state
- **THEN** `selectDJTimelineTrack` SHALL NOT be invoked by that gesture

### Requirement: DJ timeline bodies match shared layout horizon

`ActionRoll` / `.mr-djtrack__body` horizontal footprint SHALL likewise consume `layoutHorizonBeats * pxPerBeat` for grids, overlays, beats, clips, aligning with PianoRoll/param lane surfaces so DJ rows stay phase-locked scrolling with channel groups.

#### Scenario: Mixed channel + DJ timelines share scrollbar phase

- **WHEN** the session renders at least one `.mr-channel` and one `.mr-djtrack` concurrently
- **THEN** horizontally scrolling `.mr-timeline` SHALL slide both stripes so beat `k` aligns across kinds for identical `layoutHorizonBeats`

### Requirement: OutputMapping may specify a Web MIDI output port override

The `OutputMapping` type (see `src/data/dj.ts`) SHALL accept an optional `midiOutputDeviceId?: string` holding a Web MIDI **output** port identifier from the runtime enumeration. When the field is **absent** or empty after normalization, the row SHALL **not** override the track-level default output port. When present and non-empty, DJ playback for events on that row SHALL send MIDI to that port (see `midi-playback`). The `midiOutputDeviceId` field SHALL be orthogonal to the existing logical `device: DeviceId` field used for UI coloring.

#### Scenario: Normalization strips empty override

- **WHEN** `setOutputMapping` receives a mapping whose `midiOutputDeviceId` is `''` or whitespace only
- **THEN** the persisted `outputMap[pitch]` SHALL omit the override (or store it in a canonical “unset” representation equivalent to absent) so the row falls back to the track default port

### Requirement: DJActionTrack carries a default Web MIDI output port id

Each `DJActionTrack` SHALL include `defaultMidiOutputDeviceId: string`. An empty string SHALL mean “no track-level port; use the same global fallback as channel-roll playback” (first enumerated output or existing session default). Seeded demo tracks SHALL initialize this field to `''` unless a capability explicitly sets a fixture.

#### Scenario: Demo DJ track exposes the new field

- **WHEN** the app loads with `demo=dj` and exactly one seeded DJ track
- **THEN** that track’s `defaultMidiOutputDeviceId` property SHALL exist and be a string

### Requirement: Stage exposes DJ default MIDI output mutation

`StageState` from `useStage()` SHALL expose `setDJTrackDefaultMidiOutputDevice(trackId: DJTrackId, deviceId: string): void`, which updates the named track’s `defaultMidiOutputDeviceId`. The call SHALL be a no-op for unknown `trackId`. Values SHALL be stored verbatim after trimming; clamping is not required beyond string normalization chosen in implementation.

#### Scenario: Setter updates track default

- **WHEN** `setDJTrackDefaultMidiOutputDevice('dj1', 'port-b')` is invoked and track `dj1` exists
- **THEN** the next read of `useStage().djActionTracks` SHALL show `defaultMidiOutputDeviceId === 'port-b'` for that track

### Requirement: DJ ActionEvent timing uses integer tTicks and durTicks

Each `ActionEvent` SHALL persist **`tTicks`** and **`durTicks`** as non-negative integers on the session MIDI tick axis at TPQ. Legacy **`t` / `dur` in beats SHALL NOT** remain authoritative after migration.

Merge grouping thresholds that were expressed in beats SHALL be converted to tick thresholds equivalent under TPQ.

#### Scenario: Stored DJ position survives tick round-trip

- **WHEN** an event’s `tTicks` is set to `481` at `TPQ = 480` and `durTicks = 48`
- **THEN** persisted session reload SHALL preserve `tTicks === 481` and `durTicks === 48`

### Requirement: Stage SHALL mutate DJ action event timing with coordinated automation translation

The codebase SHALL expose mutation API(s) reachable via `useStage()` (delegating into `useDJActionTracks` or equivalent) that update the timing of the DJ timeline item identified by `djEventSelection`.

Commits SHALL compute **`deltaTicks`** as the signed integer difference between committed **`tTicks`** and the prior anchor **`tTicks`**.

When the selected item is a **single** `ActionEvent`, a **start-time** commit SHALL set **`tTicks := tTicks + deltaTicks`** and SHALL add **`deltaTicks`** to each embedded automation timestamp stored as ticks (pressure samples).

When the selected item is a **merged CC automation strip**, a **start-time** commit SHALL add **`deltaTicks`** to **`tTicks` on every `ActionEvent` in that cluster**.

The implementation SHALL keep `djEventSelection` valid after the mutation.

#### Scenario: Moving a note-style event translates stored aftertouch points

- **WHEN** `djEventSelection` references an event with non-empty `pressure` arrays keyed by tick time and the user commits **`deltaTicks = 960`**
- **THEN** the event's `tTicks` SHALL increase by exactly `960`
- **AND** each pressure sample tick coordinate SHALL increase by exactly `960`

#### Scenario: Moving a merged CC strip translates every member step

- **WHEN** `djEventSelection.eventIdx` is the representative index of a merged CC cluster with multiple underlying events and the user commits integer **`deltaTicks`**
- **THEN** every member event SHALL have its `tTicks` increased by **`deltaTicks`**

### Requirement: Inspector SHALL show bar-beat-tick fields for selected DJ timeline items

When the Note tab is active AND `djEventSelection !== null` AND the referenced event exists (its `eventIdx` is in range and `track.events[eventIdx].pitch` equals the selected row pitch), the Inspector SHALL render a **two-field tick-native start-time editor** bound to the event's **`tTicks`**:

- a **phrase·bar·beat (BBT)** input whose value decodes and encodes via the same canonical `phrase·bar·beat ↔ tTicks` helpers used for instrument-channel notes (`canonicalPhraseBarBeatFromTicks`, etc.) at the session TPQ;
- an **integer ticks** input bound to raw `tTicks` from session zero.

Both inputs SHALL stay synchronized: a commit on either re-canonicalizes the other from the resulting stored `tTicks`.

The timing controls SHALL live inside `data-mr-dj-selection-region="true"`.

A focus, value change, or commit on either input SHALL NOT clear `djEventSelection` or `djActionSelection`.

#### Scenario: Selected event shows two-field start editor

- **WHEN** `djEventSelection === { trackId, pitch, eventIdx }` and the event exists with `track.events[eventIdx].pitch === pitch`
- **THEN** the Inspector SHALL render two inputs (BBT + integer ticks) reflecting `track.events[eventIdx].tTicks`

#### Scenario: Timing inputs preserve DJ selection on interaction

- **WHEN** `djEventSelection !== null` and the user focuses or edits the BBT or ticks input
- **THEN** the DJ outside-click handler SHALL NOT clear `djEventSelection` or `djActionSelection` solely due to that focus or edit

### Requirement: Stage SHALL mutate DJ action event durTicks with coordinated CC cluster scaling

The codebase SHALL expose a `setDJEventDurTicks(trackId, pitch, eventIdx, nextDurTicks, baseline?)` mutation API reachable via `useStage()` (delegating into `useDJActionTracks`) that updates the **duration** of the DJ timeline item identified by `djEventSelection`.

The committed value SHALL be clamped to a minimum of `1` tick (`max(1, round(nextDurTicks))`).

**Single event (non-cluster, or a cluster member that is NOT the cluster representative).** The mutator SHALL set the referenced event's `durTicks` to the clamped value and leave all other events unchanged. Pressure samples on the event SHALL NOT be re-translated because `PressurePoint.t` is normalized to `[0,1]` of the event's duration (see `src/data/dj.ts`) and therefore survives `durTicks` changes by construction.

**Cluster representative (CC merged group with ≥ 2 members).** When `eventIdx` is the `representativeIdx` of a `CcMergedGroup` (per `buildCcMergedGroupsByMemberIndex`), the mutator SHALL treat `nextDurTicks` as the **new total span of the cluster** (`newSpanTicks`). The first member's start (`t0Ticks = representative.tTicks`) SHALL be unchanged.

The mutator SHALL accept an optional `baseline` argument shaped:

```
ClusterResizeBaseline = {
  memberTTicks: ReadonlyMap<number /* eventIdx */, number /* tTicks at baseline */>,
  spanTicks: number,            // max(member.tTicks + member.durTicks) - t0Ticks at baseline
  trailingIdx: number,          // event index of the trailing member at baseline time
  trailingDurTicks: number,     // trailing member's durTicks at baseline time
}
```

**Baseline-relative scaling (when `baseline` is provided).** For each member with index `idx` in the cluster, the mutator SHALL set `newTTicks = t0Ticks + round((baseline.memberTTicks.get(idx) - t0Ticks) * scale)`, where `scale = newSpanTicks / baseline.spanTicks`. The trailing member SHALL be `baseline.trailingIdx` (the trailing member SHALL NOT change identity across the edit session). The trailing member's `newDurTicks` SHALL equal `max(1, t0Ticks + newSpanTicks - newTTicks_trailing)`. Non-trailing members' `durTicks` SHALL be unchanged.

**Fallback scaling (when `baseline` is omitted or empty).** The mutator SHALL fall back to the previous behavior: `scale = newSpanTicks / oldSpanTicks` where `oldSpanTicks = max(member.tTicks + member.durTicks) − t0Ticks` from the pre-mutation cluster; member offsets are rounded from current `tTicks`; trailing member is the pre-mutation member with the largest `tTicks + durTicks`; trailing `durTicks` is recomputed so cluster end equals `t0Ticks + newSpanTicks`.

**Round-trip invariant.** When `baseline` is provided and `newSpanTicks === baseline.spanTicks`, the mutator SHALL produce member `tTicks` and `durTicks` values identical to the baseline (modulo `t0Ticks`, which remains the representative's current `tTicks`). This SHALL hold regardless of how many intermediate commits with smaller or larger `newSpanTicks` have occurred during the same edit session.

The mutator SHALL be a no-op (returns the input reference) for unknown track ids, out-of-range `eventIdx`, `pitch` mismatches, or when the clamped `nextDurTicks` equals the referenced event's current `durTicks` (single-event case) or equals the active cluster span (cluster representative case: `oldSpanTicks` when no baseline, `baseline.spanTicks` when baseline is provided AND every member's current `tTicks`/`durTicks` already match the baseline-projected values for that span).

The mutator SHALL NOT change any event's `tTicks` in the single-event case. In the cluster-representative case it MAY change non-representative members' `tTicks` (via offset rounding) but the representative member's `tTicks` SHALL remain at `t0Ticks`.

The implementation SHALL keep `djEventSelection` valid after the mutation.

**Inspector baseline lifecycle.** The Inspector SHALL capture a `ClusterResizeBaseline` for the active DJ event selection when (a) the selection points to a cluster representative AND (b) no baseline currently exists for that `(trackId, pitch, eventIdx)`. The Inspector SHALL pass that baseline as the fifth argument on every `setDJEventDurTicks` call from its length editors (`lengthBeatsDraft`, `lengthTicksDraft`, `endBbtDraft`, `endTicksDraft`). The Inspector SHALL clear the baseline when `djEventSelection` changes to a different `(trackId, pitch, eventIdx)`, when `djEventSelection` becomes null, or when the cluster's member set differs from the baseline's `memberTTicks` keys.

#### Scenario: Single event durTicks update changes only the targeted event

- **WHEN** `djEventSelection` references a single (non-clustered) event with `durTicks = 240` and the user commits `nextDurTicks = 480`
- **THEN** that event's `durTicks` SHALL equal `480`
- **AND** that event's `tTicks` SHALL be unchanged
- **AND** no other event SHALL be modified
- **AND** any `pressure` samples on the event SHALL retain their original normalized `t` values

#### Scenario: Single event durTicks clamps to minimum 1 tick

- **WHEN** the user commits `nextDurTicks = 0` (or any negative value) for a single event
- **THEN** that event's `durTicks` SHALL equal `1`

#### Scenario: Cluster representative durTicks scales member offsets and trailing member (baseline-relative)

- **WHEN** `djEventSelection.eventIdx` is the `representativeIdx` of a merged CC cluster with members at offsets `[0, 120, 240]` from `t0Ticks` and trailing-member `durTicks = 60`, giving baseline `spanTicks = 300`, and the user commits `nextDurTicks = 600` with a baseline captured from that state (so `scale = 2`)
- **THEN** members SHALL move to offsets `[0, 240, 480]` (each rounded to the nearest tick) so their new `tTicks` are `[t0Ticks, t0Ticks+240, t0Ticks+480]`
- **AND** the representative member's `tTicks` SHALL remain at `t0Ticks`
- **AND** the trailing member's `durTicks` SHALL be adjusted so its end (`tTicks + durTicks`) equals `t0Ticks + 600`
- **AND** non-trailing members' `durTicks` SHALL be unchanged

#### Scenario: Cluster representative durTicks clamps to minimum 1 tick

- **WHEN** `djEventSelection.eventIdx` is a cluster representative and the user commits `nextDurTicks = 0`
- **THEN** `newSpanTicks` SHALL equal `1`
- **AND** the trailing member's end SHALL equal `t0Ticks + 1`

#### Scenario: Non-representative cluster member durTicks update is single-event semantics

- **WHEN** `djEventSelection.eventIdx` is a member of a CC cluster but NOT the cluster representative, and the user commits a new `durTicks`
- **THEN** only that member's `durTicks` SHALL be set (no cluster-wide scaling)
- **AND** all other members SHALL be unchanged

#### Scenario: No-op when committed value equals current

- **WHEN** the user commits `nextDurTicks` equal to the current `durTicks` (single event) or equal to the active cluster span (cluster representative)
- **THEN** the mutator SHALL return the input `tracks` reference unchanged

#### Scenario: No-op for invalid selection

- **WHEN** `eventIdx` is out of range OR `track.events[eventIdx].pitch !== pitch` OR no track has the given `trackId`
- **THEN** the mutator SHALL return the input `tracks` reference unchanged

#### Scenario: Cluster span round-trip restores original member positions exactly

- **WHEN** a cluster representative is selected with members at baseline offsets `[0, 73, 211]` and baseline `spanTicks = 240`, and the user commits in sequence: `nextDurTicks = 80` (shrink, `scale = 1/3`), then `nextDurTicks = 30`, then `nextDurTicks = 240` (back to baseline) — all with the same baseline passed through
- **THEN** after the final commit, member offsets SHALL equal `[0, 73, 211]` exactly
- **AND** the trailing member's `durTicks` SHALL equal its baseline `trailingDurTicks`
- **AND** non-trailing members' `durTicks` SHALL be unchanged from baseline

#### Scenario: Baseline-relative scaling bounds per-commit rounding error to <= 0.5 tick

- **WHEN** a baseline cluster has a member at offset `73` and the user commits `nextDurTicks = 100` against `baseline.spanTicks = 240` (so `scale = 100/240 ~= 0.4167`)
- **THEN** that member's new offset SHALL be `round(73 * 0.4167) = 30`
- **AND** the absolute error from the unrounded target (`30.42`) SHALL be <= `0.5` tick
- **AND** a subsequent commit with `nextDurTicks = 240` SHALL restore that member to offset `73`

#### Scenario: Fallback scaling (no baseline) preserves prior behavior

- **WHEN** `setDJEventDurTicks` is called with `baseline` omitted (or `undefined`) for a cluster representative with current member offsets `[0, 120, 240]` and `oldSpanTicks = 300`, committing `nextDurTicks = 600`
- **THEN** the mutator SHALL scale from the current state: new offsets `[0, 240, 480]`, trailing dur recomputed so end equals `t0Ticks + 600`
- **AND** repeated round-trip commits without a baseline MAY drift (this is the legacy behavior; callers SHOULD pass a baseline to avoid drift)

#### Scenario: Inspector captures baseline on cluster selection and clears on selection change

- **WHEN** `djEventSelection` becomes `(trackId=T, pitch=P, eventIdx=R)` where `R` is a cluster representative and the Inspector has no baseline for `(T,P,R)`
- **THEN** the Inspector SHALL capture a baseline holding the current `memberTTicks`, `spanTicks`, `trailingIdx`, and `trailingDurTicks`
- **AND** all subsequent `setDJEventDurTicks` calls from the Inspector's length editors while `(T,P,R)` remains the active selection SHALL pass that captured baseline
- **WHEN** `djEventSelection` changes to a different `(trackId, pitch, eventIdx)` OR becomes `null`
- **THEN** the Inspector SHALL clear the baseline
- **AND** re-selecting `(T,P,R)` after the cluster's `memberIndices` set has changed SHALL capture a fresh baseline (not reuse the cleared one)

### Requirement: ActionRoll drag-to-move honors snapAbsoluteOn

The `ActionRoll` component SHALL accept an optional prop `snapAbsoluteOn?: boolean` (defaulting to `false` when omitted). The existing drag-to-move gesture (added by `timeline-drag-move-items`) for `.mr-djtrack__note` (all variants) and `.mr-djtrack__cc` SHALL branch its preview-tick computation on this flag:

- **When `snapAbsoluteOn === true` AND transport `quantizeOn === true`** (absolute-snap mode):
  - For a single event: `finalTick = max(0, round((tick0 + deltaTicksRaw) / snap) * snap)` where `deltaTicksRaw = round(deltaPx / pxPerTick)` and `snap = quantizeGridToTicks(transport.quantizeGrid)`.
  - For a CC group: only the **earliest member** SHALL align to the grid. Compute `earliestFinal = max(0, round((earliestTTicks + deltaTicksRaw) / snap) * snap)`. Set `groupDeltaTicks = earliestFinal - earliestTTicks`. Every member's final tick SHALL be `max(0, originalMemberTTicks + groupDeltaTicks)`. Members other than the earliest SHALL NOT be snapped to the grid independently — relative spacing inside the group SHALL be preserved.
- **Otherwise** (either flag off — delta-snap mode, the default from `timeline-drag-move-items`):
  - The gesture SHALL behave exactly as specified by `timeline-drag-move-items` (delta-snap math for single events; `groupDeltaTicks = snapped delta` applied uniformly to all members for CC groups, also clamped so the earliest member stays at or above 0).

When `quantizeOn === false`, `snapAbsoluteOn` SHALL have no effect on the gesture's behavior.

When `snapAbsoluteOn` is omitted or `false`, the gesture SHALL behave exactly as specified by `timeline-drag-move-items`.

The branching SHALL apply to both the live preview and the values dispatched via `setDJEventTTicks` on `pointerup`.

Orchestration code outside `ActionRoll` SHALL surface `useTransport().snapAbsoluteOn` to the prop wherever `quantizeOn` / `quantizeGrid` are also passed.

#### Scenario: Absolute mode realigns an off-grid single event

- **WHEN** the transport reports `quantizeOn: true`, `quantizeGrid: '1/16'` (snap=120), `snapAbsoluteOn: true`, and the user drags a trigger event from `tTicks=154` by 22 px to the right and releases
- **THEN** `deltaTicksRaw = 120`, `finalTick = round((154 + 120) / 120) * 120 = 240`
- **AND** `setDJEventTTicks` SHALL be called exactly once with `nextTTicks === 240`

#### Scenario: Absolute mode realigns a CC group by its earliest member

- **WHEN** a CC group has members at ticks `[154, 214, 274]` (earliest off-grid by 34), the transport reports `quantizeOn: true`, `quantizeGrid: '1/16'` (snap=120), `snapAbsoluteOn: true`, and the user drags the representative `.mr-djtrack__cc` by `deltaTicksRaw = 120` and releases
- **THEN** `earliestFinal = round((154 + 120) / 120) * 120 = 240`, `groupDeltaTicks = 240 - 154 = 86`
- **AND** `setDJEventTTicks` SHALL be called exactly three times — once per member — with `nextTTicks` values `240`, `300`, and `360` respectively (`originalTTicks + 86`)
- **AND** the group's internal spacing (60-tick gaps) SHALL be preserved
- **AND** only the earliest member SHALL land on the grid; the other members SHALL retain their off-grid offsets from the earliest

#### Scenario: Delta mode preserves off-grid offsets (regression guard)

- **WHEN** the same CC group `[154, 214, 274]` is dragged with `quantizeOn: true`, `quantizeGrid: '1/16'`, `snapAbsoluteOn: false`, by `deltaTicksRaw = 120`
- **THEN** `groupDeltaTicks = round(120 / 120) * 120 = 120` and `setDJEventTTicks` SHALL be called with `nextTTicks` values `274`, `334`, and `394` respectively (matches `timeline-drag-move-items` delta-snap behavior — earliest stays off-grid)

#### Scenario: Absolute mode with on-grid start equals delta mode for single events

- **WHEN** the transport reports `quantizeOn: true`, `quantizeGrid: '1/16'`, and the user drags an event from `tTicks=0` by 27 px and releases
- **THEN** with `snapAbsoluteOn: true`, `setDJEventTTicks` SHALL be called with `nextTTicks === 120`
- **AND** with `snapAbsoluteOn: false`, `setDJEventTTicks` SHALL also be called with `nextTTicks === 120`

#### Scenario: snapAbsoluteOn has no effect when quantize is off

- **WHEN** the transport reports `quantizeOn: false`, `snapAbsoluteOn: true`, and the user drags a single event from `tTicks=154` by 100 px and releases
- **THEN** `setDJEventTTicks` SHALL be called exactly once with `nextTTicks === 154 + round(100 / pxPerTick)` (raw pixel-converted delta, no snapping — identical to `snapAbsoluteOn: false` under `quantizeOn: false`)

#### Scenario: Absolute mode clamps CC group earliest to non-negative

- **WHEN** a CC group has members at ticks `[60, 120]`, the transport reports `quantizeOn: true`, `quantizeGrid: '1/16'`, `snapAbsoluteOn: true`, and the user drags the representative by a deltaPx that yields `deltaTicksRaw = -1000`
- **THEN** `earliestFinal = max(0, round((60 - 1000)/120) * 120) = 0`, `groupDeltaTicks = -60`
- **AND** `setDJEventTTicks` SHALL be called with `nextTTicks` values `0` and `60` respectively
- **AND** no member SHALL receive a negative `nextTTicks`

#### Scenario: Absolute mode commits exactly once per gesture (single events)

- **WHEN** the user performs a multi-`pointermove` drag of a single event with `snapAbsoluteOn: true` and `quantizeOn: true`, then releases
- **THEN** `setDJEventTTicks` SHALL be invoked exactly once on `pointerup`

#### Scenario: Absolute mode commits exactly once per member for CC groups

- **WHEN** the user performs a multi-`pointermove` drag of a CC group with N members, `snapAbsoluteOn: true` and `quantizeOn: true`, then releases
- **THEN** `setDJEventTTicks` SHALL be invoked exactly N times on `pointerup` (once per member), all with the same `groupDeltaTicks`

