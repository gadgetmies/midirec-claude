import { useMemo } from 'react';
import { PianoKeys } from './PianoKeys';
import { isBlackKey, notesInMarquee, type Marquee, type Note } from './notes';
import './PianoRoll.css';

export const KEYS_COLUMN_WIDTH = 56;
export const DEFAULT_PX_PER_BEAT = 88;
export const DEFAULT_ROW_HEIGHT = 14;

interface PianoRollProps {
  notes: Note[];
  lo?: number;
  hi?: number;
  totalT?: number;
  playheadT?: number;
  pxPerBeat?: number;
  rowHeight?: number;
  marquee?: Marquee | null;
  selectedIdx?: number[];
  trackColor?: string;
  accent?: 'note';
}

export function PianoRoll({
  notes,
  lo = 48,
  hi = 76,
  totalT = 16,
  playheadT = 0,
  pxPerBeat = DEFAULT_PX_PER_BEAT,
  rowHeight = DEFAULT_ROW_HEIGHT,
  marquee = null,
  selectedIdx,
  trackColor,
}: PianoRollProps) {
  const range = hi - lo;
  const height = range * rowHeight;
  const lanesWidth = totalT * pxPerBeat;
  const width = KEYS_COLUMN_WIDTH + lanesWidth;

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
  for (let i = 0; i <= totalT; i++) {
    const major = i % 4 === 0;
    ticks.push(
      <div
        key={`t${i}`}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: i * pxPerBeat,
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
    const left = n.t * pxPerBeat;
    const w = Math.max(2, n.dur * pxPerBeat);
    const h = Math.max(5, rowHeight - 2);
    const sel = effectiveSel.includes(i);
    let background: string;
    if (sel) {
      background = 'var(--mr-note-sel)';
    } else if (trackColor) {
      background = `color-mix(in oklab, ${trackColor} ${50 + n.vel * 50}%, transparent)`;
    } else {
      background = `oklch(68% ${0.06 + n.vel * 0.1} 240 / ${0.5 + n.vel * 0.5})`;
    }
    noteEls.push(
      <div
        key={`n${i}`}
        className="mr-note"
        data-sel={sel ? 'true' : undefined}
        style={{ top, left, width: w, height: h, background }}
      />,
    );
  });

  let marqueeEl: JSX.Element | null = null;
  let marqueeBadge: JSX.Element | null = null;
  if (marquee) {
    const x0 = Math.min(marquee.t0, marquee.t1) * pxPerBeat;
    const x1 = Math.max(marquee.t0, marquee.t1) * pxPerBeat;
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
    marqueeBadge = (
      <div className="mr-marquee__badge" style={{ left: x1 + 6, top: yTop }}>
        <span className="mr-marquee__count">{effectiveSel.length}</span>
        <span className="mr-marquee__lbl">selected</span>
      </div>
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
        <div className="mr-playhead" style={{ left: playheadT * pxPerBeat }} />
        {marqueeBadge}
      </div>
    </div>
  );
}
