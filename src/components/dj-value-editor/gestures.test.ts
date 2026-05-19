import { describe, expect, test } from 'vitest';
import { cellsBetween, clientXToTicks, clientYToVel, lerpVel, snapTickForWrite } from './gestures';

describe('snapTickForWrite', () => {
  test('quantizeOn=false rounds to nearest integer tick', () => {
    expect(snapTickForWrite({ rawTicks: 145.7, quantizeOn: false, quantizeGrid: '1/16', snapAbsoluteOn: true })).toBe(
      146,
    );
    expect(snapTickForWrite({ rawTicks: 144.4, quantizeOn: false, quantizeGrid: '1/16', snapAbsoluteOn: false })).toBe(
      144,
    );
  });

  test('quantizeOn + snapAbsoluteOn rounds to nearest grid cell', () => {
    /* 1/16 at TPQ=480 → 120 ticks. Cells at 0, 120, 240, ... */
    expect(
      snapTickForWrite({ rawTicks: 145, quantizeOn: true, quantizeGrid: '1/16', snapAbsoluteOn: true }),
    ).toBe(120);
    expect(
      snapTickForWrite({ rawTicks: 60, quantizeOn: true, quantizeGrid: '1/16', snapAbsoluteOn: true }),
    ).toBe(120);
    expect(
      snapTickForWrite({ rawTicks: 59, quantizeOn: true, quantizeGrid: '1/16', snapAbsoluteOn: true }),
    ).toBe(0);
    expect(
      snapTickForWrite({ rawTicks: 600, quantizeOn: true, quantizeGrid: '1/16', snapAbsoluteOn: true }),
    ).toBe(600);
  });

  test('quantizeOn without snapAbsoluteOn floors to grid cell', () => {
    expect(
      snapTickForWrite({ rawTicks: 145, quantizeOn: true, quantizeGrid: '1/16', snapAbsoluteOn: false }),
    ).toBe(120);
    expect(
      snapTickForWrite({ rawTicks: 119, quantizeOn: true, quantizeGrid: '1/16', snapAbsoluteOn: false }),
    ).toBe(0);
    expect(
      snapTickForWrite({ rawTicks: 240, quantizeOn: true, quantizeGrid: '1/16', snapAbsoluteOn: false }),
    ).toBe(240);
  });

  test('1/8 grid (240 ticks) at 145 with snapAbsoluteOn rounds to 240', () => {
    expect(
      snapTickForWrite({ rawTicks: 145, quantizeOn: true, quantizeGrid: '1/8', snapAbsoluteOn: true }),
    ).toBe(240);
  });
});

describe('clientYToVel', () => {
  test('top of canvas → 1', () => {
    expect(clientYToVel(0, 0, 100)).toBe(1);
  });
  test('bottom of canvas → 0', () => {
    expect(clientYToVel(100, 0, 100)).toBe(0);
  });
  test('middle of canvas → 0.5', () => {
    expect(clientYToVel(50, 0, 100)).toBe(0.5);
  });
  test('out-of-bounds clamps to [0, 1]', () => {
    expect(clientYToVel(-50, 0, 100)).toBe(1);
    expect(clientYToVel(200, 0, 100)).toBe(0);
  });
  test('respects non-zero canvasTop', () => {
    expect(clientYToVel(120, 100, 80)).toBeCloseTo(0.75, 3);
  });
});

describe('cellsBetween', () => {
  test('returns ascending cells in inclusive range', () => {
    expect(cellsBetween(120, 600, 120)).toEqual([120, 240, 360, 480, 600]);
  });

  test('reversed args still produce ascending cells', () => {
    expect(cellsBetween(600, 120, 120)).toEqual([120, 240, 360, 480, 600]);
  });

  test('single cell when endpoints coincide on grid', () => {
    expect(cellsBetween(240, 240, 120)).toEqual([240]);
  });

  test('endpoint not on grid rounds inward', () => {
    expect(cellsBetween(50, 600, 120)).toEqual([120, 240, 360, 480, 600]);
    expect(cellsBetween(120, 550, 120)).toEqual([120, 240, 360, 480]);
  });

  test('empty when range is between two adjacent grid cells off-grid', () => {
    expect(cellsBetween(125, 235, 120)).toEqual([]);
  });
});

describe('lerpVel', () => {
  test('linear interpolation', () => {
    expect(lerpVel(0, 0, 100, 1, 50)).toBeCloseTo(0.5, 3);
    expect(lerpVel(0, 0, 100, 1, 0)).toBe(0);
    expect(lerpVel(0, 0, 100, 1, 100)).toBe(1);
  });
  test('t0 === t1 returns v1', () => {
    expect(lerpVel(50, 0.2, 50, 0.7, 50)).toBe(0.7);
  });
});

describe('clientXToTicks', () => {
  test('inverts the keys-column-offset translate', () => {
    /* When scrollLeft = 0 and the inner is translated by keysColumnWidth,
       a click at clientX === canvasContentLeft + keysColumnWidth maps to
       tick 0. */
    expect(
      clientXToTicks({
        clientX: 56,
        canvasContentLeft: 0,
        scrollLeft: 0,
        keysColumnWidth: 56,
        pxPerTick: 0.5,
      }),
    ).toBe(0);
  });

  test('respects scrollLeft offset', () => {
    /* With scrollLeft = 400, the click at clientX = canvasContentLeft +
       keysColumnWidth (the timeline body's tick-0 position) maps to the
       tick currently at the visible left of the body: scrollLeft / pxPerTick
       = 400 / 0.5 = 800. */
    const args = {
      clientX: 56,
      canvasContentLeft: 0,
      scrollLeft: 400,
      keysColumnWidth: 56,
      pxPerTick: 0.5,
    };
    expect(clientXToTicks(args)).toBe(800);
    expect(
      clientXToTicks({ ...args, clientX: 56 + 50 }),
    ).toBe(900);
  });
});
