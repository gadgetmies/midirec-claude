## Context

Under external MIDI clock, the `applyExternalPulse` reducer mirrors the smoother's `bpm` (rounded integer) and advances `timecodeMs` by the raw `deltaMs` of the pulse. Downstream, `useStage` derived the visible playhead as `playheadTicksFromTimecodeMs(timecodeMs, bpm) = (timecodeMs/1000) * (bpm/60) * tpq`.

The two inputs are independent: `timecodeMs` accumulates wall-clock pulse intervals (monotonic), `bpm` is the rolling-23 mean rounded to the nearest integer. Realistic inter-pulse jitter pushes the mean back and forth across a 0.5-BPM line, so the rounded bpm flips between two neighbouring integers each pulse. At any timecode the playhead position moves with it, so the playhead can wobble backward — enough to push it past the auto-scroll halfMark and freeze the viewport ("UI stutters at random points during external-clock playback").

## Goals / Non-Goals

**Goals:**
- The visible playhead under external clock SHALL be strictly monotonic across the smoother's bpm jitter.
- Per-pulse advance SHALL be a fixed musical interval (one 24th of a quarter note), not a function of the displayed bpm.
- Internal-clock behaviour SHALL be unchanged.

**Non-Goals:**
- Stabilising the titlebar BBS display (`bbsFromMs`) — same root cause, but the user only flagged the playhead. Out of scope.
- Removing drift between the external master and the scheduler's `tempoSnapshot` — separate concern.
- Replacing `timecodeMs` as the source of truth for `seek` / `bbsFromMs`.

## Decisions

**Make `playheadTicks` a first-class field on `TransportState`.**
The alternative was to keep deriving it in `useStage` from a less-jittery source (e.g., unrounded internal bpm, or a wider smoothing window). Both options leave the playhead a function of inferred bpm, which is fundamentally inferential — any smoothing strategy still wobbles. Counting pulses directly in the reducer makes the playhead a function of pulses received, which is exactly the musical truth the external master is communicating.

**Per-pulse advance = `DEFAULT_MIDI_TPQ / 24`.**
At 24 PPQN, every pulse is exactly one twenty-fourth of a quarter note. With `tpq=480`, that's exactly 20 ticks per pulse — no rounding required.

**Internal `tick` reducer also updates `playheadTicks`.**
To keep one source of truth across clock sources, the internal-clock tick advances `playheadTicks` by `(deltaMs/1000) * (bpm/60) * tpq`. `useStage` reads only `playheadTicks` regardless of clock source. The `seek` / `stop` / `record` reducers update `playheadTicks` alongside `timecodeMs` so the two stay coherent at mode transitions.

**`bbsFromMs` still uses `timecodeMs * bpm`.**
The titlebar BBS display has the same wobble in principle, but the user's report was about the playhead and viewport. Touching the BBS would expand scope; deferred until separately reported.

## Risks / Trade-offs

- `playheadTicks` and `timecodeMs` can diverge in external mode (ticks track pulses; ms tracks wall-clock). At the actual master tempo they describe the same thing, but the smoother's rounded bpm doesn't perfectly recover the master's bpm — so `(timecodeMs/1000) * (bpm/60) * tpq` and `playheadTicks` will not be exactly equal. Mitigation: `useStage` reads `playheadTicks` directly; nothing else compares them.
- The scheduler still uses `timecodeMs` and `tempoSnapshot` (start-time bpm) to schedule event emission. Note timing relative to the visible playhead may drift in external mode at materially different bpms — but this drift exists today and is independent of this fix.
