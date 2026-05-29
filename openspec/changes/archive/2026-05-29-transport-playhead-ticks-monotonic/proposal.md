## Why

Under external MIDI clock, the visible playhead was derived in `useStage` as `(timecodeMs/1000) * (bpm/60) * tpq`. `timecodeMs` accumulates raw wall-clock pulse deltas (monotonic), but the transport's `bpm` mirrors the smoother's rolling-23 mean rounded to the nearest integer. With normal inter-pulse jitter the rounded bpm flips between neighbouring integers each pulse, so `playheadTicks` wobbled — sometimes regressing — which pushed the playhead left of `halfMark` and froze the asymmetric auto-scroll for a frame or more.

## What Changes

- Add `playheadTicks: number` as a first-class field on `TransportState`, advanced by the reducer instead of derived downstream.
- In `applyExternalPulse`, advance `playheadTicks` by a constant `TICKS_PER_PULSE = DEFAULT_MIDI_TPQ / 24` whenever `mode !== 'idle'`. This is independent of the (rounded, jittery) `bpm` value the pulse carries.
- In the internal `tick` reducer, advance `playheadTicks` by `(deltaMs/1000) * (bpm/60) * tpq` so internal-clock behaviour is unchanged.
- Reset / preserve `playheadTicks` alongside `timecodeMs` in `stop`, `record`, `seek` (derive ticks from `ms` at current `bpm`), and skip in `play` / `pause` / `hydrate` / `revertToInternalClock` (mirrors the existing `timecodeMs` rules).
- `useStage` reads `playheadTicks` directly from the transport instead of computing it from `timecodeMs * bpm`.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `midi-clock`: the per-pulse external advance now updates a tick counter alongside `timecodeMs`, and that tick counter is the source of truth for the visible playhead.

## Impact

- `src/hooks/useTransport.tsx` — new `playheadTicks` field on `TransportState`/`InternalState`; reducer updates in `stop`, `record`, `seek`, `tick`, `applyExternalPulse`.
- `src/hooks/useStage.tsx` — drops the `(timecodeMs, bpm) → ticks` derivation; reads `playheadTicks` from the transport.
- No changes to `bbsFromMs` (titlebar BBS still uses `timecodeMs * bpm`, since the titlebar wobble is not the reported symptom).
- No changes to the MIDI scheduler (still uses `timecodeMs` for event scheduling — drift between external master and the start-time `tempoSnapshot` is a separate concern).
