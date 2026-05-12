## Context

The two earlier E2E slices established:

- **`midi-runtime`**: a singleton `MIDIAccess` wrapper (`src/midi/access.ts`), a `MidiRuntimeProvider` exposing `useMidiInputs()` / `useMidiOutputs()`, permission/banner UX, and hotplug-driven live device arrays.
- **`midi-recording`**: a `useMidiRecorder()` hook mounted once in `App.tsx`, an active-note map keyed by `pitch`, hung-note finalization, rAF-coalesced `appendNote` dispatch, and a `selectedChannelId`-only routing contract on the inbound side.

The transport layer (`src/hooks/useTransport.tsx`) advances `timecodeMs` via a `requestAnimationFrame` loop while `mode !== 'idle'`. The reducer-based state machine already supports `play`/`pause`/`stop`/`record`/`seek` plus loop-region wrapping. `useChannels` exposes `channels` and `rolls` (one `PianoRollTrack` per channel) where each roll's `notes: Note[]` is the source of truth for what to schedule. `Note` is `{ t: number; dur: number; pitch: number; vel: number }` with `t` and `dur` in beats (not ms), consistent with the recorder's `appendNote` writes.

This slice closes the third (final) E2E loop by adding the outbound side: an rAF-driven scheduler that turns `PianoRollTrack.notes` into `MIDIOutput.send` calls. It does not change the recorder, the transport state machine's existing fields, or any visual contract.

A key constraint: the only existing tempo source is `useTransport().bpm` (number, default 124). The session has a single global tempo; tempo automation is not a thing this codebase models. The scheduler captures this snapshot at `play()` time and uses it for the duration of the play session.

## Goals / Non-Goals

**Goals:**

- Pressing **Play** with at least one connected `MIDIOutput` causes recorded (or fixture) notes to play back through the hardware with sub-millisecond timing precision, sustained over arbitrary session lengths without timing drift, regardless of frame-rate stutter or tab inactivity (within the lookahead budget).
- Pressing **Stop** silences all currently-sounding notes within one frame — no stuck notes, no zombie tails, even if the user pulled the cable mid-playback (the panic message is sent regardless of whether the synth still receives it; correctness is the synth's responsibility once the cable is back).
- Mute/solo state on `useChannels` affects playback in real time. Toggling solo on channel 2 mid-playback silences channels 1, 3..16 on the next frame.
- The scheduler is a self-contained module that does **not** require changes to the visual transport contracts (LED, button accent, animations, disabled-state rules).
- The data shape of the active-note map is forward-compatible with the next backlog item (per-channel output routing via the Routing matrix) — i.e., it's keyed by `(outputId, channelByte, pitch)` so multi-output panic works without a refactor.

**Non-Goals:**

- Per-channel output routing via the Routing matrix. The scheduler reads `useMidiOutputs().outputs[0]` and stops there. The matrix exists in the UI but its state is decorative for this slice.
- Multi-output layering, output-channel rewrite, looped playback (the playhead does wrap when `looping === true && loopRegion != null` per the existing transport contract, but the scheduler does NOT specially re-emit notes around the loop boundary — described as risk below).
- Count-in / pre-roll, tempo automation, MTC sync, clock-source switching during playback.
- CC / pitch-bend / aftertouch dispatch. The scheduler emits only note-on and note-off messages plus the panic All Notes Off CC.
- Reactivity to `bpm` changes during playback. Tempo is snapshotted at `play()` time. A mid-playback `bpm` change is documented as "may cause timing artifacts" — not a bug.

## Decisions

### Decision 1: rAF-driven lookahead scan, not a Web Audio context

**Choice**: Use `requestAnimationFrame` with a 100 ms lookahead window and the Web MIDI API's `MIDIOutput.send(data, timestamp)` for sample-accurate hardware delivery.

**Alternative considered**: A Web Audio `AudioContext.currentTime`-based scheduler with `setInterval` polling. This is the literal "Tale of Two Clocks" pattern. Rejected because:

1. The Web MIDI `timestamp` argument **is** the high-precision clock for outbound MIDI — it accepts a `performance.now()`-relative DOMHighResTimeStamp and hands it directly to the OS driver, which is the same surface Web Audio uses internally for its sample clock. Spawning an `AudioContext` just to read `currentTime` adds an unrelated dependency (audio device, sample-rate negotiation) for zero gain.
2. We already have an rAF loop in `useTransport` advancing `timecodeMs`. Co-locating the scheduler's tick with the transport tick keeps both reading the same `performance.now()` source. A second `setInterval` would jitter independently and require its own teardown.
3. Per the user's recorded preferences (memory: "MIDI-only tool — no audio generation"), this app emits **only** MIDI. Creating an `AudioContext` invites the wrong mental model.

**Rationale**: The scheduler mirrors the existing recorder's lifecycle (a `useMidiScheduler()` hook mounted once in `App.tsx`, an effect that runs on every animation frame while `mode === 'play'`). The 100 ms lookahead is the conventional choice (Wilson recommends 100 ms in the original write-up); at 60 fps each tick has 16.7 ms of frame budget but must enqueue notes up to 100 ms ahead, leaving comfortable slack for tab inactivation (Chrome throttles background rAF to ~1 Hz; with a 100 ms lookahead we'd still over-promise — but that's correct: a backgrounded tab is documented to glitch, and the timestamp argument means already-enqueued messages still play on time).

### Decision 2: Per-channel cursor to avoid O(N) note scanning

**Choice**: Each playback session maintains a `nextNoteIndex: number` cursor per channel. On every tick we resume scanning from the cursor instead of `notes[0]`. When `notes[cursor].t * msPerBeat >= playheadMs + lookaheadMs` we stop and remember the cursor for the next tick.

**Rationale**: `PianoRollTrack.notes` is sorted by `t` (a session-model invariant — append-only writes from the recorder, plus piano-roll edits maintain order). Without the cursor, every tick at 60 fps walks every note in the channel — at a multi-minute take with thousands of notes that's gratuitous wasted work in the render loop. The cursor reduces per-tick work to O(notes added in the last 100 ms + 1).

**Cursor invalidation**: `seek()` (or any non-monotonic playhead movement) MUST reset every channel's cursor. The scheduler subscribes to the `timecodeMs` change and, when it detects a non-monotonic jump (i.e., `newTimecode < lastSeenTimecode - epsilon`), it re-binary-searches each channel's `notes` to find the first index with `t * msPerBeat >= newTimecode`. `notes` is sorted, so this is O(log N) per channel.

**Mutability during playback**: If a note is appended to a channel mid-playback (the recorder shouldn't run while playing — `mode === 'record'` and `mode === 'play'` are mutually exclusive — but a user could conceivably edit a roll mid-playback), the cursor may become stale. We accept this: an edited note that falls into the *past* of the cursor is silently skipped (it would have been emitted already if the edit had happened earlier), and an edit that falls into the *future* of the cursor is picked up naturally on the next tick. This is good enough for a slice that doesn't ship mid-playback editing as a feature.

### Decision 3: Panic key is `(outputId, channelByte, pitch)` even though only one output is used

**Choice**: The `activeNoteOns` map is keyed by the tuple `(outputId, channelByte, pitch)` and stores `{ offTimestamp: number }`. On `stop()`, we iterate the map and emit a note-off + All Notes Off for every distinct `(outputId, channelByte)`.

**Alternative considered**: Key by `(channelByte, pitch)` and use a `Set<number>` of "channels touched" for the All Notes Off pass. Simpler, but locks us into single-output for the next slice's data model.

**Rationale**: The next backlog item (per-channel routing) will route different channels to different outputs and may layer a channel to N outputs. That slice should not have to rewrite the panic machinery — it should just write more entries to the same map. Including `outputId` in the key now (even though every entry in this slice has the same `outputId` value — the `outputs[0].id`) is a single-line addition that keeps the contract stable.

### Decision 4: `play()` / `stop()` drive the scheduler via effect subscription, not via reducer side effects

**Choice**: The `useMidiScheduler` hook reads `useTransport().mode` via the existing transport context. An effect with `mode` in the deps runs the start/stop logic:

- On transition to `mode === 'play'` from any other mode: snapshot `bpm`, `outputs[0]`, reset cursors to match `timecodeMs`, start the rAF loop.
- On transition away from `mode === 'play'`: cancel the rAF loop, flush the panic.

**Alternative considered**: Make `play()` and `stop()` directly call functions on a scheduler instance via a registration mechanism (the transport reducer would maintain a `scheduler` ref and call `scheduler.start()` / `scheduler.stop()` inline). Rejected because:

1. Reducers must be pure. Calling `MIDIOutput.send` from a reducer branch is a side effect that breaks time-travel debugging and React 18's strict-mode double-invocation testing.
2. The effect-driven path is simpler — the scheduler is its own boundary; the transport doesn't need to know it exists.

**Rationale**: This is the same pattern the recorder uses for `mode === 'record'` subscription. Consistency reduces cognitive load.

**Note**: This means the spec contracts for `play()` and `stop()` in `transport-titlebar` describe the **observable behavior** (a scheduler runs, panic fires) — they don't mandate the *implementation mechanism* by which the scheduler subscribes. The effect-driven approach is the implementation choice, not a spec contract. (The spec scenarios in this change are written in terms of observable MIDI output, not internal subscription mechanics.)

### Decision 5: No-output path: enabled play button, toast on click, no disabled-state contract

**Choice**: The play button stays enabled even when `outputs.length === 0`. Clicking it dispatches `play()`, which transitions `mode` to `'play'` and starts `timecodeMs` advancement as usual. The scheduler reads `outputs[0]` and finds `undefined`, calls `useToast().show('No output device available')` exactly once per `play()` invocation, and otherwise no-ops.

**Alternative considered**: Disable the play button when no output is connected, mirroring the record button's `No MIDI input available` contract. Rejected because:

1. Playback without output isn't *meaningless* — the timecode still advances, the playhead still scrolls. A user reviewing timing on screen without a physical synth attached still benefits from this.
2. The record button's disable contract exists because no-input means no captured notes — the recorder physically cannot do its job. Play with no output still has a UX (the visual playhead). The semantics differ.
3. A toast is louder than a disabled button — the user gets clear feedback about why nothing is audible.

**Rationale**: Different ergonomics for different sides of the loop. Keep the play button surface simple.

### Decision 6: Mute/solo respected at scheduling time, not at dispatch time

**Choice**: The scheduler reads `useChannels()` on every tick and applies the existing solo/mute composition rule (`anyChannelSoloed ? (channel.soloed && !channel.muted) : !channel.muted`) before walking that channel's notes. A muted (or non-soloed-when-any-soloed) channel contributes zero `MIDIOutput.send` calls.

**Alternative considered**: Pre-emit every note's note-on/note-off regardless, then send a sequence of `[0xB0|ch, 0x78, 0x00]` (CC #120, All Sound Off) on mute toggles. Rejected because:

1. It wastes bus bandwidth for channels that aren't audible.
2. It introduces a mute-toggle latency equal to one All Sound Off round-trip on the device, which on slow MIDI links can be tens of ms.
3. Scheduling-time skipping is the natural place to apply the rule — the question "should this note be heard?" is answered once, at the latest possible moment.

**Mid-playback un-mute behavior**: When a channel is un-muted mid-playback, its notes from the current `playheadMs` cursor onward are scheduled normally. Notes whose `t` falls in the past (between `play()` and the un-mute moment) are NOT retroactively played — they're skipped permanently for this playback session. This matches "scheduling is real-time" semantics; a DAW-style "include muted history" would require a different model.

### Decision 7: Loop wrap is documented as imperfect in this slice

**Choice**: When `looping === true && loopRegion != null`, the existing transport contract wraps `timecodeMs` back to `loopRegion.start` when it crosses `loopRegion.end`. The scheduler detects this as a non-monotonic `timecodeMs` jump (Decision 2) and re-binary-searches every channel's cursor. Notes whose start falls inside `[loopRegion.end - lookaheadMs, loopRegion.end)` will have already been dispatched with future-`timestamp` note-on/off pairs — those continue to play *past* the loop point, briefly.

**Rationale**: A correct loop scheduler clips the lookahead to `min(playheadMs + lookaheadMs, loopRegion.end * msPerBeat)` and re-schedules from `loopRegion.start` on wrap. That's a small but tricky chunk of code, and the user explicitly placed "looped playback" in the out-of-scope list for this slice. The behavior described above is incorrect but bounded — at worst, ~100 ms of audible tail bleeds past the loop boundary on each iteration. We document it as a known limitation and address it when the loop-playback backlog entry lands.

**Mitigation in this slice**: We DO reset cursors on loop wrap (necessary for correctness on the post-wrap side). We do NOT clip lookahead to `loopRegion.end`. We document this in `tasks.md` as an explicit non-task.

## Risks / Trade-offs

- **[Risk] Active-note map grows unbounded if `stop()` is never called and the rAF loop is killed by some other mechanism (e.g., the page is unloaded)** → Mitigation: The map is owned by the `useMidiScheduler` hook's React state; React's unmount fires its cleanup, which we wire to call the panic emitter. The browser firing `unload` is a separate, well-known stuck-note case that no in-page code can prevent reliably — best effort via a `beforeunload` listener that calls panic is reasonable but out of scope for this slice (the user explicitly scoped to "stop button silences notes").

- **[Risk] The lookahead window can mis-fire if `MIDIOutput.send` is called with a `timestamp` in the past** → Mitigation: We always pass `Math.max(timestamp, performance.now())` to `send()` so any due-now notes go out immediately rather than being rejected by the implementation. This matters mostly on `play()` when the rAF tick lands a frame later than expected; the per-tick window math (`playheadMs + lookaheadMs`) already guarantees we don't lag behind by more than one frame.

- **[Risk] Rapid `play` → `stop` → `play` cycles could leak note-ons** → Mitigation: `stop()` always flushes the panic before clearing the map; the next `play()` starts from an empty map. Add a test that simulates start/stop/start in <50 ms.

- **[Trade-off] Single-output routing means a user with two synths connected hears only the one returned at `outputs[0]`** → Acceptable: this is the explicit scope of this slice; the toast message could be enhanced later to say "Playing to <output.name>" so the user understands which device is being used. **Decision**: include the output name in a more informative toast — "Playing to <output.name>" — only when at least one output is present. The no-output path's toast stays at `No output device available`. This is a small UX addition documented in the spec.

- **[Risk] Tempo snapshot diverges from `useTransport().bpm` if user changes BPM mid-playback** → Documented limitation. If the user changes `bpm` mid-playback, the scheduler continues with the old `msPerBeat` — visual timecode (driven by `useTransport`'s rAF, which reads live `bpm`) drifts from audible note timing. We do not specify recovery behavior. Addressed by a future "tempo automation" backlog entry.

- **[Risk] Multiple `MidiSchedulerProvider`-style mounts could create competing rAF loops** → Mitigation: Following the recorder's pattern, the hook is mounted exactly once at the `App.tsx` level (sibling of the recorder mount). The spec for `midi-playback` includes a scenario that asserts mount-count behavior at the architectural seam.
