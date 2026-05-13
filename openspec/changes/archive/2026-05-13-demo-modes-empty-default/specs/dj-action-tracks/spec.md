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

The `outputMap` field SHALL hold per-pitch **optional output-mapping overrides**, keyed by the same pitch keys that drive `actionMap`. When `outputMap[pitch]` is present, its `channel` and `pitch` override `track.midiChannel` and the event's row pitch for emission, respectively. When absent, the event emits with `track.midiChannel` as the channel and the event's own `pitch` as the output pitch. Deleting an action via `deleteActionEntry` SHALL also remove the matching `outputMap` entry. When a DJ demo track is seeded, initial `outputMap` SHALL be `{}`.

The `events` field SHALL be the list of action events associated with this track. In Slice 7b these are synthetic demo events seeded **only when `demo=dj` is enabled** at first render; a future routing slice MAY replace this with events derived from channel-track notes via `inputRouting`.

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
- **AND** `Object.keys(djActionTracks[0].actionMap).length` SHALL equal the implementation’s seeded pitch count (`6`)
- **AND** `djActionTracks[0].events.length` SHALL be ≥ 10

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
