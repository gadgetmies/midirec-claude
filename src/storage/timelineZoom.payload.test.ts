import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  STORAGE_SCHEMA_VERSION,
  deserializeTimeline,
  emptyTransportAuthoring,
  serializeTimeline,
  type SerializeInput,
  type TimelinePayload,
} from './timelinePayload';
import {
  parseTimelineJsonl,
  serializeTimelineToJsonl,
} from './timelineJsonl';
import { DEFAULT_PX_PER_BEAT, MAX_PX_PER_BEAT } from '../session/timelineZoom';

function makeInput(pxPerBeat?: number): SerializeInput {
  return {
    channels: [],
    rolls: [],
    lanes: [],
    djActionTracks: [],
    transport: emptyTransportAuthoring(),
    loopRegion: null,
    pxPerBeat,
  };
}

afterEach(() => vi.restoreAllMocks());

describe('timelinePayload — pxPerBeat round-trip', () => {
  test('serializeTimeline emits the live pxPerBeat', () => {
    const payload = serializeTimeline(makeInput(250), 'demo');
    expect(payload.session.pxPerBeat).toBe(250);
  });

  test('serializeTimeline defaults pxPerBeat when omitted', () => {
    const payload = serializeTimeline(makeInput(), 'demo');
    expect(payload.session.pxPerBeat).toBe(DEFAULT_PX_PER_BEAT);
  });

  test('round-trip preserves an in-range pxPerBeat', () => {
    const payload = serializeTimeline(makeInput(250), 'rt');
    const slices = deserializeTimeline(JSON.parse(JSON.stringify(payload)));
    expect(slices.view.pxPerBeat).toBe(250);
  });

  test('legacy payload without pxPerBeat hydrates to empty view slice (no warn)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const payload = serializeTimeline(makeInput(), 'legacy');
    const decoded = JSON.parse(JSON.stringify(payload)) as TimelinePayload;
    delete (decoded.session as { pxPerBeat?: number }).pxPerBeat;
    const slices = deserializeTimeline(decoded);
    expect(slices.view).toEqual({});
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('non-finite pxPerBeat falls back to default with a console warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const payload = serializeTimeline(makeInput(), 'bad');
    const decoded = JSON.parse(JSON.stringify(payload)) as TimelinePayload;
    /* JSON drops NaN to null, so write the field after parse to simulate
       a corrupted in-memory payload. */
    (decoded.session as { pxPerBeat?: number }).pxPerBeat = Number.NaN;
    const slices = deserializeTimeline(decoded);
    expect(slices.view.pxPerBeat).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    const msg = warnSpy.mock.calls[0]![0];
    expect(String(msg)).toMatch(/pxPerBeat/);
  });

  test('out-of-range pxPerBeat clamps on hydrate', () => {
    const payload = serializeTimeline(makeInput(5000), 'big');
    const slices = deserializeTimeline(JSON.parse(JSON.stringify(payload)));
    expect(slices.view.pxPerBeat).toBe(MAX_PX_PER_BEAT);
  });

  test('STORAGE_SCHEMA_VERSION is unchanged at 1', () => {
    expect(STORAGE_SCHEMA_VERSION).toBe(1);
  });
});

describe('timelineJsonl — pxPerBeat view line', () => {
  test('emits exactly one view line per serialisation', () => {
    const text = serializeTimelineToJsonl({ ...makeInput(176), name: 'demo' });
    const viewLines = text
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l) as { kind: string; pxPerBeat?: number })
      .filter((l) => l.kind === 'view');
    expect(viewLines).toHaveLength(1);
    expect(viewLines[0]!.pxPerBeat).toBe(176);
  });

  test('parseTimelineJsonl round-trips pxPerBeat', () => {
    const text = serializeTimelineToJsonl({ ...makeInput(176), name: 'demo' });
    const parsed = parseTimelineJsonl(text);
    expect(parsed.slices.view.pxPerBeat).toBe(176);
  });

  test('missing view line parses without error and yields empty view slice', () => {
    const text = serializeTimelineToJsonl({ ...makeInput(176), name: 'demo' });
    const without = text
      .trim()
      .split('\n')
      .filter((l) => !l.includes('"kind":"view"'))
      .join('\n');
    const parsed = parseTimelineJsonl(without + '\n');
    expect(parsed.slices.view).toEqual({});
  });

  test('malformed view line is rejected by parse', () => {
    const text = serializeTimelineToJsonl({ ...makeInput(176), name: 'demo' });
    const rewritten = text
      .trim()
      .split('\n')
      .map((l) =>
        l.includes('"kind":"view"')
          ? JSON.stringify({ kind: 'view', pxPerBeat: 'oops' })
          : l,
      )
      .join('\n');
    expect(() => parseTimelineJsonl(rewritten + '\n')).toThrow(/pxPerBeat/);
  });
});
