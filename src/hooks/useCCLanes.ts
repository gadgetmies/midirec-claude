import { useCallback, useMemo, useReducer } from 'react';
import { ccModWheel, ccPitchBend, ccVelocity, type CCPoint } from '../components/cc-lanes/ccPoints';

export type { CCPoint };

export interface CCLane {
  id: string;
  name: string;
  cc: string;
  color: string;
  points: CCPoint[];
  muted: boolean;
  soloed: boolean;
}

type CCLaneAction =
  | { type: 'toggleMuted'; id: string }
  | { type: 'toggleSoloed'; id: string };

function ccLanesReducer(state: CCLane[], action: CCLaneAction): CCLane[] {
  const idx = state.findIndex((l) => l.id === action.id);
  if (idx < 0) return state;
  const next = state.slice();
  const l = state[idx];
  switch (action.type) {
    case 'toggleMuted':
      next[idx] = { ...l, muted: !l.muted };
      return next;
    case 'toggleSoloed':
      next[idx] = { ...l, soloed: !l.soloed };
      return next;
    default:
      return state;
  }
}

function seedCCLanes(totalT: number): CCLane[] {
  return [
    {
      id: 'cc1',
      name: 'Mod Wheel',
      cc: '01',
      color: 'var(--mr-cc)',
      points: ccModWheel(totalT),
      muted: false,
      soloed: false,
    },
    {
      id: 'cc2',
      name: 'Pitch Bend',
      cc: 'PB',
      color: 'var(--mr-pitch)',
      points: ccPitchBend(totalT),
      muted: false,
      soloed: false,
    },
    {
      id: 'cc3',
      name: 'Velocity',
      cc: 'VEL',
      color: 'var(--mr-aftertouch)',
      points: ccVelocity(totalT),
      muted: true,
      soloed: false,
    },
  ];
}

export interface UseCCLanesReturn {
  lanes: CCLane[];
  toggleCCLaneMuted: (id: string) => void;
  toggleCCLaneSoloed: (id: string) => void;
}

export function useCCLanes(totalT: number): UseCCLanesReturn {
  const initial = useMemo(() => seedCCLanes(totalT), [totalT]);
  const [lanes, dispatch] = useReducer(ccLanesReducer, initial);
  const toggleCCLaneMuted = useCallback(
    (id: string) => dispatch({ type: 'toggleMuted', id }),
    [],
  );
  const toggleCCLaneSoloed = useCallback(
    (id: string) => dispatch({ type: 'toggleSoloed', id }),
    [],
  );
  return { lanes, toggleCCLaneMuted, toggleCCLaneSoloed };
}
