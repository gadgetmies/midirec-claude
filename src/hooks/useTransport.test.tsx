import { describe, expect, expectTypeOf, test, afterEach } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { TransportProvider, useTransport, type TransportValue } from './useTransport';
import { DEFAULT_MIDI_TPQ } from '../midi/timelineTicks';

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

describe('useTransport snapAbsoluteOn', () => {
  test('defaults to false at hook init', () => {
    const t = harness();
    expect(t.current!.snapAbsoluteOn).toBe(false);
  });

  test('toggleSnapAbsolute flips the flag', () => {
    const t = harness();
    expect(t.current!.snapAbsoluteOn).toBe(false);
    act(() => {
      t.current!.toggleSnapAbsolute();
    });
    expect(t.current!.snapAbsoluteOn).toBe(true);
    act(() => {
      t.current!.toggleSnapAbsolute();
    });
    expect(t.current!.snapAbsoluteOn).toBe(false);
  });

  test('toggleSnapAbsolute does not affect quantizeOn or quantizeGrid', () => {
    const t = harness();
    const before = { qOn: t.current!.quantizeOn, qGrid: t.current!.quantizeGrid };
    act(() => {
      t.current!.toggleSnapAbsolute();
    });
    expect(t.current!.quantizeOn).toBe(before.qOn);
    expect(t.current!.quantizeGrid).toBe(before.qGrid);
  });
});

describe('useTransport setQuantizeGrid', () => {
  test('updates quantizeGrid to the given value', () => {
    const t = harness();
    expect(t.current!.quantizeGrid).toBe('1/16');
    act(() => {
      t.current!.setQuantizeGrid('1/8');
    });
    expect(t.current!.quantizeGrid).toBe('1/8');
    act(() => {
      t.current!.setQuantizeGrid('1/32');
    });
    expect(t.current!.quantizeGrid).toBe('1/32');
  });

  test('does not affect quantizeOn or snapAbsoluteOn', () => {
    const t = harness();
    const before = { qOn: t.current!.quantizeOn, snap: t.current!.snapAbsoluteOn };
    act(() => {
      t.current!.setQuantizeGrid('1/4');
    });
    expect(t.current!.quantizeOn).toBe(before.qOn);
    expect(t.current!.snapAbsoluteOn).toBe(before.snap);
  });
});

describe('useTransport.pause contract', () => {
  test('1.1 pause from record preserves recordingStartedAt + timecodeMs + playheadTicks', () => {
    const t = harness();
    act(() => {
      t.current!.record();
    });
    expect(t.current!.mode).toBe('record');
    const stamp = t.current!.recordingStartedAt;
    expect(stamp).not.toBeNull();
    act(() => {
      t.current!.seek(1000);
    });
    const ms = t.current!.timecodeMs;
    const ticks = t.current!.playheadTicks;
    act(() => {
      t.current!.pause();
    });
    expect(t.current!.mode).toBe('idle');
    expect(t.current!.recordingStartedAt).toBe(stamp);
    expect(t.current!.timecodeMs).toBe(ms);
    expect(t.current!.playheadTicks).toBe(ticks);
  });

  test('1.2 pause from play is structurally a no-op except mode -> idle', () => {
    const t = harness();
    act(() => {
      t.current!.play();
    });
    expect(t.current!.mode).toBe('play');
    act(() => {
      t.current!.seek(1000);
    });
    const before = {
      timecodeMs: t.current!.timecodeMs,
      playheadTicks: t.current!.playheadTicks,
      recordingStartedAt: t.current!.recordingStartedAt,
      bpm: t.current!.bpm,
      cuePointTicks: t.current!.cuePointTicks,
    };
    act(() => {
      t.current!.pause();
    });
    expect(t.current!.mode).toBe('idle');
    expect(t.current!.timecodeMs).toBe(before.timecodeMs);
    expect(t.current!.playheadTicks).toBe(before.playheadTicks);
    expect(t.current!.recordingStartedAt).toBe(before.recordingStartedAt);
    expect(t.current!.bpm).toBe(before.bpm);
    expect(t.current!.cuePointTicks).toBe(before.cuePointTicks);
  });
});

describe('useTransport.record contract', () => {
  test('1.3 record from idle with recordingStartedAt === null resets position and stamps', () => {
    const t = harness();
    act(() => {
      t.current!.seek(2000);
    });
    expect(t.current!.playheadTicks).toBeGreaterThan(0);
    expect(t.current!.recordingStartedAt).toBeNull();
    act(() => {
      t.current!.record();
    });
    expect(t.current!.mode).toBe('record');
    expect(t.current!.timecodeMs).toBe(0);
    expect(t.current!.playheadTicks).toBe(0);
    expect(t.current!.recordingStartedAt).not.toBeNull();
    expect(t.current!.recordingStartedAt!).toBeGreaterThan(0);
  });

  test('1.4 record from idle with recordingStartedAt !== null preserves position and stamp (resume)', () => {
    const t = harness();
    act(() => {
      t.current!.record();
    });
    const stamp = t.current!.recordingStartedAt;
    expect(stamp).not.toBeNull();
    act(() => {
      t.current!.seek(1500);
    });
    const ms = t.current!.timecodeMs;
    const ticks = t.current!.playheadTicks;
    act(() => {
      t.current!.pause();
    });
    expect(t.current!.mode).toBe('idle');
    expect(t.current!.recordingStartedAt).toBe(stamp);
    act(() => {
      t.current!.record();
    });
    expect(t.current!.mode).toBe('record');
    expect(t.current!.recordingStartedAt).toBe(stamp);
    expect(t.current!.timecodeMs).toBe(ms);
    expect(t.current!.playheadTicks).toBe(ticks);
  });

  test('1.5 record from play preserves position and stamps a new recordingStartedAt', () => {
    const t = harness();
    act(() => {
      t.current!.play();
    });
    act(() => {
      t.current!.seek(1000);
    });
    const ms = t.current!.timecodeMs;
    const ticks = t.current!.playheadTicks;
    expect(t.current!.recordingStartedAt).toBeNull();
    act(() => {
      t.current!.record();
    });
    expect(t.current!.mode).toBe('record');
    expect(t.current!.timecodeMs).toBe(ms);
    expect(t.current!.playheadTicks).toBe(ticks);
    expect(t.current!.recordingStartedAt).not.toBeNull();
    expect(t.current!.recordingStartedAt!).toBeGreaterThan(0);
  });
});

describe('useTransport.rewind contract', () => {
  test('1.6a rewind from idle resets position, preserves mode/recordingStartedAt/cuePointTicks', () => {
    const t = harness();
    act(() => {
      t.current!.seek(1500);
    });
    act(() => {
      t.current!.cue();
    });
    const cue = t.current!.cuePointTicks;
    expect(cue).toBeGreaterThan(0);
    act(() => {
      t.current!.seek(2500);
    });
    act(() => {
      t.current!.rewind();
    });
    expect(t.current!.mode).toBe('idle');
    expect(t.current!.timecodeMs).toBe(0);
    expect(t.current!.playheadTicks).toBe(0);
    expect(t.current!.recordingStartedAt).toBeNull();
    expect(t.current!.cuePointTicks).toBe(cue);
  });

  test('1.6b rewind from play preserves mode + cuePointTicks; resets position', () => {
    const t = harness();
    act(() => {
      t.current!.seek(1500);
    });
    act(() => {
      t.current!.cue();
    });
    const cue = t.current!.cuePointTicks;
    act(() => {
      t.current!.play();
    });
    act(() => {
      t.current!.seek(2500);
    });
    act(() => {
      t.current!.rewind();
    });
    expect(t.current!.mode).toBe('play');
    expect(t.current!.timecodeMs).toBe(0);
    expect(t.current!.playheadTicks).toBe(0);
    expect(t.current!.cuePointTicks).toBe(cue);
  });

  test('1.6c rewind from record preserves mode + recordingStartedAt + cuePointTicks; resets position', () => {
    const t = harness();
    act(() => {
      t.current!.seek(1500);
    });
    act(() => {
      t.current!.cue();
    });
    const cue = t.current!.cuePointTicks;
    act(() => {
      t.current!.record();
    });
    const stamp = t.current!.recordingStartedAt;
    expect(stamp).not.toBeNull();
    act(() => {
      t.current!.seek(2500);
    });
    act(() => {
      t.current!.rewind();
    });
    expect(t.current!.mode).toBe('record');
    expect(t.current!.timecodeMs).toBe(0);
    expect(t.current!.playheadTicks).toBe(0);
    expect(t.current!.recordingStartedAt).toBe(stamp);
    expect(t.current!.cuePointTicks).toBe(cue);
  });
});

describe('useTransport.cue contract', () => {
  test('1.7 cue from idle stores playheadTicks into cuePointTicks; no other change', () => {
    const t = harness();
    act(() => {
      t.current!.seek(1500);
    });
    const ticks = t.current!.playheadTicks;
    const ms = t.current!.timecodeMs;
    expect(ticks).toBeGreaterThan(0);
    act(() => {
      t.current!.cue();
    });
    expect(t.current!.cuePointTicks).toBe(ticks);
    expect(t.current!.mode).toBe('idle');
    expect(t.current!.playheadTicks).toBe(ticks);
    expect(t.current!.timecodeMs).toBe(ms);
    expect(t.current!.recordingStartedAt).toBeNull();
  });

  test('1.8 cue from play -> idle, playhead snaps to cuePointTicks, timecodeMs ~ ms equiv', () => {
    const t = harness();
    act(() => {
      t.current!.seek(1500);
    });
    act(() => {
      t.current!.cue();
    });
    const cue = t.current!.cuePointTicks;
    const bpm = t.current!.bpm;
    act(() => {
      t.current!.play();
    });
    act(() => {
      t.current!.seek(3000);
    });
    expect(t.current!.playheadTicks).not.toBe(cue);
    act(() => {
      t.current!.cue();
    });
    expect(t.current!.mode).toBe('idle');
    expect(t.current!.playheadTicks).toBe(cue);
    const expectedMs = (cue / DEFAULT_MIDI_TPQ) * (60 / bpm) * 1000;
    expect(Math.abs(t.current!.timecodeMs - expectedMs)).toBeLessThan(0.1);
    expect(t.current!.cuePointTicks).toBe(cue);
  });

  test('1.9 cue from record -> idle, playhead snaps, recordingStartedAt cleared', () => {
    const t = harness();
    act(() => {
      t.current!.seek(1500);
    });
    act(() => {
      t.current!.cue();
    });
    const cue = t.current!.cuePointTicks;
    const bpm = t.current!.bpm;
    act(() => {
      t.current!.record();
    });
    expect(t.current!.recordingStartedAt).not.toBeNull();
    act(() => {
      t.current!.seek(3000);
    });
    act(() => {
      t.current!.cue();
    });
    expect(t.current!.mode).toBe('idle');
    expect(t.current!.playheadTicks).toBe(cue);
    const expectedMs = (cue / DEFAULT_MIDI_TPQ) * (60 / bpm) * 1000;
    expect(Math.abs(t.current!.timecodeMs - expectedMs)).toBeLessThan(0.1);
    expect(t.current!.recordingStartedAt).toBeNull();
    expect(t.current!.cuePointTicks).toBe(cue);
  });

  test('1.10 cuePointTicks defaults to 0 and is independent of seek', () => {
    const t = harness();
    expect(t.current!.cuePointTicks).toBe(0);
    act(() => {
      t.current!.seek(2000);
    });
    expect(t.current!.playheadTicks).toBeGreaterThan(0);
    expect(t.current!.cuePointTicks).toBe(0);
  });
});

describe('useTransport stop action removed', () => {
  test('1.11 TransportValue does not expose a stop property', () => {
    expectTypeOf<TransportValue>().not.toHaveProperty('stop');
  });
});
