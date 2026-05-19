import { describe, expect, test } from 'vitest';
import type { ActionEvent } from '../../data/dj';
import { flattenRangeReplacements, rasterizeRowEvents, smoothRangeReplacements } from './bulkOps';

const ev = (pitch: number, tTicks: number, vel: number): ActionEvent => ({
  pitch,
  tTicks,
  durTicks: 0,
  vel,
});

describe('rasterizeRowEvents', () => {
  test('empty events returns 16 zeros', () => {
    const out = rasterizeRowEvents([], 80, 0, 1920);
    expect(out).toHaveLength(16);
    expect(out.every((v) => v === 0)).toBe(true);
  });

  test('other pitches are ignored', () => {
    const out = rasterizeRowEvents([ev(81, 60, 1.0)], 80, 0, 1920);
    expect(out.every((v) => v === 0)).toBe(true);
  });

  test('points outside the range are ignored', () => {
    const out = rasterizeRowEvents(
      [ev(80, 2000, 0.9), ev(80, 60, 0.5)],
      80,
      0,
      1920,
    );
    expect(out.some((v) => v === 0.5)).toBe(true);
    expect(out.some((v) => v === 0.9)).toBe(false);
  });
});

describe('smoothRangeReplacements', () => {
  test('produces 16 evenly-spaced cells across [0, 1920]', () => {
    const out = smoothRangeReplacements(
      [ev(80, 0, 0.5), ev(80, 1920, 0.5)],
      80,
      0,
      1920,
    );
    expect(out).toHaveLength(16);
    /* tTicks at 0, 128, 256, ..., 1920 with step 128 */
    expect(out[0].tTicks).toBe(0);
    expect(out[15].tTicks).toBe(1920);
    expect(out[1].tTicks).toBe(128);
  });

  test('vels are clamped to [0, 1]', () => {
    const out = smoothRangeReplacements([ev(80, 100, 1.0)], 80, 0, 1920);
    for (const c of out) {
      expect(c.vel).toBeGreaterThanOrEqual(0);
      expect(c.vel).toBeLessThanOrEqual(1);
    }
  });

  test('smoothing reduces a sharp spike', () => {
    const spike = [ev(80, 960, 1.0)];
    const out = smoothRangeReplacements(spike, 80, 0, 1920);
    const peak = Math.max(...out.map((c) => c.vel));
    expect(peak).toBeLessThan(1);
  });
});

describe('flattenRangeReplacements', () => {
  test('produces 16 cells with identical vel (the mean)', () => {
    const out = flattenRangeReplacements(
      [ev(80, 100, 0.2), ev(80, 1800, 1.0)],
      80,
      0,
      1920,
    );
    expect(out).toHaveLength(16);
    const vels = out.map((c) => c.vel);
    for (const v of vels) {
      expect(Math.abs(v - vels[0])).toBeLessThan(0.001);
    }
  });

  test('empty in-range gives all zeros', () => {
    const out = flattenRangeReplacements([], 80, 0, 1920);
    expect(out.every((c) => c.vel === 0)).toBe(true);
  });
});
