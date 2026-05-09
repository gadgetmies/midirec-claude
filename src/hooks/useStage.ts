import { useMemo } from 'react';
import type { Marquee } from '../components/piano-roll/notes';
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
  soloing: boolean;
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

export function useStage(): StageState {
  const { timecodeMs, bpm } = useTransport();
  const channels = useChannels(TOTAL_T);

  const demoMarquee = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.location.search.includes('demo=marquee');
  }, []);

  const beatsElapsed = (timecodeMs / 1000) * (bpm / 60);
  // TODO: remove the modular wrap once the scroll/zoom slice lands; per the
  // session-model contract, non-looping playback advances forever.
  const playheadT = ((beatsElapsed % TOTAL_T) + TOTAL_T) % TOTAL_T;

  const marquee: Marquee | null = demoMarquee
    ? { t0: 3.5, t1: 8.5, p0: 56, p1: 69 }
    : null;
  const selectedIdx = demoMarquee ? undefined : [];
  const selectedChannelId: ChannelId | null = demoMarquee ? 1 : null;

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
    soloing,
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
