import { afterEach, describe, expect, test } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Ruler } from './Ruler';
import { DEFAULT_MIDI_TPQ } from '../../midi/timelineTicks';

afterEach(() => cleanup());

const TPQ = DEFAULT_MIDI_TPQ;

describe('Ruler adaptive subdivision', () => {
  test('pxPerBeat=8 renders phrase-only ticks (every rendered tick is a phrase)', () => {
    /* 64 beats so we get multiple phrases. */
    const { container } = render(
      <Ruler layoutHorizonTicks={64 * TPQ} pxPerBeat={8} />,
    );
    const allTicks = container.querySelectorAll('.mr-ruler__tick');
    const phraseTicks = container.querySelectorAll('.mr-ruler__tick--phrase');
    expect(allTicks.length).toBe(phraseTicks.length);
    expect(allTicks.length).toBeGreaterThanOrEqual(4); // beats 0,16,32,48,64
  });

  test('pxPerBeat=88 renders every beat plus bar/phrase emphasis', () => {
    const { container } = render(
      <Ruler layoutHorizonTicks={16 * TPQ} pxPerBeat={88} />,
    );
    const allTicks = container.querySelectorAll('.mr-ruler__tick');
    expect(allTicks.length).toBeGreaterThanOrEqual(17); // beats 0..16

    const majors = container.querySelectorAll('.mr-ruler__tick--major');
    /* Beats 0, 4, 8, 12, 16 (bar boundaries). */
    expect(majors.length).toBe(5);

    const phrases = container.querySelectorAll('.mr-ruler__tick--phrase');
    /* Beats 0 and 16 (phrase boundaries). */
    expect(phrases.length).toBe(2);
  });

  test('pxPerBeat=400 renders 16th subdivisions; sub-beat ticks omit --major', () => {
    const { container } = render(
      <Ruler layoutHorizonTicks={4 * TPQ} pxPerBeat={400} />,
    );
    const allTicks = container.querySelectorAll('.mr-ruler__tick');
    /* 4 beats * 4 16ths/beat + 1 endpoint = 17 ticks. */
    expect(allTicks.length).toBe(17);

    /* Only the on-beat tick at beat 0 and beat 4 carry --major (bar
       boundary); sub-beat ticks must not carry --major. */
    const majors = container.querySelectorAll('.mr-ruler__tick--major');
    expect(majors.length).toBe(2);
  });

  test('pxPerBeat=176 renders 8th subdivisions (every TPQ/2 ticks)', () => {
    const { container } = render(
      <Ruler layoutHorizonTicks={4 * TPQ} pxPerBeat={176} />,
    );
    const allTicks = container.querySelectorAll('.mr-ruler__tick');
    /* 4 beats * 2 8ths/beat + 1 endpoint = 9 ticks. */
    expect(allTicks.length).toBe(9);
  });

  test('phrase ticks always present at every subdivision level', () => {
    for (const ppb of [8, 88, 200, 400, 1000]) {
      const { container, unmount } = render(
        <Ruler layoutHorizonTicks={32 * TPQ} pxPerBeat={ppb} />,
      );
      const phraseTicks = container.querySelectorAll('.mr-ruler__tick--phrase');
      /* Beats 0, 16, 32 = 3 phrase boundaries. */
      expect(phraseTicks.length).toBe(3);
      unmount();
    }
  });

  test('labels stay on integer-beat positions at every subdivision level', () => {
    /* For each tier, no label may correspond to a sub-beat position. The
       Ruler renders labels with a key prefix `l<ticks>` and class `.mr-ruler__lbl`;
       the underlying tick offset is derived from the .style.left, but we can
       infer integer-beat alignment by counting labels vs. ticks at the beat
       cadence. The Ruler only emits a label at multiples of `labelEvery`,
       which `chooseRulerSubdivision` guarantees is a multiple of TPQ. */
    for (const ppb of [8, 88, 176, 400, 1000]) {
      const { container, unmount } = render(
        <Ruler layoutHorizonTicks={16 * TPQ} pxPerBeat={ppb} />,
      );
      const labels = container.querySelectorAll('.mr-ruler__lbl');
      /* The label text matches the phrase.bar.beat regex with integer
         components, which is impossible for a sub-beat position. */
      for (const lbl of labels) {
        expect(lbl.textContent).toMatch(/^\d+\.\d+\.\d+$/);
      }
      unmount();
    }
  });
});
