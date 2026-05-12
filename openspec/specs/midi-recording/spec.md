# midi-recording Specification

## Purpose
TBD - created by archiving change record-incoming-midi. Update Purpose after archive.

## Requirements

### Requirement: MidiRecorder hook orchestrates capture lifecycle

The codebase SHALL expose a `useMidiRecorder()` React hook in `src/midi/recorder.ts`. The hook SHALL be mounted exactly once at the app root via a small `<MidiRecorderRunner />` wrapper component (that calls the hook and returns `null`). The runner SHALL be placed inside the provider tree where it has access to `useTransport()`, `useStage()`, `useMidiRuntime()` and `useMidiInputs()` (from `midi-runtime`), and `useChannels()`.

The de facto "selected input" in this slice is the first entry in `useMidiInputs().inputs` (i.e., `inputs[0]`). A proper user-driven selection lands with the pickers slice; until then the first available input is used unconditionally.

The hook SHALL NOT return any value (or SHALL return `void`/`null`). Its responsibility is the side effect: subscribing to inbound MIDI messages and dispatching captured notes.

#### Scenario: Recorder mounts once and reads required hooks

- **WHEN** the app is rendered
- **THEN** the rendered tree SHALL contain exactly one `<MidiRecorderRunner />` instance
- **AND** that component SHALL render `null`
- **AND** the hook it invokes SHALL read `useTransport()`, `useStage()`, `useMidiRuntime()`, `useMidiInputs()`, and `useChannels()`

### Requirement: Listener attaches only while recording with an available input

The recorder hook SHALL install an `onmidimessage` handler on the de facto selected `MIDIInput` (which in this slice is `useMidiInputs().inputs[0]`) ONLY when all of the following are true:

- `useTransport().recording === true`
- `useStage().selectedChannelId !== null`
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

#### Scenario: No listener when no channel is selected

- **WHEN** `useTransport().recording === true` AND `useStage().selectedChannelId === null`
- **THEN** no `MIDIInput` SHALL have a recorder-installed `onmidimessage` handler

#### Scenario: Listener installed when armed with input and channel

- **GIVEN** `useTransport().recording === true`, `useStage().selectedChannelId === 1`, `useMidiInputs().inputs[0].id === 'input-a'`, and `access.inputs.get('input-a')` returns a `MIDIInput`
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

1. Read `pitch = event.data[1]` and `velocity = event.data[2]`.
2. Open an entry in an internal active-note map keyed by `pitch`, with value `{ startedAt: performance.now(), vel: velocity }`.
3. NOT dispatch any state action yet (no `appendNote` until the note-off).

The recorder SHALL ignore the channel nibble (`status & 0x0F`) — every captured note is routed to `useStage().selectedChannelId`.

If an active-note entry already exists for that pitch, the existing entry SHALL be overwritten — the prior note-on is dropped (no note is appended for it). This documents the re-trigger-without-release case.

#### Scenario: Note-on with velocity opens an active-note entry

- **WHEN** the listener receives `event.data = [0x90, 60, 100]` (note-on, pitch 60, vel 100)
- **THEN** the active-note map SHALL contain an entry keyed by `60` with `vel === 100`
- **AND** no `appendNote` action SHALL be dispatched on this event

#### Scenario: Channel byte in the status is ignored for routing

- **GIVEN** `selectedChannelId === 1`
- **WHEN** the listener receives `event.data = [0x95, 64, 90]` (note-on on MIDI channel 6)
- **AND** later `event.data = [0x85, 64, 0]` (note-off on MIDI channel 6)
- **THEN** the resulting `appendNote` dispatch SHALL target `channelId === 1`
- **AND** the note SHALL NOT be routed to internal channel 6

#### Scenario: Note-on with velocity zero is treated as note-off

- **WHEN** the listener receives `event.data = [0x90, 60, 0]` while an active-note entry for pitch 60 exists
- **THEN** the recorder SHALL treat this as a note-off and finalize the entry per the note-off requirement

#### Scenario: Re-trigger without release drops the earlier note

- **GIVEN** the active-note map has an entry for pitch 60 from an earlier note-on
- **WHEN** a second note-on for pitch 60 arrives before any note-off
- **THEN** the active-note map's entry for pitch 60 SHALL reflect the new note-on's `startedAt` and `vel`
- **AND** no `appendNote` SHALL be dispatched for the dropped earlier note

### Requirement: Note-off finalizes the entry and queues an appendNote dispatch

The recorder SHALL recognize note-off events as either an explicit note-off status nibble `0x8` (`0x80..0x8F`) or a note-on status nibble `0x9` (`0x90..0x9F`) with velocity `0` (the running-status note-off convention). On each recognized note-off, the recorder SHALL perform the following sequence: read `pitch = event.data[1]`; look up the active-note entry for that pitch, and if none exists the event SHALL be ignored with no dispatch; compute `t = ((entry.startedAt − recordingStartedAt) / 1000) × (bpm / 60)` in beats where `recordingStartedAt` and `bpm` come from `useTransport()`; compute `dur = ((performance.now() − entry.startedAt) / 1000) × (bpm / 60)` in beats; build a `Note` record with `{ t, dur, pitch, vel: entry.vel }`; push the note onto an internal `pendingNotes` queue and schedule a `requestAnimationFrame` flush if one is not already scheduled; and delete the active-note entry for that pitch.

#### Scenario: Note-off computes beats relative to recording start

- **GIVEN** `recordingStartedAt === 1000`, `bpm === 120`
- **AND** an active-note entry for pitch 60 with `startedAt === 1500`, `vel === 100`
- **WHEN** the listener receives `event.data = [0x80, 60, 0]` at `performance.now() === 2000`
- **THEN** a `Note` SHALL be queued with `t === 1.0` (one beat after start), `dur === 1.0`, `pitch === 60`, `vel === 100`
- **AND** the active-note map SHALL no longer contain an entry for pitch 60

#### Scenario: Note-off with no matching active-note is ignored

- **WHEN** the listener receives `event.data = [0x80, 64, 0]` and the active-note map has no entry for pitch 64
- **THEN** the active-note map SHALL remain unchanged
- **AND** no `appendNote` SHALL be queued

### Requirement: Frame-coalesced dispatch flushes pending notes

The recorder SHALL maintain a `pendingNotes: Note[]` queue and SHALL schedule a single `requestAnimationFrame` callback whenever the queue transitions from empty to non-empty. The rAF callback SHALL dispatch every queued note via `useChannels().appendNote(channelId, note)` (one dispatch per note, allowing React 18's automatic batching to coalesce them into a single commit), clear the queue, and clear the scheduled-flush flag.

If multiple notes arrive within a single frame, they SHALL all flush in the same rAF callback. If a note arrives between rAF scheduling and the callback firing, it SHALL ride along in the same flush.

#### Scenario: Single note arrives and flushes on next rAF

- **GIVEN** the pending queue is empty
- **WHEN** one note finalizes and is queued
- **THEN** exactly one `requestAnimationFrame` callback SHALL be scheduled
- **AND** on the next frame the queued note SHALL be dispatched via `appendNote`
- **AND** the pending queue SHALL be empty afterward

#### Scenario: Multiple notes in one frame batch into one flush

- **GIVEN** the pending queue is empty
- **WHEN** three notes finalize within the same frame
- **THEN** exactly one `requestAnimationFrame` callback SHALL be scheduled
- **AND** that callback SHALL dispatch all three notes via `appendNote`
- **AND** React 18 automatic batching SHALL collapse the dispatches into a single render commit

### Requirement: Hung notes finalize at listener detach

When the listener detaches — because `recording` flips to false, `selectedInputId` changes, `selectedChannelId` becomes null, the input port disappears, or the recorder unmounts — every entry remaining in the active-note map SHALL be finalized using `performance.now()` as the off-time, then queued for the next flush, and the map SHALL be cleared.

#### Scenario: Stop while holding a note finalizes the hung note

- **GIVEN** the active-note map has an entry for pitch 60 with `startedAt === 1500`, `vel === 100`
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

- **GIVEN** the active-note map has an entry for pitch 60
- **WHEN** `useTransport().pause()` is called
- **THEN** the active-note map SHALL be cleared
- **AND** the hung note SHALL be queued for dispatch

### Requirement: Single-channel routing in this slice

Every captured note SHALL be appended to the channel identified by `useStage().selectedChannelId` at the moment the note-on arrived. The MIDI channel nibble of the incoming message SHALL NOT influence routing. If `selectedChannelId` changes between a note-on and its note-off, the note SHALL be appended to the channel that was selected at the note-on moment (the recorder reads `selectedChannelId` at note-on time and stores it with the active-note entry).

Multi-channel routing by the incoming MIDI channel byte is explicitly deferred to a separate slice.

#### Scenario: Selected channel at note-on wins over note-off-time selection

- **GIVEN** `selectedChannelId === 1` at the moment a note-on for pitch 60 arrives
- **WHEN** the user changes `selectedChannelId` to 2 before the matching note-off arrives
- **THEN** the resulting `appendNote` dispatch SHALL target `channelId === 1`
- **AND** the note SHALL NOT be appended to channel 2

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
