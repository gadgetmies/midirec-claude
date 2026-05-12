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
