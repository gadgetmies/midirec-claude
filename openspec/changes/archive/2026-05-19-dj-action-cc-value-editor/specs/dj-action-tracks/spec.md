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
