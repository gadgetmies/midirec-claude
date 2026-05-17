import { describe, expect, test, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { PianoRoll } from './PianoRoll';
import type { Note } from './notes';
import { beatsToSessionTicks } from '../../midi/sessionTicks';

afterEach(() => {
  cleanup();
});

function oneNote(onC4: Partial<Pick<Note, 'vel'>> = {}): Note[] {
  return [
    {
      tTicks: 0,
      durTicks: beatsToSessionTicks(1),
      pitch: 60,
      vel: 0.5,
      ...onC4,
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
