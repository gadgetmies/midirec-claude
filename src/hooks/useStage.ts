import { useMemo } from 'react';
import type { Marquee } from '../components/piano-roll/notes';
import { useTransport } from './useTransport';
import { useTracks, type Track } from './useTracks';

export interface StageState {
  tracks: Track[];
  selectedTrackId: string | null;
  lo: number;
  hi: number;
  totalT: number;
  playheadT: number;
  marquee: Marquee | null;
  selectedIdx: number[] | undefined;
  toggleTrackOpen: (id: string) => void;
  toggleTrackMuted: (id: string) => void;
  toggleTrackSoloed: (id: string) => void;
}

const TOTAL_T = 16;
const LO = 48;
const HI = 76;

export function useStage(): StageState {
  const { timecodeMs, bpm } = useTransport();
  const { tracks, toggleTrackOpen, toggleTrackMuted, toggleTrackSoloed } = useTracks();

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
  const selectedTrackId = demoMarquee ? 't1' : null;

  return {
    tracks,
    selectedTrackId,
    lo: LO,
    hi: HI,
    totalT: TOTAL_T,
    playheadT,
    marquee,
    selectedIdx,
    toggleTrackOpen,
    toggleTrackMuted,
    toggleTrackSoloed,
  };
}
