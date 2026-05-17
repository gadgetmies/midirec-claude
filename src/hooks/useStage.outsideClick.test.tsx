import { describe, expect, test, afterEach } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { StageProvider, useStage } from './useStage';
import { TransportProvider } from './useTransport';

afterEach(() => cleanup());

const CHROME_REGIONS = [
  'mr-titlebar',
  'mr-toolstrip',
  'mr-sidebar',
  'mr-inspector',
  'mr-statusbar',
] as const;

type SelectionKind = 'timeline' | 'dj';

interface ProbeHandle {
  current: ReturnType<typeof useStage> | null;
}

function Probe({ handle }: { handle: ProbeHandle }) {
  const stage = useStage();
  const ref = useRef(stage);
  ref.current = stage;
  useEffect(() => {
    handle.current = stage;
  });
  handle.current = stage;
  return null;
}

function Harness({ handle, withTimeline }: { handle: ProbeHandle; withTimeline?: boolean }) {
  return (
    <TransportProvider>
      <StageProvider>
        <div className="mr-titlebar"><span data-target="mr-titlebar" /></div>
        <div className="mr-toolstrip"><span data-target="mr-toolstrip" /></div>
        <div className="mr-sidebar"><span data-target="mr-sidebar" /></div>
        <div className="mr-inspector"><span data-target="mr-inspector" /></div>
        <div className="mr-statusbar"><span data-target="mr-statusbar" /></div>
        {withTimeline ? (
          <div className="mr-timeline">
            <div className="mr-ruler" data-target="mr-ruler" />
            <div data-mr-dj-selection-region="true">
              <span data-target="dj-region" />
            </div>
          </div>
        ) : null}
        <Probe handle={handle} />
      </StageProvider>
    </TransportProvider>
  );
}

function dispatchPointerDown(target: Element) {
  const ev = new Event('pointerdown', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'target', { value: target, configurable: true });
  act(() => {
    window.dispatchEvent(ev);
  });
}

function seedSelection(handle: ProbeHandle, kind: SelectionKind) {
  const stage = handle.current!;
  act(() => {
    if (kind === 'timeline') {
      stage.setSelectedTimelineTrack({ kind: 'channel', channelId: 1 });
    } else {
      stage.setDJActionSelection({ trackId: 'dj1', pitch: 56 });
      stage.setDJEventSelection({ trackId: 'dj1', pitch: 56, eventIdx: 0 });
    }
  });
}

describe('useStage outside-click — chrome regions preserve selection', () => {
  test.each(CHROME_REGIONS)(
    'pointerdown inside .%s does not clear selectedTimelineTrack',
    (cls) => {
      const handle: ProbeHandle = { current: null };
      render(<Harness handle={handle} />);
      seedSelection(handle, 'timeline');
      expect(handle.current?.selectedTimelineTrack).not.toBeNull();

      const target = document.querySelector(`[data-target="${cls}"]`) as Element;
      dispatchPointerDown(target);

      expect(handle.current?.selectedTimelineTrack).not.toBeNull();
    },
  );

  test.each(CHROME_REGIONS)(
    'pointerdown inside .%s does not clear DJ action/event selection',
    (cls) => {
      const handle: ProbeHandle = { current: null };
      render(<Harness handle={handle} />);
      seedSelection(handle, 'dj');
      expect(handle.current?.djActionSelection).not.toBeNull();
      expect(handle.current?.djEventSelection).not.toBeNull();

      const target = document.querySelector(`[data-target="${cls}"]`) as Element;
      dispatchPointerDown(target);

      expect(handle.current?.djActionSelection).not.toBeNull();
      expect(handle.current?.djEventSelection).not.toBeNull();
    },
  );
});

describe('useStage outside-click — intentional clear paths still work', () => {
  test('pointerdown on empty timeline area clears selectedTimelineTrack', () => {
    const handle: ProbeHandle = { current: null };
    render(<Harness handle={handle} withTimeline />);
    seedSelection(handle, 'timeline');
    expect(handle.current?.selectedTimelineTrack).not.toBeNull();

    const target = document.querySelector('[data-target="mr-ruler"]') as Element;
    dispatchPointerDown(target);

    expect(handle.current?.selectedTimelineTrack).toBeNull();
  });

  test('[data-mr-dj-selection-region] inside timeline still preserves DJ selection', () => {
    const handle: ProbeHandle = { current: null };
    render(<Harness handle={handle} withTimeline />);
    seedSelection(handle, 'dj');
    expect(handle.current?.djActionSelection).not.toBeNull();

    const target = document.querySelector('[data-target="dj-region"]') as Element;
    dispatchPointerDown(target);

    expect(handle.current?.djActionSelection).not.toBeNull();
    expect(handle.current?.djEventSelection).not.toBeNull();
  });
});
