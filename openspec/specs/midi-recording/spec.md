# midi-recording Specification

## Purpose
TBD - created by archiving change record-incoming-midi. Update Purpose after archive.
## Requirements
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

### Requirement: Frame-coalesced dispatch flushes pending notes

The recorder SHALL maintain a pending queue of `{ channelId, note }` pairs and SHALL schedule a single `requestAnimationFrame` callback whenever the queue transitions from empty to non-empty. The rAF callback SHALL dispatch every queued pair via `useStage().appendNote(channelId, note)` (one dispatch per pair, allowing React 18's automatic batching to coalesce them into a single commit), clear the queue, and clear the scheduled-flush flag.

If multiple notes arrive within a single frame, they SHALL all flush in the same rAF callback. If a note arrives between rAF scheduling and the callback firing, it SHALL ride along in the same flush.

#### Scenario: Single note arrives and flushes on next rAF

- **GIVEN** the pending queue is empty
- **WHEN** one note finalizes and is queued
- **THEN** exactly one `requestAnimationFrame` callback SHALL be scheduled
- **AND** on the next frame the queued note SHALL be dispatched via `appendNote` with its routed `channelId`
- **AND** the pending queue SHALL be empty afterward

#### Scenario: Multiple notes in one frame batch into one flush

- **GIVEN** the pending queue is empty
- **WHEN** three notes finalize within the same frame
- **THEN** exactly one `requestAnimationFrame` callback SHALL be scheduled
- **AND** that callback SHALL dispatch all three notes via `appendNote`
- **AND** React 18 automatic batching SHALL collapse the dispatches into a single render commit

### Requirement: Hung notes finalize at listener detach

When the listener detaches — because `recording` flips to false, the input port disappears, or the recorder unmounts — every entry remaining in the active-note map SHALL be finalized using `performance.now()` as the off-time, then queued for the next flush, and the map SHALL be cleared.

#### Scenario: Stop while holding a note finalizes the hung note

- **GIVEN** the active-note map has an entry for `(0, 60)` with `startedAt === 1500`, `vel === 100`, `channelId === 1`
- **AND** `recordingStartedAt === 1000`, `bpm === 120`
- **WHEN** `useTransport().stop()` is called at `performance.now() === 2200`
- **THEN** the active-note map SHALL be cleared
- **AND** a `Note` SHALL be queued with `t === 1.0`, `dur === 1.4` (≈ 2200 − 1500 ms at 120 bpm), `pitch === 60`, `vel === 100`

#### Scenario: Device unplug mid-record finalizes hung notes

- **GIVEN** the listener is attached to input A with one active-note entry
- **WHEN** input A is removed from `access.inputs` (hotplug disconnect) and the runtime updates `useMidiInputs()`
- **THEN** the recorder effect SHALL re-run, detach from input A (which may no longer be reachable), and finalize the hung note
- **AND** no further notes SHALL be captured until a new input is selected

#### Scenario: Pause while holding a note finalizes the hung note

- **GIVEN** the active-note map has an entry for `(0, 60)`
- **WHEN** `useTransport().pause()` is called
- **THEN** the active-note map SHALL be cleared
- **AND** the hung note SHALL be queued for dispatch

### Requirement: Non-note messages are ignored in this slice

The recorder SHALL ignore any `MIDIMessageEvent` whose status nibble is not `0x8` (note-off) or `0x9` (note-on). Specifically, the recorder SHALL NOT capture:

- `0xA0..0xAF` (polyphonic aftertouch)
- `0xB0..0xBF` (control change)
- `0xC0..0xCF` (program change)
- `0xD0..0xDF` (channel aftertouch)
- `0xE0..0xEF` (pitch bend)
- `0xF0..0xFF` (system messages including clock)

System messages and CC/PB/AT capture are deferred to separate slices.

#### Scenario: Control change message is ignored

- **WHEN** the listener receives `event.data = [0xB0, 1, 64]` (CC 1 = mod wheel)
- **THEN** the active-note map SHALL remain unchanged
- **AND** no `appendNote` SHALL be queued

#### Scenario: Pitch bend message is ignored

- **WHEN** the listener receives `event.data = [0xE0, 0, 64]` (centered pitch bend)
- **THEN** the active-note map SHALL remain unchanged
- **AND** no `appendNote` SHALL be queued

#### Scenario: Clock message is ignored

- **WHEN** the listener receives `event.data = [0xF8]` (MIDI clock tick)
- **THEN** the recorder SHALL NOT advance any internal state
- **AND** no `appendNote` SHALL be queued

### Requirement: Recorder chains forward to any pre-existing onmidimessage handler

The recorder SHALL preserve any previously-installed `onmidimessage` handler on the selected `MIDIInput`. When installing, the recorder SHALL capture `prev = input.onmidimessage`. Inside the recorder's handler, before processing the message, the recorder SHALL invoke `prev?.call(input, event)` so the prior consumer continues to receive every message. On cleanup, the recorder SHALL restore `input.onmidimessage = prev`.

This SHALL hold in React StrictMode, where the effect mounts twice in development.

#### Scenario: Pre-existing handler continues to receive messages

- **GIVEN** a Statusbar LED tap has installed an `onmidimessage` handler on input A
- **AND** the recorder then installs its handler on input A
- **WHEN** a note-on arrives at input A
- **THEN** the Statusbar LED tap SHALL receive the event
- **AND** the recorder SHALL also process the event

#### Scenario: Cleanup restores the prior handler reference

- **GIVEN** input A had a pre-existing `onmidimessage` value `prev`
- **AND** the recorder installed its handler, capturing `prev`
- **WHEN** the recorder cleanup runs
- **THEN** `input.onmidimessage` SHALL be set back to `prev` (identity-equal)

### Requirement: Multi-channel routing and auto-add

Every captured note that is finalized for piano-roll `appendNote` SHALL target `channelId` carried in the active-note entry (derived per the note-on requirement, including per-track `inputSources` overrides). If no `Channel` with that id exists, the recorder SHALL call `useStage().addChannel(channelId)` before queuing the finalized `appendNote`, so playback and the timeline can target the new roll.

`useStage().selectedChannelId` SHALL NOT influence capture routing in this capability.

#### Scenario: Auto-add creates channel and roll on first note

- **GIVEN** the session has no channel 5 in `useStage().channels`
- **AND** no per-track row forces a different `channelId`
- **WHEN** a complete note-on / note-off pair arrives on MIDI channel 4 (`status` nibbles `0x4`)
- **THEN** the session SHALL gain `Channel { id: 5, ... }` with an empty roll
- **AND** the finalized note SHALL be appended to channel `5`

### Requirement: DJ track note capture when inputSources match

When a note-on event's `(portId, midiChannel)` matches a `TrackInputListenRow` on a `DJActionTrack` (same matching rule as instrument channels) and the event is not consumed by a higher-priority instrument match per `design.md`, **AND** the targeted action row does **not** use `midiInputCc` for capture (see prior note-only behavior), the recorder SHALL open a DJ-specific active-note entry (or reuse the same map with a distinct namespace) and SHALL finalize an `ActionEvent` on note-off with `{ pitch, t, dur, vel }` in beats consistent with piano-roll notes, dispatching via `useStage().appendDJActionEvent(trackId, event)` (or equivalent name defined in `dj-action-tracks` delta).

When a row **has** `midiInputCc` set, **note-on/note-off `matchingDJActions` SHALL NOT** route to that row for capture — CC capture owns that row.

#### Scenario: Note from configured DJ source appends an event

- **GIVEN** DJ track `t1` lists `inputSources: [{ inputDeviceId: 'pad', channels: [10] }]` and **no** row on `t1` has `midiInputCc` that would claim the event's pitch/channel combination
- **WHEN** a NOTE ON / NOTE OFF pair completes on port `pad` with MIDI channel nibble `9` and pitch `48`
- **THEN** `t1.events` SHALL gain one `ActionEvent` with `pitch === 48` and non-negative `dur`

### Requirement: DJ track Control Change capture when inputSources and action row match

When **recording** and a **Control Change** message arrives whose `(portId, midiChannel, cc)` matches a `DJActionTrack` row with `actionMap[pitch].midiInputCc === cc` (same **wire channel** matching as note capture) and that row is selected by the same conflict-resolution rules as instrument vs DJ note capture, the recorder SHALL append or update **`ActionEvent`** entries for that `pitch` consistent with the design in change `mixer-dj-cc-messages` `design.md` **CC capture** subsection (level derived from CC value `0..127` normalized to `vel`, timing in beats consistent with existing `ActionEvent` storage).

The concrete pairing semantics (open vs close of a fader move) SHALL be implemented deterministically and covered by unit tests in `src/midi/recorder`.

#### Scenario: CC from configured DJ source appends an event

- **GIVEN** DJ track `t1` lists `inputSources: [{ inputDeviceId: 'pad', channels: [10] }]` and `actionMap[80].midiInputCc === 7`
- **WHEN** a Control Change `0xB9, 7, 64` arrives on port `pad` (channel 10, CC 7, value 64)
- **THEN** `appendDJActionEvent` (or equivalent) SHALL run for `t1` with an `ActionEvent` on **pitch `80`** whose `vel` reflects `64/127`

