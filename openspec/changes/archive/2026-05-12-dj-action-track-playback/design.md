## Context

The just-archived `play-channel-notes` slice built a lookahead-rAF scheduler at `src/midi/scheduler.ts` that walks each channel's notes, emits note-on/note-off with sample-accurate timestamps via `MIDIOutput.send`, panics on stop, and rebinds per-channel cursors on seek/loop wraps. That scheduler ignores `useStage().djActionTracks` entirely. DJ tracks render in the timeline (Slice 7b) and carry both an `actionMap: Record<pitch, ActionMapEntry>` (input binding catalog per track) and an `outputMap: Record<pitch, OutputMapping>` (per-row emission config). Each event has a `t`, `dur`, `vel`, and optional `pressure: PressurePoint[]`. The pressure curve has three states: `undefined` (synthesise via `synthesizePressure(event, perPitchIndex)`), `[]` (explicitly cleared — no AT), or non-empty (use rasterised values).

The existing scheduler is structured around `ChannelSnapshot`s passed to `start` / `tick`. The cleanest extension is a parallel `DJTrackSnapshot[]` argument feeding a parallel dispatch loop that re-uses the lookahead window, `tempoSnapshot`, `outputSnapshot`, `activeNoteOns`, `channelsActivated`, `panic`, and cursor-rebind logic.

The OutputMapping shape in `src/data/dj.ts` is `{ device: DeviceId, channel: 1..16, pitch: 0..127 }`. `DeviceId` is an abstract category (`'deck1'`/`'fx1'`/`'global'` etc.) — NOT a real MIDIOutput id. There is no `cc?: number` field; there is no `outputId` field.

## Goals / Non-Goals

**Goals:**
- DJ track events emit MIDI to the same `outputSnapshot` the channel-roll scheduler uses today, on the `OutputMapping.channel - 1` channel byte, with the `OutputMapping.pitch` as the MIDI note.
- Pressure-bearing rows emit a stream of channel aftertouch messages along each event's duration, sampled from `event.pressure` (or `synthesizePressure(event, perPitchIndex)` when `undefined`, or no AT at all when `[]`).
- The new dispatch path SHALL share lookahead, tempo/output snapshots, `activeNoteOns`, the activated-channel set, panic, and seek/loop cursor rebind with the channel-roll dispatch path. One scheduler, one rAF loop.
- Track audibility and row audibility SHALL match the predicates already defined in the `dj-action-tracks` capability ("Row audibility model" requirement) so the visual `data-audible` state and the audible MIDI stream stay in lock-step.

**Non-Goals:**
- Per-track real-output routing. All DJ rows route to the same `outputSnapshot` as channel-roll. Per-track routing is a separate backlog entry; this slice does not introduce a `device → output` resolver.
- Configurable CC# emission for pressure-bearing actions. The BACKLOG entry mentions "CC#74" as an example, but `OutputMapping` has no `cc?: number` field today. Channel aftertouch (status byte `0xD0 | channelByte`) is used instead — matches the data shape's "aftertouch curve" naming and avoids extending `OutputMapping`. Adding a `cc?: number` field is a follow-up if user demand surfaces.
- Polyphonic key pressure (`0xA0 | channelByte, pitch, value`). Channel aftertouch is one byte cheaper, simpler to panic-clear, and what hardware DJ controllers typically send.
- Tempo change mid-playback. The channel-roll scheduler already snapshots `tempo` at `start()`; this slice inherits that constraint.
- Input mapping. DJ tracks have an `inputRouting` field, but live MIDI capture into DJ tracks is a separate concern from playback emission.
- A second `outputSnapshot` for DJ tracks. The user can only choose one output today (`outputs[0]`); extending the picker UI is out of scope.

## Decisions

### Decision 1: One scheduler, one rAF loop, parallel dispatch paths

The DJ dispatch is a second loop inside `scheduler.tick`, run after the channel-roll loop. The `tick` and `start` function signatures extend to accept a `DJTrackSnapshot[]` argument; the existing `ChannelSnapshot[]` argument is unchanged.

**Why over alternatives:**
- *Alternative A — second scheduler instance with its own rAF*: doubles the rAF subscriptions; complicates panic ordering (which scheduler panics first?); makes the `activeNoteOns` map ambiguous; two output snapshots can diverge. Rejected.
- *Alternative B — convert DJ events to fake channel snapshots and reuse the channel-roll loop unchanged*: forces every DJ event to fake a `Note { pitch, t, dur, vel }`, but `vel` is 0..1 in DJ-land and 0..127 in channel-land, and there is no place to attach the pressure curve. The channel-roll loop has no concept of aftertouch sampling. Rejected.

The chosen approach keeps the dispatch logic in one module, shares state cleanly, and isolates the new code to a single dedicated loop.

### Decision 2: Pressure sample cadence — one sample per pressure-point, throttled to ≥10 ms apart

The pressure curve in `event.pressure` is a `PressurePoint[]` with `t ∈ [0, 1]` note-relative. The synthesised default has 14 points (`PRESSURE_CELLS = 14`); user-stored curves have up to ~16 points (`EDITOR_BINS`). On every rAF tick the scheduler walks each in-window pressure-bearing event and emits one `[0xD0 | channelByte, atValue]` per point whose absolute time `event.t * msPerBeat + point.t * event.dur * msPerBeat` falls in `[playheadMs, playheadMs + lookaheadMs)`. The `atValue` is `Math.round(point.v * 127)` clamped to `0..127`.

A minimum gap of 10 ms between successive AT messages on the same `(channelByte)` SHALL be enforced — if two pressure points map to AT timestamps less than 10 ms apart, the second is dropped. This caps the worst-case bandwidth at 100 AT messages/sec per channel, which is well within MIDI 1.0's 31.25 kbit/s ceiling (a 2-byte AT message is ~640 µs over a serial link).

**Why over alternatives:**
- *Alternative — fixed 10 ms cadence regardless of pressure-point density*: would over-sample sparse curves (a 2-point curve would emit 100 redundant AT messages for a 1 s event) and would conflate "sample the curve" with "emit at uniform cadence." The chosen approach lets the editor's point density drive emission density.
- *Alternative — one sample per point with no throttle*: a future heavy-handed curve with 100 points crammed into a 200 ms event would burst messages faster than 10 ms apart. The throttle bounds the worst case without affecting normal use (synthesised 14-point curves over typical 200–500 ms events stay well above 10 ms apart).

The throttle is a simple "did we emit on this channelByte less than 10 ms ago?" check, kept in a per-tick local map; no state survives between ticks.

### Decision 3: Pressure message kind — channel aftertouch (status byte 0xD0)

Pressure curves emit as `[0xD0 | channelByte, value]` (channel pressure, two bytes). Polyphonic key pressure (`0xA0 | channelByte, pitch, value`) is also valid but rejected — channel pressure is one byte smaller, what most DJ controllers emit, and channel-wide so it doesn't interact with the row's `OutputMapping.pitch`.

CC-based pressure (e.g. CC#74 from the BACKLOG example) is rejected for this slice — `OutputMapping` has no `cc?` field. Extending the data shape is a follow-up. The "Status" line of the relevant BACKLOG entry will be updated when this slice archives, calling out this deferral.

### Decision 4: Real output device resolution — single `outputSnapshot` for both channel-roll and DJ

All DJ events emit to the same `outputSnapshot` the channel-roll scheduler uses (`useMidiOutputs().outputs[0]` captured at `start()` time). `OutputMapping.device` (e.g. `'deck1'`, `'global'`) is NOT resolved to a real MIDIOutput in this slice.

**Why over alternatives:**
- *Alternative — extend `OutputMapping` with an `outputId: string`*: forces a UI for picking real outputs per row, which doesn't exist. Schema migration. Rejected for this slice.
- *Alternative — introduce a session-level `Record<DeviceId, MIDIOutput | null>` map*: also requires a new UI surface (the routing picker). Rejected.

If `outputSnapshot === undefined` (no output device), DJ dispatch is a no-op exactly as channel-roll dispatch is — the existing "Play with no output emits a toast and no-ops the scheduler" requirement covers this without modification. The "No output device available" toast already fires.

When per-track output routing arrives (separate backlog entry "Per-channel output routing in playback — Routing matrix becomes live"), it will either extend `OutputMapping` or add a parallel routing layer. Either path is forward-compatible with the current slice's emit-to-snapshot behavior.

### Decision 5: Per-DJ-track cursor uses the same shape as per-channel cursor

The scheduler already maintains `cursors: Map<number, number>` keyed by channel id. For DJ tracks, a parallel `djCursors: Map<DJTrackId, number>` keyed by string track id. The seek-back rebind logic — comparing `playheadMs` to `lastPlayheadMs` and binary-searching when the gap exceeds the 17 ms epsilon — runs identically on `djCursors`. `lastPlayheadMs` and `tempoSnapshot` are shared.

`rebindCursors` extends to also rebind `djCursors` from each track's `events` array.

### Decision 6: Audibility composition follows the `rowAudible` predicate already in spec

The `dj-action-tracks` spec defines:

```
rowAudible(track, pitch, soloing) =
  !track.mutedRows.includes(pitch)
  && trackAudible(track, soloing)
  && (!soloing
      || track.soloedRows.includes(pitch)
      || (track.soloed && track.soloedRows.length === 0))
```

The scheduler SHALL use exactly this predicate, treating the channel-roll `anySoloed` computation as part of the session-wide `soloing` flag — i.e. the scheduler computes `anySoloed = soloing || channels.some(c => c.soloed || c.rollSoloed) || djTracks.some(t => t.soloed || t.soloedRows.length > 0)` (the last term is new for this slice), then applies `rowAudible` per (track, pitch).

**Why:** mixing channel-roll solo and DJ-row solo into a single `anySoloed` lets the user solo a channel and unmute everything else, OR solo a DJ row and unmute everything else, OR solo both and hear both. This matches the "Soloing flag combines channel and dj-action-track solo" requirement already in the `dj-action-tracks` spec, which defines the rendering side; the scheduler side reads the same condition for audibility.

### Decision 7: `outputMap` miss is a silent skip; `actionMap` miss is also a silent skip

Per the `dj-action-tracks` spec: an event whose `pitch` is not in `actionMap` is filtered out at render time without error; an action MAY have an `actionMap` entry but no corresponding `outputMap` entry (treated as no-emit). The scheduler mirrors this — both misses are silent skips, no toast, no console message. This keeps the dispatch tight inside the rAF hot path.

### Decision 8: Velocity scaling — `Math.round(event.vel * 127)` clamped to 1..127 for note-on, 0 for note-off

DJ `event.vel` is `0..1`. MIDI velocity is `0..127`. Note-on velocity of 0 is equivalent to note-off in MIDI spec, so the floor for note-on is 1 (clamped). Note-offs use velocity 0 (the channel-roll scheduler does the same).

### Decision 9: `perPitchIndex` for pressure synthesis is the event's position among that pitch's events on the track

`synthesizePressure(event, perPitchIndex)` produces three shapes (arch/rise/center-peak) depending on `perPitchIndex % 3`. The renderer uses the event's position in the row to compute this; the scheduler SHALL use the same computation so that scheduler-emitted AT and renderer-displayed pressure curve match. Concretely: `perPitchIndex` is the count of preceding events on the same track with the same `pitch`. Computed once per (track, event) when building the snapshot.

## Risks / Trade-offs

- [**Risk**: AT throttle at 10 ms could starve very-fast-pressure transients (e.g. a 5-point curve compressed into a 30 ms event)] → Mitigation: the throttle is 10 ms not 100 ms; 5 points over 30 ms means 6 ms gaps which would drop alternate points, leaving 3 of 5 emitted — degraded but not silent. If users complain, lower to 5 ms or expose as a per-row setting.
- [**Risk**: Channel aftertouch is not what the user expected (BACKLOG mentioned CC#74)] → Mitigation: pressure-bearing dispatch is documented as channel-aftertouch in the new spec requirement; a future `OutputMapping.cc?` field can override. The decision is reversible without rework — the dispatch loop just changes one status byte.
- [**Risk**: Two pressure-bearing events overlap on the same channelByte, and their AT streams interleave] → Mitigation: the throttle is per-channelByte per-tick, so interleaving emits both streams at their natural cadence with a global 10 ms minimum gap. Synth-side this looks like channel aftertouch from a single source — acceptable. Future polyphonic-AT slice can disambiguate.
- [**Risk**: DJ track walk adds enough work per tick to miss frame deadlines on dense sessions] → Mitigation: the loop is per-event O(1) and bounded by lookahead-window event count; the synthesised curve allocates 14 points per call but `synthesizePressure` is pure and JIT-friendly. If profile shows hot, memoize per (eventIdx, perPitchIndex) inside the snapshot builder. Defer until measured.
- [**Risk**: `outputSnapshot` is the channel-roll's snapshot but the user's mental model maps DJ tracks to "their own device"] → Mitigation: this is documented in the new spec requirement and in the BACKLOG entry's "Status" deferral note. When per-track output routing lands, this slice's behavior is the default-no-routing case.
- [**Risk**: Panic mid-pressure-event leaves the synth's channel-pressure "stuck" at the last sent value] → Mitigation: channel aftertouch is stateless from the synth's perspective in the sense that MIDI doesn't require an AT-zero on note-off. But some synths cache it. The existing panic emits `0xB0 | channelByte, 0x7B, 0x00` (All Notes Off, CC 123) on every activated channel — this does NOT reset channel pressure. If users report stuck AT, add `0xD0 | channelByte, 0x00` to the panic flush as a forward-compatible addition (no spec change to channel-roll panic, additive to the new DJ panic requirement).

## Open Questions

1. **Should the panic flush emit `0xD0 | channelByte, 0x00` on every channelByte that emitted any AT during the play session?** Defer to first-pass implementation: if the manual verification step "press stop during a sustained pressure event → the synth's modulation immediately falls to zero" passes without this addition, leave it out. Add only if observed stuck AT in testing.
2. **`perPitchIndex` calculation cost**: building the snapshot computes a Map<pitch, runningCount> across `track.events`. For 100-event tracks this is trivial; for 10k-event tracks it's a per-tick allocation of one Map. Acceptable for now; revisit if the snapshot builder shows up in a profile.
3. **AT throttle constant (10 ms)**: derived from "100 Hz is a reasonable controller poll rate" and "MIDI bandwidth ~3 kHz for 2-byte messages." Could be 5 ms or 20 ms with no spec change. Defer to measured behavior; lock in via a named constant `AT_MIN_GAP_MS = 10` so future tuning is one-edit.
