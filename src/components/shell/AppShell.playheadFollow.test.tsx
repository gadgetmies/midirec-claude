import { describe, expect, test, afterEach } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useLayoutEffect, useRef } from 'react';
import { followPlayheadScrollLeft } from '../../session/layoutHorizon';

/**
 * Standalone re-implementation of the follow effect from `AppShell.tsx`.
 *
 * The full `<AppShell />` pulls in MIDI runtime, toast, stage, and DOM
 * measurement code that is impractical to mount in JSDOM. This harness
 * exercises the same `followPlayheadScrollLeft` + `useLayoutEffect` shape
 * AppShell uses, against a real `.mr-timeline` DOM node, so any regression
 * in the rule's runtime behavior is caught.
 */
function FollowProbe({
  mode,
  playheadTicks,
  pxPerTick,
  keysColumnWidth,
  initialScrollLeft,
  clientWidth,
}: {
  mode: 'idle' | 'play' | 'record';
  playheadTicks: number;
  pxPerTick: number;
  keysColumnWidth: number;
  initialScrollLeft: number;
  clientWidth: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const seededRef = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!seededRef.current) {
      Object.defineProperty(el, 'clientWidth', { value: clientWidth, configurable: true });
      el.scrollLeft = initialScrollLeft;
      seededRef.current = true;
    }
  }, [clientWidth, initialScrollLeft]);

  useLayoutEffect(() => {
    if (mode !== 'play' && mode !== 'record') return;
    const el = ref.current;
    if (!el) return;
    const next = followPlayheadScrollLeft(
      playheadTicks,
      pxPerTick,
      keysColumnWidth,
      el.scrollLeft,
      el.clientWidth,
    );
    if (next !== null) {
      el.scrollLeft = next;
    }
  }, [mode, playheadTicks, pxPerTick, keysColumnWidth]);

  return <div ref={ref} className="mr-timeline" data-testid="timeline" />;
}

function getTimeline(): HTMLDivElement {
  return document.querySelector('[data-testid="timeline"]') as HTMLDivElement;
}

afterEach(() => cleanup());

const KEYS = 56;

describe('AppShell playhead-follow effect', () => {
  test('mode=play advances scrollLeft when playhead crosses the half-viewport mark', () => {
    // pxPerTick=4, clientWidth=1000, KEYS=56 → playheadPx = 56 + 200*4 = 856
    // halfMark = 0 + 500 = 500 → 856 > 500 → scrollLeft target = 856 - 500 = 356
    const { rerender } = render(
      <FollowProbe
        mode="play"
        playheadTicks={100}
        pxPerTick={4}
        keysColumnWidth={KEYS}
        initialScrollLeft={0}
        clientWidth={1000}
      />,
    );
    // playheadTicks=100 → playheadPx = 456 ≤ 500 → no write; scrollLeft stays 0
    expect(getTimeline().scrollLeft).toBe(0);

    act(() => {
      rerender(
        <FollowProbe
          mode="play"
          playheadTicks={200}
          pxPerTick={4}
          keysColumnWidth={KEYS}
          initialScrollLeft={0}
          clientWidth={1000}
        />,
      );
    });
    expect(getTimeline().scrollLeft).toBe(356);
  });

  test('mode=record triggers the same auto-scroll as mode=play', () => {
    const { rerender } = render(
      <FollowProbe
        mode="record"
        playheadTicks={100}
        pxPerTick={4}
        keysColumnWidth={KEYS}
        initialScrollLeft={0}
        clientWidth={1000}
      />,
    );
    expect(getTimeline().scrollLeft).toBe(0);

    act(() => {
      rerender(
        <FollowProbe
          mode="record"
          playheadTicks={200}
          pxPerTick={4}
          keysColumnWidth={KEYS}
          initialScrollLeft={0}
          clientWidth={1000}
        />,
      );
    });
    expect(getTimeline().scrollLeft).toBe(356);
  });

  test('mode=idle does NOT trigger any scrollLeft write even as playheadTicks changes', () => {
    const { rerender } = render(
      <FollowProbe
        mode="idle"
        playheadTicks={100}
        pxPerTick={4}
        keysColumnWidth={KEYS}
        initialScrollLeft={0}
        clientWidth={1000}
      />,
    );
    expect(getTimeline().scrollLeft).toBe(0);

    act(() => {
      rerender(
        <FollowProbe
          mode="idle"
          playheadTicks={500}
          pxPerTick={4}
          keysColumnWidth={KEYS}
          initialScrollLeft={0}
          clientWidth={1000}
        />,
      );
    });
    // playheadPx = 56 + 500*4 = 2056, well past any half-mark, but idle → no write
    expect(getTimeline().scrollLeft).toBe(0);

    act(() => {
      rerender(
        <FollowProbe
          mode="idle"
          playheadTicks={1000}
          pxPerTick={4}
          keysColumnWidth={KEYS}
          initialScrollLeft={0}
          clientWidth={1000}
        />,
      );
    });
    expect(getTimeline().scrollLeft).toBe(0);
  });

  test('playhead to the left of the visible viewport does NOT pull viewport back', () => {
    // Start scrolled far right; playhead far left.
    // scrollLeft=2000, clientWidth=1000, halfMark=2500
    // playheadTicks=50, pxPerTick=4 → playheadPx = 56 + 200 = 256 (well left of viewport)
    // 256 ≤ 2500 → null → no write; scrollLeft stays at 2000
    render(
      <FollowProbe
        mode="play"
        playheadTicks={50}
        pxPerTick={4}
        keysColumnWidth={KEYS}
        initialScrollLeft={2000}
        clientWidth={1000}
      />,
    );
    expect(getTimeline().scrollLeft).toBe(2000);
  });
});
