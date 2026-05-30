import { describe, expect, it } from 'vitest';
import {
  STORAGE_SCHEMA_VERSION,
  PayloadVersionError,
  PayloadShapeError,
  deserializeTimeline,
  emptySessionPayload,
  emptyTransportAuthoring,
  serializeTimeline,
  type SerializeInput,
  type TimelinePayload,
} from './timelinePayload';
import type { Channel, PianoRollTrack, ParamLane } from '../hooks/useChannels';
import type { DJActionTrack } from '../hooks/useDJActionTracks';

function makeInput(overrides: Partial<SerializeInput> = {}): SerializeInput {
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
    events: [
      { pitch: 48, tTicks: 1920, durTicks: 240, vel: 1.0 },
    ],
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
    ...overrides,
  };
}

describe('serializeTimeline', () => {
  it('tags the payload with the current schema version and trimmed name', () => {
    const payload = serializeTimeline(makeInput(), '  take1  ');
    expect(payload.version).toBe(STORAGE_SCHEMA_VERSION);
    expect(payload.name).toBe('take1');
    expect(typeof payload.appVersion).toBe('string');
    expect(payload.appVersion.length).toBeGreaterThan(0);
    expect(typeof payload.savedAt).toBe('number');
  });

  it('only includes the persistable session surface (no transient state)', () => {
    const payload = serializeTimeline(makeInput(), 'x');
    const sessionKeys = Object.keys(payload.session).sort();
    expect(sessionKeys).toEqual(
      ['channels', 'djActionTracks', 'lanes', 'loopRegion', 'rolls', 'transportAuthoring'].sort(),
    );
    expect(payload.session).not.toHaveProperty('mode');
    expect(payload.session).not.toHaveProperty('playing');
    expect(payload.session).not.toHaveProperty('recording');
    expect(payload.session).not.toHaveProperty('timecodeMs');
    expect(payload.session).not.toHaveProperty('marquee');
    expect(payload.session).not.toHaveProperty('selectedIdx');
    expect(payload.session).not.toHaveProperty('selectedChannelId');
    expect(payload.session).not.toHaveProperty('dialogOpen');
    expect(payload.session).not.toHaveProperty('djActionSelection');
    expect(payload.session).not.toHaveProperty('djEventSelection');
    expect(payload.session).not.toHaveProperty('sessionHorizonFloorBeats');
    expect(payload.session).not.toHaveProperty('layoutHorizonBeats');
  });

  it('includes only the documented transport-authoring subset', () => {
    const payload = serializeTimeline(makeInput(), 'x');
    expect(Object.keys(payload.session.transportAuthoring).sort()).toEqual(
      [
        'bpm',
        'sig',
        'quantizeOn',
        'quantizeGrid',
        'snapAbsoluteOn',
        'looping',
        'metronomeOn',
        'clockSource',
      ].sort(),
    );
  });
});

describe('serialize / deserialize round trip', () => {
  it('preserves integer tick values exactly', () => {
    const input = makeInput();
    const payload = serializeTimeline(input, 'rt');
    const json = JSON.stringify(payload);
    const decoded = JSON.parse(json) as TimelinePayload;
    const slices = deserializeTimeline(decoded);

    const note = slices.channels.rolls[0]!.notes[0]!;
    expect(note.tTicks).toBe(1920);
    expect(note.durTicks).toBe(480);
    expect(Number.isInteger(note.tTicks)).toBe(true);

    const ev = slices.djActionTracks[0]!.events[0]!;
    expect(ev.tTicks).toBe(1920);
    expect(ev.durTicks).toBe(240);

    const point = slices.channels.lanes[0]!.points[1]!;
    expect(point.tTicks).toBe(1920);
  });

  it('round-trips transport-authoring and loop region', () => {
    const input = makeInput({
      transport: {
        bpm: 140,
        sig: '7/8',
        quantizeOn: false,
        quantizeGrid: '1/8',
        snapAbsoluteOn: true,
        looping: true,
        metronomeOn: false,
        clockSource: 'external-clock',
      },
      loopRegion: { start: 1.5, end: 4.0 },
    });
    const payload = serializeTimeline(input, 'rt');
    const slices = deserializeTimeline(JSON.parse(JSON.stringify(payload)));

    expect(slices.transportAuthoring).toEqual({
      bpm: 140,
      sig: '7/8',
      quantizeOn: false,
      quantizeGrid: '1/8',
      snapAbsoluteOn: true,
      looping: true,
      metronomeOn: false,
      clockSource: 'external-clock',
    });
    expect(slices.loopRegion).toEqual({ start: 1.5, end: 4.0 });
  });
});

describe('deserializeTimeline rejection paths', () => {
  it('throws PayloadVersionError when version mismatches', () => {
    const payload = serializeTimeline(makeInput(), 'old');
    const bumped = { ...payload, version: 999 };
    expect(() => deserializeTimeline(bumped)).toThrow(PayloadVersionError);
  });

  it('throws PayloadShapeError when the payload is malformed', () => {
    expect(() => deserializeTimeline(null)).toThrow(PayloadShapeError);
    expect(() => deserializeTimeline({})).toThrow(PayloadShapeError);
    const payload = serializeTimeline(makeInput(), 'x');
    const broken = { ...payload, session: { ...payload.session, channels: 'not-an-array' } };
    expect(() => deserializeTimeline(broken)).toThrow(PayloadShapeError);
  });
});

describe('empty defaults', () => {
  it('emptySessionPayload returns no channels and no DJ tracks', () => {
    const empty = emptySessionPayload();
    expect(empty.channels).toEqual([]);
    expect(empty.rolls).toEqual([]);
    expect(empty.lanes).toEqual([]);
    expect(empty.djActionTracks).toEqual([]);
    expect(empty.loopRegion).toBe(null);
    expect(empty.transportAuthoring.bpm).toBe(124);
    expect(empty.transportAuthoring.sig).toBe('4/4');
    expect(empty.transportAuthoring.clockSource).toBe('internal');
  });
});
