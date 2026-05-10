import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Marquee } from '../components/piano-roll/notes';
import { notesInMarquee } from '../components/piano-roll/notes';
import { useTransport } from './useTransport';
import {
  useChannels,
  anySoloed,
  channelHasContent,
  type Channel,
  type ChannelId,
  type PianoRollTrack,
  type ParamLane,
  type ParamLaneKind,
} from './useChannels';

export interface ResolvedSelection {
  channelId: ChannelId;
  indexes: number[];
}

export interface LoopRegion {
  start: number;
  end: number;
}

export interface StageState {
  channels: Channel[];
  rolls: PianoRollTrack[];
  lanes: ParamLane[];
  visibleChannels: Channel[];
  selectedChannelId: ChannelId | null;
  lo: number;
  hi: number;
  totalT: number;
  playheadT: number;
  marquee: Marquee | null;
  selectedIdx: number[] | undefined;
  resolvedSelection: ResolvedSelection | null;
  loopRegion: LoopRegion | null;
  soloing: boolean;
  dialogOpen: boolean;
  openExportDialog: () => void;
  closeExportDialog: () => void;
  toggleChannelCollapsed: (id: ChannelId) => void;
  toggleChannelMuted: (id: ChannelId) => void;
  toggleChannelSoloed: (id: ChannelId) => void;
  toggleRollCollapsed: (id: ChannelId) => void;
  toggleRollMuted: (id: ChannelId) => void;
  toggleRollSoloed: (id: ChannelId) => void;
  toggleLaneCollapsed: (id: ChannelId, kind: ParamLaneKind, cc?: number) => void;
  toggleLaneMuted: (id: ChannelId, kind: ParamLaneKind, cc?: number) => void;
  toggleLaneSoloed: (id: ChannelId, kind: ParamLaneKind, cc?: number) => void;
  addParamLane: (id: ChannelId, kind: ParamLaneKind, cc?: number) => void;
}

const TOTAL_T = 16;
const LO = 48;
const HI = 76;
const DEMO_NOTE_IDX = 3;

function useStageState(): StageState {
  const { timecodeMs, bpm } = useTransport();
  const channels = useChannels(TOTAL_T);

  const [dialogOpen, setDialogOpen] = useState(false);
  const openExportDialog = useCallback(() => setDialogOpen(true), []);
  const closeExportDialog = useCallback(() => setDialogOpen(false), []);

  const { demoMarquee, demoNote } = useMemo(() => {
    if (typeof window === 'undefined') return { demoMarquee: false, demoNote: false };
    const search = window.location.search;
    const marquee = search.includes('demo=marquee');
    const note = !marquee && search.includes('demo=note');
    return { demoMarquee: marquee, demoNote: note };
  }, []);

  const beatsElapsed = (timecodeMs / 1000) * (bpm / 60);
  // TODO: remove the modular wrap once the scroll/zoom slice lands; per the
  // session-model contract, non-looping playback advances forever.
  const playheadT = ((beatsElapsed % TOTAL_T) + TOTAL_T) % TOTAL_T;

  const marquee: Marquee | null = demoMarquee
    ? { t0: 3.5, t1: 8.5, p0: 56, p1: 69 }
    : null;
  const selectedIdx: number[] | undefined = demoMarquee
    ? undefined
    : demoNote
      ? [DEMO_NOTE_IDX]
      : [];
  const selectedChannelId: ChannelId | null = demoMarquee || demoNote ? 1 : null;

  const resolvedSelection = useMemo<ResolvedSelection | null>(() => {
    if (selectedChannelId === null) return null;
    if (selectedIdx && selectedIdx.length > 0) {
      return { channelId: selectedChannelId, indexes: selectedIdx };
    }
    if (marquee !== null) {
      const roll = channels.rolls.find((r) => r.channelId === selectedChannelId);
      if (!roll) return null;
      const indexes = notesInMarquee(roll.notes, marquee);
      if (indexes.length === 0) return null;
      return { channelId: selectedChannelId, indexes };
    }
    return null;
  }, [selectedChannelId, selectedIdx, marquee, channels.rolls]);

  const visibleChannels = useMemo(
    () => channels.channels.filter((c) => channelHasContent(c, channels.rolls, channels.lanes)),
    [channels.channels, channels.rolls, channels.lanes],
  );
  const soloing = useMemo(() => anySoloed(channels), [channels]);

  return {
    channels: channels.channels,
    rolls: channels.rolls,
    lanes: channels.lanes,
    visibleChannels,
    selectedChannelId,
    lo: LO,
    hi: HI,
    totalT: TOTAL_T,
    playheadT,
    marquee,
    selectedIdx,
    resolvedSelection,
    loopRegion: null,
    soloing,
    dialogOpen,
    openExportDialog,
    closeExportDialog,
    toggleChannelCollapsed: channels.toggleChannelCollapsed,
    toggleChannelMuted: channels.toggleChannelMuted,
    toggleChannelSoloed: channels.toggleChannelSoloed,
    toggleRollCollapsed: channels.toggleRollCollapsed,
    toggleRollMuted: channels.toggleRollMuted,
    toggleRollSoloed: channels.toggleRollSoloed,
    toggleLaneCollapsed: channels.toggleLaneCollapsed,
    toggleLaneMuted: channels.toggleLaneMuted,
    toggleLaneSoloed: channels.toggleLaneSoloed,
    addParamLane: channels.addParamLane,
  };
}

const StageContext = createContext<StageState | null>(null);

export function StageProvider({ children }: { children: ReactNode }) {
  const stage = useStageState();
  return <StageContext.Provider value={stage}>{children}</StageContext.Provider>;
}

export function useStage(): StageState {
  const ctx = useContext(StageContext);
  if (!ctx) {
    throw new Error('useStage must be used inside <StageProvider>');
  }
  return ctx;
}
