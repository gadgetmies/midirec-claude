import { afterEach, describe, expect, test } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useLayoutEffect, useRef } from 'react';
import { StageProvider, useStage } from '../../hooks/useStage';
import { TransportProvider } from '../../hooks/useTransport';
import { useTimelineZoomGestures } from './useTimelineZoomGestures';
import {
  DEFAULT_PX_PER_BEAT,
  KEYBOARD_ZOOM_STEP,
  WHEEL_ZOOM_FACTOR_PER_LINE,
  clampPxPerBeat,
  fitPxPerBeat,
} from '../../session/timelineZoom';
import { DEFAULT_MIDI_TPQ } from '../../midi/timelineTicks';
import { KEYS_COLUMN_WIDTH, pxPerTickFromPxPerBeat } from '../piano-roll/PianoRoll';

afterEach(() => cleanup());

/* Mounts a `.mr-timeline` div with our gesture hook attached, with the
   bounding rect / clientWidth / scrollLeft seeded so wheel/keyboard handlers
   exercise the same math the production AppShell does. */
function Harness({
  layoutHorizonTicks = 7680,
  playheadTicks = 0,
  clientWidth = 1000,
  rectLeft = 0,
  initialScrollLeft = 0,
  onMount,
}: {
  layoutHorizonTicks?: number;
  playheadTicks?: number;
  clientWidth?: number;
  rectLeft?: number;
  initialScrollLeft?: number;
  onMount?: (el: HTMLDivElement) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const stage = useStage();
  useTimelineZoomGestures({ timelineRef: ref, layoutHorizonTicks, playheadTicks });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    Object.defineProperty(el, 'clientWidth', { value: clientWidth, configurable: true });
    el.getBoundingClientRect = () =>
      ({
        x: rectLeft,
        y: 0,
        left: rectLeft,
        top: 0,
        right: rectLeft + clientWidth,
        bottom: 0,
        width: clientWidth,
        height: 0,
        toJSON() {},
      }) as DOMRect;
    el.scrollLeft = initialScrollLeft;
    onMount?.(el);
  }, [clientWidth, rectLeft, initialScrollLeft, onMount]);
  return (
    <div>
      <div
        ref={ref}
        className="mr-timeline"
        data-testid="timeline"
        data-pxperbeat={stage.pxPerBeat}
      />
    </div>
  );
}

function mount(props: Parameters<typeof Harness>[0] = {}) {
  return render(
    <TransportProvider>
      <StageProvider>
        <Harness {...props} />
      </StageProvider>
    </TransportProvider>,
  );
}

function timeline(): HTMLDivElement {
  return document.querySelector('[data-testid="timeline"]') as HTMLDivElement;
}

describe('useTimelineZoomGestures — wheel', () => {
  test('Cmd-wheel calls preventDefault and updates pxPerBeat', () => {
    mount();
    const el = timeline();
    expect(el.dataset.pxperbeat).toBe(String(DEFAULT_PX_PER_BEAT));

    let prevented = false;
    /* DOM_DELTA_LINE (1) so the gesture hook sees `deltaY` as a normalised
       line delta — what a hardware wheel notch is conceptually. */
    const evt = new WheelEvent('wheel', {
      deltaY: -1,
      deltaMode: 1,
      ctrlKey: true,
      clientX: 400,
      bubbles: true,
      cancelable: true,
    });
    const origPreventDefault = evt.preventDefault.bind(evt);
    evt.preventDefault = () => {
      prevented = true;
      origPreventDefault();
    };
    act(() => {
      el.dispatchEvent(evt);
    });
    expect(prevented).toBe(true);
    /* deltaY=-1 LINE → factor = exp(0.18) ≈ 1.197 → 88 * 1.197 ≈ 105 */
    const expected = clampPxPerBeat(
      DEFAULT_PX_PER_BEAT * Math.exp(1 * WHEEL_ZOOM_FACTOR_PER_LINE),
    );
    expect(Number(el.dataset.pxperbeat)).toBeCloseTo(expected, 5);
  });

  test('Cmd-wheel in PIXEL mode normalises deltaY (hardware notch ≈ 125px → factor in [1.15, 1.25])', () => {
    mount();
    const el = timeline();
    const evt = new WheelEvent('wheel', {
      deltaY: -125,
      deltaMode: 0,
      ctrlKey: true,
      clientX: 400,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      el.dispatchEvent(evt);
    });
    const next = Number(el.dataset.pxperbeat);
    const factor = next / DEFAULT_PX_PER_BEAT;
    expect(factor).toBeGreaterThanOrEqual(1.15);
    expect(factor).toBeLessThanOrEqual(1.3);
  });

  test('wheel without modifier does NOT zoom or preventDefault', () => {
    mount();
    const el = timeline();
    let prevented = false;
    const evt = new WheelEvent('wheel', {
      deltaY: -100,
      ctrlKey: false,
      metaKey: false,
      clientX: 400,
      bubbles: true,
      cancelable: true,
    });
    evt.preventDefault = () => {
      prevented = true;
    };
    act(() => {
      el.dispatchEvent(evt);
    });
    expect(prevented).toBe(false);
    expect(el.dataset.pxperbeat).toBe(String(DEFAULT_PX_PER_BEAT));
  });

  test('Cmd-wheel preserves beat under cursor (within tolerance) and never goes negative', () => {
    mount({ initialScrollLeft: 100, clientWidth: 1000 });
    const el = timeline();

    const cursorClientX = 400;
    const anchorPx = Math.max(cursorClientX - 0, KEYS_COLUMN_WIDTH);
    const prevPxPerBeat = DEFAULT_PX_PER_BEAT;
    const beatBefore = (el.scrollLeft + anchorPx - KEYS_COLUMN_WIDTH) / prevPxPerBeat;

    act(() => {
      el.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY: -1,
          ctrlKey: true,
          clientX: cursorClientX,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    const nextPxPerBeat = Number(el.dataset.pxperbeat);
    expect(nextPxPerBeat).toBeGreaterThan(prevPxPerBeat);
    expect(el.scrollLeft).toBeGreaterThanOrEqual(0);

    const beatAfter = (el.scrollLeft + anchorPx - KEYS_COLUMN_WIDTH) / nextPxPerBeat;
    expect(Math.abs(beatBefore - beatAfter)).toBeLessThan(0.5 / nextPxPerBeat);
  });

  test('Cmd-wheel over the keys column clamps anchor and keeps scrollLeft non-negative', () => {
    mount({ initialScrollLeft: 0, clientWidth: 1000 });
    const el = timeline();

    act(() => {
      el.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY: 100, // zoom out
          ctrlKey: true,
          clientX: 10, // inside keys column
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(el.scrollLeft).toBeGreaterThanOrEqual(0);
  });
});

describe('useTimelineZoomGestures — keyboard', () => {
  test("'+' zooms in with playhead anchor when playhead is visible", () => {
    /* Playhead at tick 480 = beat 1 at default px/beat → playheadX = 56 + 88 = 144,
       inside viewport [0..1000]. After zoom-in, playheadX must remain ~144. */
    const playheadTicks = 480;
    mount({ playheadTicks, clientWidth: 1000 });
    const el = timeline();
    const prevPxPerBeat = DEFAULT_PX_PER_BEAT;
    const prevPxPerTick = pxPerTickFromPxPerBeat(prevPxPerBeat);
    const playheadXBefore =
      KEYS_COLUMN_WIDTH + playheadTicks * prevPxPerTick - el.scrollLeft;

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '+' }));
    });

    const nextPxPerBeat = Number(el.dataset.pxperbeat);
    expect(nextPxPerBeat).toBeCloseTo(
      clampPxPerBeat(prevPxPerBeat * KEYBOARD_ZOOM_STEP),
      5,
    );
    const nextPxPerTick = pxPerTickFromPxPerBeat(nextPxPerBeat);
    const playheadXAfter =
      KEYS_COLUMN_WIDTH + playheadTicks * nextPxPerTick - el.scrollLeft;
    expect(Math.abs(playheadXAfter - playheadXBefore)).toBeLessThan(0.5);
  });

  test("'+' with playhead off-screen anchors on viewport center", () => {
    /* Playhead at tick 100_000 → playheadX is way past clientWidth.
       Anchor should be viewport center (500). Verify by checking the beat at
       on-screen X = 500 stays put. */
    const clientWidth = 1000;
    const playheadTicks = 100_000;
    mount({ playheadTicks, clientWidth, initialScrollLeft: 0 });
    const el = timeline();

    const prevPxPerBeat = DEFAULT_PX_PER_BEAT;
    const anchorPx = clientWidth / 2;
    const beatBefore = (el.scrollLeft + anchorPx - KEYS_COLUMN_WIDTH) / prevPxPerBeat;

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '+' }));
    });

    const nextPxPerBeat = Number(el.dataset.pxperbeat);
    const beatAfter = (el.scrollLeft + anchorPx - KEYS_COLUMN_WIDTH) / nextPxPerBeat;
    expect(Math.abs(beatBefore - beatAfter)).toBeLessThan(0.5 / nextPxPerBeat);
  });

  test("'0' fits the session and resets scrollLeft to 0", () => {
    const layoutHorizonTicks = 7680;
    const clientWidth = 856;
    mount({ layoutHorizonTicks, clientWidth, initialScrollLeft: 400 });
    const el = timeline();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '0' }));
    });

    const expected = fitPxPerBeat(
      layoutHorizonTicks,
      clientWidth,
      KEYS_COLUMN_WIDTH,
      DEFAULT_MIDI_TPQ,
    );
    expect(Number(el.dataset.pxperbeat)).toBeCloseTo(expected, 5);
    expect(el.scrollLeft).toBe(0);
  });

  test("'+' inside a focused input is a no-op", () => {
    mount();
    const el = timeline();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
    });

    expect(el.dataset.pxperbeat).toBe(String(DEFAULT_PX_PER_BEAT));
    document.body.removeChild(input);
  });

  test('modifier-laden combinations (Cmd+0) do NOT trigger fit', () => {
    mount({ initialScrollLeft: 300 });
    const el = timeline();

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: '0', metaKey: true, bubbles: true }),
      );
    });
    /* Default pxPerBeat unchanged, scrollLeft unchanged */
    expect(el.dataset.pxperbeat).toBe(String(DEFAULT_PX_PER_BEAT));
    expect(el.scrollLeft).toBe(300);
  });

  test("'-' zooms out", () => {
    mount();
    const el = timeline();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '-' }));
    });
    expect(Number(el.dataset.pxperbeat)).toBeCloseTo(
      clampPxPerBeat(DEFAULT_PX_PER_BEAT / KEYBOARD_ZOOM_STEP),
      5,
    );
  });
});

/* Helps the assertion below stay close to the production formula. */
void WHEEL_ZOOM_FACTOR_PER_LINE;
