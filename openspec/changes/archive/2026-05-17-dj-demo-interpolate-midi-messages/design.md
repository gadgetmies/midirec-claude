## Context

The automation demo builds mixer ramps in `buildAutomationMixerEvents()` by placing one `ActionEvent` per integer beat (`useDJActionTracks.ts`). Playback maps each row to CC output with `round(vel × 127)`. For short beat spans (Ch 1/2 volume ramps) rounding maps many neighboring beats onto the **same** CC integer, so the timeline does not traverse every quantized step and logs/devices see fewer outbound messages than a smooth move from 0→127 would imply.

## Goals / Non-Goals

**Goals:**

- Preserve the automation demo’s prescribed **range** (0–127 full-volume ramps, Ch 2/Ch 1 EQ lows 0→63 / 63→0) and **window** (beats 4→20 or 34→68 plus EQ spans) while guaranteeing **coverage of every quantized MIDI/CC value** in that range via interpolation of `ActionEvent.t` inside the interval.
- Keep deck scripted events (beat jump sizes, play) and URL-flag behavior untouched.
- Update `dj-automation-demo` deltas so tests can assert value coverage rather than merely “number of beats in window.”

**Non-Goals:**

- Changing realtime scheduler behavior globally (only seeded demo timelines).
- Sub-beat perceptual smoothing or jitter outside what’s needed for step coverage.
- Traktor/driver-specific quirks beyond “one outbound message per `ActionEvent` for CC rows.”

## Decisions

1. **Interpolate beat time from target MIDI integers (inverse of nominal ramp formula)** rather than iterating beats and deduplicating duplicated rounds. Each ramp uses the same continuous shape as today (same endpoints and fractional mapping), but the seed emits one event **per distinct output integer** in-range with `t` chosen from the contour’s inverse so `round(f(t) × normalization) === v`.

   **Ch 1 Volume (pitch 81)** over `t ∈ [4, 20]`: nominal `midi(t) = (t − 4) / (20 − 4) × 127`. For each `v ∈ {0,…,127}`, set `t(v) = 4 + v / 127 × (20 − 4)` and emit `round(vel×127)=v`.

   **Ch 2 Volume (pitch 82)** over `t ∈ [34, 68]`: `midi(t) = (68 − t) / (68 − 34) × 127`. For each `v`, `t(v) = 68 − v / 127 × (68 − 34)` with analogous ordering.

   **EQ segments (pitch 88 on [26, 34], pitch 85 on [26, 34])**: use `(t − 26) / (34 − 26) × 63` and inverse for `v ∈ {0,…,63}`; keep the separate anchor at **beat 4** for pitch 88 (`vel` 0).

   **Rationale:** Guarantees monotone `t`, exact coverage, and aligns with producers’ intuition of linear automation.

   **Alternatives:** binary search per `v` against `midi(t)`; scan fine-grained subdivisions until all values hit — heavier and less deterministic.

2. **Keep a small uniform `dur` per interpolated step** (reuse `AUTOMATION_CC_STEP_DUR` or successor) so each event still classifies as a tap-like CC poke.

   **Alternatives:** `dur → 1/128` beats already in use; shrinking further is unnecessary unless QA demands.

3. **Sort merged mixer events by `(t, pitch)`** as today so deterministic ordering survives mixed rows.

## Risks / Trade-offs

- **Many more seeded events (~128 × two volume lanes)** → larger initial state and snapshots. Mitigation: only affects automation demo mode; negligible for UX.

- **Duplicate quantized `0` on pitch 88** between `t = 4` and `t = 26`. Mitigation: spec allows duplicated holds at anchor vs ramp onset; avoids over-constraining if we keep both markers.

## Migration Plan

Roll out with code + spec delta + tests together. Rollback by reverting `buildAutomationMixerEvents` seed and restoring prior expectations. No persisted session schema change.

## Open Questions

- None blocking: inverse placement is deterministic for affine ramps across the scripted ranges above.
