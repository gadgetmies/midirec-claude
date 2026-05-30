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
  test('replaces the transport-authoring subset', () => {
    const t = harness();
    expect(t.current!.bpm).toBe(124);

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
  });

  test('does not touch runtime/transient transport fields', () => {
    const t = harness();

    act(() => {
      t.current!.play();
    });
    expect(t.current!.playing).toBe(true);
    expect(t.current!.mode).toBe('play');

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
      });
    });

    expect(t.current!.bpm).toBe(100);
    expect(t.current!.mode).toBe('play');
    expect(t.current!.playing).toBe(true);

    act(() => {
      t.current!.stop();
    });
  });
});
