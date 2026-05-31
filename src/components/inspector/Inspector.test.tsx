import { describe, expect, test, vi, beforeEach } from 'vitest';
import { beatsToSessionTicks } from '../../midi/sessionTicks';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DEFAULT_ACTION_MAP,
} from '../../data/dj';
import type { DJActionTrack } from '../../hooks/useDJActionTracks';
import { Inspector } from './Inspector';

const djTrack: DJActionTrack = {
  id: 'dj1',
  name: 'Deck',
  color: '#fff',
  midiChannel: 1,
  actionMap: { 48: DEFAULT_ACTION_MAP[48]! },
  outputMap: {},
  events: [],
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

const stageCtl = vi.hoisted(() => ({
  djTimelineFocused: true,
  updateNoteAt: vi.fn(),
}));

vi.mock('../../hooks/useStage', () => ({
  useStage: () => ({
    resolvedSelection: { channelId: 1, indexes: [0] },
    rolls: [
      {
        channelId: 1,
        notes: [{ tTicks: 0, durTicks: beatsToSessionTicks(1), pitch: 60, vel: 0.8 }],
        muted: false,
        soloed: false,
        collapsed: false,
      },
    ],
    channels: [{ id: 1, name: 'CH1', color: '#000', muted: false, soloed: false, collapsed: false }],
    djActionSelection: null,
    djActionTracks: [djTrack],
    selectedTimelineTrack: stageCtl.djTimelineFocused
      ? ({ kind: 'dj', trackId: 'dj1' } as const)
      : null,
    setOutputMapping: vi.fn(),
    setDJTrackDefaultMidiOutputDevice: vi.fn(),
    updateNoteAt: stageCtl.updateNoteAt,
  }),
}));

vi.mock('../../midi/MidiRuntimeProvider', () => {
  const granted = {
    status: 'granted' as const,
    access: { inputs: new Map(), outputs: new Map() },
    inputs: [] as { id: string; name: string }[],
    outputs: [] as { id: string; name: string }[],
  };
  return {
    useMidiOutputs: () => ({
      status: 'granted' as const,
      outputs: [{ id: 'midi-1', name: 'Interface' }],
    }),
    useMidiRuntime: () => ({
      state: granted,
      retry: vi.fn(),
    }),
  };
});

vi.mock('../../midi/MidiClockSendProvider', () => ({
  useMidiClockSend: () => ({
    enabled: false,
    selectedOutputIds: new Set<string>(),
    txPulse: 0,
    txPulseByOutputId: new Map<string, number>(),
    gridAlignment: {
      enabled: false,
      outputId: null,
      message: { kind: 'note', channel: 1, note: 60, velocity: 127 },
      boundary: 'bar',
      phraseBars: 8,
    },
    setEnabled: vi.fn(),
    toggleOutput: vi.fn(),
    setSelectedOutputs: vi.fn(),
    sync: vi.fn(),
    setGridAlignment: vi.fn(),
    fireGridAlignment: vi.fn(),
  }),
}));

vi.mock('../../hooks/useTransport', async () => {
  const actual = await vi.importActual<object>('../../hooks/useTransport');
  return {
    ...actual,
    useTransport: () => ({
      mode: 'idle',
      playing: false,
      recording: false,
      looping: false,
      metronomeOn: false,
      quantizeOn: true,
      quantizeGrid: '1/16',
      snapAbsoluteOn: false,
      timecodeMs: 0,
      playheadTicks: 0,
      cuePointTicks: 0,
      bar: '1.1.1',
      bpm: 124,
      sig: '4/4',
      clockSource: 'internal',
      recordingStartedAt: null,
      play: vi.fn(),
      pause: vi.fn(),
      record: vi.fn(),
      rewind: vi.fn(),
      cue: vi.fn(),
      toggleLoop: vi.fn(),
      toggleMetronome: vi.fn(),
      toggleQuantize: vi.fn(),
      toggleSnapAbsolute: vi.fn(),
      setQuantizeGrid: vi.fn(),
      seek: vi.fn(),
      hydrate: vi.fn(),
      applyExternalPulse: vi.fn(),
      revertToInternalClock: vi.fn(),
    }),
  };
});

describe('Inspector — DJ track output mapping', () => {
  beforeEach(() => {
    stageCtl.djTimelineFocused = true;
  });

  test('Events tab shows track mapping panel when a DJ timeline track is focused', () => {
    const html = renderToStaticMarkup(<Inspector />);
    expect(html).toContain('mr-insp__dj-track-map');
    expect(html).toContain('Deck');
    expect(html).toContain('DJ track · output mapping');
    expect(html).toContain('Track MIDI output');
    expect(html).toContain('Play / Pause');
  });
});

describe('Inspector — single-note start editors', () => {
  beforeEach(() => {
    stageCtl.djTimelineFocused = false;
  });

  test('shows phrase-bar-beat and ticks inputs in the Start row', () => {
    const html = renderToStaticMarkup(<Inspector />);
    expect(html).toContain('Start phrase bar beat');
    expect(html).toContain('Start ticks');
    expect(html).toContain('mr-insp__start-bbt');
    expect(html).toContain('mr-insp__start-ticks');
  });
});

describe('Inspector — ClockSendPanel mount', () => {
  test('ClockSendPanel renders alongside the inspector regardless of selection', () => {
    stageCtl.djTimelineFocused = false;
    const html = renderToStaticMarkup(<Inspector />);
    expect(html).toContain('mr-insp-clock-send');
    expect(html).toContain('MIDI CLOCK SEND');
  });

  test('ClockSendPanel still renders when a DJ track is focused', () => {
    stageCtl.djTimelineFocused = true;
    const html = renderToStaticMarkup(<Inspector />);
    expect(html).toContain('mr-insp-clock-send');
  });
});
