import { describe, expect, test } from 'vitest';
import {
  DEFAULT_ACTION_MAP,
  DJ_CATEGORIES,
  actionMode,
  defaultMixerOutputCc,
  normalizeActionMapEntry,
  normalizeOutputMapping,
  resolveOutKind,
  resolvedDjRowOutputCc,
  type ActionMapEntry,
  type OutputMapping,
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
    /* Synthetic fixture: a pad-only entry. The cue family in the seeded
       DEFAULT_ACTION_MAP is now uniformly pressure-bearing, so this test
       no longer pins to a specific seeded pitch. */
    const padOnly = make({ pad: true });
    expect(actionMode(padOnly)).toBe('velocity-sensitive');
  });

  test('trigger for play id without pad/pressure', () => {
    const play = DEFAULT_ACTION_MAP[48];
    expect(actionMode(play)).toBe('trigger');
  });

  test('pressure-bearing for cue id', () => {
    const cue = DEFAULT_ACTION_MAP[49];
    expect(actionMode(cue)).toBe('pressure-bearing');
  });

  test('pressure-bearing for HC2 (every cue-family entry is pressure-bearing)', () => {
    const hc2 = DEFAULT_ACTION_MAP[57];
    expect(actionMode(hc2)).toBe('pressure-bearing');
  });

  test('trigger for fx1_on id', () => {
    const fx1On = DEFAULT_ACTION_MAP[60];
    expect(actionMode(fx1On)).toBe('trigger');
  });

  test('fallback for load-deck rows without pad/pressure', () => {
    const loadA = DEFAULT_ACTION_MAP[73];
    expect(loadA.cat).toBe('browser');
    expect(actionMode(loadA)).toBe('fallback');
  });

  test('trigger for loop_in id', () => {
    const loopIn = DEFAULT_ACTION_MAP[52];
    expect(actionMode(loopIn)).toBe('trigger');
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
    expect(defaultMixerOutputCc('ch1_vol')).toBe(7);
    expect(defaultMixerOutputCc('ch2_vol')).toBe(8);
    expect(defaultMixerOutputCc('load_a')).toBeUndefined();
  });
});

describe('normalizeOutputMapping — midiOutputDeviceId', () => {
  test('preserves trimmed non-empty id', () => {
    const m = normalizeOutputMapping({
      device: 'global',
      channel: 1,
      pitch: 60,
      midiOutputDeviceId: '  port-1 ',
    });
    expect(m.midiOutputDeviceId).toBe('port-1');
  });

  test('omits id when empty after trim', () => {
    const m = normalizeOutputMapping({
      device: 'global',
      channel: 1,
      pitch: 60,
      midiOutputDeviceId: ' \t ',
    });
    expect(m.midiOutputDeviceId).toBeUndefined();
  });
});

describe('resolvedDjRowOutputCc', () => {
  const xfade = DEFAULT_ACTION_MAP[80]!;
  const play = DEFAULT_ACTION_MAP[48]!;

  test('uses outputMap.cc when set', () => {
    const actionMap = { 80: xfade };
    const outputMap = {
      80: normalizeOutputMapping({ device: 'mixer', channel: 16, pitch: 80, cc: 99 }),
    };
    expect(resolvedDjRowOutputCc(actionMap, outputMap, 80)).toBe(99);
  });

  test('falls back to defaultMixerOutputCc when outputMap has no cc', () => {
    const actionMap = { 80: xfade };
    const outputMap = {
      80: normalizeOutputMapping({ device: 'mixer', channel: 16, pitch: 80 }),
    };
    expect(resolvedDjRowOutputCc(actionMap, outputMap, 80)).toBe(16);
  });

  test('returns undefined for pressure-bearing rows even if outputMap has cc', () => {
    const actionMap = { 56: DEFAULT_ACTION_MAP[56]! };
    const outputMap = {
      56: normalizeOutputMapping({ device: 'deck1', channel: 1, pitch: 56, cc: 1 }),
    };
    expect(resolvedDjRowOutputCc(actionMap, outputMap, 56)).toBeUndefined();
  });

  test('returns undefined for deck actions without cc default', () => {
    const actionMap = { 48: play };
    const outputMap: Record<number, OutputMapping> = {};
    expect(resolvedDjRowOutputCc(actionMap, outputMap, 48)).toBeUndefined();
  });
});

describe('resolveOutKind', () => {
  const base = { device: 'mixer', channel: 1, pitch: 60 } as const;

  test('explicit out:pb wins', () => {
    expect(resolveOutKind({ ...base, out: 'pb' })).toBe('pb');
  });

  test('explicit out:cc wins', () => {
    expect(resolveOutKind({ ...base, out: 'cc' })).toBe('cc');
  });

  test('explicit out:note wins even when cc is set (stale data)', () => {
    expect(resolveOutKind({ ...base, cc: 7, out: 'note' })).toBe('note');
  });

  test('legacy: cc set with no out resolves to cc', () => {
    expect(resolveOutKind({ ...base, cc: 7 })).toBe('cc');
  });

  test('bare mapping with neither cc nor out resolves to note', () => {
    expect(resolveOutKind(base)).toBe('note');
  });

  test('undefined mapping resolves to note', () => {
    expect(resolveOutKind(undefined)).toBe('note');
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
