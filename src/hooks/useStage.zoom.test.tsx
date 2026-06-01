import { afterEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { StageProvider, useStage, type StageState } from './useStage';
import { TransportProvider } from './useTransport';
import {
  DEFAULT_PX_PER_BEAT,
  MAX_PX_PER_BEAT,
  MIN_PX_PER_BEAT,
} from '../session/timelineZoom';

afterEach(() => {
  cleanup();
});

function harness() {
  const captured: { current: StageState | null } = { current: null };
  function Probe() {
    captured.current = useStage();
    return null;
  }
  render(
    <TransportProvider>
      <StageProvider>
        <Probe />
      </StageProvider>
    </TransportProvider>,
  );
  return captured;
}

describe('useStage zoom state', () => {
  test('defaults pxPerBeat to DEFAULT_PX_PER_BEAT', () => {
    const s = harness();
    expect(s.current!.pxPerBeat).toBe(DEFAULT_PX_PER_BEAT);
  });

  test('setPxPerBeat clamps low values to MIN', () => {
    const s = harness();
    act(() => s.current!.setPxPerBeat(0.5));
    expect(s.current!.pxPerBeat).toBe(MIN_PX_PER_BEAT);
  });

  test('setPxPerBeat clamps high values to MAX', () => {
    const s = harness();
    act(() => s.current!.setPxPerBeat(99999));
    expect(s.current!.pxPerBeat).toBe(MAX_PX_PER_BEAT);
  });

  test('setPxPerBeat with equal value is a no-op (state ref preserved)', () => {
    const s = harness();
    const before = s.current!.pxPerBeat;
    act(() => s.current!.setPxPerBeat(before));
    expect(s.current!.pxPerBeat).toBe(before);
  });

  test('setPxPerBeat accepts in-range values verbatim', () => {
    const s = harness();
    act(() => s.current!.setPxPerBeat(176));
    expect(s.current!.pxPerBeat).toBe(176);
  });
});

describe('useStage.hydrateView', () => {
  test('missing pxPerBeat hydrates to default', () => {
    const s = harness();
    act(() => s.current!.setPxPerBeat(400));
    expect(s.current!.pxPerBeat).toBe(400);
    act(() => s.current!.hydrateView({}));
    expect(s.current!.pxPerBeat).toBe(DEFAULT_PX_PER_BEAT);
  });

  test('non-finite pxPerBeat defaults and warns', () => {
    const s = harness();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    act(() => s.current!.hydrateView({ pxPerBeat: Number.NaN }));
    expect(s.current!.pxPerBeat).toBe(DEFAULT_PX_PER_BEAT);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0]![0]).toMatch(/pxPerBeat/);
    warnSpy.mockRestore();
  });

  test('out-of-range pxPerBeat is clamped on hydrate', () => {
    const s = harness();
    act(() => s.current!.hydrateView({ pxPerBeat: 5000 }));
    expect(s.current!.pxPerBeat).toBe(MAX_PX_PER_BEAT);
    act(() => s.current!.hydrateView({ pxPerBeat: 0.1 }));
    expect(s.current!.pxPerBeat).toBe(MIN_PX_PER_BEAT);
  });

  test('in-range pxPerBeat is hydrated verbatim', () => {
    const s = harness();
    act(() => s.current!.hydrateView({ pxPerBeat: 250 }));
    expect(s.current!.pxPerBeat).toBe(250);
  });
});
