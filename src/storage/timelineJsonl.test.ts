import { describe, expect, it } from 'vitest';
import {
  parseTimelineJsonl,
  serializeTimelineToJsonl,
  type SerializeJsonlInput,
} from './timelineJsonl';
import {
  PayloadShapeError,
  PayloadVersionError,
  STORAGE_SCHEMA_VERSION,
  emptyTransportAuthoring,
} from './timelinePayload';
import type { Channel, PianoRollTrack, ParamLane } from '../hooks/useChannels';
import type { DJActionTrack } from '../hooks/useDJActionTracks';

function makeInput(overrides: Partial<SerializeJsonlInput> = {}): SerializeJsonlInput {
  const channel: Channel = {
    id: 1,
    name: 'Lead',
    color: 'oklch(72% 0.14 240)',
    collapsed: false,
    muted: false,
    soloed: false,
    inputSources: [],
  };
  const roll: PianoRollTrack = {
    channelId: 1,
    notes: [
      { tTicks: 1920, durTicks: 480, pitch: 60, vel: 100 },
      { tTicks: 3840, durTicks: 240, pitch: 64, vel: 80 },
    ],
    muted: false,
    soloed: false,
    collapsed: false,
  };
  const lane: ParamLane = {
    channelId: 1,
    kind: 'cc',
    cc: 1,
    name: 'Mod Wheel',
    color: 'var(--mr-cc)',
    points: [
      { tTicks: 0, v: 0 },
      { tTicks: 1920, v: 0.5 },
    ],
    muted: false,
    soloed: false,
    collapsed: false,
  };
  const djTrack: DJActionTrack = {
    id: 'dj-deck1',
    name: 'Deck 1',
    color: '#abcdef',
    midiChannel: 1,
    actionMap: {},
    outputMap: {},
    events: [{ pitch: 48, tTicks: 1920, durTicks: 240, vel: 1.0 }],
    inputRouting: { channels: [] },
    outputRouting: { channels: [] },
    collapsed: false,
    muted: false,
    soloed: false,
    mutedRows: [],
    soloedRows: [],
    defaultMidiInputDeviceId: '',
    defaultMidiOutputDeviceId: '',
  };
  return {
    channels: [channel],
    rolls: [roll],
    lanes: [lane],
    djActionTracks: [djTrack],
    transport: emptyTransportAuthoring(),
    loopRegion: null,
    name: 'take1',
    ...overrides,
  };
}

describe('serializeTimelineToJsonl', () => {
  it('produces one JSON object per line, starting with a meta line', () => {
    const text = serializeTimelineToJsonl(makeInput());
    const lines = text.trim().split('\n');
    expect(lines.length).toBeGreaterThan(1);
    const first = JSON.parse(lines[0]!);
    expect(first.kind).toBe('meta');
    expect(first.version).toBe(STORAGE_SCHEMA_VERSION);
    expect(first.name).toBe('take1');
  });

  it('emits a transport, loop, channel, roll, lane, and dj.track line for the seeded input', () => {
    const text = serializeTimelineToJsonl(makeInput());
    const kinds = text
      .trim()
      .split('\n')
      .map((l) => (JSON.parse(l) as { kind: string }).kind);
    expect(kinds).toEqual([
      'meta',
      'transport',
      'loop',
      'channel',
      'roll',
      'lane',
      'dj.track',
    ]);
  });
});

describe('parseTimelineJsonl', () => {
  it('round-trips the seeded input back to slices', () => {
    const input = makeInput();
    const text = serializeTimelineToJsonl(input);
    const parsed = parseTimelineJsonl(text);
    expect(parsed.name).toBe('take1');
    expect(parsed.slices.channels.channels[0]?.name).toBe('Lead');
    expect(parsed.slices.channels.rolls[0]?.notes[0]?.tTicks).toBe(1920);
    expect(parsed.slices.channels.lanes[0]?.cc).toBe(1);
    expect(parsed.slices.djActionTracks[0]?.events[0]?.tTicks).toBe(1920);
    expect(parsed.slices.transportAuthoring.bpm).toBe(124);
    expect(parsed.slices.transportAuthoring.cuePointTicks).toBe(0);
    expect(parsed.slices.loopRegion).toBe(null);
  });

  it('round-trips a non-zero cuePointTicks on the transport line', () => {
    const input = makeInput({
      transport: { ...emptyTransportAuthoring(), cuePointTicks: 1920 },
    });
    const parsed = parseTimelineJsonl(serializeTimelineToJsonl(input));
    expect(parsed.slices.transportAuthoring.cuePointTicks).toBe(1920);
  });

  it('defaults cuePointTicks to 0 on a legacy transport line that lacks the field', () => {
    const text =
      `{"kind":"meta","version":${STORAGE_SCHEMA_VERSION},"appVersion":"x","name":"legacy","savedAt":0}\n` +
      `{"kind":"transport","slice":{"bpm":124,"sig":"4/4","quantizeOn":true,"quantizeGrid":"1/16","snapAbsoluteOn":false,"looping":false,"metronomeOn":true,"clockSource":"internal"}}\n`;
    const parsed = parseTimelineJsonl(text);
    expect(parsed.slices.transportAuthoring.cuePointTicks).toBe(0);
  });

  it('tolerates CRLF line endings and trailing blank lines', () => {
    const text = serializeTimelineToJsonl(makeInput()).replace(/\n/g, '\r\n') + '\r\n\r\n';
    const parsed = parseTimelineJsonl(text);
    expect(parsed.slices.channels.channels).toHaveLength(1);
  });

  it('throws PayloadVersionError when meta.version mismatches', () => {
    const text = '{"kind":"meta","version":999,"appVersion":"x","name":"old","savedAt":0}\n';
    expect(() => parseTimelineJsonl(text)).toThrow(PayloadVersionError);
  });

  it('throws PayloadShapeError when meta line is missing', () => {
    const text = '{"kind":"transport","slice":{}}\n';
    expect(() => parseTimelineJsonl(text)).toThrow(PayloadShapeError);
  });

  it('throws PayloadShapeError on invalid JSON on any line', () => {
    expect(() => parseTimelineJsonl('not-json\n')).toThrow(PayloadShapeError);
  });

  it('ignores unknown line kinds for forward compatibility', () => {
    const text =
      `{"kind":"meta","version":${STORAGE_SCHEMA_VERSION},"appVersion":"x","name":"n","savedAt":0}\n` +
      `{"kind":"some.future.line","data":{"x":1}}\n`;
    const parsed = parseTimelineJsonl(text);
    expect(parsed.name).toBe('n');
    expect(parsed.slices.channels.channels).toEqual([]);
  });
});
