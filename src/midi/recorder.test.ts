import { describe, expect, test } from 'vitest';
import type { DJActionTrack } from '../hooks/useDJActionTracks';
import type { ActionMapEntry } from '../data/dj';
import { matchingDJActions, matchingDJCcActions } from './recorder';

function trackWith(actions: Record<number, ActionMapEntry>): DJActionTrack {
  return {
    id: 't1',
    name: 'T',
    color: '#000',
    midiChannel: 1,
    actionMap: actions,
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
}

describe('matchingDJActions / matchingDJCcActions', () => {
  test('note rows with midiInputCc set do not match note routing', () => {
    const row: ActionMapEntry = {
      id: 'ch1_vol',
      cat: 'mixer',
      label: 'Vol',
      short: 'V',
      device: 'mixer',
      pad: true,
      midiInputCc: 7,
    };
    const t = trackWith({ 81: row });
    const byNote = matchingDJActions([t], 'pad', 9, 81);
    expect(byNote).toHaveLength(0);
  });

  test('CC row matches control change', () => {
    const row: ActionMapEntry = {
      id: 'ch1_vol',
      cat: 'mixer',
      label: 'Vol',
      short: 'V',
      device: 'mixer',
      pad: true,
      midiInputCc: 7,
      midiInputChannel: 10,
    };
    const t = trackWith({ 81: row });
    const hits = matchingDJCcActions([t], 'pad', 9, 7);
    expect(hits).toEqual([{ trackId: 't1', actionPitch: 81 }]);
  });
});
