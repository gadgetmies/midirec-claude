import { describe, expect, test } from 'vitest';
import type { Note } from '../piano-roll/notes';
import { formatBBT, formatPitch, summarizeSelection } from './summary';

describe('formatBBT', () => {
  test('integer beats produce 1-indexed bar.beat.sixteenth', () => {
    expect(formatBBT(0)).toBe('01.1.1');
    expect(formatBBT(4)).toBe('02.1.1');
  });

  test('fractional beats compute the sixteenth correctly', () => {
    expect(formatBBT(6.5)).toBe('02.3.3');
  });

  test('honours non-default time signature numerator', () => {
    expect(formatBBT(3, { num: 3, den: 4 })).toBe('02.1.1');
  });
});

describe('formatPitch', () => {
  test('C4 is MIDI 60', () => {
    expect(formatPitch(60)).toBe('C4');
  });

  test('uses unicode sharp accidental', () => {
    expect(formatPitch(63)).toBe('D♯4');
  });

  test('octave numbers shift correctly across C boundaries', () => {
    expect(formatPitch(48)).toBe('C3');
    expect(formatPitch(72)).toBe('C5');
  });
});

const note = (t: number, dur: number, pitch: number, vel: number): Note => ({ t, dur, pitch, vel });

describe('summarizeSelection', () => {
  test('detects mixed velocity when values differ', () => {
    const notes: Note[] = [note(0, 1, 60, 0.5), note(1, 1, 62, 0.7), note(2, 1, 64, 0.8)];
    const summary = summarizeSelection(notes, [0, 1, 2], 'Lead');
    expect(summary.velocity.mixed).toBe(true);
    expect(summary.velocity.mean).toBeCloseTo(0.6667, 3);
  });

  test('reports uniform velocity when all equal', () => {
    const notes: Note[] = [note(0, 1, 60, 0.5), note(1, 1, 62, 0.5)];
    const summary = summarizeSelection(notes, [0, 1], 'Lead');
    expect(summary.velocity.mixed).toBe(false);
    expect(summary.velocity.mean).toBeCloseTo(0.5, 6);
  });

  test('reports uniform length when all dur values are within epsilon', () => {
    const notes: Note[] = [note(0, 0.5, 60, 0.5), note(1, 0.5, 62, 0.5), note(2, 0.5, 64, 0.5)];
    const summary = summarizeSelection(notes, [0, 1, 2], 'Lead');
    expect(summary.length.uniform).toBe(0.5);
    expect(summary.length.range).toEqual([0.5, 0.5]);
  });

  test('reports null uniform when durations differ', () => {
    const notes: Note[] = [note(0, 0.25, 60, 0.5), note(1, 0.75, 62, 0.5)];
    const summary = summarizeSelection(notes, [0, 1], 'Lead');
    expect(summary.length.uniform).toBeNull();
    expect(summary.length.range).toEqual([0.25, 0.75]);
  });

  test('produces distinct, sorted pitches', () => {
    const notes: Note[] = [note(0, 1, 64, 0.5), note(1, 1, 60, 0.5), note(2, 1, 64, 0.5), note(3, 1, 62, 0.5)];
    const summary = summarizeSelection(notes, [0, 1, 2, 3], 'Lead');
    expect(summary.pitches).toEqual([60, 62, 64]);
  });

  test('range t1 is the inclusive end (note.t + note.dur)', () => {
    const notes: Note[] = [note(2, 1, 60, 0.5), note(3.5, 0.25, 62, 0.5)];
    const summary = summarizeSelection(notes, [0, 1], 'Lead');
    expect(summary.range.t0).toBe(2);
    expect(summary.range.t1).toBe(3.75);
  });

  test('empty selection produces zeroed summary', () => {
    const notes: Note[] = [note(0, 1, 60, 0.5)];
    const summary = summarizeSelection(notes, [], 'Lead');
    expect(summary.count).toBe(0);
    expect(summary.pitches).toEqual([]);
    expect(summary.length.uniform).toBeNull();
  });
});
