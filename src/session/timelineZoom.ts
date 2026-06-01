/* Pure helpers for horizontal timeline zoom.

   All math lives here so AppShell, Ruler, useStage hydrate, and the storage
   codec can share one source of truth. Nothing in this module touches React,
   the DOM, audio, or MIDI. */

import { DEFAULT_MIDI_TPQ } from '../midi/timelineTicks';

export const MIN_PX_PER_BEAT = 2;
export const MAX_PX_PER_BEAT = 2000;
export const DEFAULT_PX_PER_BEAT = 88;

/* Multiplier exponent applied to a NORMALISED line delta. Use
   `normalizeWheelDeltaToLines(event)` before multiplying — most browsers
   report `deltaY` in pixels (`deltaMode === DOM_DELTA_PIXEL`), where a raw
   `event.deltaY` would saturate after a single hardware wheel notch
   (~125px → exp(-125·0.18) ≈ e^-22.5, instant rail to MIN). */
export const WHEEL_ZOOM_FACTOR_PER_LINE = 0.18;

/** Approximate device pixels per "line" of wheel scroll. Hardware wheel
    notches commonly report ~100px in pixel mode; trackpad pinch events
    fire many small deltas that sum to similar magnitudes. Using 100 lands
    one hardware notch on ~1 line — within the [1.15, 1.25] step target. */
export const WHEEL_PIXELS_PER_LINE = 100;

/** Lines per page for keyboards/track-pads that report DOM_DELTA_PAGE. */
export const WHEEL_LINES_PER_PAGE = 16;

/* Pinch gestures on macOS trackpads synthesize many small `wheel` events
   (typical `deltaY` ≈ 3-15px per frame at ~60Hz). Without amplification,
   a full pinch lands well under 1.5× total — the user perceives it as
   sluggish. Anything under this threshold (in pre-boost line units) is
   treated as a pinch frame and multiplied by `PINCH_SENSITIVITY_BOOST`.
   The threshold sits below the smallest hardware wheel notch (~50px →
   0.5 lines at WHEEL_PIXELS_PER_LINE=100) so notch behaviour is
   untouched. */
export const PINCH_FRAME_LINE_THRESHOLD = 0.4;
export const PINCH_SENSITIVITY_BOOST = 4;

/** Discrete step magnitude for keyboard `+`/`-` and toolstrip `+`/`-`. */
export const KEYBOARD_ZOOM_STEP = 1.2;

/** Maps a raw `WheelEvent` to a unit-line delta, regardless of the
    browser's reported `deltaMode`. Positive = zoom-out direction.

    For PIXEL-mode events whose magnitude is below
    {@link PINCH_FRAME_LINE_THRESHOLD}, the result is amplified by
    {@link PINCH_SENSITIVITY_BOOST} so a macOS pinch — which dispatches
    many small per-frame deltas — accumulates into a perceptible zoom
    within a normal gesture. Larger PIXEL-mode events (hardware wheel
    notches) and LINE/PAGE-mode events are passed through unboosted so
    a single notch still falls in the spec's [1.15, 1.25] step target. */
export function normalizeWheelDeltaToLines(event: WheelEvent): number {
  /* WheelEvent.DOM_DELTA_LINE = 1, DOM_DELTA_PAGE = 2; everything else is
     pixel mode. Reading the numeric constants directly avoids a JSDOM
     constructor dependency in tests. */
  if (event.deltaMode === 1) return event.deltaY;
  if (event.deltaMode === 2) return event.deltaY * WHEEL_LINES_PER_PAGE;
  const lines = event.deltaY / WHEEL_PIXELS_PER_LINE;
  if (Math.abs(lines) < PINCH_FRAME_LINE_THRESHOLD) {
    return lines * PINCH_SENSITIVITY_BOOST;
  }
  return lines;
}

export function clampPxPerBeat(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PX_PER_BEAT;
  if (value < MIN_PX_PER_BEAT) return MIN_PX_PER_BEAT;
  if (value > MAX_PX_PER_BEAT) return MAX_PX_PER_BEAT;
  return value;
}

export interface ZoomAroundAnchorResult {
  nextScrollLeft: number;
}

/**
 * Returns the `scrollLeft` that keeps the beat located at on-screen position
 * `anchorPx` in place when `pxPerBeat` changes from `prev` to `next`.
 *
 * `anchorPx` is the cursor X relative to the timeline element's left edge,
 * clamped to `>= keysColW` so the anchor never falls inside the fixed left
 * keys column. The result is clamped to `>= 0` so it can be written directly
 * to `element.scrollLeft`.
 */
export function zoomAroundAnchor(
  prev: number,
  next: number,
  anchorPx: number,
  scrollLeft: number,
  keysColW: number,
): ZoomAroundAnchorResult {
  const anchor = Math.max(anchorPx, keysColW);
  if (!Number.isFinite(prev) || prev <= 0) {
    return { nextScrollLeft: Math.max(0, scrollLeft) };
  }
  const beatAtAnchor = (scrollLeft + anchor - keysColW) / prev;
  const nextScrollLeft = beatAtAnchor * next - anchor + keysColW;
  return { nextScrollLeft: Math.max(0, nextScrollLeft) };
}

/**
 * Returns the `pxPerBeat` that makes the session horizon fit exactly inside
 * the viewport's lane width. Falls back to {@link DEFAULT_PX_PER_BEAT} when
 * the inputs don't describe a meaningful viewport (empty session, collapsed
 * lane area).
 */
export function fitPxPerBeat(
  horizonTicks: number,
  viewportInnerPx: number,
  keysColW: number,
  tpq: number = DEFAULT_MIDI_TPQ,
): number {
  const laneWidth = viewportInnerPx - keysColW;
  if (!(horizonTicks > 0) || !(laneWidth > 0) || !(tpq > 0)) {
    return DEFAULT_PX_PER_BEAT;
  }
  return clampPxPerBeat((laneWidth * tpq) / horizonTicks);
}

export interface RulerSubdivision {
  /** Spacing between adjacent rendered ticks in MIDI ticks. */
  ticksPerLine: number;
  /** Spacing between adjacent labels in MIDI ticks (always a multiple of TPQ). */
  labelEvery: number;
  /** Identifier for the chosen subdivision (debug + tests). */
  format: 'phrase' | 'beat' | '8th' | '16th' | '32nd';
}

/**
 * Picks tick subdivision and label cadence so each rendered tick is at least
 * ~22px from its neighbour. Phrase / bar emphasis is layered on top by the
 * caller and is independent of the returned subdivision.
 *
 * Monotone: a strictly higher `pxPerBeat` never returns a coarser
 * `ticksPerLine`.
 */
/* `phrase.bar.beat` labels are ~32-40px wide in the default ruler font, but
   we need enough buffer that the label staircase keeps `labelEvery = BAR`
   at the editor's default `pxPerBeat = 88` (so existing pixel-position
   tests continue to pass) and transitions to `labelEvery = BEAT` only at
   higher zooms where there is room. 120px lands those transitions at
   30 / 120 px/beat. */
const RULER_MIN_LABEL_SPACING_PX = 120;

/**
 * Chooses how many beats a ruler-label cadence should span so labels never
 * overlap at the given zoom. Steps through a power-of-4 staircase aligned to
 * bar (4), phrase (16), and multi-phrase boundaries; preserves the long-
 * standing default-zoom behaviour where labels appear at every bar.
 */
function pickLabelEveryBeats(pxPerBeat: number): number {
  if (!Number.isFinite(pxPerBeat) || pxPerBeat <= 0) return 64;
  const needBeats = RULER_MIN_LABEL_SPACING_PX / pxPerBeat;
  /* Staircase steps in beats: 1 (beat), 4 (bar), 16 (phrase), 64 (4 phrases),
     then quadruple for every further halving of pxPerBeat. */
  if (needBeats <= 1) return 1;
  if (needBeats <= 4) return 4;
  if (needBeats <= 16) return 16;
  if (needBeats <= 64) return 64;
  if (needBeats <= 256) return 256;
  return 1024;
}

export function chooseRulerSubdivision(
  pxPerBeat: number,
  tpq: number = DEFAULT_MIDI_TPQ,
): RulerSubdivision {
  const BEATS_PER_PHRASE = 16;
  const labelEvery = tpq * pickLabelEveryBeats(pxPerBeat);
  /* Tick density tiers per timeline-zoom spec; the label cadence is computed
     independently above so very low zooms thin further than `phrase`. */
  if (!Number.isFinite(pxPerBeat) || pxPerBeat < 12) {
    return {
      ticksPerLine: tpq * BEATS_PER_PHRASE,
      labelEvery,
      format: 'phrase',
    };
  }
  if (pxPerBeat < 176) {
    return { ticksPerLine: tpq, labelEvery, format: 'beat' };
  }
  if (pxPerBeat < 352) {
    return { ticksPerLine: tpq / 2, labelEvery, format: '8th' };
  }
  if (pxPerBeat < 800) {
    return { ticksPerLine: tpq / 4, labelEvery, format: '16th' };
  }
  return { ticksPerLine: tpq / 8, labelEvery, format: '32nd' };
}
