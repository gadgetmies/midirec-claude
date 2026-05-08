import { useCallback, useMemo, useReducer } from 'react';
import { makeNotes, type Note } from '../components/piano-roll/notes';

export interface Track {
  id: string;
  name: string;
  channel: string;
  color: string;
  notes: Note[];
  open: boolean;
  muted: boolean;
  soloed: boolean;
}

type TrackAction =
  | { type: 'toggleOpen'; id: string }
  | { type: 'toggleMuted'; id: string }
  | { type: 'toggleSoloed'; id: string };

function tracksReducer(state: Track[], action: TrackAction): Track[] {
  const idx = state.findIndex((t) => t.id === action.id);
  if (idx < 0) return state;
  const next = state.slice();
  const t = state[idx];
  switch (action.type) {
    case 'toggleOpen':
      next[idx] = { ...t, open: !t.open };
      return next;
    case 'toggleMuted':
      next[idx] = { ...t, muted: !t.muted };
      return next;
    case 'toggleSoloed':
      next[idx] = { ...t, soloed: !t.soloed };
      return next;
    default:
      return state;
  }
}

function seedTracks(): Track[] {
  return [
    {
      id: 't1',
      name: 'Lead',
      channel: 'CH 1',
      color: 'oklch(72% 0.14 240)',
      notes: makeNotes(22, 7),
      open: true,
      muted: false,
      soloed: false,
    },
    {
      id: 't2',
      name: 'Bass',
      channel: 'CH 2',
      color: 'oklch(70% 0.16 30)',
      notes: makeNotes(16, 11),
      open: true,
      muted: false,
      soloed: false,
    },
    {
      id: 't3',
      name: 'Pads',
      channel: 'CH 3',
      color: 'oklch(74% 0.10 145)',
      notes: makeNotes(12, 19),
      open: false,
      muted: true,
      soloed: false,
    },
  ];
}

export interface UseTracksReturn {
  tracks: Track[];
  toggleTrackOpen: (id: string) => void;
  toggleTrackMuted: (id: string) => void;
  toggleTrackSoloed: (id: string) => void;
}

export function useTracks(): UseTracksReturn {
  const initial = useMemo(() => seedTracks(), []);
  const [tracks, dispatch] = useReducer(tracksReducer, initial);
  const toggleTrackOpen = useCallback((id: string) => dispatch({ type: 'toggleOpen', id }), []);
  const toggleTrackMuted = useCallback((id: string) => dispatch({ type: 'toggleMuted', id }), []);
  const toggleTrackSoloed = useCallback((id: string) => dispatch({ type: 'toggleSoloed', id }), []);
  return { tracks, toggleTrackOpen, toggleTrackMuted, toggleTrackSoloed };
}
