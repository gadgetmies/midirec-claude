import { describe, expect, test } from 'vitest';
import type { PressurePoint } from '../../data/dj';
import { computeATSweepDelete, computeATSweepPaint, computeCCSweep } from './dragSweep';

describe('computeCCSweep', () => {
  test('forward jump produces inclusive [lo, hi] and two endpoint replacements', () => {
    const out = computeCCSweep({ t: 120, v: 0.2 }, { t: 480, v: 0.8 });
    expect(out.lo).toBe(120);
    expect(out.hi).toBe(480);
    expect(out.replacements).toEqual([
      { tTicks: 120, vel: 0.2 },
      { tTicks: 480, vel: 0.8 },
    ]);
  });

  test('backward jump normalises lo/hi and keeps prev-then-cur replacement order', () => {
    const out = computeCCSweep({ t: 480, v: 0.7 }, { t: 120, v: 0.4 });
    expect(out.lo).toBe(120);
    expect(out.hi).toBe(480);
    expect(out.replacements).toEqual([
      { tTicks: 480, vel: 0.7 },
      { tTicks: 120, vel: 0.4 },
    ]);
  });

  test('same-tick samples degenerate to a single latest-wins replacement', () => {
    const out = computeCCSweep({ t: 240, v: 0.3 }, { t: 240, v: 0.9 });
    expect(out.lo).toBe(240);
    expect(out.hi).toBe(240);
    expect(out.replacements).toEqual([{ tTicks: 240, vel: 0.9 }]);
  });

  /* Integration check: feeding the computeCCSweep output into the existing
     applyReplaceDJEventsInRange (covered separately) gives the end-to-end
     behavior the spec requires. We re-imagine that pipeline inline here. */
  test('end-to-end: fast drag wipes pre-existing in-range events including off-grid', () => {
    const existing = [
      { tTicks: 240, vel: 0.5 }, // intermediate snapped cell
      { tTicks: 360, vel: 0.5 }, // another intermediate snapped cell
      { tTicks: 263, vel: 0.5 }, // off-grid
      { tTicks: 600, vel: 0.9 }, // outside the sweep — must survive
    ];
    const out = computeCCSweep({ t: 120, v: 0.2 }, { t: 480, v: 0.8 });
    const filtered = existing.filter((e) => !(e.tTicks >= out.lo && e.tTicks <= out.hi));
    const next = [...filtered, ...out.replacements].sort((a, b) => a.tTicks - b.tTicks);
    expect(next).toEqual([
      { tTicks: 120, vel: 0.2 },
      { tTicks: 480, vel: 0.8 },
      { tTicks: 600, vel: 0.9 },
    ]);
  });
});

describe('computeATSweepPaint', () => {
  const ev = { tTicks: 480, durTicks: 240 }; // spans [480, 720], 1/16 = 120 → cells at 480, 600, 720

  test('returns null when either endpoint is outside the event span', () => {
    const base: PressurePoint[] = [{ t: 0.5, v: 0.5 }];
    expect(
      computeATSweepPaint({
        basePoints: base,
        evTTicks: ev.tTicks,
        evDurTicks: ev.durTicks,
        prev: { t: 100, v: 0.3 }, // before span
        cur: { t: 600, v: 0.7 },
      }),
    ).toBeNull();
    expect(
      computeATSweepPaint({
        basePoints: base,
        evTTicks: ev.tTicks,
        evDurTicks: ev.durTicks,
        prev: { t: 600, v: 0.3 },
        cur: { t: 900, v: 0.7 }, // after span
      }),
    ).toBeNull();
  });

  test('sweeps pressure points whose tRel falls strictly between prev and cur', () => {
    const base: PressurePoint[] = [
      { t: 0.0, v: 0.1 }, // outside swept range — survives
      { t: 0.5, v: 0.5 }, // inside — swept
      { t: 0.6, v: 0.7 }, // inside — swept
      { t: 1.0, v: 0.9 }, // outside — survives
    ];
    /* prev at tTicks 540 → tRel 0.25; cur at tTicks 660 → tRel 0.75. */
    const next = computeATSweepPaint({
      basePoints: base,
      evTTicks: ev.tTicks,
      evDurTicks: ev.durTicks,
      prev: { t: 540, v: 0.2 },
      cur: { t: 660, v: 0.8 },
    })!;
    expect(next.map((p) => p.t)).toEqual([0.0, 0.25, 0.75, 1.0]);
    expect(next.find((p) => p.t === 0.25)?.v).toBeCloseTo(0.2);
    expect(next.find((p) => p.t === 0.75)?.v).toBeCloseTo(0.8);
  });

  test('same-tick samples produce a single replacement (latest-wins)', () => {
    const base: PressurePoint[] = [{ t: 0.5, v: 0.4 }];
    const next = computeATSweepPaint({
      basePoints: base,
      evTTicks: ev.tTicks,
      evDurTicks: ev.durTicks,
      prev: { t: 600, v: 0.4 },
      cur: { t: 600, v: 0.9 },
    })!;
    /* The single replacement at tRel 0.5 overwrites the existing point. */
    expect(next).toEqual([{ t: 0.5, v: 0.9 }]);
  });

  test('clamps tRel endpoints to [0, 1] at the boundary', () => {
    const next = computeATSweepPaint({
      basePoints: [],
      evTTicks: ev.tTicks,
      evDurTicks: ev.durTicks,
      prev: { t: 480, v: 0.0 }, // exactly tRel 0
      cur: { t: 720, v: 1.0 }, // exactly tRel 1
    })!;
    expect(next).toEqual([
      { t: 0.0, v: 0.0 },
      { t: 1.0, v: 1.0 },
    ]);
  });

  test('clamps endpoint values to [0, 1]', () => {
    const next = computeATSweepPaint({
      basePoints: [],
      evTTicks: ev.tTicks,
      evDurTicks: ev.durTicks,
      prev: { t: 540, v: -0.3 },
      cur: { t: 660, v: 1.5 },
    })!;
    expect(next.find((p) => p.t === 0.25)?.v).toBe(0);
    expect(next.find((p) => p.t === 0.75)?.v).toBe(1);
  });
});

describe('computeATSweepDelete', () => {
  const ev = { tTicks: 480, durTicks: 240 };

  test('returns null when either endpoint is outside the event span', () => {
    const base: PressurePoint[] = [{ t: 0.5, v: 0.5 }];
    expect(
      computeATSweepDelete({
        basePoints: base,
        evTTicks: ev.tTicks,
        evDurTicks: ev.durTicks,
        prev: { t: 100 },
        cur: { t: 600 },
      }),
    ).toBeNull();
  });

  test('returns null when nothing in the range to delete (no-op)', () => {
    const base: PressurePoint[] = [
      { t: 0.0, v: 0.1 },
      { t: 1.0, v: 0.9 },
    ];
    expect(
      computeATSweepDelete({
        basePoints: base,
        evTTicks: ev.tTicks,
        evDurTicks: ev.durTicks,
        prev: { t: 540 }, // tRel 0.25
        cur: { t: 660 }, // tRel 0.75
      }),
    ).toBeNull();
  });

  test('removes pressure points whose tRel falls in the swept range', () => {
    const base: PressurePoint[] = [
      { t: 0.0, v: 0.1 },
      { t: 0.5, v: 0.5 },
      { t: 0.6, v: 0.7 },
      { t: 1.0, v: 0.9 },
    ];
    const next = computeATSweepDelete({
      basePoints: base,
      evTTicks: ev.tTicks,
      evDurTicks: ev.durTicks,
      prev: { t: 540 }, // tRel 0.25
      cur: { t: 660 }, // tRel 0.75
    })!;
    expect(next.map((p) => p.t)).toEqual([0.0, 1.0]);
  });
});
