import { describe, expect, test } from 'vitest';
import {
  DEFAULT_PX_PER_BEAT,
  MAX_PX_PER_BEAT,
  MIN_PX_PER_BEAT,
  PINCH_FRAME_LINE_THRESHOLD,
  PINCH_SENSITIVITY_BOOST,
  WHEEL_LINES_PER_PAGE,
  WHEEL_PIXELS_PER_LINE,
  WHEEL_ZOOM_FACTOR_PER_LINE,
  chooseRulerSubdivision,
  clampPxPerBeat,
  fitPxPerBeat,
  normalizeWheelDeltaToLines,
  zoomAroundAnchor,
} from './timelineZoom';
import { DEFAULT_MIDI_TPQ } from '../midi/timelineTicks';

const KEYS_COLW = 56;

describe('clampPxPerBeat', () => {
  test('passes through in-range values', () => {
    expect(clampPxPerBeat(88)).toBe(88);
    expect(clampPxPerBeat(MIN_PX_PER_BEAT)).toBe(MIN_PX_PER_BEAT);
    expect(clampPxPerBeat(MAX_PX_PER_BEAT)).toBe(MAX_PX_PER_BEAT);
  });

  test('saturates below MIN and above MAX', () => {
    expect(clampPxPerBeat(-5)).toBe(MIN_PX_PER_BEAT);
    expect(clampPxPerBeat(0)).toBe(MIN_PX_PER_BEAT);
    expect(clampPxPerBeat(99999)).toBe(MAX_PX_PER_BEAT);
  });

  test('returns default for non-finite values', () => {
    expect(clampPxPerBeat(Number.NaN)).toBe(DEFAULT_PX_PER_BEAT);
    expect(clampPxPerBeat(Number.POSITIVE_INFINITY)).toBe(DEFAULT_PX_PER_BEAT);
    expect(clampPxPerBeat(Number.NEGATIVE_INFINITY)).toBe(DEFAULT_PX_PER_BEAT);
  });
});

describe('zoomAroundAnchor', () => {
  test('round-trips the beat under the anchor within ±0.5 px', () => {
    const prev = 88;
    const next = 176;
    const anchor = 400; // inside lane area
    const scrollLeft = 100;
    const { nextScrollLeft } = zoomAroundAnchor(prev, next, anchor, scrollLeft, KEYS_COLW);

    /* Beat located at on-screen X = anchor before and after the zoom. */
    const beatBefore = (scrollLeft + anchor - KEYS_COLW) / prev;
    const beatAfter = (nextScrollLeft + anchor - KEYS_COLW) / next;
    expect(Math.abs(beatBefore - beatAfter)).toBeLessThan(0.5 / next);
  });

  test('anchor below keys column is clamped — nextScrollLeft is non-negative', () => {
    const { nextScrollLeft } = zoomAroundAnchor(88, 176, 10, 0, KEYS_COLW);
    expect(nextScrollLeft).toBeGreaterThanOrEqual(0);
    expect(nextScrollLeft).toBe(0);
  });

  test('left edge anchor at keys column keeps scrollLeft at 0', () => {
    const { nextScrollLeft } = zoomAroundAnchor(88, 44, KEYS_COLW, 0, KEYS_COLW);
    expect(nextScrollLeft).toBe(0);
  });

  test('handles invalid prev gracefully', () => {
    expect(zoomAroundAnchor(0, 88, 100, 50, KEYS_COLW).nextScrollLeft).toBe(50);
    expect(zoomAroundAnchor(Number.NaN, 88, 100, 0, KEYS_COLW).nextScrollLeft).toBe(0);
  });
});

describe('fitPxPerBeat', () => {
  test('returns default on empty session', () => {
    expect(fitPxPerBeat(0, 1000, KEYS_COLW)).toBe(DEFAULT_PX_PER_BEAT);
  });

  test('returns default on collapsed lane area', () => {
    expect(fitPxPerBeat(7680, KEYS_COLW, KEYS_COLW)).toBe(DEFAULT_PX_PER_BEAT);
    expect(fitPxPerBeat(7680, 30, KEYS_COLW)).toBe(DEFAULT_PX_PER_BEAT);
  });

  test('fills the viewport exactly for the given horizon', () => {
    /* 16 beats at TPQ 480 = 7680 ticks, lane width 800 px → 50 px/beat. */
    expect(fitPxPerBeat(7680, 856, KEYS_COLW, 480)).toBe(50);
  });

  test('clamps tiny session at MAX_PX_PER_BEAT', () => {
    /* 1 tick horizon would call for an absurd density — clamped. */
    expect(fitPxPerBeat(1, 1000, KEYS_COLW)).toBe(MAX_PX_PER_BEAT);
  });

  test('clamps very large session at MIN_PX_PER_BEAT', () => {
    /* 1e9 ticks → effectively zero px/beat — clamped to floor. */
    expect(fitPxPerBeat(1e9, 1000, KEYS_COLW)).toBe(MIN_PX_PER_BEAT);
  });
});

describe('chooseRulerSubdivision', () => {
  const TPQ = DEFAULT_MIDI_TPQ;

  test('phrase-only at very low zoom', () => {
    const s = chooseRulerSubdivision(8);
    expect(s.format).toBe('phrase');
    expect(s.ticksPerLine).toBe(TPQ * 16);
  });

  test('beat at default 88 px/beat', () => {
    expect(chooseRulerSubdivision(88).format).toBe('beat');
    expect(chooseRulerSubdivision(88).ticksPerLine).toBe(TPQ);
  });

  test('8th at 176-352 px/beat', () => {
    expect(chooseRulerSubdivision(176).format).toBe('8th');
    expect(chooseRulerSubdivision(351).format).toBe('8th');
    expect(chooseRulerSubdivision(176).ticksPerLine).toBe(TPQ / 2);
  });

  test('16th at 352-800 px/beat', () => {
    expect(chooseRulerSubdivision(352).format).toBe('16th');
    expect(chooseRulerSubdivision(400).format).toBe('16th');
    expect(chooseRulerSubdivision(400).ticksPerLine).toBe(TPQ / 4);
  });

  test('32nd at 800+ px/beat', () => {
    expect(chooseRulerSubdivision(800).format).toBe('32nd');
    expect(chooseRulerSubdivision(2000).ticksPerLine).toBe(TPQ / 8);
  });

  test('boundary inclusivity matches spec', () => {
    expect(chooseRulerSubdivision(11.999).format).toBe('phrase');
    expect(chooseRulerSubdivision(12).format).toBe('beat');
    expect(chooseRulerSubdivision(175.999).format).toBe('beat');
    expect(chooseRulerSubdivision(176).format).toBe('8th');
  });

  test('labelEvery is always a multiple of TPQ', () => {
    for (const ppb of [4, 12, 88, 176, 352, 800, 2000]) {
      const s = chooseRulerSubdivision(ppb);
      expect(s.labelEvery % TPQ).toBe(0);
    }
  });

  test('monotone in pxPerBeat — ticksPerLine never increases', () => {
    let prev = chooseRulerSubdivision(1).ticksPerLine;
    for (const ppb of [2, 11, 12, 20, 88, 175, 176, 200, 351, 352, 400, 799, 800, 1500, 2000]) {
      const cur = chooseRulerSubdivision(ppb).ticksPerLine;
      expect(cur).toBeLessThanOrEqual(prev);
      prev = cur;
    }
  });

  test('non-finite pxPerBeat falls into phrase tier', () => {
    expect(chooseRulerSubdivision(Number.NaN).format).toBe('phrase');
  });

  test('default zoom (88 px/beat) still labels every bar', () => {
    const s = chooseRulerSubdivision(88);
    expect(s.labelEvery).toBe(TPQ * 4);
  });

  test('extreme zoom-out (2 px/beat) thins labels past the phrase cadence so they do not overlap', () => {
    const s = chooseRulerSubdivision(2);
    /* Labels span at least 4 phrases (64 beats) so the on-screen gap is
       at least ~120px wide even at MIN_PX_PER_BEAT. */
    expect(s.labelEvery).toBeGreaterThanOrEqual(TPQ * 64);
    expect(s.labelEvery * (2 / TPQ)).toBeGreaterThanOrEqual(60);
  });

  test('mid-low zoom (8 px/beat) labels per phrase', () => {
    expect(chooseRulerSubdivision(8).labelEvery).toBe(TPQ * 16);
  });
});

describe('normalizeWheelDeltaToLines', () => {
  function evt(deltaY: number, deltaMode = 0): WheelEvent {
    return { deltaY, deltaMode } as unknown as WheelEvent;
  }

  test('DOM_DELTA_PIXEL with hardware-wheel-magnitude delta divides by WHEEL_PIXELS_PER_LINE (no boost)', () => {
    /* 100px → 1 line (above pinch threshold), passed through unboosted. */
    expect(normalizeWheelDeltaToLines(evt(100, 0))).toBe(100 / WHEEL_PIXELS_PER_LINE);
    /* Hardware wheel notch (~125px) lands close to 1.25 lines. */
    expect(normalizeWheelDeltaToLines(evt(125, 0))).toBeCloseTo(1.25, 5);
  });

  test('DOM_DELTA_PIXEL with pinch-magnitude delta is amplified by PINCH_SENSITIVITY_BOOST', () => {
    /* Typical macOS pinch frame: 5px → 0.05 lines (below threshold) → boosted. */
    const small = normalizeWheelDeltaToLines(evt(5, 0));
    expect(small).toBeCloseTo((5 / WHEEL_PIXELS_PER_LINE) * PINCH_SENSITIVITY_BOOST, 5);
    /* Sign is preserved through the boost. */
    expect(normalizeWheelDeltaToLines(evt(-5, 0))).toBeCloseTo(-small, 5);
  });

  test('PIXEL boost threshold is below typical hardware notch magnitude', () => {
    /* If a hardware notch reports as low as 50px in pixel mode, it must
       NOT trigger the pinch boost — otherwise a wheel click goes wild. */
    const justAboveThreshold = (PINCH_FRAME_LINE_THRESHOLD + 0.01) * WHEEL_PIXELS_PER_LINE;
    expect(normalizeWheelDeltaToLines(evt(justAboveThreshold, 0))).toBe(
      justAboveThreshold / WHEEL_PIXELS_PER_LINE,
    );
  });

  test('cumulative pinch (30 frames at 5px) lands a perceptible zoom factor', () => {
    /* Simulates a natural pinch: 30 events at 5px each. The cumulative
       multiplicative factor should be >= ~1.8x (clearly visible) but
       not so aggressive that small pinches over-zoom (< ~10x). */
    let factor = 1;
    for (let i = 0; i < 30; i++) {
      const lines = normalizeWheelDeltaToLines(evt(-5, 0));
      factor *= Math.exp(-lines * WHEEL_ZOOM_FACTOR_PER_LINE);
    }
    expect(factor).toBeGreaterThan(1.8);
    expect(factor).toBeLessThan(10);
  });

  test('DOM_DELTA_LINE passes deltaY through unchanged (no boost)', () => {
    expect(normalizeWheelDeltaToLines(evt(3, 1))).toBe(3);
    expect(normalizeWheelDeltaToLines(evt(-1, 1))).toBe(-1);
  });

  test('DOM_DELTA_PAGE multiplies by WHEEL_LINES_PER_PAGE', () => {
    expect(normalizeWheelDeltaToLines(evt(1, 2))).toBe(WHEEL_LINES_PER_PAGE);
  });
});
