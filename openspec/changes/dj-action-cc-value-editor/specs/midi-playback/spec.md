## ADDED Requirements

### Requirement: DJ Pitch-bend mode dispatches Pitch-bend messages

For each audible DJ event whose **resolved output mapping** has **`out === 'pb'`** (`track.outputMap[event.pitch].out`), the scheduler SHALL **not** enqueue note-on/note-off for that event via the note-mode path AND SHALL NOT emit Control Change. Instead, it SHALL call `output.send([0xE0 | channelByte, lsb, msb], ts)` where:

1. `channelByte` is resolved identically to note-mode: `(mapping?.channel ?? track.midiChannel - 1) & 0x0f`.
2. `value14 = Math.max(0, Math.min(16383, Math.round(event.vel * 16383)))`.
3. `lsb = value14 & 0x7F` (low 7 bits).
4. `msb = (value14 >> 7) & 0x7F` (high 7 bits).
5. `ts` is `max(performance.now(), now + (event.t * msPerBeat - playheadMs))` for the **start** of the event window; **MVP:** a **single** Pitch-bend dispatch per event at that timestamp (no note envelope).

The 14-bit value SHALL center at `vel === 0.5` (`Math.round(0.5 * 16383) = 8192`, MIDI's `0x2000` neutral). The `outputMap[pitch].cc` field SHALL be ignored when `out === 'pb'`. The `outputMap[pitch].pitch` field SHALL be ignored for wire-level emit but remains persisted for UI and migration purposes.

PB events SHALL **not** insert keys into `activeNoteOns`. They SHALL participate in `channelsActivated` so that the per-channel All-Notes-Off broadcast still fires for channels carrying PB rows.

The cursor SHALL advance past the event after dispatch, matching other DJ modes.

#### Scenario: PB row emits a 14-bit Pitch-bend at center for vel 0.5

- **GIVEN** an audible DJ event `{ pitch: 80, t: 1.0, dur: 0.25, vel: 0.5 }`, `outputMap[80] === { device: 'mixer', channel: 2, out: 'pb' }`, `tempoSnapshot = 120`, and the event lies in the lookahead window
- **WHEN** the rAF tick fires
- **THEN** `output.send([0xE1, 0x00, 0x40], <ts>)` SHALL be called exactly once (LSB 0, MSB 64 → 14-bit 8192)
- **AND** no `0x90` / `0x80` pair SHALL be sent for this event
- **AND** no `0xB1` CC message SHALL be sent for this event

#### Scenario: PB row emits min and max correctly

- **WHEN** `event.vel === 0` on a PB row
- **THEN** the emitted message SHALL be `output.send([0xE0 | channelByte, 0x00, 0x00], ...)` (14-bit value 0)
- **WHEN** `event.vel === 1`
- **THEN** the emitted message SHALL be `output.send([0xE0 | channelByte, 0x7F, 0x7F], ...)` (14-bit value 16383)

#### Scenario: PB row ignores cc field

- **WHEN** `outputMap[80] === { device: 'mixer', channel: 2, cc: 7, out: 'pb' }`
- **THEN** the scheduler SHALL emit Pitch-bend on channel 2 (not Control Change on CC 7)

### Requirement: Scheduler emits PB center at song start for every PB-output channel

At play start (when `useTransport().mode` transitions to `'play'` via `play()` from a non-play state), and BEFORE the first scheduled event of the play session is dispatched, the scheduler SHALL emit one `output.send([0xE0 | channelByte, 0x00, 0x40], <immediate-or-tick-0-ts>)` (14-bit value 8192, MIDI neutral) for every distinct `(outputId, channelByte)` pair that has at least one row across the session whose resolved output is `out === 'pb'`.

The tick-0 emit SHALL happen exactly once per play session — even if a row's first painted event is itself at tick 0 with `vel === 0.5`, the tick-0 center emit and the row's tick-0 event MAY produce two equivalent messages; this is acceptable. No tick-0 emit SHALL happen for CC rows or note rows (preserving existing behavior).

A "PB-output row" SHALL include both `out === 'pb'` (explicit) and any legacy back-compat form that resolves to PB (currently none — `out` is the only PB discriminator).

#### Scenario: Play start emits PB center on every PB channel

- **GIVEN** the session has two PB-output rows, one with resolved channel byte `1` and one with resolved channel byte `5`, both routed to the same `outputId`
- **WHEN** `play()` is invoked from a non-play state
- **THEN** the scheduler SHALL emit `output.send([0xE1, 0x00, 0x40], ...)` exactly once
- **AND** SHALL emit `output.send([0xE5, 0x00, 0x40], ...)` exactly once
- **AND** both emits SHALL precede the dispatch of the first painted event in the play session

#### Scenario: No PB tick-0 emit for CC-only sessions

- **GIVEN** the session has CC-out and note-out rows but no PB-output rows
- **WHEN** `play()` is invoked
- **THEN** the scheduler SHALL NOT emit any `0xE_` Pitch-bend message at session start

## MODIFIED Requirements

### Requirement: DJ CC-out mode dispatches Control Change messages

For each audible DJ event whose **resolved output mapping** has **`out === 'cc'`**, OR has `out` unset AND `cc !== undefined` in `0..127` (back-compat for legacy data) — referred to here as a "CC-output row" — the scheduler SHALL **not** enqueue note-on/note-off for that event via the note-mode path and SHALL NOT emit Pitch-bend. Instead, it SHALL call `output.send([0xB0 | channelByte, cc, value], ts)` where:

1. `channelByte` is resolved identically to note-mode: `(mapping?.channel ?? track.midiChannel - 1) & 0x0f`.
2. `cc` is `mapping.cc` (after clamping `0..127`). When `out === 'cc'` AND `cc` is absent or out of range, the event SHALL be silently skipped (no dispatch).
3. `value` is `Math.min(127, Math.max(0, Math.round(event.vel * 127)))` (**zero allowed** for CC level, unlike note-on velocity floor).
4. `ts` is `max(performance.now(), now + (event.t * msPerBeat - playheadMs))` for the **start** of the event window; **MVP:** a **single** CC dispatch per event at that timestamp (no note envelope).

CC-out events SHALL **not** insert keys into `activeNoteOns`. They SHALL still participate in `channelsActivated` / All-Notes-Off behavior only if the implementation already ties ANO to channel activity — if not, channel activity for CC-only rows MAY register only the `(outputId, channelByte)` pair without a held note.

The cursor SHALL advance past the event after dispatch, matching other DJ modes.

When `out === 'note'` (explicit) or `out` is unset AND `cc === undefined`, dispatch SHALL follow the note-mode requirement; the CC path SHALL NOT fire even if `cc` happens to be present from stale data when `out === 'note'`.

#### Scenario: Mixer row with out:'cc' emits control change

- **GIVEN** an audible DJ event `{ pitch: 80, t: 1.0, dur: 0.25, vel: 0.5 }`, `outputMap[80] === { device: 'mixer', channel: 2, cc: 7, out: 'cc' }`, `tempoSnapshot = 120`, and the event lies in the lookahead window
- **WHEN** the rAF tick fires
- **THEN** `output.send([0xB1, 7, 64], <ts>)` SHALL be called exactly once (`0xB0|channel 1`, CC 7, value 64)
- **AND** no `0x90` / `0x80` pair SHALL be sent for this event

#### Scenario: Legacy CC row with no out field still emits CC

- **GIVEN** an audible DJ event with `outputMap[80] === { device: 'mixer', channel: 2, pitch: 80, cc: 7 }` (no `out` field)
- **WHEN** the rAF tick fires
- **THEN** `output.send([0xB1, 7, value], <ts>)` SHALL be called (back-compat)
- **AND** no `0xE_` Pitch-bend message SHALL be sent

#### Scenario: out:'note' suppresses CC even when cc is set

- **GIVEN** an audible DJ event with `outputMap[80] === { device: 'mixer', channel: 2, pitch: 80, cc: 7, out: 'note' }`
- **WHEN** the rAF tick fires
- **THEN** the scheduler SHALL emit note-on/note-off per the note-mode requirement
- **AND** SHALL NOT emit Control Change for this event

#### Scenario: CC value allows zero

- **GIVEN** an audible CC-out DJ event with `vel: 0`
- **WHEN** the rAF tick fires
- **THEN** the third byte of the CC message SHALL be `0`

#### Scenario: Missing mapping.cc on out:'cc' silently skips dispatch

- **GIVEN** an audible DJ event whose `outputMap[pitch] === { device, channel, pitch, out: 'cc' }` (no `cc` field)
- **WHEN** the rAF tick fires
- **THEN** no MIDI message SHALL be emitted for this event
- **AND** the cursor SHALL still advance past the event

#### Scenario: Missing mapping with cc absent and out unset falls back to note-mode

- **GIVEN** an audible DJ event whose `outputMap[pitch]` is absent OR has no `cc` field and no `out` field
- **WHEN** the rAF tick fires and `pressure !== true`
- **THEN** dispatch SHALL follow the "DJ note-mode dispatches note-on/note-off with outputMap as optional override" requirement

### Requirement: Panic on stop silences every dispatched note-on

The scheduler SHALL maintain an `activeNoteOns` map keyed by `(outputId, channelByte, pitch)` containing every note-on it has dispatched whose matching note-off has not yet been delivered (the note-off `timestamp` is in the future relative to wall-clock now).

When `useTransport().mode` transitions away from `'play'` (via `stop()` or `pause()`, or any externally-induced mode change to a non-`'play'` state), the scheduler SHALL emit panic:

1. For every entry `(outputId, channelByte, pitch)` in `activeNoteOns`, dispatch `output.send([0x80 | channelByte, pitch, 0])` with no future timestamp (immediate). The `output` SHALL be the one identified by `outputId` (in this slice this is always the same `outputSnapshot`).
2. For every distinct `(outputId, channelByte)` that produced any dispatch during the play session (including channels whose notes all finished naturally before stop), dispatch `output.send([0xB0 | channelByte, 0x7B, 0x00])` with no future timestamp. This is CC #123 "All Notes Off" with value 0.
3. For every distinct `(outputId, channelByte)` that has at least one PB-output row across the session, dispatch `output.send([0xE0 | channelByte, 0x00, 0x40])` with no future timestamp. This re-centers any pending pitch-bend on those channels to MIDI's `0x2000` neutral. The PB-center broadcast SHALL fire whether or not any PB event was actually dispatched during the play session (the row's existence is enough — receivers might be holding a center value from the prior tick-0 emit or from a partial paint that left a non-center value).
4. Clear `activeNoteOns` and the per-channel-byte activity set. Cancel any pending rAF handle. Clear `tempoSnapshot` and `outputSnapshot`.

Note-offs SHALL be sent before All Notes Off messages within the same panic flush. PB-center broadcasts SHALL be sent AFTER All Notes Off in the same panic flush. (Note-offs are precise; All Notes Off and PB-center are belt-and-suspenders broadcasts.)

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

#### Scenario: Panic re-centers PB on every channel carrying a PB row

- **GIVEN** the session has PB-output rows resolving to channel bytes `1` and `5` AND the play session emitted PB events on both
- **WHEN** `useTransport().stop()` is invoked
- **THEN** the scheduler SHALL emit `output.send([0xE1, 0x00, 0x40])` exactly once
- **AND** SHALL emit `output.send([0xE5, 0x00, 0x40])` exactly once
- **AND** both PB-center emits SHALL happen AFTER the All-Notes-Off broadcasts for those channels in the same panic flush

#### Scenario: Panic emits PB center even when no PB event dispatched this session

- **GIVEN** the session has a PB-output row resolving to channel byte `1` but no events on that row were inside the play session window (so no PB messages were actually sent)
- **WHEN** `useTransport().stop()` is invoked
- **THEN** the scheduler SHALL still emit `output.send([0xE1, 0x00, 0x40])` exactly once (the row's existence triggers the broadcast)

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
