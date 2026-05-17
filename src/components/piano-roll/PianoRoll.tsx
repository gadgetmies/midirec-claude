import { useMemo } from 'react';
import type { PointerEventHandler } from 'react';
import { GRID_TICK_THINNING_THRESHOLD_TICKS } from '../../session/layoutHorizon';
import { beatsToSessionTicks } from '../../midi/sessionTicks';
import { DEFAULT_MIDI_TPQ } from '../../midi/timelineTicks';
import { PianoKeys } from './PianoKeys';
import { isBlackKey, notesInMarquee, type Marquee, type Note } from './notes';
import './PianoRoll.css';

export const KEYS_COLUMN_WIDTH = 56;
export const DEFAULT_PX_PER_BEAT = 88;
export const DEFAULT_ROW_HEIGHT = 14;

export function pxPerTickFromPxPerBeat(pxPerBeat: number, tpq: number = DEFAULT_MIDI_TPQ): number {
  return pxPerBeat / tpq;
}

interface PianoRollProps {
  notes: Note[];
  lo?: number;
  hi?: number;
  totalT?: number;
  /** Timeline stripe extent in MIDI ticks (preferred). */
  layoutHorizonTicks?: number;
  /** Legacy beat extent — used when `layoutHorizonTicks` is omitted. */
  layoutHorizonBeats?: number;
  viewT0Ticks?: number;
  playheadTicks?: number;
  playheadT?: number;
  pxPerBeat?: number;
  rowHeight?: number;
  marquee?: Marquee | null;
  selectedIdx?: number[];
  /** When set, user activation on a `.mr-note` selects that index upstream. */
  onNoteSelect?: (noteIndex: number) => void;
  trackColor?: string;
  accent?: 'note';
}

export function PianoRoll({
  notes,
  lo = 48,
  hi = 76,
  totalT = 16,
  layoutHorizonTicks: layoutHorizonTicksProp,
  layoutHorizonBeats: layoutHorizonBeatsProp,
  viewT0Ticks = 0,
  playheadTicks: playheadTicksProp,
  playheadT = 0,
  pxPerBeat = DEFAULT_PX_PER_BEAT,
  rowHeight = DEFAULT_ROW_HEIGHT,
  marquee = null,
  selectedIdx,
  trackColor,
  onNoteSelect,
}: PianoRollProps) {
  const tpq = DEFAULT_MIDI_TPQ;
  const pxPerTick = pxPerTickFromPxPerBeat(pxPerBeat, tpq);
  const stripeTicks =
    layoutHorizonTicksProp ??
    beatsToSessionTicks(layoutHorizonBeatsProp ?? totalT, tpq);
  const thin = stripeTicks > GRID_TICK_THINNING_THRESHOLD_TICKS;
  const range = hi - lo;
  const height = range * rowHeight;
  const lanesWidth = stripeTicks * pxPerTick;
  const width = KEYS_COLUMN_WIDTH + lanesWidth;

  const playheadTicksResolved =
    playheadTicksProp ?? beatsToSessionTicks(playheadT, tpq);

  const effectiveSel = useMemo<number[]>(() => {
    if (selectedIdx) return selectedIdx;
    if (marquee) return notesInMarquee(notes, marquee);
    return [];
  }, [notes, marquee, selectedIdx]);

  const lanes: JSX.Element[] = [];
  for (let p = lo; p < hi; p++) {
    const idx = p - lo;
    const top = height - (idx + 1) * rowHeight;
    lanes.push(
      <div
        key={p}
        className="mr-lane"
        data-black={isBlackKey(p) ? 'true' : undefined}
        style={{ top, height: rowHeight }}
      />,
    );
  }

  const ticks: JSX.Element[] = [];
  for (let tTicks = 0; tTicks <= stripeTicks; tTicks += tpq) {
    const beatIdx = tTicks / tpq;
    if (thin && beatIdx !== 0 && tTicks !== stripeTicks && beatIdx % 4 !== 0) {
      continue;
    }
    const major = beatIdx % 4 === 0;
    ticks.push(
      <div
        key={`t${tTicks}`}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: (tTicks - viewT0Ticks) * pxPerTick,
          width: 1,
          background: major ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.025)',
        }}
      />,
    );
  }

  const noteEls: JSX.Element[] = [];
  notes.forEach((n, i) => {
    if (n.pitch < lo || n.pitch >= hi) return;
    const idx = n.pitch - lo;
    const top = height - (idx + 1) * rowHeight + 1;
    const left = (n.tTicks - viewT0Ticks) * pxPerTick;
    const w = Math.max(2, n.durTicks * pxPerTick);
    const h = Math.max(5, rowHeight - 2);
    const sel = effectiveSel.includes(i);
    let background: string;
    if (trackColor) {
      background = `color-mix(in oklab, ${trackColor} ${50 + n.vel * 50}%, transparent)`;
    } else {
      background = `oklch(68% ${0.06 + n.vel * 0.1} 240 / ${0.5 + n.vel * 0.5})`;
    }

    const onPointerDownNote: PointerEventHandler<HTMLDivElement> | undefined =
      onNoteSelect === undefined
        ? undefined
        : (e) => {
            e.stopPropagation();
            onNoteSelect(i);
          };

    noteEls.push(
      <div
        key={`n${i}`}
        className={`mr-note${onNoteSelect ? ' mr-note--hit' : ''}`}
        data-sel={sel ? 'true' : undefined}
        data-selected={sel ? 'true' : undefined}
        onPointerDown={onPointerDownNote}
        style={{
          top,
          left,
          width: w,
          height: h,
          background,
        }}
      />,
    );
  });

  let marqueeEl: JSX.Element | null = null;
  if (marquee) {
    const x0 =
      Math.min(marquee.t0Ticks - viewT0Ticks, marquee.t1Ticks - viewT0Ticks) * pxPerTick;
    const x1 =
      Math.max(marquee.t0Ticks - viewT0Ticks, marquee.t1Ticks - viewT0Ticks) * pxPerTick;
    const pTop = Math.max(marquee.p0, marquee.p1);
    const pBot = Math.min(marquee.p0, marquee.p1);
    const yTop = height - (pTop - lo + 1) * rowHeight;
    const yBot = height - (pBot - lo) * rowHeight;
    const mw = x1 - x0;
    const mh = yBot - yTop;
    marqueeEl = (
      <svg
        className="mr-marquee"
        style={{ left: x0, top: yTop, width: mw, height: mh }}
        width={mw}
        height={mh}
      >
        <rect
          className="mr-marquee__rect"
          x="0.5"
          y="0.5"
          width={Math.max(0, mw - 1)}
          height={Math.max(0, mh - 1)}
        />
      </svg>
    );
  }

  return (
    <div className="mr-roll" style={{ width, height }}>
      <PianoKeys rowHeight={rowHeight} lo={lo} hi={hi} />
      <div className="mr-roll__lanes" style={{ width: lanesWidth }}>
        {lanes}
        {ticks}
        {noteEls}
        {marqueeEl}
        <div
          className="mr-playhead"
          style={{ left: (playheadTicksResolved - viewT0Ticks) * pxPerTick }}
        />
      </div>
    </div>
  );
}
