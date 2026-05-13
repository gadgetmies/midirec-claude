## ADDED Requirements

(none)

## MODIFIED Requirements

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

## REMOVED Requirements

(none)
