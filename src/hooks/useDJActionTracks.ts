/* useDJActionTracks — slow-changing config state for DJ action tracks.

   NOT a MIDI capture or playback surface. See design/real-time-correctness.md:
   capture/playback timing belongs to the audio engine (Slice 10), not to React
   state. This hook only holds the track's user-configured shape — name, color,
   action map, routing, M/S flags. Per-message MIDI events SHALL NOT flow
   through `setState` here. */

import { useCallback, useMemo, useState } from 'react';
import {
  DEFAULT_ACTION_MAP,
  DJ_DEVICES,
  type ActionMapEntry,
} from '../data/dj';
import type { ChannelId } from './useChannels';

export type DJTrackId = string;

// TODO(routing-ui-slice): expand the routing shape with pitch ranges and CC
// selectors when the routing-configuration UI is built. For Slice 7a the
// channel list is the only field we commit to.
export interface DJTrackRouting {
  channels: ChannelId[];
}

export interface DJActionTrack {
  id: DJTrackId;
  name: string;
  color: string;
  actionMap: Record<number, ActionMapEntry>;
  inputRouting: DJTrackRouting;
  outputRouting: DJTrackRouting;
  collapsed: boolean;
  muted: boolean;
  soloed: boolean;
}

export interface UseDJActionTracksReturn {
  djActionTracks: DJActionTrack[];
  toggleDJTrackCollapsed: (id: DJTrackId) => void;
  toggleDJTrackMuted: (id: DJTrackId) => void;
  toggleDJTrackSoloed: (id: DJTrackId) => void;
}

/* The track's `actionMap` is the set of actions CONFIGURED on this track —
   not the full catalog of available actions. `DEFAULT_ACTION_MAP` (from
   src/data/dj.ts) is the picker source for the future routing UI; users
   add entries from there into a track's actionMap.

   Default seed: 4 actions spanning 3 devices (Deck 1 transport + Hot Cue 1,
   FX 1, Mixer) to give Slice 7b's per-action rendering a small but visually
   diverse target. Empty by default would be valid too; the small seed exists
   for demo purposes only. */
function seedDefault(): DJActionTrack[] {
  const seededPitches = [48, 56, 60, 71];
  const seededActionMap: Record<number, ActionMapEntry> = {};
  for (const p of seededPitches) {
    const entry = DEFAULT_ACTION_MAP[p];
    if (entry) seededActionMap[p] = entry;
  }
  return [
    {
      id: 'dj1',
      name: 'DJ',
      color: DJ_DEVICES.global.color,
      actionMap: seededActionMap,
      inputRouting: { channels: [] },
      outputRouting: { channels: [] },
      collapsed: false,
      muted: false,
      soloed: false,
    },
  ];
}

export function useDJActionTracks(): UseDJActionTracksReturn {
  const initial = useMemo(() => seedDefault(), []);
  const [djActionTracks, setDJActionTracks] = useState<DJActionTrack[]>(initial);

  const flip = useCallback(
    (id: DJTrackId, field: 'collapsed' | 'muted' | 'soloed') => {
      setDJActionTracks((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        if (idx < 0) return prev;
        const next = prev.slice();
        next[idx] = { ...next[idx], [field]: !next[idx][field] };
        return next;
      });
    },
    [],
  );

  const toggleDJTrackCollapsed = useCallback((id: DJTrackId) => flip(id, 'collapsed'), [flip]);
  const toggleDJTrackMuted = useCallback((id: DJTrackId) => flip(id, 'muted'), [flip]);
  const toggleDJTrackSoloed = useCallback((id: DJTrackId) => flip(id, 'soloed'), [flip]);

  return {
    djActionTracks,
    toggleDJTrackCollapsed,
    toggleDJTrackMuted,
    toggleDJTrackSoloed,
  };
}

/** True iff any dj-action-track is soloed. */
export function anyDJTrackSoloed(djActionTracks: DJActionTrack[]): boolean {
  return djActionTracks.some((t) => t.soloed);
}

/** True iff (track.soloed) OR (no solo anywhere across channels/dj-tracks). */
export function isDJTrackAudible(track: DJActionTrack, anySoloed: boolean): boolean {
  if (!anySoloed) return true;
  return track.soloed;
}
