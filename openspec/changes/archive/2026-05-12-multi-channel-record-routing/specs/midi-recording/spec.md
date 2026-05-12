## MODIFIED Requirements

### Requirement: MidiRecorder hook orchestrates capture lifecycle

The codebase SHALL expose a `useMidiRecorder()` React hook in `src/midi/recorder.ts`. The hook SHALL be mounted exactly once at the app root via a small `<MidiRecorderRunner />` wrapper component (that calls the hook and returns `null`). The runner SHALL be placed inside the provider tree where it has access to `useTransport()`, `useStage()`, `useMidiRuntime()` and `useMidiInputs()` (from `midi-runtime`).

The de facto "selected input" in this slice is the first entry in `useMidiInputs().inputs` (i.e., `inputs[0]`). A proper user-driven selection lands with the pickers slice; until then the first available input is used unconditionally.

The hook SHALL NOT return any value (or SHALL return `void`/`null`). Its responsibility is the side effect: subscribing to inbound MIDI messages and dispatching captured notes.

#### Scenario: Recorder mounts once and reads required hooks

- **WHEN** the app is rendered
- **THEN** the rendered tree SHALL contain exactly one `<MidiRecorderRunner />` instance
- **AND** that component SHALL render `null`
- **AND** the hook it invokes SHALL read `useTransport()`, `useStage()`, `useMidiRuntime()`, and `useMidiInputs()`

### Requirement: Listener attaches only while recording with an available input

The recorder hook SHALL install an `onmidimessage` handler on the de facto selected `MIDIInput` (which in this slice is `useMidiInputs().inputs[0]`) ONLY when all of the following are true:

- `useTransport().recording === true`
- `useMidiInputs().status === 'granted'`
- `useMidiInputs().inputs.length > 0`
- The current `MIDIAccess` resolves the chosen `MIDIInput` id to a defined port

When any of these become false, the handler SHALL be detached. When `inputs[0]` changes identity (e.g., the previous first input was unplugged and the next-listed device shifts up), the handler SHALL detach from the old input and attach to the new one in a single effect cycle.

When installing, the recorder SHALL capture any previously-installed `onmidimessage` handler (`const prev = input.onmidimessage`) and SHALL call it (via `prev?.call(input, event)`) at the top of its own handler. On cleanup, the recorder SHALL restore `input.onmidimessage = prev`.

#### Scenario: No listener when recording is off

- **WHEN** `useTransport().recording === false`
- **THEN** no `MIDIInput` in `access.inputs` SHALL have an `onmidimessage` handler installed by the recorder

#### Scenario: No listener when no input is available

- **WHEN** `useTransport().recording === true` AND `useMidiInputs().inputs.length === 0`
- **THEN** no `MIDIInput` SHALL have a recorder-installed `onmidimessage` handler

#### Scenario: Listener installed when recording with input

- **GIVEN** `useTransport().recording === true`, `useMidiInputs().inputs[0].id === 'input-a'`, and `access.inputs.get('input-a')` returns a `MIDIInput`
- **WHEN** the recorder effect runs
- **THEN** that `MIDIInput.onmidimessage` SHALL be a function installed by the recorder
- **AND** any `prev` handler captured at install time SHALL be restored on cleanup

#### Scenario: First-input identity change mid-record swaps the listener

- **GIVEN** the listener is attached to input A (which was `inputs[0]`) and the input list shifts so that `inputs[0]` is now input B (e.g., input A was unplugged, or hotplug reordered the list)
- **WHEN** the recorder effect re-runs
- **THEN** input A's `onmidimessage` SHALL be restored to its prior value (when input A is still reachable)
- **AND** input B's `onmidimessage` SHALL be the recorder's handler

### Requirement: Note-on opens an active-note entry

When the listener receives a `MIDIMessageEvent` whose first data byte has status nibble `0x9` (`0x90..0x9F`) and the second data byte (velocity) is `> 0`, the recorder SHALL:

1. Read `midiChannel = status0 & 0x0F`, `pitch = event.data[1]` and `velocity = event.data[2]`.
2. Derive `channelId = midiChannel + 1` (internal `ChannelId` 1..16).
3. Ensure the session contains a `Channel` with `id === channelId` (calling `useStage().addChannel(channelId)` if missing) before continuing.
4. Open an entry in an internal active-note map keyed by the composite `(midiChannel, pitch)` (implementation MAY stringify), with value `{ startedAt: performance.now(), vel: velocity, channelId }`.
5. NOT dispatch any state action yet (no `appendNote` until the note-off).

If an active-note entry already exists for the same key, the existing entry SHALL be overwritten — the prior note-on is dropped (no note is appended for it). This documents the re-trigger-without-release case.

#### Scenario: Note-on with velocity opens an active-note entry

- **WHEN** the listener receives `event.data = [0x90, 60, 100]` (note-on, MIDI channel 0, pitch 60, vel 100)
- **THEN** the active-note map SHALL contain an entry for `(0, 60)` with `vel === 100`
- **AND** no `appendNote` action SHALL be dispatched on this event

#### Scenario: Channel byte routes to matching internal channel

- **GIVEN** channel 6 exists in the session
- **WHEN** the listener receives `event.data = [0x95, 64, 90]` (note-on on MIDI channel 5)
- **AND** later `event.data = [0x85, 64, 0]` (note-off on MIDI channel 5)
- **THEN** the resulting `appendNote` dispatch SHALL target `channelId === 6`
- **AND** the note SHALL NOT be routed to channel 1 solely because another channel is selected in the UI

#### Scenario: Note-on with velocity zero is treated as note-off

- **WHEN** the listener receives `event.data = [0x90, 60, 0]` while an active-note entry for `(0, 60)` exists
- **THEN** the recorder SHALL treat this as a note-off and finalize the entry per the note-off requirement

#### Scenario: Re-trigger without release drops the earlier note

- **GIVEN** the active-note map has an entry for `(0, 60)` from an earlier note-on
- **WHEN** a second note-on for `(0, 60)` arrives before any note-off
- **THEN** the active-note map's entry for `(0, 60)` SHALL reflect the new note-on's `startedAt` and `vel`
- **AND** no `appendNote` SHALL be dispatched for the dropped earlier note

#### Scenario: Simultaneous pitch on two MIDI channels does not collide

- **GIVEN** channels 1 and 2 exist in the session
- **WHEN** the listener receives `event.data = [0x90, 60, 100]` then `event.data = [0x91, 60, 110]` before either note-off
- **THEN** the active-note map SHALL hold distinct entries for `(0, 60)` and `(1, 60)`

### Requirement: Note-off finalizes the entry and queues an appendNote dispatch

The recorder SHALL recognize note-off events as either an explicit note-off status nibble `0x8` (`0x80..0x8F`) or a note-on status nibble `0x9` (`0x90..0x9F`) with velocity `0` (the running-status note-off convention). On each recognized note-off, the recorder SHALL perform the following sequence: read `midiChannel = status0 & 0x0F` and `pitch = event.data[1]`; look up the active-note entry for composite key `(midiChannel, pitch)`, and if none exists the event SHALL be ignored with no dispatch; compute `t = ((entry.startedAt − recordingStartedAt) / 1000) × (bpm / 60)` in beats where `recordingStartedAt` and `bpm` come from `useTransport()`; compute `dur = ((performance.now() − entry.startedAt) / 1000) × (bpm / 60)` in beats; build a `Note` record with `{ t, dur, pitch, vel: entry.vel }`; push `{ channelId: entry.channelId, note }` onto an internal `pendingNotes` queue and schedule a `requestAnimationFrame` flush if one is not already scheduled; and delete the active-note entry for that key.

#### Scenario: Note-off computes beats relative to recording start

- **GIVEN** `recordingStartedAt === 1000`, `bpm === 120`
- **AND** an active-note entry for `(0, 60)` with `startedAt === 1500`, `vel === 100`, `channelId === 1`
- **WHEN** the listener receives `event.data = [0x80, 60, 0]` at `performance.now() === 2000`
- **THEN** a `Note` SHALL be queued with `t === 1.0` (one beat after start), `dur === 1.0`, `pitch === 60`, `vel === 100`
- **AND** the active-note map SHALL no longer contain an entry for `(0, 60)`

#### Scenario: Note-off with no matching active-note is ignored

- **WHEN** the listener receives `event.data = [0x80, 64, 0]` and the active-note map has no entry for `(0, 64)`
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

## ADDED Requirements

### Requirement: Multi-channel routing and auto-add

Every captured note SHALL be appended to the internal channel matching the incoming message's MIDI channel nibble: `channelId = (status0 & 0x0F) + 1`. If no `Channel` with that id exists, the recorder SHALL call `useStage().addChannel(channelId)` before queuing the finalized `appendNote`, so playback and the timeline can target the new roll.

`useStage().selectedChannelId` SHALL NOT influence capture routing in this capability.

#### Scenario: Auto-add creates channel and roll on first note

- **GIVEN** the session has no channel 5 in `useStage().channels`
- **WHEN** a complete note-on / note-off pair arrives on MIDI channel 4 (`status` nibbles `0x4`)
- **THEN** the session SHALL gain `Channel { id: 5, ... }` with an empty roll
- **AND** the finalized note SHALL be appended to channel `5`

## REMOVED Requirements

### Requirement: Single-channel routing in this slice

**Reason**: Superseded by multi-channel routing keyed off the MIDI channel byte.

**Migration**: Remove `selectedChannelId` from recorder attach preconditions and routing; use `channelId = (status0 & 0x0F) + 1`.
