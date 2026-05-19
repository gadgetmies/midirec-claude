/// <reference types="vite/client" />
import { afterEach, describe, expect, test } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Ruler } from './Ruler';
import rulerCss from './Ruler.css?raw';
import { DEFAULT_MIDI_TPQ } from '../../midi/timelineTicks';
import { GRID_TICK_THINNING_THRESHOLD_BEATS } from '../../session/layoutHorizon';

afterEach(() => {
  cleanup();
});

const TPQ = DEFAULT_MIDI_TPQ;

describe('Ruler labels', () => {
  test('major-tick labels use {phrase}.{bar}.{beat} format up to 32 beats', () => {
    const { container } = render(<Ruler layoutHorizonTicks={32 * TPQ} />);
    const labels = Array.from(container.querySelectorAll('.mr-ruler__lbl')).map(
      (n) => n.textContent,
    );
    expect(labels).toEqual([
      '1.1.1',
      '1.2.1',
      '1.3.1',
      '1.4.1',
      '2.1.1',
      '2.2.1',
      '2.3.1',
      '2.4.1',
    ]);
  });
});

describe('Ruler phrase ticks', () => {
  test('phrase boundaries carry the mr-ruler__tick--phrase modifier alongside --major', () => {
    const { container } = render(<Ruler layoutHorizonTicks={32 * TPQ} />);
    const phraseTicks = container.querySelectorAll('.mr-ruler__tick--phrase');
    expect(phraseTicks.length).toBe(3);
    for (const t of phraseTicks) {
      expect(t.classList.contains('mr-ruler__tick')).toBe(true);
      expect(t.classList.contains('mr-ruler__tick--major')).toBe(true);
    }
  });

  test('non-phrase bar majors do not carry the phrase modifier', () => {
    const { container } = render(<Ruler layoutHorizonTicks={32 * TPQ} />);
    const majors = container.querySelectorAll('.mr-ruler__tick--major');
    const nonPhraseMajors = Array.from(majors).filter(
      (n) => !n.classList.contains('mr-ruler__tick--phrase'),
    );
    expect(nonPhraseMajors.length).toBe(6);
  });

  test('phrase ticks survive ruler thinning at wide horizons', () => {
    const wideBeats = GRID_TICK_THINNING_THRESHOLD_BEATS + 64;
    const { container } = render(<Ruler layoutHorizonTicks={wideBeats * TPQ} />);
    const phraseTicks = container.querySelectorAll('.mr-ruler__tick--phrase');
    const expectedPhrases = Math.floor(wideBeats / 16) + 1;
    expect(phraseTicks.length).toBe(expectedPhrases);
    for (const t of phraseTicks) {
      expect(t.classList.contains('mr-ruler__tick--major')).toBe(true);
    }
  });
});

describe('Ruler.css', () => {
  test('contains no hex literals or oklch values', () => {
    expect(rulerCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(rulerCss).not.toMatch(/oklch\(/);
  });
});
