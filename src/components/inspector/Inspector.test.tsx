import { describe, expect, test, vi } from 'vitest';
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

vi.mock('../../hooks/useStage', () => ({
  useStage: () => ({
    resolvedSelection: { channelId: 1, indexes: [0] },
    rolls: [
      {
        channelId: 1,
        notes: [{ t: 0, dur: 1, pitch: 60, vel: 0.8 }],
        muted: false,
        soloed: false,
        collapsed: false,
      },
    ],
    channels: [{ id: 1, name: 'CH1', color: '#000', muted: false, soloed: false, collapsed: false }],
    djActionSelection: null,
    djActionTracks: [djTrack],
    selectedTimelineTrack: { kind: 'dj', trackId: 'dj1' } as const,
    setOutputMapping: vi.fn(),
    setDJTrackDefaultMidiOutputDevice: vi.fn(),
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

describe('Inspector — DJ track output mapping', () => {
  test('Note tab shows track mapping panel when a DJ timeline track is focused', () => {
    const html = renderToStaticMarkup(<Inspector />);
    expect(html).toContain('mr-insp__dj-track-map');
    expect(html).toContain('Deck');
    expect(html).toContain('DJ track · output mapping');
    expect(html).toContain('Track MIDI output');
    expect(html).toContain('Play / Pause');
  });
});
