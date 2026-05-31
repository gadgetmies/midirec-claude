import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { BeatLed } from './BeatLed';
import type { MidiClockValue } from '../../midi/MidiClockProvider';

let clockState: MidiClockValue = {
  present: false,
  bpm: null,
  pulse: 0,
  beat: 0,
  running: false,
  selection: 'auto',
  strictStart: false,
  setSelection: () => {},
  setStrictStart: () => {},
  onPulse: () => () => {},
  onStart: () => () => {},
};

vi.mock('../../midi/MidiClockProvider', () => ({
  useMidiClock: () => clockState,
}));

function setClock(next: Partial<MidiClockValue>) {
  clockState = { ...clockState, ...next };
}

beforeEach(() => {
  vi.useFakeTimers();
  clockState = {
    present: false,
    bpm: null,
    pulse: 0,
    beat: 0,
    running: false,
    selection: 'auto',
    strictStart: false,
    setSelection: () => {},
    setStrictStart: () => {},
    onPulse: () => () => {},
  onStart: () => () => {},
  };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('BeatLed', () => {
  test('renders dim with no data-state when present === false', () => {
    setClock({ present: false });
    const { container } = render(<BeatLed />);
    const led = container.querySelector('.mr-led')!;
    expect(led.getAttribute('data-state')).toBeNull();
    expect(led.classList.contains('is-pulse')).toBe(false);
  });

  test('renders data-state="beat" when present === true', () => {
    setClock({ present: true, beat: 0 });
    const { container } = render(<BeatLed />);
    const led = container.querySelector('.mr-led')!;
    expect(led.getAttribute('data-state')).toBe('beat');
  });

  test('receives is-pulse on beat increment and loses it ~80 ms later', () => {
    setClock({ present: true, beat: 5 });
    const { container, rerender } = render(<BeatLed />);
    let led = container.querySelector('.mr-led')!;
    // Initial mount with present=true and any beat → effect runs and sets is-pulse=true.
    expect(led.classList.contains('is-pulse')).toBe(true);

    // 80 ms passes — class clears.
    act(() => {
      vi.advanceTimersByTime(80);
    });
    led = container.querySelector('.mr-led')!;
    expect(led.classList.contains('is-pulse')).toBe(false);

    // New beat increment → is-pulse re-applies.
    setClock({ present: true, beat: 6 });
    rerender(<BeatLed />);
    led = container.querySelector('.mr-led')!;
    expect(led.classList.contains('is-pulse')).toBe(true);

    act(() => {
      vi.advanceTimersByTime(80);
    });
    led = container.querySelector('.mr-led')!;
    expect(led.classList.contains('is-pulse')).toBe(false);
  });

  test('does not animate via a CSS keyframe — no animation-name set inline', () => {
    setClock({ present: true, beat: 5 });
    const { container } = render(<BeatLed />);
    const led = container.querySelector('.mr-led') as HTMLElement;
    // Inline style should not declare an animation — the spec mandates the flash
    // is driven by the React-applied is-pulse class, not a CSS keyframe.
    expect(led.style.animationName).toBe('');
    expect(led.style.animation).toBe('');
  });

  test('present flipping from true to false clears is-pulse and removes data-state', () => {
    setClock({ present: true, beat: 5 });
    const { container, rerender } = render(<BeatLed />);
    let led = container.querySelector('.mr-led')!;
    expect(led.getAttribute('data-state')).toBe('beat');
    expect(led.classList.contains('is-pulse')).toBe(true);

    setClock({ present: false });
    rerender(<BeatLed />);
    led = container.querySelector('.mr-led')!;
    expect(led.getAttribute('data-state')).toBeNull();
    expect(led.classList.contains('is-pulse')).toBe(false);
  });
});
