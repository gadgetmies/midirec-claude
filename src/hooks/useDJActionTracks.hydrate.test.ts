import { afterEach, describe, expect, test } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useDJActionTracks, type DJActionTrack } from './useDJActionTracks';

afterEach(() => {
  cleanup();
});

describe('useDJActionTracks.hydrate', () => {
  test('replaces the djActionTracks slice', () => {
    const { result } = renderHook(() => useDJActionTracks(true, true, false));
    expect(result.current.djActionTracks.length).toBeGreaterThan(0);

    const replacement: DJActionTrack = {
      id: 'dj-loaded',
      name: 'Loaded Deck',
      color: '#123456',
      midiChannel: 2,
      actionMap: {},
      outputMap: {},
      events: [{ pitch: 48, tTicks: 1920, durTicks: 240, vel: 0.9 }],
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

    act(() => {
      result.current.hydrate([replacement]);
    });

    expect(result.current.djActionTracks).toEqual([replacement]);
  });

  test('hydrating with an empty array clears state', () => {
    const { result } = renderHook(() => useDJActionTracks(true, true, false));

    act(() => {
      result.current.hydrate([]);
    });

    expect(result.current.djActionTracks).toEqual([]);
  });
});
