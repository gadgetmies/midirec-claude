import { afterEach, describe, expect, test } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useChannels, type Channel, type ParamLane, type PianoRollTrack } from './useChannels';

afterEach(() => {
  cleanup();
});

describe('useChannels.hydrate', () => {
  test('replaces channels / rolls / lanes from a slice', () => {
    const { result } = renderHook(() => useChannels(16, false));
    expect(result.current.channels).toHaveLength(2);

    const newChannel: Channel = {
      id: 5,
      name: 'Loaded',
      color: '#abcdef',
      collapsed: false,
      muted: false,
      soloed: false,
      inputSources: [],
    };
    const newRoll: PianoRollTrack = {
      channelId: 5,
      notes: [{ tTicks: 1920, durTicks: 240, pitch: 60, vel: 100 }],
      muted: false,
      soloed: false,
      collapsed: false,
    };
    const newLane: ParamLane = {
      channelId: 5,
      kind: 'cc',
      cc: 7,
      name: 'Volume',
      color: 'var(--mr-cc)',
      points: [{ tTicks: 0, v: 0.5 }],
      muted: false,
      soloed: false,
      collapsed: false,
    };

    act(() => {
      result.current.hydrate({
        channels: [newChannel],
        rolls: [newRoll],
        lanes: [newLane],
      });
    });

    expect(result.current.channels).toEqual([newChannel]);
    expect(result.current.rolls).toEqual([newRoll]);
    expect(result.current.lanes).toEqual([newLane]);
  });

  test('hydrating with empty slices clears state', () => {
    const { result } = renderHook(() => useChannels(16, true));
    expect(result.current.channels.length).toBeGreaterThan(0);

    act(() => {
      result.current.hydrate({ channels: [], rolls: [], lanes: [] });
    });

    expect(result.current.channels).toEqual([]);
    expect(result.current.rolls).toEqual([]);
    expect(result.current.lanes).toEqual([]);
  });
});
