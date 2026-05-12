import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Marquee, Note } from '../components/piano-roll/notes';
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
import {
  useDJActionTracks,
  anyDJTrackSoloed,
  type DJActionTrack,
  type DJTrackId,
} from './useDJActionTracks';
import type {
  ActionEvent,
  ActionMapEntry,
  OutputMapping,
  PressurePoint,
  PressureRenderMode,
} from '../data/dj';

export interface DJActionSelection {
  trackId: DJTrackId;
  pitch: number;
}

export interface DJEventSelection {
  trackId: DJTrackId;
  pitch: number;
  /* Index into `track.events`. Fragile to future reorder/insert operations;
     migrate to a stable event id when capture lands in Slice 10. */
  eventIdx: number;
}

export type TimelineTrackSelection =
  | { kind: 'channel'; channelId: ChannelId }
  | { kind: 'dj'; trackId: DJTrackId };

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
  djActionTracks: DJActionTrack[];
  djActionSelection: DJActionSelection | null;
  setDJActionSelection: (target: DJActionSelection | null) => void;
  djEventSelection: DJEventSelection | null;
  setDJEventSelection: (target: DJEventSelection | null) => void;
  pressureRenderMode: PressureRenderMode;
  setPressureRenderMode: (mode: PressureRenderMode) => void;
  setActionEntry: (id: DJTrackId, pitch: number, entry: ActionMapEntry) => void;
  deleteActionEntry: (id: DJTrackId, pitch: number) => void;
  setOutputMapping: (id: DJTrackId, pitch: number, mapping: OutputMapping) => void;
  deleteOutputMapping: (id: DJTrackId, pitch: number) => void;
  setEventPressure: (id: DJTrackId, pitch: number, eventIdx: number, points: PressurePoint[]) => void;
  clearEventPressure: (id: DJTrackId, pitch: number, eventIdx: number) => void;
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
  appendNote: (id: ChannelId, note: Note) => void;
  addChannel: (id: ChannelId, name?: string, color?: string) => void;
  selectedTimelineTrack: TimelineTrackSelection | null;
  setSelectedTimelineTrack: (s: TimelineTrackSelection | null) => void;
  setChannelInputSourceChannels: (channelId: ChannelId, inputDeviceId: string, channels: ChannelId[]) => void;
  setDJTrackDefaultMidiInputDevice: (trackId: DJTrackId, inputDeviceId: string) => void;
  appendDJActionEvent: (trackId: DJTrackId, event: ActionEvent) => void;
  toggleDJTrackCollapsed: (id: DJTrackId) => void;
  toggleDJTrackMuted: (id: DJTrackId) => void;
  toggleDJTrackSoloed: (id: DJTrackId) => void;
  toggleDJTrackRowMuted: (id: DJTrackId, pitch: number) => void;
  toggleDJTrackRowSoloed: (id: DJTrackId, pitch: number) => void;
}

const TOTAL_T = 16;
const LO = 48;
const HI = 76;
const DEMO_NOTE_IDX = 3;

function useStageState(): StageState {
  const { timecodeMs, bpm } = useTransport();
  const demoClean = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.location.search.includes('demo=clean');
  }, []);
  const channels = useChannels(TOTAL_T, demoClean);
  const djTracks = useDJActionTracks();

  const [dialogOpen, setDialogOpen] = useState(false);
  const openExportDialog = useCallback(() => setDialogOpen(true), []);
  const closeExportDialog = useCallback(() => setDialogOpen(false), []);

  const [djActionSelection, setDJActionSelection] = useState<DJActionSelection | null>(null);
  const [djEventSelection, setDJEventSelection] = useState<DJEventSelection | null>(null);
  const [pressureRenderMode, setPressureRenderMode] = useState<PressureRenderMode>('curve');
  const [selectedTimelineTrack, setSelectedTimelineTrack] = useState<TimelineTrackSelection | null>(null);

  useEffect(() => {
    if (!selectedTimelineTrack) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      if (!target.closest('.mr-timeline')) return;
      if (
        target.closest('.mr-channel__hdr') ||
        target.closest('.mr-track__hdr') ||
        target.closest('.mr-djtrack__hdr')
      ) {
        return;
      }
      setSelectedTimelineTrack(null);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [selectedTimelineTrack]);

  /* Blur both DJ selections (row + event) when the user clicks outside the
     track or the side panels. Surfaces opt in by carrying
     `data-mr-dj-selection-region="true"` (the sidebar Map Note panel, the
     inspector Action+Output panel, and the Inspector pressure section
     inside it); the DJ track itself is identified by `.mr-djtrack`. The
     listener is only active while at least one selection exists. The two
     selections clear atomically — both setters fire in the same handler
     tick, and React batches the resulting renders. */
  useEffect(() => {
    if (!djActionSelection && !djEventSelection) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      if (target.closest('.mr-djtrack')) return;
      if (target.closest('[data-mr-dj-selection-region]')) return;
      setDJActionSelection(null);
      setDJEventSelection(null);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [djActionSelection, djEventSelection]);

  /* deleteActionEntry from useDJActionTracks prunes the actionMap (and the
     pitch's outputMap/row state). We additionally clear djActionSelection
     and djEventSelection when they point at the just-deleted pitch so the
     sidebar/inspector panels don't keep pointing at a now-missing entry. */
  const deleteActionEntry = useCallback(
    (id: DJTrackId, pitch: number) => {
      djTracks.deleteActionEntry(id, pitch);
      setDJActionSelection((cur) =>
        cur && cur.trackId === id && cur.pitch === pitch ? null : cur,
      );
      setDJEventSelection((cur) =>
        cur && cur.trackId === id && cur.pitch === pitch ? null : cur,
      );
    },
    [djTracks],
  );

  const { demoMarquee, demoNote } = useMemo(() => {
    if (typeof window === 'undefined') return { demoMarquee: false, demoNote: false };
    const search = window.location.search;
    const marquee = search.includes('demo=marquee');
    const note = !marquee && search.includes('demo=note');
    return { demoMarquee: marquee, demoNote: note };
  }, []);

  // Non-looping playback advances forever — let the playhead exceed TOTAL_T
  // rather than wrap back to 0. Visual overflow (cursor off the right edge of
  // the rendered timeline) is the lesser evil vs. an unrequested loop. Loop
  // wrap belongs to the transport tick reducer once loopRegion is real.
  const playheadT = (timecodeMs / 1000) * (bpm / 60);

  const marquee: Marquee | null = demoMarquee
    ? { t0: 3.5, t1: 8.5, p0: 56, p1: 69 }
    : null;
  const selectedIdx: number[] | undefined = demoMarquee
    ? undefined
    : demoNote
      ? [DEMO_NOTE_IDX]
      : [];
  const selectedChannelId: ChannelId | null = demoMarquee || demoNote || demoClean ? 1 : null;

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
  const soloing = useMemo(
    () => anySoloed(channels) || anyDJTrackSoloed(djTracks.djActionTracks),
    [channels, djTracks.djActionTracks],
  );

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
    appendNote: channels.appendNote,
    addChannel: channels.addChannel,
    selectedTimelineTrack,
    setSelectedTimelineTrack,
    setChannelInputSourceChannels: channels.setChannelInputSourceChannels,
    setDJTrackDefaultMidiInputDevice: djTracks.setDJTrackDefaultMidiInputDevice,
    appendDJActionEvent: djTracks.appendDJActionEvent,
    djActionTracks: djTracks.djActionTracks,
    djActionSelection,
    setDJActionSelection,
    djEventSelection,
    setDJEventSelection,
    pressureRenderMode,
    setPressureRenderMode,
    setActionEntry: djTracks.setActionEntry,
    deleteActionEntry,
    setOutputMapping: djTracks.setOutputMapping,
    deleteOutputMapping: djTracks.deleteOutputMapping,
    setEventPressure: djTracks.setEventPressure,
    clearEventPressure: djTracks.clearEventPressure,
    toggleDJTrackCollapsed: djTracks.toggleDJTrackCollapsed,
    toggleDJTrackMuted: djTracks.toggleDJTrackMuted,
    toggleDJTrackSoloed: djTracks.toggleDJTrackSoloed,
    toggleDJTrackRowMuted: djTracks.toggleDJTrackRowMuted,
    toggleDJTrackRowSoloed: djTracks.toggleDJTrackRowSoloed,
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
