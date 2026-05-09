import { useCallback, useMemo, useReducer } from 'react';
import { ccModWheel, ccPitchBend, ccVelocity, type CCPoint } from '../components/cc-lanes/ccPoints';
import { makeNotes, type Note } from '../components/piano-roll/notes';

export type { CCPoint };

export type ChannelId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;

export type CCLaneKind = 'cc' | 'pb' | 'at' | 'vel';

export interface Channel {
  id: ChannelId;
  name: string;
  color: string;
  collapsed: boolean;
  muted: boolean;
  soloed: boolean;
}

export interface PianoRollTrack {
  channelId: ChannelId;
  notes: Note[];
  muted: boolean;
  soloed: boolean;
  collapsed: boolean;
}

export interface CCLane {
  channelId: ChannelId;
  kind: CCLaneKind;
  cc?: number;
  name: string;
  color: string;
  points: CCPoint[];
  muted: boolean;
  soloed: boolean;
  collapsed: boolean;
}

/* ── Standard MIDI CC name table ──────────────────────────────────────────
   Used by both addCCLane's name derivation and the AddCCLanePopover picker.
   Numbers come from the General MIDI CC list; kept short on purpose — users
   can type a custom CC# in the popover for anything not listed. */
export interface StandardCCEntry {
  cc: number;
  name: string;
}

export const STANDARD_CCS: readonly StandardCCEntry[] = [
  { cc: 1, name: 'Mod Wheel' },
  { cc: 7, name: 'Volume' },
  { cc: 10, name: 'Pan' },
  { cc: 11, name: 'Expression' },
  { cc: 64, name: 'Sustain' },
  { cc: 71, name: 'Resonance' },
  { cc: 74, name: 'Cutoff' },
];

const STANDARD_CC_BY_NUMBER = new Map(STANDARD_CCS.map((e) => [e.cc, e.name]));

export function laneDefaultName(kind: CCLaneKind, cc?: number): string {
  switch (kind) {
    case 'cc':
      return cc !== undefined ? STANDARD_CC_BY_NUMBER.get(cc) ?? `CC ${cc}` : 'CC';
    case 'pb':
      return 'Pitch Bend';
    case 'at':
      return 'Aftertouch';
    case 'vel':
      return 'Note Velocity';
  }
}

export function laneCCLabel(lane: CCLane): string {
  switch (lane.kind) {
    case 'cc':
      return `CC ${lane.cc}`;
    case 'pb':
      return 'PB';
    case 'at':
      return 'AT';
    case 'vel':
      return 'VEL';
  }
}

export function laneKey(channelId: ChannelId, kind: CCLaneKind, cc?: number): string {
  return `${channelId}.${kind}.${cc ?? ''}`;
}

export function laneKeyOf(lane: CCLane): string {
  return laneKey(lane.channelId, lane.kind, lane.cc);
}

/* ── State shape and actions ─────────────────────────────────────────────── */

interface State {
  channels: Channel[];
  rolls: PianoRollTrack[];
  lanes: CCLane[];
}

type Action =
  | { type: 'channel/toggleCollapsed'; channelId: ChannelId }
  | { type: 'channel/toggleMuted'; channelId: ChannelId }
  | { type: 'channel/toggleSoloed'; channelId: ChannelId }
  | { type: 'roll/toggleCollapsed'; channelId: ChannelId }
  | { type: 'roll/toggleMuted'; channelId: ChannelId }
  | { type: 'roll/toggleSoloed'; channelId: ChannelId }
  | { type: 'lane/toggleCollapsed'; channelId: ChannelId; kind: CCLaneKind; cc?: number }
  | { type: 'lane/toggleMuted'; channelId: ChannelId; kind: CCLaneKind; cc?: number }
  | { type: 'lane/toggleSoloed'; channelId: ChannelId; kind: CCLaneKind; cc?: number }
  | { type: 'lane/add'; channelId: ChannelId; kind: CCLaneKind; cc?: number; totalT: number };

function flipChannelField(state: State, channelId: ChannelId, field: keyof Pick<Channel, 'collapsed' | 'muted' | 'soloed'>): State {
  const idx = state.channels.findIndex((c) => c.id === channelId);
  if (idx < 0) return state;
  const channels = state.channels.slice();
  channels[idx] = { ...channels[idx], [field]: !channels[idx][field] };
  return { ...state, channels };
}

function flipRollField(state: State, channelId: ChannelId, field: keyof Pick<PianoRollTrack, 'collapsed' | 'muted' | 'soloed'>): State {
  const idx = state.rolls.findIndex((r) => r.channelId === channelId);
  if (idx < 0) return state;
  const rolls = state.rolls.slice();
  rolls[idx] = { ...rolls[idx], [field]: !rolls[idx][field] };
  return { ...state, rolls };
}

function flipLaneField(state: State, channelId: ChannelId, kind: CCLaneKind, cc: number | undefined, field: keyof Pick<CCLane, 'collapsed' | 'muted' | 'soloed'>): State {
  const idx = state.lanes.findIndex((l) => l.channelId === channelId && l.kind === kind && l.cc === cc);
  if (idx < 0) return state;
  const lanes = state.lanes.slice();
  lanes[idx] = { ...lanes[idx], [field]: !lanes[idx][field] };
  return { ...state, lanes };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'channel/toggleCollapsed': return flipChannelField(state, action.channelId, 'collapsed');
    case 'channel/toggleMuted':     return flipChannelField(state, action.channelId, 'muted');
    case 'channel/toggleSoloed':    return flipChannelField(state, action.channelId, 'soloed');
    case 'roll/toggleCollapsed':    return flipRollField(state, action.channelId, 'collapsed');
    case 'roll/toggleMuted':        return flipRollField(state, action.channelId, 'muted');
    case 'roll/toggleSoloed':       return flipRollField(state, action.channelId, 'soloed');
    case 'lane/toggleCollapsed':    return flipLaneField(state, action.channelId, action.kind, action.cc, 'collapsed');
    case 'lane/toggleMuted':        return flipLaneField(state, action.channelId, action.kind, action.cc, 'muted');
    case 'lane/toggleSoloed':       return flipLaneField(state, action.channelId, action.kind, action.cc, 'soloed');
    case 'lane/add': {
      const exists = state.lanes.some((l) => l.channelId === action.channelId && l.kind === action.kind && l.cc === action.cc);
      if (exists) return state;
      const newLane: CCLane = {
        channelId: action.channelId,
        kind: action.kind,
        ...(action.kind === 'cc' && action.cc !== undefined ? { cc: action.cc } : {}),
        name: laneDefaultName(action.kind, action.cc),
        color: laneDefaultColor(action.kind),
        points: [],
        muted: false,
        soloed: false,
        collapsed: false,
      };
      return { ...state, lanes: [...state.lanes, newLane] };
    }
    default:
      return state;
  }
}

function laneDefaultColor(kind: CCLaneKind): string {
  switch (kind) {
    case 'cc':  return 'var(--mr-cc)';
    case 'pb':  return 'var(--mr-pitch)';
    case 'at':  return 'var(--mr-aftertouch)';
    case 'vel': return 'var(--mr-aftertouch)';
  }
}

/* ── Seeded default session ─────────────────────────────────────────────── */

function seed(totalT: number): State {
  const channels: Channel[] = [
    { id: 1, name: 'Lead', color: 'oklch(72% 0.14 240)', collapsed: false, muted: false, soloed: false },
    { id: 2, name: 'Bass', color: 'oklch(70% 0.16 30)',  collapsed: false, muted: false, soloed: false },
  ];
  const rolls: PianoRollTrack[] = [
    { channelId: 1, notes: makeNotes(22, 7),  muted: false, soloed: false, collapsed: false },
    { channelId: 2, notes: makeNotes(16, 11), muted: false, soloed: false, collapsed: false },
  ];
  const lanes: CCLane[] = [
    {
      channelId: 1, kind: 'cc', cc: 1,
      name: 'Mod Wheel', color: 'var(--mr-cc)',
      points: ccModWheel(totalT),
      muted: false, soloed: false, collapsed: false,
    },
    {
      channelId: 1, kind: 'pb',
      name: 'Pitch Bend', color: 'var(--mr-pitch)',
      points: ccPitchBend(totalT),
      muted: false, soloed: false, collapsed: false,
    },
    {
      channelId: 1, kind: 'vel',
      name: 'Note Velocity', color: 'var(--mr-aftertouch)',
      points: ccVelocity(totalT),
      muted: true, soloed: false, collapsed: false,
    },
  ];
  return { channels, rolls, lanes };
}

/* ── Audibility & solo predicates ───────────────────────────────────────── */

export function anySoloed(state: { channels: Channel[]; rolls: PianoRollTrack[]; lanes: CCLane[] }): boolean {
  return (
    state.channels.some((c) => c.soloed) ||
    state.rolls.some((r) => r.soloed) ||
    state.lanes.some((l) => l.soloed)
  );
}

/** True iff (channel.soloed) OR (no solo anywhere). */
export function isChannelAudible(channel: Channel, state: { channels: Channel[]; rolls: PianoRollTrack[]; lanes: CCLane[] }): boolean {
  if (!anySoloed(state)) return true;
  return channel.soloed;
}

/** True iff (roll.soloed) OR (parent channel.soloed) OR (no solo anywhere). */
export function isRollAudible(roll: PianoRollTrack, state: { channels: Channel[]; rolls: PianoRollTrack[]; lanes: CCLane[] }): boolean {
  if (!anySoloed(state)) return true;
  if (roll.soloed) return true;
  const channel = state.channels.find((c) => c.id === roll.channelId);
  return !!channel?.soloed;
}

/** True iff (lane.soloed) OR (parent channel.soloed) OR (no solo anywhere). */
export function isLaneAudible(lane: CCLane, state: { channels: Channel[]; rolls: PianoRollTrack[]; lanes: CCLane[] }): boolean {
  if (!anySoloed(state)) return true;
  if (lane.soloed) return true;
  const channel = state.channels.find((c) => c.id === lane.channelId);
  return !!channel?.soloed;
}

/** True iff a channel has any visible content (notes or non-empty CC plots). */
export function channelHasContent(channel: Channel, rolls: PianoRollTrack[], lanes: CCLane[]): boolean {
  const roll = rolls.find((r) => r.channelId === channel.id);
  if (roll && roll.notes.length > 0) return true;
  return lanes.some((l) => l.channelId === channel.id && l.points.length > 0);
}

/* ── Hook ───────────────────────────────────────────────────────────────── */

export interface UseChannelsReturn {
  channels: Channel[];
  rolls: PianoRollTrack[];
  lanes: CCLane[];
  toggleChannelCollapsed: (id: ChannelId) => void;
  toggleChannelMuted: (id: ChannelId) => void;
  toggleChannelSoloed: (id: ChannelId) => void;
  toggleRollCollapsed: (channelId: ChannelId) => void;
  toggleRollMuted: (channelId: ChannelId) => void;
  toggleRollSoloed: (channelId: ChannelId) => void;
  toggleLaneCollapsed: (channelId: ChannelId, kind: CCLaneKind, cc?: number) => void;
  toggleLaneMuted: (channelId: ChannelId, kind: CCLaneKind, cc?: number) => void;
  toggleLaneSoloed: (channelId: ChannelId, kind: CCLaneKind, cc?: number) => void;
  addCCLane: (channelId: ChannelId, kind: CCLaneKind, cc?: number) => void;
}

export function useChannels(totalT: number): UseChannelsReturn {
  const initial = useMemo(() => seed(totalT), [totalT]);
  const [state, dispatch] = useReducer(reducer, initial);

  return {
    channels: state.channels,
    rolls: state.rolls,
    lanes: state.lanes,
    toggleChannelCollapsed: useCallback((id) => dispatch({ type: 'channel/toggleCollapsed', channelId: id }), []),
    toggleChannelMuted:     useCallback((id) => dispatch({ type: 'channel/toggleMuted',     channelId: id }), []),
    toggleChannelSoloed:    useCallback((id) => dispatch({ type: 'channel/toggleSoloed',    channelId: id }), []),
    toggleRollCollapsed:    useCallback((id) => dispatch({ type: 'roll/toggleCollapsed',    channelId: id }), []),
    toggleRollMuted:        useCallback((id) => dispatch({ type: 'roll/toggleMuted',        channelId: id }), []),
    toggleRollSoloed:       useCallback((id) => dispatch({ type: 'roll/toggleSoloed',       channelId: id }), []),
    toggleLaneCollapsed:    useCallback((id, kind, cc) => dispatch({ type: 'lane/toggleCollapsed', channelId: id, kind, cc }), []),
    toggleLaneMuted:        useCallback((id, kind, cc) => dispatch({ type: 'lane/toggleMuted',     channelId: id, kind, cc }), []),
    toggleLaneSoloed:       useCallback((id, kind, cc) => dispatch({ type: 'lane/toggleSoloed',    channelId: id, kind, cc }), []),
    addCCLane:              useCallback((id, kind, cc) => dispatch({ type: 'lane/add', channelId: id, kind, cc, totalT }), [totalT]),
  };
}
