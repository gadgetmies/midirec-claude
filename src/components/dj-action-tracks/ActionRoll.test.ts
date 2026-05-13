import { describe, expect, test, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DEFAULT_ACTION_MAP,
  normalizeOutputMapping,
} from '../../data/dj';
import type { DJActionTrack } from '../../hooks/useDJActionTracks';
import { ActionRoll } from './ActionRoll';

const stageMock = vi.hoisted(() => ({
  djEventSelection: null as {
    trackId: string;
    pitch: number;
    eventIdx: number;
  } | null,
  djActionSelection: null as { trackId: string; pitch: number } | null,
  setDJEventSelection: vi.fn(),
  setDJActionSelection: vi.fn(),
  pressureRenderMode: 'curve' as const,
}));

vi.mock('../../hooks/useStage', () => ({
  useStage: () => stageMock,
}));

function miniTrack(over: Partial<DJActionTrack> = {}): DJActionTrack {
  return {
    id: 'dj1',
    name: 'DJ',
    color: '#fff',
    midiChannel: 16,
    actionMap: { 80: DEFAULT_ACTION_MAP[80]! },
    outputMap: {
      80: normalizeOutputMapping({ device: 'mixer', channel: 16, pitch: 80, cc: 16 }),
    },
    events: [{ pitch: 80, t: 0, dur: 2, vel: 0.75 }],
    inputRouting: { channels: [] },
    outputRouting: { channels: [] },
    collapsed: false,
    muted: false,
    soloed: false,
    mutedRows: [],
    soloedRows: [],
    defaultMidiInputDeviceId: '',
    ...over,
  };
}

describe('ActionRoll', () => {
  test('CC-output row renders mr-djtrack__cc, not velocity note class', () => {
    const html = renderToStaticMarkup(
      ActionRoll({
        track: miniTrack(),
        soloing: false,
        layoutHorizonBeats: 16,
        pxPerBeat: 88,
        rowHeight: 24,
        playheadT: 0,
      }),
    );
    expect(html).toContain('mr-djtrack__cc');
    expect(html).not.toContain('mr-djtrack__note--velocity');
  });

  test('deck trigger row still renders mr-djtrack__note--trigger', () => {
    const html = renderToStaticMarkup(
      ActionRoll({
        track: miniTrack({
          actionMap: { 48: DEFAULT_ACTION_MAP[48]! },
          outputMap: {},
          events: [{ pitch: 48, t: 0, dur: 0.1, vel: 1 }],
        }),
        soloing: false,
        layoutHorizonBeats: 16,
        pxPerBeat: 88,
        rowHeight: 24,
        playheadT: 0,
      }),
    );
    expect(html).toContain('mr-djtrack__note--trigger');
    expect(html).not.toContain('mr-djtrack__cc');
  });

  test('pad row without CC output still uses velocity-sensitive note', () => {
    const html = renderToStaticMarkup(
      ActionRoll({
        track: miniTrack({
          actionMap: { 57: DEFAULT_ACTION_MAP[57]! },
          outputMap: {},
          events: [{ pitch: 57, t: 0, dur: 1, vel: 0.5 }],
        }),
        soloing: false,
        layoutHorizonBeats: 16,
        pxPerBeat: 88,
        rowHeight: 24,
        playheadT: 0,
      }),
    );
    expect(html).toContain('mr-djtrack__note--velocity');
    expect(html).not.toContain('mr-djtrack__cc');
  });

  test('merges CC events on the same pitch when starts are under 1 beat apart', () => {
    const html = renderToStaticMarkup(
      ActionRoll({
        track: miniTrack({
          /* Out-of-order indices: chronologically first is events[1] at t=0.2 */
          events: [
            { pitch: 80, t: 1.2, dur: 0.1, vel: 0.5 },
            { pitch: 80, t: 0.2, dur: 0.1, vel: 0.9 },
            { pitch: 80, t: 0.6, dur: 0.1, vel: 0.7 },
          ],
        }),
        soloing: false,
        layoutHorizonBeats: 16,
        pxPerBeat: 88,
        rowHeight: 24,
        playheadT: 0,
      }),
    );
    expect(html.match(/class="mr-djtrack__cc"/g)?.length).toBe(1);
  });

  test('keeps separate CC bars when starts are 1 beat apart or more', () => {
    const html = renderToStaticMarkup(
      ActionRoll({
        track: miniTrack({
          events: [
            { pitch: 80, t: 0, dur: 0.1, vel: 0.5 },
            { pitch: 80, t: 1, dur: 0.1, vel: 0.6 },
          ],
        }),
        soloing: false,
        layoutHorizonBeats: 16,
        pxPerBeat: 88,
        rowHeight: 24,
        playheadT: 0,
      }),
    );
    expect(html.match(/class="mr-djtrack__cc"/g)?.length).toBe(2);
  });

  test('CC group uses one rect per message, merging colliding pixel columns', () => {
    const html = renderToStaticMarkup(
      ActionRoll({
        track: miniTrack({
          events: [
            { pitch: 80, t: 0, dur: 0.05, vel: 0.3 },
            { pitch: 80, t: 0.001, dur: 0.05, vel: 0.9 },
            { pitch: 80, t: 0.5, dur: 0.05, vel: 0.5 },
          ],
        }),
        soloing: false,
        layoutHorizonBeats: 16,
        pxPerBeat: 88,
        rowHeight: 24,
        playheadT: 0,
      }),
    );
    expect(html.match(/<rect/g)?.length).toBe(2);
  });
});
