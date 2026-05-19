import { describe, expect, it } from 'vitest';
import { quantizeGridToTicks } from './quantizeGrid';
import { DEFAULT_MIDI_TPQ } from './timelineTicks';

describe('quantizeGridToTicks', () => {
  it('maps each grid to the expected tick count at TPQ=480', () => {
    expect(quantizeGridToTicks('1/4', 480)).toBe(480);
    expect(quantizeGridToTicks('1/8', 480)).toBe(240);
    expect(quantizeGridToTicks('1/16', 480)).toBe(120);
    expect(quantizeGridToTicks('1/32', 480)).toBe(60);
  });

  it('uses DEFAULT_MIDI_TPQ when tpq is omitted', () => {
    expect(quantizeGridToTicks('1/4')).toBe(DEFAULT_MIDI_TPQ);
    expect(quantizeGridToTicks('1/8')).toBe(DEFAULT_MIDI_TPQ / 2);
    expect(quantizeGridToTicks('1/16')).toBe(DEFAULT_MIDI_TPQ / 4);
    expect(quantizeGridToTicks('1/32')).toBe(DEFAULT_MIDI_TPQ / 8);
  });

  it('scales with a custom tpq', () => {
    expect(quantizeGridToTicks('1/4', 96)).toBe(96);
    expect(quantizeGridToTicks('1/16', 96)).toBe(24);
  });
});
