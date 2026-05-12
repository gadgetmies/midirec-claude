## 1. Scheduler module

- [x] 1.1 Create `src/midi/scheduler.ts` exporting a `useMidiScheduler()` hook that subscribes to `useTransport()`, `useChannels()`, `useMidiOutputs()`, and `useToast()`. The hook returns `null` (renders nothing) — it is mounted purely for its side effects.
- [x] 1.2 Inside the hook, hold the following refs (so they survive renders without re-firing effects): `rafHandle: number | null`, `tempoSnapshot: number | null`, `outputSnapshot: MidiDevice | undefined`, `outputRef: MIDIOutput | null` (the actual Web MIDI port, resolved from the snapshot via `MidiAccess.outputs`), `activeNoteOns: Map<string, { channelByte: number; pitch: number; outputId: string }>` (key = `${outputId}|${channelByte}|${pitch}`), `channelsActivated: Set<string>` (key = `${outputId}|${channelByte}`), `cursors: Map<number, number>` (channelId → next-note index), `lastPlayheadMs: number`.
- [x] 1.3 Implement `start(playheadMs: number, bpm: number, output: MidiDevice | undefined, midiOutput: MIDIOutput | null)`: populate snapshots, fire the appropriate toast (`'No output device available'` or `` `Playing to ${output.name}` ``), initialize cursors by binary-searching each channel's `notes` for the first index where `t * (60000 / bpm) >= playheadMs`, set `lastPlayheadMs = playheadMs`, and start the rAF loop.
- [x] 1.4 Implement the rAF tick: read fresh `playheadMs = useTransport().timecodeMs`; if `playheadMs < lastPlayheadMs - 17` then rebind every cursor via binary-search (seek / loop-wrap detection); for each channel that passes the mute/solo composition rule, walk its notes from the cursor and dispatch any note whose `t * msPerBeat ∈ [playheadMs, playheadMs + 100)`; advance the cursor past dispatched notes; update `lastPlayheadMs`; schedule the next frame.
- [x] 1.5 In the dispatch, compute `tsOn = performance.now() + (note.t * msPerBeat - playheadMs)` and `tsOff = performance.now() + ((note.t + note.dur) * msPerBeat - playheadMs)`. Clamp each to `>= performance.now()` before passing to `MIDIOutput.send`. Add the note-on key to `activeNoteOns` keyed by `(outputId, channelByte, pitch)`; add `(outputId, channelByte)` to `channelsActivated`. The note-off message goes out with `tsOff` directly — the implementation queues it on the OS-level driver; the active-note map only tracks it for panic.
- [x] 1.6 Implement `panic()`: for every entry in `activeNoteOns`, call `midiOutput.send([0x80 | channelByte, pitch, 0])` (no timestamp = immediate); then for every entry in `channelsActivated`, call `midiOutput.send([0xB0 | channelByte, 0x7B, 0x00])`. Order is note-offs first, then All Notes Off. Clear both collections, the cursor map, and the snapshots. Cancel the rAF handle.
- [x] 1.7 Implement an effect with `useTransport().mode` in its deps: on transition INTO `'play'` call `start(...)`; on transition OUT OF `'play'` call `panic()`. The effect MUST NOT call `start` or `panic` on `mode === 'play' → 'play'` no-op renders.
- [x] 1.8 Implement the cleanup return from the effect: if the component unmounts while `mode === 'play'`, fire `panic()` (best-effort silence on tab close).
- [x] 1.9 Add a small helper that resolves a `MidiDevice` snapshot's `id` to the live `MIDIOutput` port via `MidiAccess.outputs.get(id)`. Cache the resolved `MIDIOutput` for the duration of the play session.

## 2. Transport hook integration

- [x] 2.1 Verify in `src/hooks/useTransport.tsx` that `play()` from `'idle'` (with `timecodeMs > 0` from a prior pause) preserves `timecodeMs` and does NOT reset to 0. The existing reducer already does this — confirm with a spec scenario, no code change expected.
- [x] 2.2 Verify the reducer makes no Web MIDI calls. It already doesn't — confirm and ensure no Web MIDI imports leak into `useTransport.tsx`.
- [x] 2.3 If `play()` does not currently distinguish "fresh play from idle" vs "resume from pause" in a way the scheduler needs (e.g., a `playStartedAt` analog to `recordingStartedAt`), DO NOT add such a field in this slice — the scheduler reads `mode` transitions directly and snapshots its own internal state. No new transport fields land in this change.

## 3. App.tsx wiring

- [x] 3.1 Mount `useMidiScheduler()` exactly once at the top level of `App.tsx`, as a no-render component sibling of the existing `useMidiRecorder()` mount. Order does not matter for correctness, but place it adjacent to the recorder mount for grep-ability.
- [x] 3.2 Confirm there is no other call site for `useMidiScheduler` in the codebase (grep `useMidiScheduler` should return exactly one source-file invocation outside the module itself).

## 4. Tests

- [x] 4.1 Create `src/midi/scheduler.test.ts` mocking `MIDIOutput.send` and a fake `MIDIAccess` (reuse the harness from `MidiRuntimeProvider.test.ts` if extracted). Use Vitest's fake timers and a fake `requestAnimationFrame` so each tick is deterministic.
- [x] 4.2 Test: a single note at `t = 0.2`, `dur = 0.1`, `vel = 100`, `pitch = 60` on channel 1 with `bpm = 120` (`msPerBeat = 500`) dispatches `output.send([0x90, 60, 100], <ts>)` exactly once on the first tick where `playheadMs >= 0`, with `<ts>` ≈ `performance.now() + 100`. The matching note-off `output.send([0x80, 60, 0], <ts_off>)` fires with `<ts_off>` ≈ `performance.now() + 150`.
- [x] 4.3 Test: a note at `t = 5.0` (start at 2500 ms) is not dispatched until `playheadMs` reaches `[2400, 2500)`.
- [x] 4.4 Test: muted channel emits zero `send` calls regardless of its notes. Verify with channel 1 muted and a note that would otherwise fall in window.
- [x] 4.5 Test: solo on channel 1 silences channels 2..16. With notes on both, only channel 1's notes are dispatched.
- [x] 4.6 Test: `stop()` after a note-on with future note-off fires `[0x80 | ch, pitch, 0]` immediately AND `[0xB0 | ch, 0x7B, 0x00]` for every activated channelByte. Assert note-offs are emitted before All Notes Off in send-call order.
- [x] 4.7 Test: `play()` with `outputs.length === 0` fires `toast.show('No output device available')` exactly once and never calls `send`.
- [x] 4.8 Test: `play()` with `outputs[0].name === 'MicroFreak'` fires `toast.show('Playing to MicroFreak')` exactly once.
- [x] 4.9 Test: `seek(0)` mid-playback (jumping back) causes every channel's cursor to reset. Verify by seeking back, advancing one tick, and asserting a previously-emitted early note IS NOT re-emitted (it's in the past relative to the new playhead) but a different early note that's now in the lookahead window IS emitted.
- [x] 4.10 Test: rapid `play() → stop() → play()` cycle within <50 ms leaves `activeNoteOns` empty at the start of the second `play()`.
- [x] 4.11 Test: panic with `outputSnapshot === undefined` does not throw and does not call `send`.
- [x] 4.12 Test: mid-playback un-mute does not retroactively dispatch past notes. Mute channel 1, `play()`, advance past a note at `t = 0.5`, un-mute, advance again — the `t = 0.5` note is never dispatched; a later note at `t = 10.0` is.

## 5. Manual verification

- [x] 5.1 Connect a real MIDI output (e.g., MicroFreak, IAC bus to a soft synth) and a real MIDI input. Record a short phrase with the recorder. Press stop, then play. The phrase plays back through the output at correct pitches, velocities, timing.
- [x] 5.2 Mid-playback, press the channel mute toggle. Sound on that channel stops within one frame. Un-mute — remaining notes (those still ahead of the playhead) come back; notes that already passed do NOT replay.
- [x] 5.3 Press stop mid-playback while a long-sustained note is sounding. The note silences within one frame (no stuck note tail).
- [x] 5.4 Press play with no output device attached. A toast reads `No output device available`. The playhead advances visually; no errors.
- [x] 5.5 Press play with the output attached. A toast reads `Playing to <output.name>`.
- [x] 5.6 With the loop region enabled (`looping === true`, `loopRegion === { start: 0, end: 4 }`), press play. Acknowledge the **known limitation** (see design.md, Decision 7): notes near the loop boundary may have a ~100 ms audible tail past the wrap. Confirm this is the only audible artifact.
- [x] 5.7 `yarn typecheck` clean.
- [x] 5.8 `openspec validate play-channel-notes --strict` clean.

## 6. Out of scope (explicit non-tasks)

- [x] 6.1 DO NOT consult the Routing matrix in this slice. The scheduler always uses `outputs[0]`. (Per-channel output routing is the next backlog item.)
- [x] 6.2 DO NOT implement loop-aware lookahead clipping. Document the boundary tail bleed as a known limitation (Decision 7 in design.md).
- [x] 6.3 DO NOT add a `playStartedAt` field to `TransportState`. The scheduler tracks its own snapshots.
- [x] 6.4 DO NOT dispatch CC, pitch-bend, or aftertouch from the scheduler. Note-on / note-off / All Notes Off only.
- [x] 6.5 DO NOT react to mid-playback `bpm` changes. The tempo snapshot is final per play session.
- [x] 6.6 DO NOT re-evaluate `outputs[0]` on mid-playback hotplug. The output snapshot is final per play session.
