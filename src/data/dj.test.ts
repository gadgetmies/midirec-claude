import { describe, expect, test } from 'vitest';
import {
  DEFAULT_ACTION_MAP,
  actionMode,
  type ActionMapEntry,
  type TriggerMode,
} from './dj';

const make = (over: Partial<ActionMapEntry> = {}): ActionMapEntry => ({
  id: 'x',
  cat: 'fx',
  label: 'X',
  short: 'X',
  device: 'global',
  ...over,
});

describe('actionMode', () => {
  test('pressure-bearing wins over pad and trigger predicates', () => {
    /* Hot Cue 1 in the seeded action map has pressure: true AND pad: true,
       AND its category (hotcue) is in the trigger set. Pressure wins. */
    const hc1 = DEFAULT_ACTION_MAP[56];
    expect(actionMode(hc1)).toBe('pressure-bearing');
  });

  test('velocity-sensitive when pad: true and no pressure', () => {
    /* Hot Cue 2 in the seeded action map has pad: true and no pressure. */
    const hc2 = DEFAULT_ACTION_MAP[57];
    expect(actionMode(hc2)).toBe('velocity-sensitive');
  });

  test('trigger for transport without pad/pressure', () => {
    const play = DEFAULT_ACTION_MAP[48];
    expect(actionMode(play)).toBe('trigger');
  });

  test('trigger for cue category', () => {
    const cue = DEFAULT_ACTION_MAP[49];
    expect(actionMode(cue)).toBe('trigger');
  });

  test('fallback for fx without pad/pressure', () => {
    const fx1On = DEFAULT_ACTION_MAP[60];
    expect(actionMode(fx1On)).toBe('fallback');
  });

  test('fallback for mixer without pad/pressure', () => {
    const xfade = DEFAULT_ACTION_MAP[71];
    expect(actionMode(xfade)).toBe('fallback');
  });

  test('fallback for loop without pad/pressure', () => {
    const loopIn = DEFAULT_ACTION_MAP[52];
    expect(actionMode(loopIn)).toBe('fallback');
  });

  test('pressure beats every other predicate even when cat is fallback-territory', () => {
    /* Synthetic case: a mixer action with pressure: true. Pressure still
       wins; the predicate doesn't care about category. */
    expect(actionMode(make({ cat: 'mixer', pressure: true }))).toBe('pressure-bearing');
  });

  test('velocity-sensitive beats trigger when both predicates would match', () => {
    /* Synthetic: hotcue category (would match trigger) + pad: true. Velocity
       wins. */
    expect(actionMode(make({ cat: 'hotcue', pad: true }))).toBe('velocity-sensitive');
  });
});

describe('trigger field on ActionMapEntry', () => {
  test('DEFAULT_ACTION_MAP entries omit the trigger field', () => {
    expect(DEFAULT_ACTION_MAP[48].trigger).toBeUndefined();
    expect(DEFAULT_ACTION_MAP[56].trigger).toBeUndefined();
    expect(DEFAULT_ACTION_MAP[71].trigger).toBeUndefined();
  });

  test('TriggerMode accepts momentary and toggle', () => {
    const momentary: TriggerMode = 'momentary';
    const toggle: TriggerMode = 'toggle';
    expect(momentary).toBe('momentary');
    expect(toggle).toBe('toggle');
  });

  test('ActionMapEntry accepts an explicit trigger value', () => {
    const withMomentary = make({ trigger: 'momentary' });
    const withToggle = make({ trigger: 'toggle' });
    expect(withMomentary.trigger).toBe('momentary');
    expect(withToggle.trigger).toBe('toggle');
  });
});
