import { afterEach, describe, expect, test } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { StageProvider, useStage, type StageState } from './useStage';
import { TransportProvider } from './useTransport';

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

describe('useStage.hydrateLoopRegion', () => {
  test('writes the loop region slice', () => {
    const s = harness();
    expect(s.current!.loopRegion).toBe(null);

    act(() => {
      s.current!.hydrateLoopRegion({ start: 2.0, end: 6.0 });
    });

    expect(s.current!.loopRegion).toEqual({ start: 2.0, end: 6.0 });

    act(() => {
      s.current!.hydrateLoopRegion(null);
    });

    expect(s.current!.loopRegion).toBe(null);
  });

  test('resets transient stage flags on hydrate', () => {
    const s = harness();

    act(() => {
      s.current!.openExportDialog();
      s.current!.setSelectedTimelineTrack({ kind: 'channel', channelId: 1 });
      s.current!.setDJActionSelection({ trackId: 'dj-deck1', pitch: 48 });
    });
    expect(s.current!.dialogOpen).toBe(true);
    expect(s.current!.djActionSelection).not.toBe(null);
    expect(s.current!.selectedTimelineTrack).not.toBe(null);

    act(() => {
      s.current!.hydrateLoopRegion(null);
    });

    expect(s.current!.dialogOpen).toBe(false);
    expect(s.current!.djActionSelection).toBe(null);
    expect(s.current!.djEventSelection).toBe(null);
    expect(s.current!.selectedTimelineTrack).toBe(null);
  });
});
