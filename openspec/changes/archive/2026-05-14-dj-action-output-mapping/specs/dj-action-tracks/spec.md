## ADDED Requirements

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
