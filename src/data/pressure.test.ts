import { describe, expect, test } from 'vitest';
import type { ActionEvent, PressurePoint } from './dj';
import {
  EDITOR_BINS,
  PRESSURE_CELLS,
  clearPressure,
  flattenPressure,
  rasterizePressure,
  smoothPressure,
  summarizePressure,
  synthesizePressure,
} from './pressure';

const seedEvent = (over: Partial<ActionEvent> = {}): ActionEvent => ({
  pitch: 56,
  t: 0,
  dur: 1,
  vel: 0.8,
  ...over,
});

describe('synthesizePressure', () => {
  test('returns a deterministic 14-point curve for the same input', () => {
    const a = synthesizePressure(seedEvent());
    const b = synthesizePressure(seedEvent());
    expect(a.length).toBe(PRESSURE_CELLS);
    expect(a).toEqual(b);
  });

  test('shape varies by perPitchIndex', () => {
    const arch = synthesizePressure(seedEvent(), 0);
    const rise = synthesizePressure(seedEvent(), 1);
    const peak = synthesizePressure(seedEvent(), 2);
    /* arch should peak near the middle; rise should be monotonically
       non-decreasing across the curve; peak (center-peak) should sit
       roughly at the middle. They MUST differ from each other. */
    expect(arch).not.toEqual(rise);
    expect(rise).not.toEqual(peak);
    expect(arch).not.toEqual(peak);
    /* Each point's v stays within [0,1] (clamped above 0.05 and below 1). */
    for (const p of [...arch, ...rise, ...peak]) {
      expect(p.v).toBeGreaterThanOrEqual(0.05);
      expect(p.v).toBeLessThanOrEqual(1);
    }
  });

  test('t values cover [0, 1] evenly', () => {
    const points = synthesizePressure(seedEvent());
    expect(points[0].t).toBeCloseTo(0, 5);
    expect(points[PRESSURE_CELLS - 1].t).toBeCloseTo(1, 5);
  });
});

describe('rasterizePressure', () => {
  test('empty input yields 16 zeroes', () => {
    const out = rasterizePressure([]);
    expect(out.length).toBe(EDITOR_BINS);
    expect(out.every((v) => v === 0)).toBe(true);
  });

  test('result length matches the requested bins', () => {
    const points: PressurePoint[] = [
      { t: 0, v: 0.2 },
      { t: 0.5, v: 0.9 },
      { t: 1, v: 0.5 },
    ];
    const out = rasterizePressure(points, 32);
    expect(out.length).toBe(32);
    expect(out.every((v) => v >= 0 && v <= 1)).toBe(true);
  });

  test('values stay in [0, 1] for dense input', () => {
    const points = synthesizePressure(seedEvent());
    const out = rasterizePressure(points);
    expect(out.length).toBe(EDITOR_BINS);
    for (const v of out) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  test('single point fills every bin with that point', () => {
    const out = rasterizePressure([{ t: 0.5, v: 0.7 }]);
    expect(out.every((v) => v === 0.7)).toBe(true);
  });
});

describe('summarizePressure', () => {
  test('empty input → zero count/peak/avg', () => {
    expect(summarizePressure([])).toEqual({ count: 0, peak: 0, avg: 0 });
  });

  test('count is the source-points length, not the bin count', () => {
    const points: PressurePoint[] = [
      { t: 0, v: 0.4 },
      { t: 0.5, v: 0.8 },
      { t: 1, v: 0.6 },
    ];
    const s = summarizePressure(points);
    expect(s.count).toBe(3);
    expect(s.peak).toBeGreaterThan(0.5);
    expect(s.peak).toBeLessThanOrEqual(1);
    expect(s.avg).toBeGreaterThan(0);
    expect(s.avg).toBeLessThan(1);
  });

  test('avg is mean of rasterised bins', () => {
    const flat: PressurePoint[] = [{ t: 0.5, v: 0.5 }];
    const s = summarizePressure(flat);
    expect(s.avg).toBeCloseTo(0.5, 5);
    expect(s.peak).toBeCloseTo(0.5, 5);
  });
});

describe('smoothPressure', () => {
  test('returns 16 evenly-spaced points', () => {
    const points = synthesizePressure(seedEvent());
    const sm = smoothPressure(points);
    expect(sm.length).toBe(EDITOR_BINS);
    for (let i = 0; i < EDITOR_BINS; i++) {
      expect(sm[i].t).toBeCloseTo(i / (EDITOR_BINS - 1), 5);
    }
  });

  test('flattens a sharp spike — peak strictly decreases', () => {
    /* Place one point per rasteriser bin (16 points at bin centres) so the
       spike maps to exactly one bin under nearest-neighbour. Bin 8 gets
       v=1; the rest get v=0. After smoothing with kernel 3, the peak bin
       averages with its zero-valued neighbours → roughly 0.33. */
    const spike: PressurePoint[] = [];
    for (let i = 0; i < EDITOR_BINS; i++) {
      spike.push({ t: i / (EDITOR_BINS - 1), v: i === 8 ? 1 : 0 });
    }
    const rast = rasterizePressure(spike);
    const rawPeak = Math.max(...rast);
    const smoothed = smoothPressure(spike);
    const smRast = rasterizePressure(smoothed);
    const smPeak = Math.max(...smRast);
    expect(rawPeak).toBe(1);
    expect(smPeak).toBeLessThan(rawPeak);
  });

  test('empty input returns empty array', () => {
    expect(smoothPressure([])).toEqual([]);
  });
});

describe('flattenPressure', () => {
  test('all 16 v values are equal', () => {
    const points = synthesizePressure(seedEvent());
    const flat = flattenPressure(points);
    expect(flat.length).toBe(EDITOR_BINS);
    const v0 = flat[0].v;
    for (const p of flat) {
      expect(p.v).toBeCloseTo(v0, 5);
    }
  });

  test('flat value equals the rasterised mean of the input', () => {
    const points: PressurePoint[] = [
      { t: 0, v: 0.2 },
      { t: 0.5, v: 0.8 },
      { t: 1, v: 0.5 },
    ];
    const flat = flattenPressure(points);
    const rast = rasterizePressure(points);
    const mean = rast.reduce((a, b) => a + b, 0) / rast.length;
    expect(flat[0].v).toBeCloseTo(mean, 5);
  });

  test('empty input returns empty array', () => {
    expect(flattenPressure([])).toEqual([]);
  });
});

describe('clearPressure', () => {
  test('returns a fresh empty array on every call', () => {
    const a = clearPressure();
    const b = clearPressure();
    expect(a).toEqual([]);
    expect(b).toEqual([]);
    expect(a).not.toBe(b);
  });
});
