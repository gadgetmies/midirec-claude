import { describe, expect, it } from 'vitest';
import type { Channel, PianoRollTrack } from '../hooks/useChannels';
import type { ActionEvent } from '../data/dj';
import { normalizeOutputMapping } from '../data/dj';
import type { DJActionTrack } from '../hooks/useDJActionTracks';
import {
  buildExportRows,
  channelExportKey,
  collectDjExportJsonLines,
  computeResolvedExportRange,
  countExportTallyEvents,
  djExportKey,
} from './exportDialogModel';
import { DEFAULT_MIDI_TPQ, beatsToMidiTicks } from '../midi/timelineTicks';

function djFixture(override: Partial<DJActionTrack> & Pick<DJActionTrack, 'id' | 'events'>): DJActionTrack {
  return {
    name: '',
    color: '',
    midiChannel: 16,
    actionMap: {},
    outputMap: {},
    inputRouting: { channels: [] },
    outputRouting: { channels: [] },
    collapsed: false,
    muted: false,
    soloed: false,
    mutedRows: [],
    soloedRows: [],
    defaultMidiInputDeviceId: '',
    defaultMidiOutputDeviceId: '',
    ...override,
  };
}

function channelStub(id: 1 | 2, name: string): Channel {
  return {
    id,
    name,
    color: '#000',
    collapsed: false,
    muted: false,
    soloed: false,
    inputSources: [],
  };
}

describe('buildExportRows', () => {
  it('lists all instrument channels when there are no DJ tracks', () => {
    const rolls: PianoRollTrack[] = [];
    const rows = buildExportRows([channelStub(1, 'Lead'), channelStub(2, 'Bass')], rolls, [], []);
    expect(rows.map((r) => r.key)).toEqual([channelExportKey(1), channelExportKey(2)]);
  });

  it('drops empty instrument scaffolding when DJ tracks exist', () => {
    const rolls: PianoRollTrack[] = [
      { channelId: 1, notes: [], muted: false, soloed: false, collapsed: false },
      { channelId: 2, notes: [], muted: false, soloed: false, collapsed: false },
    ];
    const dj = djFixture({
      id: 'dj1',
      name: 'DJ Demo',
      color: '#fff',
      midiChannel: 16,
      actionMap: {
        48: { id: 'play', cat: 'deck', label: '', short: '', device: 'deck1' },
      },
      events: [{ pitch: 48, t: 0, dur: 1, vel: 0.5 }],
    });
    const rows = buildExportRows([channelStub(1, 'Lead'), channelStub(2, 'Bass')], rolls, [], [
      dj,
    ]);
    expect(rows.map((r) => r.key)).toEqual([djExportKey('dj1')]);
  });

  it('places instruments ascending by channel id before DJ tracks when both exist', () => {
    const roll: PianoRollTrack = {
      channelId: 1,
      notes: [{ t: 0, dur: 1, pitch: 60, vel: 1 }],
      muted: false,
      soloed: false,
      collapsed: false,
    };
    const dj = djFixture({ id: 'd1', events: [] });
    const rows = buildExportRows([channelStub(1, 'Lead')], [roll], [], [dj]);
    expect(rows.map((r) => r.key)).toEqual([channelExportKey(1), djExportKey('d1')]);
  });
});

describe('computeResolvedExportRange', () => {
  it('extends whole-session hi with DJ events', () => {
    const ev: ActionEvent = { pitch: 48, t: 0, dur: 20, vel: 0.5 };
    const dj = [
      {
        events: [ev],
      },
    ];
    const range = computeResolvedExportRange('whole', [], [], dj as DJActionTrack[], null, null);
    expect(range).toEqual([0, 20]);
  });
});

describe('DJ JSONL shaping (v2 ticks + note vs cc)', () => {
  const tpq = DEFAULT_MIDI_TPQ;

  const noteTrack = djFixture({
    id: 'deck',
    name: 'Deck',
    midiChannel: 16,
    actionMap: { 48: { id: 'play', cat: 'deck', label: 'Play', short: 'P', device: 'deck1' } },
    events: [{ pitch: 48, t: 2, dur: 0.5, vel: 1 }],
  });

  const ccTrack = djFixture({
    id: 'mx',
    name: 'Mixer',
    midiChannel: 1,
    actionMap: {
      80: { id: 'xfade_pos', cat: 'mixer', label: 'XF', short: 'XF', device: 'mixer', pad: true },
    },
    outputMap: {
      80: normalizeOutputMapping({ device: 'mixer', channel: 1, pitch: 80, cc: 16 }),
    },
    events: [{ pitch: 80, t: 1, dur: 2, vel: 0.5 }],
  });

  it('emits note lines with tick, velocity, durationTicks', () => {
    const lines = collectDjExportJsonLines(
      [noteTrack],
      new Set([djExportKey('deck')]),
      false,
      [0, 8],
      tpq,
    );
    expect(lines).toHaveLength(1);
    const n = lines[0];
    expect(n.message).toBe('note');
    expect(n.version).toBe(2);
    expect(n.tick).toBe(beatsToMidiTicks(2, tpq));
    if (n.message === 'note') {
      expect(n.pitch).toBe(48);
      expect(n.velocity).toBe(127);
      expect(n.durationTicks).toBe(beatsToMidiTicks(0.5, tpq));
    }
  });

  it('emits cc lines with controller and value, not pitch/dur', () => {
    const lines = collectDjExportJsonLines(
      [ccTrack],
      new Set([djExportKey('mx')]),
      false,
      [0, 8],
      tpq,
    );
    expect(lines).toHaveLength(1);
    const c = lines[0];
    expect(c.message).toBe('cc');
    expect(c.tick).toBe(beatsToMidiTicks(1, tpq));
    if (c.message === 'cc') {
      expect(c.controller).toBe(16);
      expect(c.value).toBe(64);
      expect('pitch' in c).toBe(false);
    }
  });

  it('counts both note and cc events', () => {
    expect(
      countExportTallyEvents(
        [],
        [],
        [noteTrack, ccTrack],
        [0, 8],
        new Set([djExportKey('deck'), djExportKey('mx')]),
        true,
        false,
      ),
    ).toBe(2);
  });

  it('excludes events on muted DJ tracks', () => {
    const track = djFixture({
      ...noteTrack,
      muted: true,
      soloed: false,
    });

    expect(
      countExportTallyEvents([], [], [track], [0, 8], new Set([djExportKey('deck')]), true, false),
    ).toBe(0);
    expect(
      collectDjExportJsonLines([track], new Set([djExportKey('deck')]), false, [0, 8], tpq),
    ).toHaveLength(0);
  });

  it('excludes pitches outside actionMap', () => {
    const track = djFixture({
      ...noteTrack,
      events: [{ pitch: 99, t: 0, dur: 1, vel: 0.5 }],
    });

    expect(
      countExportTallyEvents([], [], [track], [0, 8], new Set([djExportKey('deck')]), true, false),
    ).toBe(0);
  });
});
