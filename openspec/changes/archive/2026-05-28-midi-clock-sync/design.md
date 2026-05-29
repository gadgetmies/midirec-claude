## Context

Today `clockSource` is a display-only field on `useTransport()` (default `'internal'`, never mutated). The Titlebar renders `Int`, but no code path produces `'external-clock'`. The transport's playhead is driven exclusively by `requestAnimationFrame` deltas — there is no hook for an external time source.

Incoming MIDI is already plumbed for note recording: `MidiRuntimeProvider` exposes connected `MIDIInput` ports via `useMidiInputs()`, and `src/midi/recorder.ts` attaches `onmidimessage` handlers per input. We can reuse the same pattern for clock — multiple consumers per input is supported by chaining handlers (recorder.ts:418-421 already preserves a previous handler).

The relevant MIDI surface:
- Real-Time messages are status-only single bytes (no data payload) and can interleave between any two bytes of a longer message: `0xF8` Clock, `0xFA` Start, `0xFB` Continue, `0xFC` Stop.
- Standard MIDI clock is 24 pulses per quarter note (PPQ). At 120 BPM that's 48 PPS (one pulse every ~20.83 ms).
- Smoothed BPM = `60000 / (mean(pulse_intervals_ms) * 24)`.

## Goals / Non-Goals

**Goals:**
- Lock the playhead to incoming clock when an external master is present, without disturbing the existing internal rAF tick path when it isn't.
- Show the user, at a glance, that lock is healthy — both via the BPM readout converging on the master's BPM and via a beat LED that pulses on the actual incoming downbeat (not a CSS approximation).
- Keep the receiver pure-data: parse pulses, smooth, emit. No coupling to the Titlebar, the recorder, or the scheduler.

**Non-Goals:**
- MTC (`external-mtc`) wiring. The display code already handles the value; the receiver here only handles 24 PPQ clock.
- Song Position Pointer (`0xF2`). DJ master clocks usually don't send SPP; we'll add it only when a real device demands it.
- Persisting `clockSource`. It remains in-memory (session-model spec already excludes it from hydrate).
- Driving record mode from incoming Start/Stop. Recording is a user-armed action; auto-arming from a master is a footgun for live use.
- Audio metronome / click. MIDI-only tool per project memory.

## Decisions

### Pulse-driven tick vs. interpolated rAF tick when external

**Decision:** When `clockSource === 'external-clock'`, the rAF tick SHALL NOT advance `timecodeMs`. Instead the clock receiver dispatches a `{ type: 'externalTick', deltaMs }` action on each pulse, where `deltaMs = smoothedBpmIntervalMs / 24 * pulsesSinceLast`.

**Alternative considered:** Keep rAF as the tick source and merely *adjust BPM* from the receiver, letting `timecodeMs` drift toward the master via PLL. Rejected: a drifting playhead means events fire at the wrong sample tick relative to the master, which defeats the point of slaving. Direct pulse-driven advancement keeps event alignment tight at the cost of slightly coarser sub-pulse resolution (~20 ms at 120 BPM), which is acceptable for the timeline grid used here (16th-note quantize).

### BPM smoothing window

**Decision:** Rolling window of the last 24 pulse intervals (one full quarter note) using a simple mean. Round to nearest integer for `useTransport().bpm` display; keep the unrounded value internally for `deltaMs` calculation.

**Alternative considered:** Exponential moving average, or PLL with phase correction. Rejected as premature — 24-sample mean is what every DJ-grade clock follower I've seen ships with as v1, and it converges in under a second for steady masters. We can revisit if real-world clocks show too much jitter.

### Auto-switching `clockSource`

**Decision:** First incoming clock pulse in a session flips `clockSource` from `'internal'` to `'external-clock'`. If no pulse arrives for 2000 ms, revert to `'internal'`. No manual override UI in this slice.

**Why 2000 ms?** At 60 BPM (the slowest realistic master) one pulse arrives every ~41 ms; 2000 ms is ~48 missed pulses, well beyond any normal jitter or gap from a master pause. If the user explicitly stops the master, we want the local transport to fall back to internal so they can keep working.

**Alternative considered:** Manual user toggle in the `Clk` cell. Deferred — automatic behavior is correct for ~all DJ use cases, and adding a click target needs UX design that's larger than this slice. The auto behavior can be overridden later by a UI without changing the receiver.

### Beat LED placement and animation

**Decision:** Add a dedicated `.mr-led[data-state="beat"]` LED in the Titlebar status cluster, immediately to the LEFT of the existing rec/play/idle LED. Animation is NOT a CSS keyframe — it's a transient class (`is-pulse`) applied for 80 ms on each `beat` increment via React state, then removed.

**Why not a CSS keyframe with `animation-duration` derived from BPM?** Keyframes drift relative to the actual incoming pulse over time (sub-ms CSS scheduling jitter accumulates). A React-driven transient class is guaranteed to flash on the actual `0xF8` that completed the 24th pulse. Cost: one re-render per beat — at 200 BPM that's ~3.3 Hz, negligible.

**Why a separate LED and not repurpose the existing one?** The rec/play/idle LED communicates transport mode; the beat LED communicates clock lock. Conflating them confuses both signals when both are simultaneously relevant (e.g., playing while slaved).

### Receiver lifecycle

**Decision:** `MidiClockProvider` subscribes to `useMidiInputs()` and attaches a clock-only `onmidimessage` chain (preserving any prior handler — same pattern as `recorder.ts`). On unmount or input disconnect, restore the prior handler.

**Hotplug:** When a new input connects mid-session, attach to it. When an active master disconnects, the 2000 ms timeout handles the fallback — no special-case code.

## Risks / Trade-offs

- **[Risk]** A user has multiple inputs sending clock simultaneously (two masters connected) → ambiguous BPM, fighting pulses. **Mitigation:** First-wins — the receiver tracks which input most recently sent a clock pulse and only counts pulses from that input toward the smoothing window. Other inputs' clocks are ignored until the active input goes silent for 2000 ms.

- **[Risk]** Jittery cheap MIDI interfaces produce unstable BPM that wobbles ±2 BPM in the display. **Mitigation:** 24-sample mean already absorbs sub-pulse jitter; if the display still wobbles in practice, widen to 48 samples (two quarter notes) — code change only, no spec change.

- **[Risk]** Switching `clockSource` mid-playback causes a visible playhead glitch (rAF stops, pulse takes over with a different cadence). **Mitigation:** When `clockSource` flips from `'internal'` to `'external-clock'` while `mode !== 'idle'`, the receiver SHALL pin the first external `deltaMs` to whatever is needed to advance `timecodeMs` smoothly from its current value. The reducer never moves `timecodeMs` backwards on a source switch.

- **[Trade-off]** Pulse-driven advancement gives ~20 ms tick resolution at 120 BPM. Events that need sub-pulse precision (e.g., a swing-quantize ramp inside one 16th note) will land on the next pulse boundary. **Accepted** for v1 — the current timeline grid bottoms out at 1/16, which is one pulse at 4/4, so there's no surface in the UI that exposes sub-pulse timing.

- **[Risk]** Incoming Start while `mode === 'record'` would unexpectedly switch to `play`. **Mitigation:** Real-time messages are ignored when `mode === 'record'`. Stop is also ignored in record mode (the user's stop button is the authoritative way to end a recording, matching existing behavior of the panic path which doesn't fire on stop-from-record).
