import { describe, expect, it } from 'vitest';
import {
  CONTROL_MAP_VERSION,
  emptyControlMapState,
  parseControlMap,
  serializeControlMap,
  type ControlMapState,
} from './controlMap';

const sample: ControlMapState = {
  version: CONTROL_MAP_VERSION,
  mappings: [
    {
      target: 'play',
      source: { kind: 'note', portId: 'port-A', channel: 1, data: 60 },
      edge: 'press',
      minValue: 1,
    },
    {
      target: 'setBpm',
      source: { kind: 'cc', portId: 'port-A', channel: 1, data: 14 },
      continuous: { mode: 'absolute', min: 60, max: 200, takeover: true },
    },
  ],
  listenInputIds: [],
};

describe('serializeControlMap / parseControlMap', () => {
  it('round-trips a mapping set through JSON', () => {
    const json = serializeControlMap(sample);
    expect(parseControlMap(JSON.parse(json))).toEqual(sample);
  });

  it('parses a plain object (already-parsed JSON)', () => {
    expect(parseControlMap(sample)).toEqual(sample);
  });

  it('rejects a non-object', () => {
    expect(() => parseControlMap(42)).toThrow();
    expect(() => parseControlMap(null)).toThrow();
  });

  it('rejects a future version it cannot migrate', () => {
    expect(() => parseControlMap({ version: 999, mappings: [] })).toThrow();
  });

  it('rejects a payload with a non-array mappings field', () => {
    expect(() => parseControlMap({ version: CONTROL_MAP_VERSION, mappings: 'nope' })).toThrow();
  });

  it('rejects mappings with an unknown target', () => {
    expect(() =>
      parseControlMap({
        version: CONTROL_MAP_VERSION,
        mappings: [{ target: 'notATarget', source: { kind: 'note', portId: 'p', channel: 1, data: 1 } }],
      }),
    ).toThrow();
  });
});

describe('version migration', () => {
  it('migrates a version-0 payload (mappings without a version) to the current version', () => {
    const legacy = {
      version: 0,
      mappings: [{ target: 'play', source: { kind: 'note', portId: 'p', channel: 1, data: 60 } }],
    };
    const migrated = parseControlMap(legacy);
    expect(migrated.version).toBe(CONTROL_MAP_VERSION);
    expect(migrated.mappings).toHaveLength(1);
  });
});

describe('emptyControlMapState', () => {
  it('is empty and carries the current version', () => {
    const empty = emptyControlMapState();
    expect(empty.version).toBe(CONTROL_MAP_VERSION);
    expect(empty.mappings).toEqual([]);
  });
});
