## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Scheduler uses a single unified dispatch loop over all playable sources

While `useTransport().mode === 'play'`, each rAF tick SHALL run a SINGLE dispatch loop that walks every playable source — channel-rolls AND DJ action tracks — in the same loop body. There SHALL NOT be parallel dispatch pipelines for the two source kinds. Every emitted MIDI message (note-on, note-off, channel-aftertouch) SHALL flow through a single internal `emitNoteEvent` helper that handles the byte-level `output.send` calls, the `activeNoteOns` update, the `channelsActivated` update, and the pressure-aftertouch sub-emit.

Each playable source SHALL provide:

- A stable `cursorKey: string` (e.g. `'ch:1'` for channel id 1, `'dj:dj1'` for DJ track id `'dj1'`).
- A sorted `events: { t: number; dur: number; ... }[]` list.
- A per-event `resolveEmit(event, sessionAnySoloed)` that returns either `null` (event SHALL be silently skipped — audibility, missing action, etc.) or a `{ channelByte, pitch, vel, pressure? }` object describing the bytes to emit.

The unified loop SHALL maintain one `cursors: Map<string, number>` (keyed by `cursorKey`) for both source kinds. On every rAF tick the cursor for each source SHALL resume from its prior position; on non-monotonic playhead jumps (`playheadMs < lastPlayheadMs - 17`), every source's cursor SHALL be re-bound by binary-search for the first event whose `t * msPerBeat >= playheadMs`. This SHALL run in a single `rebindCursors` pass that iterates all sources.

When `outputSnapshot === undefined`, the dispatch loop SHALL be a no-op for every source (matching the existing channel-roll behavior under "Play with no output emits a toast and no-ops the scheduler" — no separate toast for DJ tracks).

#### Scenario: DJ track events emit during play

- **GIVEN** the transport is in `mode === 'play'`, `tempoSnapshot = 120` (so `msPerBeat = 500`), `playheadMs = 1000`, and a DJ track `dj1` whose `events` includes `{ pitch: 48, t: 2.1, dur: 0.5, vel: 0.8 }` with `actionMap[48]` of category `'transport'` (no `pad`, no `pressure`) and `outputMap[48] = { device: 'global', channel: 5, pitch: 60 }`
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

- **GIVEN** an audible DJ event `{ pitch: 48, t: 1.0, dur: 0.5, vel: 0.5 }` with `actionMap[48].cat === 'transport'` (no `pad`, no `pressure`) and `outputMap[48] = { device: 'global', channel: 3, pitch: 60 }`, `tempoSnapshot = 120`, `playheadMs` such that the event lands in the lookahead window
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
