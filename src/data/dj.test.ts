import { describe, expect, test } from 'vitest';
import {
  DEFAULT_ACTION_MAP,
  DJ_CATEGORIES,
  actionMode,
  defaultMixerOutputCc,
  normalizeActionMapEntry,
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
       AND its id would be trigger-style if pressure did not win. */
    const hc1 = DEFAULT_ACTION_MAP[56];
    expect(actionMode(hc1)).toBe('pressure-bearing');
  });

  test('velocity-sensitive when pad: true and no pressure', () => {
    /* Hot Cue 2 in the seeded action map has pad: true and no pressure. */
    const hc2 = DEFAULT_ACTION_MAP[57];
    expect(actionMode(hc2)).toBe('velocity-sensitive');
  });

  test('trigger for play id without pad/pressure', () => {
    const play = DEFAULT_ACTION_MAP[48];
    expect(actionMode(play)).toBe('trigger');
  });

  test('trigger for cue id', () => {
    const cue = DEFAULT_ACTION_MAP[49];
    expect(actionMode(cue)).toBe('trigger');
  });

  test('fallback for fx without pad/pressure', () => {
    const fx1On = DEFAULT_ACTION_MAP[60];
    expect(actionMode(fx1On)).toBe('fallback');
  });

  test('fallback for load-deck rows without pad/pressure', () => {
    const loadA = DEFAULT_ACTION_MAP[73];
    expect(loadA.cat).toBe('browser');
    expect(actionMode(loadA)).toBe('fallback');
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
    /* Synthetic: trigger-style id + pad: true. Velocity wins. */
    expect(actionMode(make({ id: 'hc2', cat: 'deck', pad: true }))).toBe('velocity-sensitive');
  });
});

describe('normalizeActionMapEntry', () => {
  test('migrates load_a / load_b from legacy mixer cat to browser', () => {
    const legacy73 = normalizeActionMapEntry({
      ...(DEFAULT_ACTION_MAP[73] as ActionMapEntry),
      cat: 'mixer',
    });
    expect(legacy73.cat).toBe('browser');
    const legacy74 = normalizeActionMapEntry({
      ...(DEFAULT_ACTION_MAP[74] as ActionMapEntry),
      cat: 'mixer',
    });
    expect(legacy74.cat).toBe('browser');
  });
});

describe('DJ_CATEGORIES order', () => {
  test('insertion order drives Map Note tabs', () => {
    expect(Object.keys(DJ_CATEGORIES)).toEqual(['deck', 'browser', 'mixer', 'fx', 'global']);
  });
});

describe('defaultMixerOutputCc', () => {
  test('maps continuous mixer actions', () => {
    expect(defaultMixerOutputCc('xfade_pos')).toBe(16);
    expect(defaultMixerOutputCc('ch1_eq_mid')).toBe(18);
    expect(defaultMixerOutputCc('load_a')).toBeUndefined();
  });
});

describe('trigger field on ActionMapEntry', () => {
  test('DEFAULT_ACTION_MAP entries omit the trigger field', () => {
    expect(DEFAULT_ACTION_MAP[48].trigger).toBeUndefined();
    expect(DEFAULT_ACTION_MAP[56].trigger).toBeUndefined();
    expect(DEFAULT_ACTION_MAP[73].trigger).toBeUndefined();
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
