## ADDED Requirements

### Requirement: Track input listen row shape

The `track-input-mapping` capability SHALL define a `TrackInputListenRow` record: `{ inputDeviceId: string; channels: ChannelId[] }` where `inputDeviceId` SHALL be the Web MIDI `MIDIInput.id` string exposed by `useMidiInputs()`, and `channels` SHALL be an ordered or unordered subset of internal channel ids `1..16` interpreted as **MIDI wire channels 1–16** (i.e. MIDI channel nibble `0` maps to `1`). Duplicate entries in `channels` SHALL NOT be persisted; implementations SHALL normalize to unique values.

#### Scenario: Row references a single device and subset of channels

- **WHEN** the user enables device `id-A` and ticks MIDI channels 1, 3, and 10 in the panel
- **THEN** the stored row SHALL be `{ inputDeviceId: 'id-A', channels: [1, 3, 10] }` (order MAY be sorted)

### Requirement: Timeline track selection drives the mapping panel

`useStage()` SHALL expose `selectedTimelineTrack: { kind: 'channel'; channelId: ChannelId } | { kind: 'dj'; trackId: string } | null` and a setter `setSelectedTimelineTrack(...)`. Clicking an instrument **channel header** or **channel track header** (piano-roll header, not a note in the body) SHALL set `{ kind: 'channel', channelId }`. Clicking a **DJ action track header** (the `.mr-djtrack` header region, not an action row key) SHALL set `{ kind: 'dj', trackId }`.

#### Scenario: Selecting an instrument updates timeline selection

- **WHEN** the user clicks the channel header for channel `5`
- **THEN** `selectedTimelineTrack` SHALL equal `{ kind: 'channel', channelId: 5 }`

#### Scenario: Selecting a DJ track updates timeline selection

- **WHEN** the user clicks the DJ track header for track id `'dj-1'`
- **THEN** `selectedTimelineTrack` SHALL equal `{ kind: 'dj', trackId: 'dj-1' }`

### Requirement: Sidebar track input mapping panel

The codebase SHALL render `TrackInputMappingPanel` inside `Sidebar.tsx` (same Sidebar region as other panels). The panel SHALL appear **below** `MidiPermissionBanner` and **above** the existing `InputMappingPanel` slot. When `selectedTimelineTrack === null`, the panel body SHALL show a short hint (e.g. “Select a track in the timeline to configure MIDI input”). When non-null, the body SHALL list every `MidiDevice` from `useMidiInputs().inputs` with a device-level toggle or checkbox; when a device is enabled for listening, the panel SHALL render **sixteen** channel toggles (labels `CH 1` … `CH 16`) scoped to that device row only. Multiple devices MAY be enabled simultaneously; channel selections for device A SHALL NOT change when the user edits device B.

#### Scenario: Panel hidden state copy

- **WHEN** `selectedTimelineTrack === null`
- **THEN** the panel SHALL NOT crash and SHALL show the empty-selection hint

#### Scenario: Per-device channel toggles are independent

- **GIVEN** device A has channel 1 selected
- **WHEN** the user enables channel 2 only on device B
- **THEN** device A’s stored channels SHALL remain `[1]`
- **AND** device B’s stored channels SHALL be `[2]`

### Requirement: Instrument track persists input sources

Each `Channel` SHALL carry `inputSources: TrackInputListenRow[]` owned by `useChannels` / `useStage`. The sidebar panel SHALL read and write the array for `selectedTimelineTrack.kind === 'channel'` via dedicated actions: `setChannelInputSourceChannels(channelId, inputDeviceId, channels)`, `addChannelInputDevice(channelId, inputDeviceId)` (optional helper), and `removeChannelInputDevice(channelId, inputDeviceId)`.

#### Scenario: Persisted rows survive channel re-render

- **WHEN** the user configures two listen rows on channel `3` and the stage re-renders
- **THEN** `channels` state for channel `3` SHALL still contain exactly those two rows

### Requirement: DJ action track persists input sources

Each `DJActionTrack` SHALL carry `inputSources: TrackInputListenRow[]` with the same shape as instrument channels. The sidebar panel SHALL bind to the DJ track when `selectedTimelineTrack.kind === 'dj'` using parallel setter actions on the DJ tracks slice.

#### Scenario: DJ track stores sources independently from channels

- **GIVEN** channel `1` has device A / CH 1 selected
- **WHEN** the user selects a DJ track and assigns device B / CH 2 only
- **THEN** channel `1`’s `inputSources` SHALL be unchanged
- **AND** the DJ track’s `inputSources` SHALL reflect device B / CH 2
