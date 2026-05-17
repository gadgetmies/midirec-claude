import { describe, expect, it } from 'vitest';
import type { Note } from '../components/piano-roll/notes';
import type { CCPoint } from '../components/param-lanes/ccPoints';
import type { ActionEvent } from '../data/dj';
import type { ChannelId } from '../hooks/useChannels';
import {
  migrateActionEvent,
  migrateCCPoint,
  migrateMarquee,
  migrateNote,
  migrateSessionBeatsToTicks,
} from './migrateSessionBeatsToTicks';
import { beatsToSessionTicks, playheadTicksFromTimecodeMs, timecodeMsFromPlayheadTicks } from './sessionTicks';
import { DEFAULT_MIDI_TPQ } from './timelineTicks';

describe('migrateNote', () => {
  it('idempotent for tick-native notes', () => {
    const n = { tTicks: 480, durTicks: 240, pitch: 60, vel: 0.5 };
    expect(migrateNote(n)).toEqual(n);
  });

  it('converts legacy beat fields', () => {
    expect(
      migrateNote({ pitch: 60, vel: 1, t: 2, dur: 0.5 } as Parameters<typeof migrateNote>[0]),
    ).toEqual({
      pitch: 60,
      vel: 1,
      tTicks: beatsToSessionTicks(2),
      durTicks: beatsToSessionTicks(0.5),
    });
  });
});

describe('migrateCCPoint', () => {
  it('converts legacy t', () => {
    expect(migrateCCPoint({ v: 0.5, t: 4 } as Parameters<typeof migrateCCPoint>[0])).toEqual({
      v: 0.5,
      tTicks: beatsToSessionTicks(4),
    });
  });
});

describe('migrateActionEvent', () => {
  it('preserves pressure when migrating beats', () => {
    const pts = [{ t: 0, v: 1 }];
    const ev = migrateActionEvent({
      pitch: 56,
      vel: 0.8,
      t: 1,
      dur: 1,
      pressure: pts,
    } as Parameters<typeof migrateActionEvent>[0]);
    expect(ev.pressure).toEqual(pts);
    expect(ev.tTicks).toBe(beatsToSessionTicks(1));
  });
});

describe('migrateMarquee', () => {
  it('maps legacy beat corners to ticks', () => {
    expect(migrateMarquee({ p0: 60, p1: 72, t0: 1, t1: 2 })).toEqual({
      p0: 60,
      p1: 72,
      t0Ticks: beatsToSessionTicks(1),
      t1Ticks: beatsToSessionTicks(2),
    });
  });
});

describe('migrateSessionBeatsToTicks', () => {
  it('walks rolls, lanes, and dj tracks', () => {
    const snap = migrateSessionBeatsToTicks({
      rolls: [
        {
          channelId: 1 as ChannelId,
          notes: [{ pitch: 60, vel: 1, t: 0, dur: 1 } as unknown as Note],
          muted: false,
          soloed: false,
          collapsed: false,
        },
      ],
      lanes: [
        {
          channelId: 1 as ChannelId,
          kind: 'cc',
          cc: 1,
          name: 'X',
          color: '#000',
          points: [{ v: 0.5, t: 2 } as unknown as CCPoint],
          muted: false,
          soloed: false,
          collapsed: false,
        },
      ],
      djTracks: [
        {
          id: 'dj1',
          name: '',
          color: '',
          midiChannel: 1,
          actionMap: {},
          outputMap: {},
          events: [{ pitch: 48, vel: 1, t: 3, dur: 1 } as unknown as ActionEvent],
          inputRouting: { channels: [] },
          outputRouting: { channels: [] },
          collapsed: false,
          muted: false,
          soloed: false,
          mutedRows: [],
          soloedRows: [],
          defaultMidiInputDeviceId: '',
          defaultMidiOutputDeviceId: '',
        },
      ],
    });
    expect(snap.rolls[0].notes[0].tTicks).toBe(0);
    expect(snap.lanes[0].points[0].tTicks).toBe(beatsToSessionTicks(2));
    expect(snap.djTracks[0].events[0].tTicks).toBe(beatsToSessionTicks(3));
  });
});

describe('playheadTicksFromTimecodeMs', () => {
  it('round-trips approximately through timecodeMsFromPlayheadTicks', () => {
    const bpm = 120;
    const ms = 2500;
    const ticks = playheadTicksFromTimecodeMs(ms, bpm, DEFAULT_MIDI_TPQ);
    expect(timecodeMsFromPlayheadTicks(ticks, bpm, DEFAULT_MIDI_TPQ)).toBeCloseTo(ms, 2);
  });
});
