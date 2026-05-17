## Context

Today **beats** are the conventional unit across rolls, lanes, DJ bodies, loop markers, view scrolling, and layout horizon (`session-model`). TPQ exists for MIDI export (`beatsToMidiTicks`) but is not the runtime source of truth for clip placement. This change makes **integer MIDI ticks at session TPQ** that source of truth everywhere musical **position or duration** is stored.

## Goals / Non-Goals

**Goals:**

- One lattice: **`tTicks`**, **`durTicks`** (and **`tTicks`** for point-like samples without duration) for notes, DJ events, param automation points, marquee ranges, loop endpoints, and view/window extents **when they denote musical timeline position**.
- **Transport boundary only:** `timecodeMs` ↔ **`playheadTicks`** (then derive `"beat‑phase"` UI if needed via BPM); no floating beat playhead as authority.
- **Deterministic migration:** `tTicks = round(t_beats * TPQ)`, `durTicks = max(1, round(dur_beats * TPQ))` unless a stricter rule prevents zero-length clips—document exceptions next to seed data.
- DJ Inspector bar/beat/tick fields decode/encode **absolute `tTicks`**; **`deltaTicks`** moves merged CC members and tick-native pressure samples together.

**Non-Goals:**

- Changing **audio-rate** or **UI animation** clocks (only musical timeline coordinates).
- Floating‑point **normalized** parameters (`vel`, `v` on lanes)—only **time axis** migrates first-class.

## Decisions

1. **Field names** — Use **`tTicks`** / **`durTicks`** on **`Note`** and **`ActionEvent`**; **`CCPoint.t`** becomes **`tTicks`** (same meaning: sample time on session axis). Reduces `startTicks` vs `t` confusion.

2. **Keep ergonomic props where cheap** — Components MAY still accept **`pxPerBeat`** internally by deriving **`pxPerTick = pxPerBeat / TPQ`** so diff volume stays manageable; alternatively rename to `pxPerQuarter`—implementation choice.

3. **`viewT0` / `totalT` / `layoutHorizonBeats`** — Prefer **`viewT0Ticks`**, **`viewSpanTicks`**, **`layoutHorizonTicks`** for clarity; if renames are too noisy in one PR, **same identifiers MAY temporarily denote ticks** only after an explicit migration flag comment—prefer renames in code during apply.

4. **Playhead** — Stage exposes **`playheadTicks`** (integer, or sub-tick accumulation converged on tick grid when snapping applies). Ruler/playhead lines use tick-derived pixel X.

5. **Ordering / merge thresholds** — CC merge **`CC_GROUP_MAX_START_GAP_BEATS`** becomes **`…_TICKS`** (`Math.round(beats * TPQ)` of prior constant) so thresholds stay musically equivalent.

6. **Pressure (`PressurePoint`)** — Move **`t`** to **`tTicks`** (absolute session ticks) for stored curves; synthesis outputs ticks before rasterization.

7. **Validation** — Mutations reject negative **`tTicks`** / **`durTicks`** below minimum; reject moves that push dependents negative.

## Risks / Trade-offs

- **[Risk]** Large refactor blast radius → **Mitigation:** Mechanical migration helpers (`beatsToTickQuant(t)`, `ticksToBeatsDisplay()`); port seeds/tests in batches; keep Vitest focused on round-trip and supremum/horizon math.

- **[Risk]** BPM changes vs absolute ticks — **Mitigation:** Session axis is **musical ticks**, not wall-clock; tempo affects ms playback only, not `tTicks` values (matches MIDI edit expectations).

## Open Questions

- Sub-tick playhead smoothing vs strict integers during drag.
