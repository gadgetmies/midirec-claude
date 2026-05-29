import { afterEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { TransportProvider, useTransport, type TransportValue } from './useTransport';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
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

describe('useTransport — external clock', () => {
  test('applyExternalPulse flips clockSource to external-clock and mirrors bpm', () => {
    const t = harness();
    expect(t.current!.clockSource).toBe('internal');
    expect(t.current!.bpm).toBe(124);

    act(() => {
      t.current!.applyExternalPulse(0, 128);
    });

    expect(t.current!.clockSource).toBe('external-clock');
    expect(t.current!.bpm).toBe(128);
  });

  test('applyExternalPulse advances timecodeMs by deltaMs when mode !== idle', () => {
    const t = harness();
    act(() => t.current!.play());
    const before = t.current!.timecodeMs;

    act(() => t.current!.applyExternalPulse(20.833, 120));
    // Source is now external, timecode advanced by ~20.833 ms from where we were.
    expect(t.current!.clockSource).toBe('external-clock');
    expect(t.current!.timecodeMs).toBeCloseTo(before + 20.833, 1);

    act(() => t.current!.applyExternalPulse(20.833, 120));
    expect(t.current!.timecodeMs).toBeCloseTo(before + 41.666, 1);
  });

  test('applyExternalPulse does not advance timecodeMs when mode === idle', () => {
    const t = harness();
    expect(t.current!.mode).toBe('idle');
    expect(t.current!.timecodeMs).toBe(0);

    act(() => t.current!.applyExternalPulse(20.833, 120));
    expect(t.current!.timecodeMs).toBe(0);
    expect(t.current!.clockSource).toBe('external-clock');
    expect(t.current!.bpm).toBe(120);
  });

  test('rAF tick does not advance timecodeMs while in external-clock mode', async () => {
    const t = harness();
    act(() => t.current!.play());
    act(() => t.current!.applyExternalPulse(0, 120));
    const before = t.current!.timecodeMs;

    // Wait long enough that rAF ticks would normally accumulate (~100 ms of frames).
    await new Promise((resolve) => setTimeout(resolve, 120));

    // Nothing should have advanced because rAF is gated off in external-clock mode.
    expect(t.current!.timecodeMs).toBe(before);
  });

  test('revertToInternalClock restores bpm to user-set value and re-enables rAF', async () => {
    const t = harness();
    act(() => t.current!.applyExternalPulse(0, 145));
    expect(t.current!.bpm).toBe(145);
    expect(t.current!.clockSource).toBe('external-clock');

    act(() => t.current!.revertToInternalClock());
    expect(t.current!.bpm).toBe(124);
    expect(t.current!.clockSource).toBe('internal');

    // rAF should resume advancing timecodeMs in play mode.
    act(() => t.current!.play());
    const before = t.current!.timecodeMs;
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(t.current!.timecodeMs).toBeGreaterThan(before);
  });

  test('applyExternalPulse with mode=idle then play preserves source on next pulse', () => {
    const t = harness();
    // External clock detected before play
    act(() => t.current!.applyExternalPulse(0, 120));
    expect(t.current!.clockSource).toBe('external-clock');
    expect(t.current!.timecodeMs).toBe(0);

    // User hits play; clockSource remains external (play doesn't change source)
    act(() => t.current!.play());
    expect(t.current!.clockSource).toBe('external-clock');
    expect(t.current!.mode).toBe('play');

    // Pulse advances now
    act(() => t.current!.applyExternalPulse(20.833, 120));
    expect(t.current!.timecodeMs).toBeCloseTo(20.833, 1);
  });

  test('source-switch mid-playback does not move timecode backwards', async () => {
    const t = harness();
    act(() => t.current!.play());

    // Let rAF run for a bit to accumulate timecode in internal mode.
    await new Promise((resolve) => setTimeout(resolve, 60));
    const before = t.current!.timecodeMs;
    expect(before).toBeGreaterThan(0);

    // First external pulse arrives with deltaMs = 0 (no prior pulse to derive interval).
    act(() => t.current!.applyExternalPulse(0, 120));
    expect(t.current!.timecodeMs).toBeGreaterThanOrEqual(before);
    expect(t.current!.clockSource).toBe('external-clock');
  });

  test('negative deltaMs is clamped to zero in the reducer', () => {
    const t = harness();
    act(() => t.current!.play());
    const before = t.current!.timecodeMs;
    act(() => t.current!.applyExternalPulse(-50, 120));
    expect(t.current!.timecodeMs).toBe(before);
  });

  test('revertToInternalClock when already internal is a no-op', () => {
    const t = harness();
    const initial = t.current!;
    act(() => t.current!.revertToInternalClock());
    expect(t.current!).toBe(initial);
  });
});
