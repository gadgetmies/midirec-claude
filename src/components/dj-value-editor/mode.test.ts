import { describe, expect, test } from 'vitest';
import type { ActionEvent, ActionMapEntry, OutputMapping, PressurePoint } from '../../data/dj';
import { DEFAULT_ACTION_MAP } from '../../data/dj';
import type { DJActionTrack } from '../../hooks/useDJActionTracks';
import { deriveEditorMode } from './mode';

function makeTrack(opts: {
  id?: string;
  actionMap?: Record<number, ActionMapEntry>;
  outputMap?: Record<number, OutputMapping>;
  events?: ActionEvent[];
} = {}): DJActionTrack {
  return {
    id: opts.id ?? 'dj1',
    name: 'DJ Track',
    color: 'oklch(70% 0.1 240)',
    midiChannel: 16,
    actionMap: opts.actionMap ?? {},
    outputMap: opts.outputMap ?? {},
    events: opts.events ?? [],
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
}

const padCC: ActionMapEntry = { id: 'xfade_pos', cat: 'mixer', label: 'Crossfader', short: 'XF', device: 'mixer', pad: true };
const padPressure: ActionMapEntry = DEFAULT_ACTION_MAP[56]!; // hc1, pad+pressure
const trigger: ActionMapEntry = DEFAULT_ACTION_MAP[48]!; // play, trigger-style
const fallback: ActionMapEntry = DEFAULT_ACTION_MAP[73]!; // load_a, fallback (browser, no pad/pressure, not a trigger id)

describe('deriveEditorMode', () => {
  test('hidden when neither selection set', () => {
    const track = makeTrack({ actionMap: { 80: padCC } });
    expect(deriveEditorMode({ djActionTracks: [track], djActionSelection: null, djEventSelection: null }).kind).toBe(
      'hidden',
    );
  });

  test('cc mode for explicit out:cc', () => {
    const track = makeTrack({
      actionMap: { 80: padCC },
      outputMap: { 80: { device: 'mixer', channel: 1, pitch: 80, cc: 16, out: 'cc' } },
    });
    const mode = deriveEditorMode({
      djActionTracks: [track],
      djActionSelection: { trackId: 'dj1', pitch: 80 },
      djEventSelection: null,
    });
    expect(mode.kind).toBe('cc');
  });

  test('cc mode for legacy mapping with cc but no out', () => {
    const track = makeTrack({
      actionMap: { 80: padCC },
      outputMap: { 80: { device: 'mixer', channel: 1, pitch: 80, cc: 16 } },
    });
    const mode = deriveEditorMode({
      djActionTracks: [track],
      djActionSelection: { trackId: 'dj1', pitch: 80 },
      djEventSelection: null,
    });
    expect(mode.kind).toBe('cc');
  });

  test('pb mode for explicit out:pb', () => {
    const track = makeTrack({
      actionMap: { 80: padCC },
      outputMap: { 80: { device: 'mixer', channel: 1, pitch: 80, out: 'pb' } },
    });
    const mode = deriveEditorMode({
      djActionTracks: [track],
      djActionSelection: { trackId: 'dj1', pitch: 80 },
      djEventSelection: null,
    });
    expect(mode.kind).toBe('pb');
  });

  test('at mode for event selection on a pressure row', () => {
    const ev: ActionEvent = { pitch: 56, tTicks: 0, durTicks: 240, vel: 0.5 };
    const track = makeTrack({ actionMap: { 56: padPressure }, events: [ev] });
    const mode = deriveEditorMode({
      djActionTracks: [track],
      djActionSelection: null,
      djEventSelection: { trackId: 'dj1', pitch: 56, eventIdx: 0 },
    });
    expect(mode.kind).toBe('at');
    if (mode.kind === 'at') {
      expect(mode.eventIdx).toBe(0);
      expect(mode.pitch).toBe(56);
    }
  });

  test('at mode hidden when event missing', () => {
    const track = makeTrack({ actionMap: { 56: padPressure }, events: [] });
    expect(
      deriveEditorMode({
        djActionTracks: [track],
        djActionSelection: null,
        djEventSelection: { trackId: 'dj1', pitch: 56, eventIdx: 0 },
      }).kind,
    ).toBe('hidden');
  });

  test('at mode hidden when row is not pressure-bearing', () => {
    const ev: ActionEvent = { pitch: 80, tTicks: 0, durTicks: 240, vel: 0.5 };
    const track = makeTrack({ actionMap: { 80: padCC }, events: [ev] });
    expect(
      deriveEditorMode({
        djActionTracks: [track],
        djActionSelection: null,
        djEventSelection: { trackId: 'dj1', pitch: 80, eventIdx: 0 },
      }).kind,
    ).toBe('hidden');
  });

  test('trigger-only row produces hidden mode', () => {
    const track = makeTrack({ actionMap: { 48: trigger } });
    expect(
      deriveEditorMode({
        djActionTracks: [track],
        djActionSelection: { trackId: 'dj1', pitch: 48 },
        djEventSelection: null,
      }).kind,
    ).toBe('hidden');
  });

  test('fallback row produces hidden mode', () => {
    const track = makeTrack({ actionMap: { 73: fallback } });
    expect(
      deriveEditorMode({
        djActionTracks: [track],
        djActionSelection: { trackId: 'dj1', pitch: 73 },
        djEventSelection: null,
      }).kind,
    ).toBe('hidden');
  });

  test('event selection on a CC row falls through to action selection (cc mode)', () => {
    const evCC: ActionEvent = { pitch: 80, tTicks: 0, durTicks: 0, vel: 0.5 };
    const track = makeTrack({
      actionMap: { 80: padCC },
      outputMap: { 80: { device: 'mixer', channel: 1, pitch: 80, cc: 16 } },
      events: [evCC],
    });
    /* fireEventClick sets BOTH selections when clicking a CC cluster.
       The editor should still open in CC mode, not get hidden by the
       non-pressure evtSel branch. */
    expect(
      deriveEditorMode({
        djActionTracks: [track],
        djActionSelection: { trackId: 'dj1', pitch: 80 },
        djEventSelection: { trackId: 'dj1', pitch: 80, eventIdx: 0 },
      }).kind,
    ).toBe('cc');
  });

  test('event selection takes precedence over action selection', () => {
    const evPoints: PressurePoint[] = [];
    const ev: ActionEvent = { pitch: 56, tTicks: 0, durTicks: 240, vel: 0.5, pressure: evPoints };
    const track = makeTrack({
      actionMap: { 56: padPressure, 80: padCC },
      outputMap: { 80: { device: 'mixer', channel: 1, pitch: 80, cc: 16 } },
      events: [ev],
    });
    expect(
      deriveEditorMode({
        djActionTracks: [track],
        djActionSelection: { trackId: 'dj1', pitch: 80 },
        djEventSelection: { trackId: 'dj1', pitch: 56, eventIdx: 0 },
      }).kind,
    ).toBe('at');
  });

  test('selection on missing track yields hidden', () => {
    const track = makeTrack({ actionMap: { 80: padCC } });
    expect(
      deriveEditorMode({
        djActionTracks: [track],
        djActionSelection: { trackId: 'no-such', pitch: 80 },
        djEventSelection: null,
      }).kind,
    ).toBe('hidden');
  });

  test('selection on missing actionMap entry yields hidden', () => {
    const track = makeTrack({ actionMap: {} });
    expect(
      deriveEditorMode({
        djActionTracks: [track],
        djActionSelection: { trackId: 'dj1', pitch: 80 },
        djEventSelection: null,
      }).kind,
    ).toBe('hidden');
  });

  test('velocity-sensitive row with no outputMap produces hidden (note-mode)', () => {
    const track = makeTrack({ actionMap: { 80: padCC } });
    expect(
      deriveEditorMode({
        djActionTracks: [track],
        djActionSelection: { trackId: 'dj1', pitch: 80 },
        djEventSelection: null,
      }).kind,
    ).toBe('hidden');
  });
});
