import { useMemo } from 'react';
import { makeNotes, type Marquee, type Note } from '../components/piano-roll/notes';
import { useTransport } from './useTransport';

export interface StageState {
  notes: Note[];
  lo: number;
  hi: number;
  totalT: number;
  playheadT: number;
  marquee: Marquee | null;
  selectedIdx: number[] | undefined;
}

const TOTAL_T = 16;
const LO = 48;
const HI = 76;

export function useStage(): StageState {
  const { timecodeMs, bpm } = useTransport();

  const notes = useMemo(() => makeNotes(38, 7), []);

  const demoMarquee = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.location.search.includes('demo=marquee');
  }, []);

  const beatsElapsed = (timecodeMs / 1000) * (bpm / 60);
  const playheadT = ((beatsElapsed % TOTAL_T) + TOTAL_T) % TOTAL_T;

  const marquee: Marquee | null = demoMarquee
    ? { t0: 3.5, t1: 8.5, p0: 56, p1: 69 }
    : null;
  const selectedIdx = demoMarquee ? undefined : [];

  return {
    notes,
    lo: LO,
    hi: HI,
    totalT: TOTAL_T,
    playheadT,
    marquee,
    selectedIdx,
  };
}
