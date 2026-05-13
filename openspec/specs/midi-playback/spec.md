# midi-playback Specification

## Purpose
TBD - created by archiving change play-channel-notes. Update Purpose after archive.
## Requirements
### Requirement: MidiScheduler hook is the single source of outbound MIDI

The codebase SHALL expose a `useMidiScheduler()` React hook at `src/midi/scheduler.ts`. `App.tsx` SHALL mount the hook exactly once at the top level of the tree (a sibling of the existing `useMidiRecorder` mount and the `MidiRuntimeProvider` / `TransportProvider` / `ToastProvider`). The hook SHALL be a no-op component that subscribes to `useTransport()`, `useChannels()`, `useMidiOutputs()`, and `useToast()` and drives an internal `requestAnimationFrame` loop while `useTransport().mode === 'play'`.

The hook SHALL NOT render any DOM. The hook SHALL be a self-contained module — its internal active-note map, cursor state, and rAF handle live in `useRef` or module-scoped state but SHALL NOT leak outside the hook. No other module in the codebase SHALL call `MIDIOutput.send` directly for note-on / note-off / panic messages — all outbound playback MIDI SHALL flow through the scheduler.

#### Scenario: Scheduler hook is mounted exactly once

- **WHEN** the rendered application is inspected for occurrences of `useMidiScheduler`
- **THEN** the hook SHALL be invoked from exactly one component in the live tree (the top-level mount in `App.tsx`)
- **AND** no other component SHALL import or invoke it

#### Scenario: Scheduler renders no DOM

- **WHEN** the component invoking `useMidiScheduler()` returns
- **THEN** the rendered output SHALL be `null`

#### Scenario: Scheduler is the sole MIDIOutput.send caller for playback notes

- **WHEN** the codebase is grepped for `MIDIOutput.send`, `.send(`, or comparable patterns invoking the Web MIDI send API outside `src/midi/scheduler.ts`
- **THEN** the only matches outside the scheduler module SHALL be in test files, type declarations, or comments — not in production source modules emitting playback note-on / note-off / All Notes Off bytes

### Requirement: Scheduler uses lookahead rAF scan with sample-accurate timestamps

While `useTransport().mode === 'play'`, the scheduler SHALL run an internal `requestAnimationFrame` tick. Each tick SHALL:

1. Compute `playheadMs = useTransport().timecodeMs` at the moment the tick fires.
2. For each channel that passes the mute/solo composition rule (see "Scheduler respects mute and solo"), scan its `PianoRollTrack.notes` starting from a per-channel cursor and find every note whose `note.t * msPerBeat` falls in the half-open range `[playheadMs, playheadMs + lookaheadMs)`, where `msPerBeat = 60000 / tempoSnapshot` and `tempoSnapshot` is the `bpm` value captured at the most recent `play()` transition.
3. For each such note, call `output.send([0x90 | channelByte, note.pitch, note.vel], performance.now() + (note.t * msPerBeat - playheadMs))` for the note-on, and `output.send([0x80 | channelByte, note.pitch, 0], performance.now() + ((note.t + note.dur) * msPerBeat - playheadMs))` for the matching note-off, where `channelByte = (channelId − 1) & 0x0F` (internal channel ids are 1-indexed; the Web MIDI channel byte's low nibble is 0-indexed).
4. Advance the per-channel cursor past the last note whose start was scheduled this tick.

The lookahead window `lookaheadMs` SHALL be `100`.

When the timestamp passed to `output.send` would be in the past (i.e., `performance.now() + offset < performance.now()`), the implementation SHALL pass `performance.now()` (or `0` per Web MIDI spec semantics) instead so the message is delivered immediately rather than rejected.

#### Scenario: Note-on dispatches with future timestamp inside lookahead window

- **GIVEN** the scheduler is running with `tempoSnapshot = 120` (so `msPerBeat = 500`), `playheadMs = 1000`, and a channel containing a note `{ t: 2.1, dur: 0.5, pitch: 60, vel: 100 }` on channelId 1 (channelByte 0)
- **WHEN** the rAF tick fires
- **THEN** the scheduler SHALL have called `output.send([0x90, 60, 100], <ts>)` exactly once
- **AND** `<ts>` SHALL be approximately `performance.now() + (2.1 * 500 - 1000) = performance.now() + 50` (±2 ms jitter)

#### Scenario: Matching note-off dispatches at start + duration

- **GIVEN** the same state as the previous scenario
- **WHEN** the rAF tick fires
- **THEN** the scheduler SHALL have called `output.send([0x80, 60, 0], <ts_off>)` exactly once
- **AND** `<ts_off>` SHALL be approximately `performance.now() + ((2.1 + 0.5) * 500 - 1000) = performance.now() + 300` (±2 ms jitter)

#### Scenario: Notes past the lookahead window are deferred

- **GIVEN** `tempoSnapshot = 120`, `msPerBeat = 500`, `playheadMs = 1000`, and a channel containing a note `{ t: 3.0, dur: 0.5, pitch: 64, vel: 100 }` (so `note.t * msPerBeat = 1500`)
- **WHEN** the rAF tick fires (lookahead window is `[1000, 1100)`)
- **THEN** `output.send` SHALL NOT have been called for pitch 64
- **AND** the per-channel cursor SHALL still point to that note for the next tick

#### Scenario: Notes before the playhead are skipped

- **GIVEN** `playheadMs = 1000` and a channel containing a note `{ t: 0.5, dur: 0.5, pitch: 60, vel: 100 }` (so `note.t * msPerBeat = 250`, in the past)
- **WHEN** the rAF tick fires
- **THEN** `output.send` SHALL NOT be called for pitch 60 for this tick
- **AND** the per-channel cursor SHALL advance past this note so subsequent ticks do not reconsider it

#### Scenario: Past-due lookahead timestamp is clamped to immediate delivery

- **GIVEN** a notional note whose computed `timestamp` argument would resolve to a value before `performance.now()` (e.g., the tick fires a frame late and the math underflows)
- **WHEN** the scheduler invokes `output.send`
- **THEN** the timestamp argument SHALL NOT be less than `performance.now()` at the moment of the call
- **AND** the message SHALL be delivered immediately by the Web MIDI implementation (not rejected for being in the past)

### Requirement: Tempo and output are snapshotted at play time

When `useTransport().mode` transitions to `'play'` from any other mode, the scheduler SHALL snapshot two values that remain fixed for the duration of the play session (until `mode` leaves `'play'`):

- `tempoSnapshot` — `useTransport().bpm` at the moment of transition.
- `outputSnapshot` — the first entry of `useMidiOutputs().outputs` at the moment of transition, or `undefined` if the array is empty.

The scheduler SHALL NOT re-read `bpm` mid-playback for any scheduling math. The scheduler SHALL NOT re-read `outputs` mid-playback for dispatch — even if a new output is plugged in mid-playback, the snapshot continues to govern. (Re-evaluation on hotplug is out of scope for this slice.)

#### Scenario: Tempo snapshot persists across mid-playback bpm changes

- **GIVEN** the transport is in `mode === 'play'` with `tempoSnapshot = 120`
- **WHEN** `useTransport().bpm` is changed to `180` mid-playback
- **THEN** subsequent rAF ticks SHALL continue computing `msPerBeat = 60000 / 120 = 500`, not `60000 / 180`

#### Scenario: Output snapshot persists across mid-playback hotplug

- **GIVEN** the transport is in `mode === 'play'` with `outputSnapshot.id === 'out-A'`
- **WHEN** a second output `'out-B'` is plugged in mid-playback such that `useMidiOutputs().outputs[0]` would now resolve to a different device
- **THEN** the scheduler SHALL continue dispatching to `'out-A'` for the remainder of the play session

### Requirement: Play with no output emits a toast and no-ops the scheduler

When `useTransport().mode` transitions to `'play'` and `useMidiOutputs().outputs.length === 0`, the scheduler SHALL invoke `useToast().show('No output device available')` exactly once for that `play()` invocation and SHALL NOT call `MIDIOutput.send`. The rAF loop SHALL still tick (so the spec contract on tempo/output snapshotting is uniform), but every tick's dispatch SHALL be a no-op.

When `outputs.length >= 1` at play time, the scheduler SHALL invoke `useToast().show('Playing to <output.name>')` exactly once for that `play()` invocation, where `<output.name>` is the `name` field of `outputSnapshot`. The toast SHALL NOT fire on subsequent rAF ticks.

The scheduler SHALL NOT emit a "play started" toast if `mode` transitions from `'play'` to `'play'` (a no-op transition that does not exist in this slice but is contractually well-defined as "no fresh snapshot, no fresh toast").

#### Scenario: No output available emits no-output toast once

- **GIVEN** `useMidiOutputs().outputs.length === 0`
- **WHEN** `useTransport().play()` is invoked
- **THEN** `useToast().show` SHALL have been called exactly once with the argument `'No output device available'`
- **AND** for the duration of the resulting play session, `MIDIOutput.send` SHALL NOT have been called

#### Scenario: Output available emits playing-to toast once

- **GIVEN** `useMidiOutputs().outputs[0] = { id: 'out-A', name: 'MicroFreak', ... }`
- **WHEN** `useTransport().play()` is invoked
- **THEN** `useToast().show` SHALL have been called exactly once with the argument `'Playing to MicroFreak'`
- **AND** subsequent rAF ticks within the same play session SHALL NOT fire further toasts

#### Scenario: Empty-name output still emits a toast

- **GIVEN** `useMidiOutputs().outputs[0] = { id: 'out-X', name: '(unnamed device)', ... }` (the fallback applied by `toMidiDevice` for blank Web MIDI port names)
- **WHEN** `useTransport().play()` is invoked
- **THEN** `useToast().show` SHALL have been called exactly once with the argument `'Playing to (unnamed device)'`

### Requirement: Scheduler respects mute and solo composition

For each rAF tick, the scheduler SHALL apply the codebase's two-level mute/solo composition rule before scanning a channel's notes. A channel `c` with associated `PianoRollTrack` `r` SHALL be considered audible IF AND ONLY IF:

- `c.muted === false` AND `r.muted === false` (neither level mutes) AND
- EITHER no audible-affecting solo exists in the session (no `c.soloed === true` and no `r.soloed === true` for any channel/roll pair AND no `t.soloed === true` for any DJ track AND no `t.soloedRows.length > 0` for any DJ track), OR `c.soloed === true`, OR `r.soloed === true` (this channel or its roll is in the active solo set)

This matches the codebase's existing `isRollAudible(roll, channels, soloing)` semantics — the user can mute or solo at either the channel header's M/S chip OR the per-roll M/S chip, and either layer affects playback. Lane-level (CC/PB/AT) M/S is NOT considered by the scheduler (lanes are out of scope for the current scheduler). DJ-track and DJ-row M/S participate in the session-wide solo flag — when ANY DJ track is soloed or has any row soloed, channel-roll audibility flips to "soloed channels only" exactly as if a channel/roll were soloed. (DJ-row dispatch audibility is governed by a separate requirement.)

Non-audible channels SHALL contribute zero `MIDIOutput.send` calls for that tick. The check SHALL be re-evaluated on every tick, so toggling `muted` or `soloed` mid-playback affects subsequent ticks within one frame. Mid-playback un-muting SHALL NOT retroactively dispatch notes that fell in the past while the channel was muted — those notes SHALL be skipped permanently for this play session.

#### Scenario: Channel-level muted channel emits no notes

- **GIVEN** the transport is in `mode === 'play'` and channel 2 has `muted === true` (regardless of its roll's `muted` value)
- **WHEN** any rAF tick fires while channel 2's notes are within the lookahead window
- **THEN** `output.send` SHALL NOT be called for any channelByte that maps to channel 2

#### Scenario: Roll-level muted channel emits no notes

- **GIVEN** the transport is in `mode === 'play'`, channel 2 has `muted === false`, and channel 2's `PianoRollTrack.muted === true`
- **WHEN** any rAF tick fires while channel 2's notes are within the lookahead window
- **THEN** `output.send` SHALL NOT be called for any channelByte that maps to channel 2

#### Scenario: Roll-level solo silences non-soloed channels

- **GIVEN** the transport is in `mode === 'play'`, channel 1's `PianoRollTrack.soloed === true`, all channel-level `soloed` are `false`, and channels 2..16 have no solo at either level
- **WHEN** any rAF tick fires
- **THEN** `output.send` SHALL only be called for channelByte 0 (corresponding to channel 1) regardless of what notes exist on channels 2..16

#### Scenario: Solo on one channel mutes all others

- **GIVEN** the transport is in `mode === 'play'`, channel 1 has `soloed === true`, and channels 2..16 have `soloed === false` and `muted === false`
- **WHEN** any rAF tick fires
- **THEN** `output.send` SHALL only be called for channelByte 0 (corresponding to channel 1) regardless of what notes exist on channels 2..16

#### Scenario: DJ track solo silences non-soloed channels

- **GIVEN** the transport is in `mode === 'play'`, a DJ track `dj1` has `soloed === true`, no channel/roll has solo set, and channels 1..16 carry notes within the lookahead window
- **WHEN** any rAF tick fires
- **THEN** `output.send` SHALL NOT be called for any channelByte derived from `state.channels`
- **AND** dispatch for `dj1`'s events SHALL proceed per the DJ-track dispatch requirements

#### Scenario: DJ row solo silences non-soloed channels

- **GIVEN** the transport is in `mode === 'play'`, a DJ track `dj1` has `soloedRows === [48]` and `soloed === false`, no channel/roll has solo set, and channels 1..16 carry notes within the lookahead window
- **WHEN** any rAF tick fires
- **THEN** `output.send` SHALL NOT be called for any channelByte derived from `state.channels`
- **AND** dispatch for `dj1`'s events SHALL be governed by the DJ-row audibility requirement

#### Scenario: Mid-playback un-mute resumes from current playhead

- **GIVEN** the transport is in `mode === 'play'`, `tempoSnapshot = 120` (`msPerBeat = 500`), `playheadMs = 4000`, channel 1 was muted at `play()` time and has notes at `t = 0.5`, `t = 5.0`, and `t = 12.0`
- **WHEN** the user un-mutes channel 1 (setting `muted = false`)
- **THEN** subsequent rAF ticks SHALL schedule the notes at `t = 5.0` and `t = 12.0` when they enter the lookahead window
- **AND** the note at `t = 0.5` (start time 250 ms, in the past) SHALL NOT be retroactively scheduled

### Requirement: Panic on stop silences every dispatched note-on

The scheduler SHALL maintain an `activeNoteOns` map keyed by `(outputId, channelByte, pitch)` containing every note-on it has dispatched whose matching note-off has not yet been delivered (the note-off `timestamp` is in the future relative to wall-clock now).

When `useTransport().mode` transitions away from `'play'` (via `stop()` or `pause()`, or any externally-induced mode change to a non-`'play'` state), the scheduler SHALL emit panic:

1. For every entry `(outputId, channelByte, pitch)` in `activeNoteOns`, dispatch `output.send([0x80 | channelByte, pitch, 0])` with no future timestamp (immediate). The `output` SHALL be the one identified by `outputId` (in this slice this is always the same `outputSnapshot`).
2. For every distinct `(outputId, channelByte)` that produced any dispatch during the play session (including channels whose notes all finished naturally before stop), dispatch `output.send([0xB0 | channelByte, 0x7B, 0x00])` with no future timestamp. This is CC #123 "All Notes Off" with value 0.
3. Clear `activeNoteOns` and the per-channel-byte activity set. Cancel any pending rAF handle. Clear `tempoSnapshot` and `outputSnapshot`.

Note-offs SHALL be sent before All Notes Off messages within the same panic flush. (Note-offs are precise; All Notes Off is a belt-and-suspenders broadcast.)

If `outputSnapshot === undefined` (the no-output case), panic SHALL be a no-op — there is no output to send messages to. The `activeNoteOns` map will be empty in this case (no notes were ever dispatched), so this is consistent.

#### Scenario: Stop silences a sustained note

- **GIVEN** the scheduler has dispatched `output.send([0x90, 60, 100], performance.now() + 0)` at some prior tick and the matching note-off is scheduled for 2000 ms in the future
- **WHEN** `useTransport().stop()` is invoked
- **THEN** the scheduler SHALL call `output.send([0x80, 60, 0])` (immediate, no future timestamp) before clearing state
- **AND** SHALL subsequently call `output.send([0xB0, 0x7B, 0x00])` (All Notes Off on channelByte 0) before clearing state

#### Scenario: Pause from play triggers panic identically to stop

- **GIVEN** the scheduler has any entry in `activeNoteOns`
- **WHEN** `useTransport().pause()` is invoked
- **THEN** the same panic sequence SHALL fire as for `stop()`

#### Scenario: All Notes Off fires per activated channel, not per active note

- **GIVEN** during a play session, channelByte 0 dispatched notes at `pitch 60` and `pitch 64` (both with future note-offs at stop time), and channelByte 2 dispatched notes at `pitch 36` (note-off already delivered before stop)
- **WHEN** `useTransport().stop()` is invoked
- **THEN** the scheduler SHALL emit `output.send([0x80, 60, 0])` and `output.send([0x80, 64, 0])` (note-offs for the two still-active notes)
- **AND** SHALL emit `output.send([0xB0, 0x7B, 0x00])` (All Notes Off on channelByte 0) exactly once
- **AND** SHALL emit `output.send([0xB2, 0x7B, 0x00])` (All Notes Off on channelByte 2) exactly once
- **AND** SHALL NOT emit a note-off for pitch 36 (already naturally delivered)

#### Scenario: Stop with no output is a no-op

- **GIVEN** the play session started with `outputSnapshot === undefined` (no output device)
- **WHEN** `useTransport().stop()` is invoked
- **THEN** the scheduler SHALL NOT attempt to call `send` on any output
- **AND** SHALL NOT throw

#### Scenario: activeNoteOns is empty after panic

- **GIVEN** any panic has just flushed
- **WHEN** the panic completes
- **THEN** the scheduler's `activeNoteOns` map SHALL be empty
- **AND** any subsequent `play()` SHALL start from an empty map

### Requirement: Seek and loop wrap reset per-channel cursors

The scheduler SHALL maintain a per-channel cursor (an index into that channel's `PianoRollTrack.notes`) so each rAF tick resumes scanning from the cursor instead of from index 0. When the cursor reaches the end of a channel's notes, that channel SHALL be skipped for the remainder of the play session (no further scanning) until a non-monotonic `playheadMs` jump or a fresh `play()`.

On every rAF tick the scheduler SHALL compare `playheadMs` against the previous tick's `playheadMs` (call it `lastPlayheadMs`). When `playheadMs < lastPlayheadMs - epsilon` (where `epsilon` is one frame-time at 60 fps, ≈ 17 ms — sufficient to ignore rounding jitter), the scheduler SHALL recompute every channel's cursor by binary-searching that channel's `notes` for the first index whose `t * msPerBeat >= playheadMs`. This handles both `seek()` and the loop-region wrap.

#### Scenario: Sequential ticks advance the cursor monotonically

- **GIVEN** a channel with 1000 notes spanning a long take, and the scheduler is running with cursor at index 50
- **WHEN** the next rAF tick fires with `playheadMs` advancing by one frame (≈ 17 ms)
- **THEN** the cursor SHALL advance to at most index 51 (assuming no more than one note's start falls in the new 17 ms window)
- **AND** the scheduler SHALL NOT re-walk indices 0..49

#### Scenario: Seek backward resets all cursors

- **GIVEN** the transport is in `mode === 'play'` with `playheadMs = 30000` and per-channel cursors pointing well into the notes arrays
- **WHEN** `seek(5000)` is invoked (`playheadMs` jumps backward from 30000 to 5000)
- **THEN** the next rAF tick SHALL recompute every channel's cursor by binary-searching for the first note whose `t * msPerBeat >= 5000`
- **AND** dispatch resumes from those new cursor positions

#### Scenario: Loop wrap resets cursors

- **GIVEN** the transport is in `mode === 'play'`, `looping === true`, `loopRegion === { start: 4, end: 8 }`, `tempoSnapshot = 120` (`msPerBeat = 500`), so the wrap point in ms is 4000
- **WHEN** `playheadMs` crosses 4000 and the transport's rAF reducer wraps it back to the millisecond equivalent of beat 4 (2000 ms)
- **THEN** the scheduler's next tick SHALL detect the non-monotonic jump and reset every channel's cursor to the first note whose `t * msPerBeat >= 2000`

### Requirement: Scheduler uses a single unified dispatch loop over all playable sources

While `useTransport().mode === 'play'`, each rAF tick SHALL run a SINGLE dispatch loop that walks every playable source — channel-rolls AND DJ action tracks — in the same loop body. There SHALL NOT be parallel dispatch pipelines for the two source kinds. Every emitted MIDI message (note-on, note-off, channel-aftertouch) SHALL flow through a single internal `emitNoteEvent` helper that handles the byte-level `output.send` calls, the `activeNoteOns` update, the `channelsActivated` update, and the pressure-aftertouch sub-emit.

Each playable source SHALL provide:

- A stable `cursorKey: string` (e.g. `'ch:1'` for channel id 1, `'dj:dj1'` for DJ track id `'dj1'`).
- A sorted `events: { t: number; dur: number; ... }[]` list.
- A per-event `resolveEmit(event, sessionAnySoloed)` that returns either `null` (event SHALL be silently skipped — audibility, missing action, etc.) or a `{ channelByte, pitch, vel, pressure? }` object describing the bytes to emit.

The unified loop SHALL maintain one `cursors: Map<string, number>` (keyed by `cursorKey`) for both source kinds. On every rAF tick the cursor for each source SHALL resume from its prior position; on non-monotonic playhead jumps (`playheadMs < lastPlayheadMs - 17`), every source's cursor SHALL be re-bound by binary-search for the first event whose `t * msPerBeat >= playheadMs`. This SHALL run in a single `rebindCursors` pass that iterates all sources.

When `outputSnapshot === undefined`, the dispatch loop SHALL be a no-op for every source (matching the existing channel-roll behavior under "Play with no output emits a toast and no-ops the scheduler" — no separate toast for DJ tracks).

#### Scenario: DJ track events emit during play

- **GIVEN** the transport is in `mode === 'play'`, `tempoSnapshot = 120` (so `msPerBeat = 500`), `playheadMs = 1000`, and a DJ track `dj1` whose `events` includes `{ pitch: 48, t: 2.1, dur: 0.5, vel: 0.8 }` with `actionMap[48]` of category `'deck'` (no `pad`, no `pressure`) and `outputMap[48] = { device: 'global', channel: 5, pitch: 60 }`
- **WHEN** the rAF tick fires
- **THEN** the scheduler SHALL have called `output.send([0x94, 60, 102], <tsOn>)` and `output.send([0x84, 60, 0], <tsOff>)` exactly once each
- **AND** `<tsOn>` SHALL be approximately `now + (2.1 * 500 - 1000) = now + 50` ms (±2 ms jitter)
- **AND** `<tsOff>` SHALL be approximately `now + (2.6 * 500 - 1000) = now + 300` ms (±2 ms jitter)

#### Scenario: DJ events past the lookahead window are deferred

- **GIVEN** `tempoSnapshot = 120`, `playheadMs = 1000`, lookahead 100 ms, and a DJ event whose absolute start is `1500` ms (outside `[1000, 1100)`)
- **WHEN** the rAF tick fires
- **THEN** `output.send` SHALL NOT be called for that event during this tick
- **AND** the per-DJ-track cursor SHALL still point to that event for the next tick

#### Scenario: DJ events before the playhead are skipped

- **GIVEN** `playheadMs = 1000` and a DJ event whose absolute start is `250` ms (in the past)
- **WHEN** the rAF tick fires
- **THEN** `output.send` SHALL NOT be called for that event
- **AND** the per-DJ-track cursor SHALL advance past the event so subsequent ticks do not reconsider it

#### Scenario: Seek backward rebinds DJ cursors

- **GIVEN** the transport is in `mode === 'play'` with `playheadMs = 30000` and a DJ-track cursor pointing well into the events array
- **WHEN** `seek(5000)` is invoked (`playheadMs` jumps backward by more than the 17 ms epsilon)
- **THEN** the next rAF tick SHALL re-bind the DJ track's cursor by binary-searching for the first event whose `t * msPerBeat >= 5000`
- **AND** dispatch resumes from that new cursor position

#### Scenario: Loop wrap rebinds DJ cursors

- **GIVEN** the transport is in `mode === 'play'`, `looping === true`, the playhead wraps from a later beat to an earlier one such that `playheadMs` decreases by more than the 17 ms epsilon
- **WHEN** the scheduler's next tick fires
- **THEN** every DJ track's cursor SHALL be reset to the first event whose `t * msPerBeat >= playheadMs`

### Requirement: DJ row audibility predicate gates dispatch

A DJ track `t` SHALL be considered track-audible IF AND ONLY IF `t.muted === false` AND (`!sessionAnySoloed` OR `t.soloed === true` OR `t.soloedRows.length > 0`), where `sessionAnySoloed = soloing || channels.some(c => c.soloed || c.rollSoloed) || djTracks.some(t => t.soloed || t.soloedRows.length > 0)`.

A row within a track-audible track — identified by `pitch ∈ keys(t.actionMap)` — SHALL be considered row-audible IF AND ONLY IF:

- `!t.mutedRows.includes(pitch)` AND
- EITHER `!sessionAnySoloed`, OR `t.soloedRows.includes(pitch)`, OR (`t.soloed === true` AND `t.soloedRows.length === 0`).

A DJ event SHALL dispatch IF AND ONLY IF its containing row is row-audible AND its containing track is track-audible.

This predicate matches the `rowAudible` predicate defined in the `dj-action-tracks` capability's "Row audibility model" requirement. The scheduler SHALL re-evaluate audibility on every tick — toggling row M/S mid-playback affects subsequent ticks within one frame. Past events whose row was un-muted after their dispatch window passed SHALL NOT be retroactively scheduled.

#### Scenario: Track-level muted DJ track emits no events

- **GIVEN** the transport is in `mode === 'play'` and a DJ track `dj1` has `muted === true`
- **WHEN** any rAF tick fires while `dj1`'s events fall in the lookahead window
- **THEN** `output.send` SHALL NOT be called for any of `dj1`'s events

#### Scenario: Row-level muted row emits no events

- **GIVEN** the transport is in `mode === 'play'`, DJ track `dj1` has `muted === false` and `mutedRows = [48]`
- **WHEN** any rAF tick fires while events with `pitch === 48` on `dj1` fall in the lookahead window
- **THEN** `output.send` SHALL NOT be called for any of `dj1`'s events whose `pitch === 48`
- **AND** events on `dj1` whose `pitch` is not 48 SHALL dispatch per the DJ-track dispatch requirements

#### Scenario: Row-level solo dispatches only the soloed row

- **GIVEN** the transport is in `mode === 'play'`, DJ track `dj1` has `soloedRows = [48]` and `soloed === false`, no other solo state exists in the session
- **WHEN** any rAF tick fires while `dj1`'s events fall in the lookahead window
- **THEN** `output.send` SHALL be called only for `dj1`'s events whose `pitch === 48`
- **AND** `output.send` SHALL NOT be called for `dj1`'s events whose `pitch !== 48`

#### Scenario: Track-level solo with no row solo dispatches all rows in the track

- **GIVEN** DJ track `dj1` has `soloed === true` and `soloedRows === []`, no other solo state exists in the session
- **WHEN** any rAF tick fires while `dj1`'s events fall in the lookahead window
- **THEN** `output.send` SHALL be called for every event on `dj1` whose row passes the `!mutedRows.includes(pitch)` check

#### Scenario: Mid-playback row un-mute resumes from current playhead

- **GIVEN** the transport is in `mode === 'play'`, `tempoSnapshot = 120`, `playheadMs = 4000`, DJ track `dj1` started with `mutedRows = [48]` at `play()` time and has events with `pitch === 48` at `t = 0.5`, `t = 10.0`, and `t = 20.0`
- **WHEN** the user toggles `mutedRows` to `[]` mid-playback
- **THEN** subsequent rAF ticks SHALL dispatch the events at `t = 10.0` and `t = 20.0` when they enter the lookahead window
- **AND** the event at `t = 0.5` (in the past) SHALL NOT be retroactively scheduled

### Requirement: DJ note-mode dispatches note-on/note-off with outputMap as optional override

For each audible DJ event whose row's `actionMap[pitch]` has `pressure !== true`, the scheduler SHALL emit a note-on at the event's absolute start time and a matching note-off at the event's absolute end time using the same `emitNoteEvent` helper that channel-roll dispatch uses.

Concrete dispatch:

1. Resolve `action = track.actionMap[event.pitch]`. If `action === undefined`, the event SHALL be silently skipped (matches the renderer's filter behavior).
2. Resolve `mapping = track.outputMap[event.pitch]` (OPTIONAL — may be `undefined`).
3. Compute `channel = mapping?.channel ?? track.midiChannel`. The fallback to `track.midiChannel` makes DJ tracks emit by default (without requiring per-row `outputMap` configuration), mirroring how a channel-roll always emits on its own `Channel.id`.
4. Compute `channelByte = (channel - 1) & 0x0F`. Both `mapping.channel` and `track.midiChannel` are in the inclusive range `1..16` per the `dj-action-tracks` spec.
5. Compute `outputPitch = mapping?.pitch ?? event.pitch`. The fallback uses the row's own pitch as the output MIDI note, mirroring how a channel-roll's note uses `note.pitch` directly.
6. Compute `vel = Math.min(127, Math.max(1, Math.round(event.vel * 127)))`. Floor of 1 because MIDI velocity 0 is equivalent to note-off.
7. Compute `tsOn = max(performance.now(), now + (event.t * msPerBeat - playheadMs))` and `tsOff = max(performance.now(), now + ((event.t + event.dur) * msPerBeat - playheadMs))`.
8. Call `output.send([0x90 | channelByte, outputPitch, vel], tsOn)` and `output.send([0x80 | channelByte, outputPitch, 0], tsOff)`.
9. Insert an entry into `activeNoteOns` keyed by `(outputId, channelByte, outputPitch)` and insert `(outputId, channelByte)` into `channelsActivated`, so the existing panic flush covers DJ note-ons.

The cursor SHALL advance past the event after dispatch, so subsequent ticks do not re-emit it.

#### Scenario: outputMap override emits with mapping.pitch and event.vel * 127

- **GIVEN** an audible DJ event `{ pitch: 48, t: 1.0, dur: 0.5, vel: 0.5 }` with `actionMap[48].cat === 'deck'` (no `pad`, no `pressure`) and `outputMap[48] = { device: 'global', channel: 3, pitch: 60 }`, `tempoSnapshot = 120`, `playheadMs` such that the event lands in the lookahead window
- **WHEN** the rAF tick fires
- **THEN** `output.send([0x92, 60, 64], <tsOn>)` SHALL be called exactly once (channel byte 2 = channel 3 minus 1, velocity 64 = round(0.5 * 127))
- **AND** `output.send([0x82, 60, 0], <tsOff>)` SHALL be called exactly once

#### Scenario: Missing outputMap falls back to track.midiChannel + event.pitch

- **GIVEN** an audible DJ event `{ pitch: 48, t: 0.0, dur: 0.1, vel: 0.8 }` with `actionMap[48]` configured (no `pressure`), `outputMap = {}`, `track.midiChannel = 16`, `tempoSnapshot = 120`, `playheadMs = 0`
- **WHEN** the rAF tick fires
- **THEN** `output.send([0x9F, 48, 102], <tsOn>)` SHALL be called exactly once (channel byte 15 = channel 16 minus 1, output pitch = event's row pitch = 48, velocity 102 = round(0.8 * 127))
- **AND** `output.send([0x8F, 48, 0], <tsOff>)` SHALL be called exactly once

#### Scenario: Note-mode applies velocity floor of 1

- **GIVEN** an audible DJ note-mode event with `vel: 0.001` (rounds to 0)
- **WHEN** the rAF tick fires
- **THEN** the note-on velocity SHALL be `1`, not `0`

#### Scenario: Note-mode applies velocity ceiling of 127

- **GIVEN** an audible DJ note-mode event with `vel: 1.0` (rounds to 127)
- **WHEN** the rAF tick fires
- **THEN** the note-on velocity SHALL be `127`

#### Scenario: Missing actionMap entry silently skips the event

- **GIVEN** a DJ event whose `pitch` is NOT a key in the track's `actionMap` (a stale event left from an earlier action-deletion that did not clean up events)
- **WHEN** the rAF tick fires
- **THEN** `output.send` SHALL NOT be called for this event
- **AND** no error SHALL be logged

### Requirement: DJ pressure-mode dispatches note envelope plus channel-aftertouch curve

For each audible DJ event whose row's `actionMap[pitch]` has `pressure === true`, the scheduler SHALL emit a note-on/note-off envelope using the same logic as note-mode (per the "DJ note-mode dispatches note-on/note-off with outputMap as optional override" requirement) — including the same `track.midiChannel` and `event.pitch` fallbacks when `outputMap[event.pitch]` is absent — AND additionally SHALL emit a sequence of channel-aftertouch messages tracking the event's pressure curve along the event's duration. The note-on/note-off and the pressure curve share the same `channelByte` resolved from the unified rule.

The pressure source curve SHALL be selected by the event's `pressure` field:

- `pressure === undefined` — synthesise via `synthesizePressure(event, perPitchIndex)` from `src/data/pressure.ts`, where `perPitchIndex` is the count of preceding events on the same track with the same `pitch`. The synthesised curve has 14 points (`PRESSURE_CELLS = 14`).
- `pressure === []` — emit ZERO aftertouch messages (an explicitly-cleared curve).
- non-empty `pressure: PressurePoint[]` — use those points directly.

When the event is dispatched in a tick (its `event.t * msPerBeat` falls in the lookahead window), the scheduler SHALL emit ALL of its pressure points in the same tick, each with its own future timestamp computed as `max(performance.now(), now + (tsAt - playheadMs))`, where `tsAt = event.t * msPerBeat + point.t * event.dur * msPerBeat` and `atValue = Math.min(127, Math.max(0, Math.round(point.v * 127)))`. The Web MIDI implementation buffers each `output.send` call until its target timestamp arrives. Some timestamps may be far in the future (up to `event.dur * msPerBeat` past `now` for the last point); this mirrors the channel-roll's existing behavior of scheduling the matching note-off at a future timestamp in the same dispatch tick. The scheduler SHALL NOT defer pressure-point emission across rAF ticks — once the event's envelope is dispatched, the cursor advances past the event and the event is not revisited.

A throttle SHALL enforce a minimum gap between successive aftertouch messages on the same `(channelByte)`: when two points map to AT timestamps less than `AT_MIN_GAP_MS = 10` apart (computed against the most-recent AT timestamp emitted on that channelByte during this play session), the second SHALL be dropped. The throttle state SHALL survive across rAF ticks for the duration of the play session and SHALL clear on panic.

Channel-aftertouch messages SHALL NOT be inserted into `activeNoteOns` (aftertouch has no matching "off" message). The existing panic flush SHALL NOT emit an explicit AT-zero on stop; channel aftertouch is treated as stateless from the synth's perspective.

If `action === undefined` for the event, NO aftertouch is emitted (the event is silently skipped per the note-mode rules). `mapping === undefined` is NOT a skip condition for pressure-mode either — the note envelope AND pressure curve emit on `track.midiChannel` with `event.pitch` as the output pitch, exactly as in note-mode.

#### Scenario: Pressure-mode emits note envelope plus AT curve

- **GIVEN** an audible DJ event `{ pitch: 56, t: 0.0, dur: 2.0, vel: 0.8 }` with `actionMap[56] = { pressure: true, ... }`, `outputMap[56] = { device: 'deck1', channel: 1, pitch: 36 }`, `event.pressure === undefined`, `tempoSnapshot = 120` (`msPerBeat = 500`), `playheadMs = 0` placing the event start in the lookahead window
- **WHEN** the rAF tick fires that captures the event's start in its lookahead window
- **THEN** `output.send([0x90, 36, 102], <tsOn>)` SHALL be called exactly once at the event's start (note-on; `mapping.pitch === 36`, channel byte 0)
- **AND** `output.send([0x80, 36, 0], <tsOff>)` SHALL be called exactly once at the event's end
- **AND** for each of the 14 synthesised pressure points, `output.send([0xD0, <atValue>], <ts>)` SHALL be called once in the same tick (subject to throttle)
- **AND** the total count of AT messages SHALL be 14 (one per synthesised point) since synthesised 14-point curves over a 1000 ms event have ~77 ms point gaps, well above the throttle minimum

#### Scenario: Pressure points closer than the AT throttle are dropped

- **GIVEN** an audible pressure-mode event whose pressure curve has two consecutive points whose absolute times are 5 ms apart on the same channelByte
- **WHEN** the rAF tick fires
- **THEN** the first point SHALL emit an AT message
- **AND** the second point SHALL NOT emit an AT message (gap < `AT_MIN_GAP_MS = 10` ms)

#### Scenario: Empty stored pressure emits zero AT messages

- **GIVEN** an audible pressure-mode event with `event.pressure === []`
- **WHEN** rAF ticks fire across the event's duration
- **THEN** the note-on/note-off envelope SHALL be emitted per the note-mode rules
- **AND** ZERO AT messages SHALL be emitted for this event

#### Scenario: Non-empty stored pressure emits one AT per point

- **GIVEN** an audible pressure-mode event with `event.pressure = [{ t: 0.0, v: 0.0 }, { t: 0.5, v: 1.0 }, { t: 1.0, v: 0.0 }]`, sufficient spacing to clear the throttle
- **WHEN** rAF ticks fire across the event's duration
- **THEN** exactly three AT messages SHALL be emitted with values 0, 127, 0 (rounded `v * 127`)

#### Scenario: Pressure synthesis uses perPitchIndex from event order

- **GIVEN** a DJ track has events at the same `pitch` in order with `pressure === undefined`; the 0th, 1st, and 2nd events on that pitch
- **WHEN** the scheduler synthesises the pressure curve for each event
- **THEN** the curves SHALL be derived from `synthesizePressure(event, 0)`, `synthesizePressure(event, 1)`, and `synthesizePressure(event, 2)` respectively (yielding arch, rise, center-peak shapes)

#### Scenario: AT throttle state clears on panic

- **GIVEN** a play session has emitted AT messages and accumulated throttle state per channelByte
- **WHEN** the transport stops and panic flushes
- **THEN** the throttle state SHALL be cleared
- **AND** a subsequent `play()` SHALL emit AT messages starting from an empty throttle map

#### Scenario: Pressure-mode panic does not emit AT-zero

- **GIVEN** the scheduler is mid-event in a pressure-mode dispatch with `activeNoteOns` containing the envelope note-on
- **WHEN** `useTransport().stop()` is invoked
- **THEN** the existing panic flush SHALL emit the matching note-off and All-Notes-Off per the "Panic on stop silences every dispatched note-on" requirement
- **AND** the scheduler SHALL NOT emit `output.send([0xD0 | channelByte, 0x00])` as part of panic

