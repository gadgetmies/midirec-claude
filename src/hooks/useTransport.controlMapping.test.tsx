import { afterEach, describe, expect, test } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { TransportProvider, useTransport, type TransportValue } from './useTransport';

afterEach(() => {
  cleanup();
});

function harness() {
  const captured: { current: TransportValue | null } = { current: null };
  function Probe() {
    captured.current = useTransport();
    return null;
  }
  render(
    <TransportProvider>
      <Probe />
    </TransportProvider>,
  );
  return captured;
}

describe('useTransport phrase-jump', () => {
  test('phraseForward advances by N bars snapped to the bar', () => {
    const t = harness();
    // default 124 BPM, 4/4: 1 bar = 4 * (60000/124) ms.
    const barMs = 4 * (60000 / 124);
    act(() => {
      t.current!.phraseForward(8);
    });
    expect(t.current!.timecodeMs).toBeCloseTo(8 * barMs, 3);
  });

  test('phraseBack clamps the playhead at 0', () => {
    const t = harness();
    act(() => {
      t.current!.phraseForward(4); // move forward first
    });
    act(() => {
      t.current!.phraseBack(8); // back further than current → clamp 0
    });
    expect(t.current!.timecodeMs).toBe(0);
    expect(t.current!.playheadTicks).toBe(0);
  });
});

describe('useTransport setBpm', () => {
  test('changes BPM while on the internal clock', () => {
    const t = harness();
    expect(t.current!.clockSource).toBe('internal');
    act(() => {
      t.current!.setBpm(140);
    });
    expect(t.current!.bpm).toBe(140);
  });

  test('is a no-op while slaved to an external clock', () => {
    const t = harness();
    act(() => {
      t.current!.applyExternalPulse(10, 128); // flip to external-clock, mirror 128
    });
    expect(t.current!.clockSource).toBe('external-clock');
    act(() => {
      t.current!.setBpm(140);
    });
    expect(t.current!.bpm).toBe(128); // unchanged — clock owns tempo
  });

  test('does not move the playhead', () => {
    const t = harness();
    act(() => {
      t.current!.seek(2000);
    });
    const before = t.current!.timecodeMs;
    act(() => {
      t.current!.setBpm(150);
    });
    expect(t.current!.timecodeMs).toBe(before);
  });
});

describe('useTransport setClockSource', () => {
  test('sets the clock source', () => {
    const t = harness();
    act(() => {
      t.current!.setClockSource('external-mtc');
    });
    expect(t.current!.clockSource).toBe('external-mtc');
  });

  test('reverting to internal restores the user BPM', () => {
    const t = harness();
    act(() => {
      t.current!.setBpm(150); // user bpm now 150
    });
    act(() => {
      t.current!.applyExternalPulse(10, 90); // external mirror 90
    });
    expect(t.current!.bpm).toBe(90);
    act(() => {
      t.current!.setClockSource('internal');
    });
    expect(t.current!.bpm).toBe(150);
  });
});
