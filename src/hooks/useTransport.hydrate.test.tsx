import { describe, expect, test, afterEach } from 'vitest';
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

describe('useTransport.hydrate', () => {
  test('replaces the transport-authoring subset including cuePointTicks', () => {
    const t = harness();
    expect(t.current!.bpm).toBe(124);
    expect(t.current!.cuePointTicks).toBe(0);

    act(() => {
      t.current!.hydrate({
        bpm: 140,
        sig: '7/8',
        quantizeOn: false,
        quantizeGrid: '1/8',
        snapAbsoluteOn: true,
        looping: true,
        metronomeOn: false,
        clockSource: 'external-clock',
        cuePointTicks: 1920,
      });
    });

    expect(t.current!.bpm).toBe(140);
    expect(t.current!.sig).toBe('7/8');
    expect(t.current!.quantizeOn).toBe(false);
    expect(t.current!.quantizeGrid).toBe('1/8');
    expect(t.current!.snapAbsoluteOn).toBe(true);
    expect(t.current!.looping).toBe(true);
    expect(t.current!.metronomeOn).toBe(false);
    expect(t.current!.clockSource).toBe('external-clock');
    expect(t.current!.cuePointTicks).toBe(1920);
  });

  test('resets runtime fields atomically (mode, timecodeMs, playheadTicks, recordingStartedAt)', () => {
    const t = harness();

    act(() => {
      t.current!.record();
    });
    act(() => {
      t.current!.seek(2500);
    });
    expect(t.current!.mode).toBe('record');
    expect(t.current!.timecodeMs).toBeGreaterThan(0);
    expect(t.current!.playheadTicks).toBeGreaterThan(0);
    expect(t.current!.recordingStartedAt).not.toBeNull();

    act(() => {
      t.current!.hydrate({
        bpm: 100,
        sig: '4/4',
        quantizeOn: true,
        quantizeGrid: '1/16',
        snapAbsoluteOn: false,
        looping: false,
        metronomeOn: true,
        clockSource: 'internal',
        cuePointTicks: 0,
      });
    });

    expect(t.current!.bpm).toBe(100);
    expect(t.current!.mode).toBe('idle');
    expect(t.current!.playing).toBe(false);
    expect(t.current!.recording).toBe(false);
    expect(t.current!.timecodeMs).toBe(0);
    expect(t.current!.playheadTicks).toBe(0);
    expect(t.current!.recordingStartedAt).toBeNull();
    expect(t.current!.cuePointTicks).toBe(0);
  });
});
