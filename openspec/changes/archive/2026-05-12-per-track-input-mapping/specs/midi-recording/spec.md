## MODIFIED Requirements

### Requirement: MidiRecorder hook orchestrates capture lifecycle

The codebase SHALL expose a `useMidiRecorder()` React hook in `src/midi/recorder.ts`. The hook SHALL be mounted exactly once at the app root via a small `<MidiRecorderRunner />` wrapper component (that calls the hook and returns `null`). The runner SHALL be placed inside the provider tree where it has access to `useTransport()`, `useStage()`, `useMidiRuntime()` and `useMidiInputs()` (from `midi-runtime`).

The recorder SHALL read `useStage().selectedTimelineTrack` and every `Channel` and `DJActionTrack` `inputSources` row to determine which `MIDIInput` ports subscribe during recording and how inbound events route. When **no** `inputSources` row in the session has a non-empty `channels` array, the recorder SHALL fall back to the de facto single input `useMidiInputs().inputs[0]`, matching prior behavior.

The hook SHALL NOT return any value (or SHALL return `void`/`null`). Its responsibility is the side effect: subscribing to inbound MIDI messages and dispatching captured notes.

#### Scenario: Recorder mounts once and reads required hooks

- **WHEN** the app is rendered
- **THEN** the rendered tree SHALL contain exactly one `<MidiRecorderRunner />` instance
- **AND** that component SHALL render `null`
- **AND** the hook it invokes SHALL read `useTransport()`, `useStage()`, `useMidiRuntime()`, and `useMidiInputs()`

### Requirement: Listener attaches only while recording with an available input

The recorder hook SHALL install `onmidimessage` handlers on one or more `MIDIInput` ports while all of the following are true:

- `useTransport().recording === true`
- `useMidiInputs().status === 'granted'`
- The current `MIDIAccess` resolves every targeted port id

Let `S` be the set of `inputDeviceId` values taken from every `TrackInputListenRow` on every `Channel` and `DJActionTrack` where `row.channels.length > 0`. If `S` is non-empty, the recorder SHALL install handlers on each `access.inputs.get(id)` that exists for `id ∈ S`. If `S` is empty, the recorder SHALL install a handler on `useMidiInputs().inputs[0]` only when `useMidiInputs().inputs.length > 0`, matching the prior single-input behavior.

When any guard becomes false, every recorder-installed handler SHALL be detached. When the union set `S` changes (user edits mapping, hotplug changes available ids), the recorder SHALL detach from ports no longer targeted and attach to newly targeted ports in the same effect cycle.

When installing on a port, the recorder SHALL capture any previously-installed `onmidimessage` handler (`const prev = input.onmidimessage`) and SHALL call it (via `prev?.call(input, event)`) at the top of its own handler. On cleanup, the recorder SHALL restore `input.onmidimessage = prev`.

#### Scenario: No listener when recording is off

- **WHEN** `useTransport().recording === false`
- **THEN** no `MIDIInput` in `access.inputs` SHALL have an `onmidimessage` handler installed by the recorder

#### Scenario: No listener when no input is available and fallback applies

- **WHEN** `useTransport().recording === true` AND `useMidiInputs().inputs.length === 0` AND the session has no configured `inputSources` with non-empty `channels`
- **THEN** no `MIDIInput` SHALL have a recorder-installed `onmidimessage` handler

#### Scenario: Listeners installed on union of configured devices

- **GIVEN** `recording === true` and channel `2` lists `inputSources: [{ inputDeviceId: 'a', channels: [1] }, { inputDeviceId: 'b', channels: [2] }]`
- **WHEN** both `access.inputs.get('a')` and `access.inputs.get('b')` exist
- **THEN** both ports SHALL have the recorder handler installed

### Requirement: Note-on opens an active-note entry

When the listener receives a `MIDIMessageEvent` whose first data byte has status nibble `0x9` (`0x90..0x9F`) and the second data byte (velocity) is `> 0`, the recorder SHALL:

1. Read `midiChannel = status0 & 0x0F`, `pitch = event.data[1]` and `velocity = event.data[2]`, and `portId` from the MIDI input port id for this event.
2. Compute `channelId` for piano-roll capture:
   - If the event matches the `track-input-mapping` capability’s DJ capture path (see `dj-action-tracks` delta), the recorder SHALL follow that path and SHALL NOT open a piano-roll active-note entry for this event.
   - Else, if exactly one instrument `Channel` carries an `inputSources` row with `inputDeviceId === portId` and `(midiChannel + 1) ∈ row.channels`, set `channelId` to that `Channel.id`.
   - Else set `channelId = midiChannel + 1` (legacy routing).
3. Ensure the session contains a `Channel` with `id === channelId` (calling `useStage().addChannel(channelId)` if missing) before continuing when recording for piano-roll capture.
4. Open an entry in an internal active-note map keyed by the composite `(portId, midiChannel, pitch)` (implementation MAY stringify), with value `{ startedAt: performance.now(), vel: velocity, channelId }`.
5. NOT dispatch any state action yet (no `appendNote` until the note-off).

If an active-note entry already exists for the same key, the existing entry SHALL be overwritten — the prior note-on is dropped (no note is appended for it). This documents the re-trigger-without-release case.

#### Scenario: Note-on with velocity opens an active-note entry

- **WHEN** the listener receives `event.data = [0x90, 60, 100]` (note-on, MIDI channel 0, pitch 60, vel 100)
- **THEN** the active-note map SHALL contain an entry for the key including `(midiChannel 0, pitch 60)` with `vel === 100`
- **AND** no `appendNote` action SHALL be dispatched on this event

#### Scenario: Channel byte routes to matching internal channel when no per-track row matches

- **GIVEN** channel 6 exists in the session and no `inputSources` row matches the event’s `(portId, midiChannel)`
- **WHEN** the listener receives `event.data = [0x95, 64, 90]` (note-on on MIDI channel 5)
- **AND** later `event.data = [0x85, 64, 0]` (note-off on MIDI channel 5)
- **THEN** the resulting `appendNote` dispatch SHALL target `channelId === 6`

#### Scenario: Per-track input row overrides wire channel to an instrument channel

- **GIVEN** channel `9` exists and lists `inputSources: [{ inputDeviceId: 'kbd', channels: [1] }]`
- **WHEN** a note-on arrives from port `kbd` with MIDI channel nibble `0` and pitch `60`
- **THEN** the active-note entry SHALL use `channelId === 9`

#### Scenario: Note-on with velocity zero is treated as note-off

- **WHEN** the listener receives `event.data = [0x90, 60, 0]` while an active-note entry for the same composite key exists
- **THEN** the recorder SHALL treat this as a note-off and finalize the entry per the note-off requirement

#### Scenario: Re-trigger without release drops the earlier note

- **GIVEN** the active-note map has an entry for a given composite key from an earlier note-on
- **WHEN** a second note-on for the same key arrives before any note-off
- **THEN** the active-note map’s entry for that key SHALL reflect the new note-on’s `startedAt` and `vel`
- **AND** no `appendNote` SHALL be dispatched for the dropped earlier note

#### Scenario: Simultaneous pitch on two MIDI channels does not collide

- **GIVEN** channels 1 and 2 exist in the session
- **WHEN** the listener receives `event.data = [0x90, 60, 100]` then `event.data = [0x91, 60, 110]` before either note-off on the same port
- **THEN** the active-note map SHALL hold distinct entries for those two composite keys

### Requirement: Note-off finalizes the entry and queues an appendNote dispatch

The recorder SHALL recognize note-off events as either an explicit note-off status nibble `0x8` (`0x80..0x8F`) or a note-on status nibble `0x9` (`0x90..0x9F`) with velocity `0` (the running-status note-off convention). On each recognized note-off, the recorder SHALL perform the following sequence: read `midiChannel = status0 & 0x0F`, `pitch = event.data[1]`, and `portId` from the MIDI input port; look up the active-note entry for composite key `(portId, midiChannel, pitch)`, and if none exists the event SHALL be ignored with no dispatch; compute `t = ((entry.startedAt − recordingStartedAt) / 1000) × (bpm / 60)` in beats where `recordingStartedAt` and `bpm` come from `useTransport()`; compute `dur = ((performance.now() − entry.startedAt) / 1000) × (bpm / 60)` in beats; build a `Note` record with `{ t, dur, pitch, vel: entry.vel }`; push `{ channelId: entry.channelId, note }` onto an internal `pendingNotes` queue and schedule a `requestAnimationFrame` flush if one is not already scheduled; and delete the active-note entry for that key.

#### Scenario: Note-off computes beats relative to recording start

- **GIVEN** `recordingStartedAt === 1000`, `bpm === 120`
- **AND** an active-note entry for key `(port-X, 0, 60)` with `startedAt === 1500`, `vel === 100`, `channelId === 1`
- **WHEN** the listener receives `event.data = [0x80, 60, 0]` at `performance.now() === 2000` on the same port
- **THEN** a `Note` SHALL be queued with `t === 1.0` (one beat after start), `dur === 1.0`, `pitch === 60`, `vel === 100`
- **AND** the active-note map SHALL no longer contain an entry for that key

#### Scenario: Note-off with no matching active-note is ignored

- **WHEN** the listener receives `event.data = [0x80, 64, 0]` and the active-note map has no matching entry
- **THEN** the active-note map SHALL remain unchanged
- **AND** no `appendNote` SHALL be queued

### Requirement: Multi-channel routing and auto-add

Every captured note that is finalized for piano-roll `appendNote` SHALL target `channelId` carried in the active-note entry (derived per the note-on requirement, including per-track `inputSources` overrides). If no `Channel` with that id exists, the recorder SHALL call `useStage().addChannel(channelId)` before queuing the finalized `appendNote`, so playback and the timeline can target the new roll.

`useStage().selectedChannelId` SHALL NOT influence capture routing in this capability.

#### Scenario: Auto-add creates channel and roll on first note

- **GIVEN** the session has no channel 5 in `useStage().channels`
- **AND** no per-track row forces a different `channelId`
- **WHEN** a complete note-on / note-off pair arrives on MIDI channel 4 (`status` nibbles `0x4`)
- **THEN** the session SHALL gain `Channel { id: 5, ... }` with an empty roll
- **AND** the finalized note SHALL be appended to channel `5`

## ADDED Requirements

### Requirement: DJ track note capture when inputSources match

When a note-on event’s `(portId, midiChannel)` matches a `TrackInputListenRow` on a `DJActionTrack` (same matching rule as instrument channels) and the event is not consumed by a higher-priority instrument match per `design.md`, the recorder SHALL open a DJ-specific active-note entry (or reuse the same map with a distinct namespace) and SHALL finalize an `ActionEvent` on note-off with `{ pitch, t, dur, vel }` in beats consistent with piano-roll notes, dispatching via `useStage().appendDJActionEvent(trackId, event)` (or equivalent name defined in `dj-action-tracks` delta).

#### Scenario: Note from configured DJ source appends an event

- **GIVEN** DJ track `t1` lists `inputSources: [{ inputDeviceId: 'pad', channels: [10] }]`
- **WHEN** a NOTE ON / NOTE OFF pair completes on port `pad` with MIDI channel nibble `9` and pitch `48`
- **THEN** `t1.events` SHALL gain one `ActionEvent` with `pitch === 48` and non-negative `dur`
