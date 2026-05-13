## ADDED Requirements

(none)

## MODIFIED Requirements

### Requirement: DJ data tables are exported as typed constants

The codebase SHALL expose a `src/data/dj.ts` module exporting:

- `DJ_CATEGORIES: Record<CategoryId, { label: string }>`. Keys: `'deck' | 'mixer' | 'fx' | 'global'`.
- `DJ_DEVICES: Record<DeviceId, { label: string; short: string; color: string }>` — verbatim. Keys: `'deck1' | 'deck2' | 'deck3' | 'deck4' | 'fx1' | 'fx2' | 'mixer' | 'global'`. Each entry's `color` is an OKLCH string.
- `DEFAULT_ACTION_MAP: Record<number, ActionMapEntry>` — same pitch coverage as today; every entry's `cat` SHALL be one of the four `CategoryId` literals. Former transport/cue/loop/hotcue semantics are represented with `cat: 'deck'` except where noted below. Tap Tempo SHALL use `cat: 'global'`. Load Deck actions (`load_a`, `load_b`) SHALL use `cat: 'mixer'`. Continuous mixer controls (crossfader, per-channel volumes, per-channel EQ bands) in `DEFAULT_ACTION_MAP` SHALL remain `cat: 'mixer'` with `pad: true` as today; implementations SHALL pair them with **default output CC numbers** (see `design.md` in change `mixer-dj-cc-messages`) so playback targets CC without per-user configuration in the common case.
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

#### Scenario: Category keys are the four Map Note tabs

- **WHEN** a reader enumerates `Object.keys(DJ_CATEGORIES)` in insertion order
- **THEN** it SHALL yield exactly `deck`, `mixer`, `fx`, `global`

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

The `outputMap` field SHALL hold per-pitch **optional output-mapping overrides**, keyed by the same pitch keys that drive `actionMap`. When `outputMap[pitch]` is present and **`cc` is absent or `undefined`**, its `channel` and `pitch` override `track.midiChannel` and the event's row pitch for note-on/note-off emission, respectively. When `outputMap[pitch].cc` is present (`0..127`), playback SHALL emit **Control Change** messages on that CC number on the resolved output channel per `midi-playback`; the `pitch` field remains persisted for UI and migration. When `outputMap[pitch]` is absent, the event emits with `track.midiChannel` as the channel and the event's own `pitch` as the output pitch for note mode. Deleting an action via `deleteActionEntry` SHALL also remove the matching `outputMap` entry. When a DJ demo track is seeded, initial `outputMap` SHALL be `{}`.

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

#### Scenario: outputMap with cc overrides note output per midi-playback

- **WHEN** `outputMap[80]` exists as `{ device: 'mixer', channel: 2, pitch: 80, cc: 7 }` for a mixer volume row
- **THEN** playback SHALL emit Control Change on CC 7 (not note-on for pitch 80) when that row dispatches, subject to `midi-playback` CC rules

## REMOVED Requirements

(none)
