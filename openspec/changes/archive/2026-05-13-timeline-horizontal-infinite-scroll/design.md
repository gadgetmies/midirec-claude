## Context

Timeline layout today keys every row’s intrinsic width off a single fixed `TOTAL_T` (16 beats) passed from `useStage`/`useChannels`. The scroll container hides scrollbars yet still uses native `overflow-x: auto`; `scrollLeft` naturally cannot go negative, but paired with a bounded `scrollWidth` the user reaches a hard ceiling at ~4 bars regardless of playback or edits. Session model already permits unbounded notes; ruler and grids still paint only that fixed span.

## Goals / Non-Goals

**Goals:**

- Extend the timeline’s **physical width** (`scrollWidth`) with the session when material runs past today’s horizon, capped by sensible padding so working past the current last event is fluent.
- Keep **beat 0** as the immutable left-most musical origin: clamp horizontal scroll (`scrollLeft >= 0` after programmatic moves) so the user never sees emptiness “before” the session origin.
- Maintain one shared horizontal scroll source (`.mr-timeline`) synchronized across Ruler, channel rolls, param lanes, DJ action bodies.
- **Virtualize ruler + lane grids** beyond a pragmatic beat threshold so DOM ticks do not grow linearly forever (reuse existing “major every 4 beats” visual language; minors may omit when density would exceed caps defined in tasks).

**Non-Goals:**

- Zoom gestures and `totalT`/window-zoom changes (beyond whatever constant default window length still drives note clipping).
- Vertical infinite scroll or per-roll pitch-window work (tracked separately in backlog).

## Decisions

1. **`layoutHorizonBeats` as the sole width driver.** `useStage` (or successor) derives this from  
   `max(MIN_VISIBLE_BEATS, ceil(sessionExtentBeats + TAIL_PADDING_BEATS))`.  
   `sessionExtentBeats` aggregates endpoints from every channel roll, param lane points, dj-action-track events if present (mirrors exporter `max`). **Why:** one number flows to `AppShell` width, ruler, grids, minimizing drift.

2. **Split “view window length” (`totalT`/`viewT0` semantics from `session-model`) from stripe width.** `PianoRoll`/`ActionRoll`/`ParamLane` widths use `layoutHorizonBeats * pxPerBeat`; note/param filtering MAY still reuse existing `totalT` as `[viewT0, viewT0+totalT)` until zoom slice lands. Defaults where only `totalT` is passed: horizon defaults to legacy `TOTAL_T`-style constant for parity in tests.

3. **Clamp scroll on user + programmatic mutations.** ResizeObserver resetting scroll, programmatic `scrollTo`, playback-driven auto-follow: after each mutation `scrollLeft = max(0, scrollLeft)`. **Why:** fulfills “never past beat 0 to the left”; native wheel already cannot go `<0`; edge cases arise from programmatic moves.

4. **Ruler / grid thinning.** Above `GRID_TICK_CAP` (~512) contiguous integer beats switches tick generation from “every beat” to “majors-only + subdivisions sparse” computed from visible viewport if needed—or fixed bar majors only—to keep layout O(visible ∩ horizon), not O(horizon). Document exact cap during implementation review.

## Risks / Trade-offs

[Ruler label density collapses far zoomed out without separate zoom slice] → accept readable majors-first; minors optional.

[Larger DOM if horizon jumps to thousands suddenly] → cap growth increments (chunk by bars) mitigates spikes.

[Sticky keys column + negative absolute note positions unchanged] → continue relying on `.mr-timeline` clipping; scrolling left clamp preserves beat-zero alignment semantics.

## Migration Plan

Pure client-side; no persisted schema change. Existing seeds keep similar visible window; widen horizon once session extent computed.

## Open Questions

- Exact coefficients for `MIN_VISIBLE_BEATS` and `TAIL_PADDING_BEATS` (spec leaves normative derivation to session-model additive requirement).
- Whether playhead autopan should extend horizon automatically before user reaches boundary (likely yes via session extent—but tasks can stage this).
