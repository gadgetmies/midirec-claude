import { describe, expect, test, vi, afterEach, beforeAll } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { PianoRoll } from './PianoRoll';
import type { Note } from './notes';
import { beatsToSessionTicks } from '../../midi/sessionTicks';

afterEach(() => {
  cleanup();
});

beforeAll(() => {
  /* jsdom doesn't implement pointer capture; stub so the drag state machine
     can call setPointerCapture / hasPointerCapture / releasePointerCapture. */
  const proto = Element.prototype as unknown as {
    setPointerCapture?: (pointerId: number) => void;
    releasePointerCapture?: (pointerId: number) => void;
    hasPointerCapture?: (pointerId: number) => boolean;
  };
  if (typeof proto.setPointerCapture !== 'function') {
    const captured = new WeakMap<Element, Set<number>>();
    proto.setPointerCapture = function (this: Element, pointerId: number) {
      let set = captured.get(this);
      if (!set) {
        set = new Set();
        captured.set(this, set);
      }
      set.add(pointerId);
    };
    proto.releasePointerCapture = function (this: Element, pointerId: number) {
      captured.get(this)?.delete(pointerId);
    };
    proto.hasPointerCapture = function (this: Element, pointerId: number) {
      return captured.get(this)?.has(pointerId) ?? false;
    };
  }
});

function oneNote(overrides: Partial<Note> = {}): Note[] {
  return [
    {
      tTicks: 0,
      durTicks: beatsToSessionTicks(1),
      pitch: 60,
      vel: 0.5,
      ...overrides,
    },
  ];
}

describe('PianoRoll', () => {
  test('selection uses velocity/track fill and exposes data-selected chrome', () => {
    render(<PianoRoll notes={oneNote()} selectedIdx={[0]} trackColor="oklch(70% 0.16 30)" />);
    const noteEl = document.querySelector('.mr-note');
    expect(noteEl?.getAttribute('data-selected')).toBe('true');
    expect(noteEl?.getAttribute('data-sel')).toBe('true');
    const bg = (noteEl as HTMLElement | undefined)?.style.background ?? '';
    expect(bg).toMatch(/color-mix\(in oklab, oklch\(0\.7 .* 30\) 75%, transparent\)/);
    expect(bg).not.toContain('mr-note-sel');
  });

  test('pointerdown on a note calls onNoteSelect with index', () => {
    const onNoteSelect = vi.fn();
    render(<PianoRoll notes={oneNote()} onNoteSelect={onNoteSelect} />);
    const note = document.querySelector('.mr-note');
    expect(note).toBeTruthy();
    fireEvent.pointerDown(note as Element);
    expect(onNoteSelect).toHaveBeenCalledTimes(1);
    expect(onNoteSelect).toHaveBeenCalledWith(0);
  });

  test('tiles are not flagged hit targets without callback', () => {
    render(<PianoRoll notes={oneNote()} />);
    expect(document.querySelector('.mr-note--hit')).toBeNull();
  });
});

describe('PianoRoll drag-to-move', () => {
  test('sub-threshold pointer motion fires onNoteSelect, not onNoteMove', () => {
    const onNoteSelect = vi.fn();
    const onNoteMove = vi.fn();
    render(
      <PianoRoll
        notes={oneNote()}
        onNoteSelect={onNoteSelect}
        onNoteMove={onNoteMove}
      />,
    );
    const note = document.querySelector('.mr-note') as Element;
    fireEvent.pointerDown(note, { pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(note, { pointerId: 1, clientX: 102 });
    fireEvent.pointerUp(note, { pointerId: 1, clientX: 102 });
    expect(onNoteSelect).toHaveBeenCalledTimes(1);
    expect(onNoteSelect).toHaveBeenCalledWith(0);
    expect(onNoteMove).not.toHaveBeenCalled();
  });

  test('quantize-on snaps the delta to grid on commit', () => {
    const onNoteSelect = vi.fn();
    const onNoteMove = vi.fn();
    render(
      <PianoRoll
        notes={oneNote()}
        onNoteSelect={onNoteSelect}
        onNoteMove={onNoteMove}
        quantizeOn
        quantizeGrid="1/4"
        pxPerBeat={88}
      />,
    );
    const note = document.querySelector('.mr-note') as Element;
    fireEvent.pointerDown(note, { pointerId: 1, clientX: 0 });
    fireEvent.pointerMove(note, { pointerId: 1, clientX: 540 });
    fireEvent.pointerUp(note, { pointerId: 1, clientX: 540 });
    /* pxPerTick = 88/480 ≈ 0.1833 → deltaTicksRaw = round(540 / 0.1833) = 2945
       → deltaTicks = round(2945 / 480) * 480 = 2880, finalTick = 0 + 2880 = 2880. */
    expect(onNoteMove).toHaveBeenCalledTimes(1);
    expect(onNoteMove).toHaveBeenCalledWith(0, 2880);
    expect(onNoteSelect).not.toHaveBeenCalled();
  });

  test('off-grid note preserves its offset when snap-dragged', () => {
    const onNoteMove = vi.fn();
    render(
      <PianoRoll
        notes={oneNote({ tTicks: 154 })}
        onNoteMove={onNoteMove}
        quantizeOn
        quantizeGrid="1/16"
        pxPerBeat={88}
      />,
    );
    const note = document.querySelector('.mr-note') as Element;
    fireEvent.pointerDown(note, { pointerId: 1, clientX: 0 });
    fireEvent.pointerMove(note, { pointerId: 1, clientX: 22 });
    fireEvent.pointerUp(note, { pointerId: 1, clientX: 22 });
    /* deltaTicksRaw = round(22 / (88/480)) = 120, snapped delta = 120 (1/16),
       finalTick = 154 + 120 = 274 — original 34-tick offset preserved. */
    expect(onNoteMove).toHaveBeenCalledTimes(1);
    expect(onNoteMove).toHaveBeenCalledWith(0, 274);
    expect(274 % 120).toBe(34);
  });

  test('quantize-off commits raw pixel-converted ticks', () => {
    const onNoteMove = vi.fn();
    render(
      <PianoRoll
        notes={oneNote({ tTicks: 120 })}
        onNoteMove={onNoteMove}
        quantizeOn={false}
        pxPerBeat={88}
      />,
    );
    const note = document.querySelector('.mr-note') as Element;
    fireEvent.pointerDown(note, { pointerId: 1, clientX: 0 });
    fireEvent.pointerMove(note, { pointerId: 1, clientX: 100 });
    fireEvent.pointerUp(note, { pointerId: 1, clientX: 100 });
    /* round(100 / (88/480)) = round(545.45...) = 545. 120 + 545 = 665. */
    expect(onNoteMove).toHaveBeenCalledTimes(1);
    const [idx, tick] = onNoteMove.mock.calls[0]!;
    expect(idx).toBe(0);
    /* Spec text mentions 666 as the example value but uses round(100 / 0.1833…) = 546.
       The exact value is round(100 / (88/480)) — accept the precise integer. */
    expect(tick).toBe(120 + Math.round(100 / (88 / 480)));
  });

  test('drag past the left edge clamps tick to 0', () => {
    const onNoteMove = vi.fn();
    render(
      <PianoRoll
        notes={oneNote({ tTicks: 240 })}
        onNoteMove={onNoteMove}
        pxPerBeat={88}
      />,
    );
    const note = document.querySelector('.mr-note') as Element;
    fireEvent.pointerDown(note, { pointerId: 1, clientX: 200 });
    fireEvent.pointerMove(note, { pointerId: 1, clientX: -800 });
    fireEvent.pointerUp(note, { pointerId: 1, clientX: -800 });
    expect(onNoteMove).toHaveBeenCalledTimes(1);
    expect(onNoteMove).toHaveBeenCalledWith(0, 0);
  });

  test('pointercancel aborts the gesture without firing callbacks', () => {
    const onNoteSelect = vi.fn();
    const onNoteMove = vi.fn();
    render(
      <PianoRoll
        notes={oneNote()}
        onNoteSelect={onNoteSelect}
        onNoteMove={onNoteMove}
      />,
    );
    const note = document.querySelector('.mr-note') as Element;
    fireEvent.pointerDown(note, { pointerId: 1, clientX: 0 });
    fireEvent.pointerMove(note, { pointerId: 1, clientX: 50 });
    fireEvent.pointerCancel(note, { pointerId: 1, clientX: 50 });
    expect(onNoteMove).not.toHaveBeenCalled();
    expect(onNoteSelect).not.toHaveBeenCalled();
  });

  test('absolute mode realigns an off-grid note to the grid', () => {
    const onNoteMove = vi.fn();
    render(
      <PianoRoll
        notes={oneNote({ tTicks: 154 })}
        onNoteMove={onNoteMove}
        quantizeOn
        quantizeGrid="1/16"
        snapAbsoluteOn
        pxPerBeat={88}
      />,
    );
    const note = document.querySelector('.mr-note') as Element;
    fireEvent.pointerDown(note, { pointerId: 1, clientX: 0 });
    fireEvent.pointerMove(note, { pointerId: 1, clientX: 22 });
    fireEvent.pointerUp(note, { pointerId: 1, clientX: 22 });
    /* deltaTicksRaw = 120; (154+120)/120 = 2.28 → round = 2 → finalTick = 240. */
    expect(onNoteMove).toHaveBeenCalledTimes(1);
    expect(onNoteMove).toHaveBeenCalledWith(0, 240);
  });

  test('absolute mode with on-grid start equals delta mode', () => {
    const onAbs = vi.fn();
    const onDelta = vi.fn();
    const { unmount } = render(
      <PianoRoll
        notes={oneNote({ tTicks: 0 })}
        onNoteMove={onAbs}
        quantizeOn
        quantizeGrid="1/4"
        snapAbsoluteOn
        pxPerBeat={88}
      />,
    );
    const noteA = document.querySelector('.mr-note') as Element;
    fireEvent.pointerDown(noteA, { pointerId: 1, clientX: 0 });
    fireEvent.pointerMove(noteA, { pointerId: 1, clientX: 540 });
    fireEvent.pointerUp(noteA, { pointerId: 1, clientX: 540 });
    expect(onAbs).toHaveBeenCalledWith(0, 2880);
    unmount();
    render(
      <PianoRoll
        notes={oneNote({ tTicks: 0 })}
        onNoteMove={onDelta}
        quantizeOn
        quantizeGrid="1/4"
        pxPerBeat={88}
      />,
    );
    const noteB = document.querySelector('.mr-note') as Element;
    fireEvent.pointerDown(noteB, { pointerId: 1, clientX: 0 });
    fireEvent.pointerMove(noteB, { pointerId: 1, clientX: 540 });
    fireEvent.pointerUp(noteB, { pointerId: 1, clientX: 540 });
    expect(onDelta).toHaveBeenCalledWith(0, 2880);
  });

  test('snapAbsoluteOn has no effect when quantize is off', () => {
    const onNoteMove = vi.fn();
    render(
      <PianoRoll
        notes={oneNote({ tTicks: 154 })}
        onNoteMove={onNoteMove}
        quantizeOn={false}
        snapAbsoluteOn
        pxPerBeat={88}
      />,
    );
    const note = document.querySelector('.mr-note') as Element;
    fireEvent.pointerDown(note, { pointerId: 1, clientX: 0 });
    fireEvent.pointerMove(note, { pointerId: 1, clientX: 100 });
    fireEvent.pointerUp(note, { pointerId: 1, clientX: 100 });
    expect(onNoteMove).toHaveBeenCalledTimes(1);
    expect(onNoteMove).toHaveBeenCalledWith(0, 154 + Math.round(100 / (88 / 480)));
  });

  test('absolute mode clamps to non-negative ticks', () => {
    const onNoteMove = vi.fn();
    render(
      <PianoRoll
        notes={oneNote({ tTicks: 60 })}
        onNoteMove={onNoteMove}
        quantizeOn
        quantizeGrid="1/16"
        snapAbsoluteOn
        pxPerBeat={88}
      />,
    );
    const note = document.querySelector('.mr-note') as Element;
    fireEvent.pointerDown(note, { pointerId: 1, clientX: 200 });
    fireEvent.pointerMove(note, { pointerId: 1, clientX: -4800 });
    fireEvent.pointerUp(note, { pointerId: 1, clientX: -4800 });
    expect(onNoteMove).toHaveBeenCalledTimes(1);
    expect(onNoteMove).toHaveBeenCalledWith(0, 0);
  });

  test('absolute mode commits exactly once across multiple pointermoves', () => {
    const onNoteMove = vi.fn();
    render(
      <PianoRoll
        notes={oneNote({ tTicks: 154 })}
        onNoteMove={onNoteMove}
        quantizeOn
        quantizeGrid="1/16"
        snapAbsoluteOn
        pxPerBeat={88}
      />,
    );
    const note = document.querySelector('.mr-note') as Element;
    fireEvent.pointerDown(note, { pointerId: 1, clientX: 0 });
    fireEvent.pointerMove(note, { pointerId: 1, clientX: 11 });
    fireEvent.pointerMove(note, { pointerId: 1, clientX: 16 });
    fireEvent.pointerMove(note, { pointerId: 1, clientX: 22 });
    fireEvent.pointerUp(note, { pointerId: 1, clientX: 22 });
    expect(onNoteMove).toHaveBeenCalledTimes(1);
  });

  test('multiple pointermoves commit exactly once on pointerup', () => {
    const onNoteMove = vi.fn();
    render(
      <PianoRoll
        notes={oneNote()}
        onNoteMove={onNoteMove}
        pxPerBeat={88}
      />,
    );
    const note = document.querySelector('.mr-note') as Element;
    fireEvent.pointerDown(note, { pointerId: 1, clientX: 0 });
    fireEvent.pointerMove(note, { pointerId: 1, clientX: 20 });
    fireEvent.pointerMove(note, { pointerId: 1, clientX: 40 });
    fireEvent.pointerMove(note, { pointerId: 1, clientX: 60 });
    fireEvent.pointerUp(note, { pointerId: 1, clientX: 60 });
    expect(onNoteMove).toHaveBeenCalledTimes(1);
  });
});
