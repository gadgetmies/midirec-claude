import { describe, expect, it, vi } from 'vitest';
import {
  applyControlMessage,
  parseControlMessage,
  type ControlMapState,
  type ControlSurface,
  type TakeoverEntry,
  type TargetKey,
} from './controlMap';

function fakeSurface(overrides: Partial<ControlSurface> = {}): ControlSurface {
  return {
    playing: false,
    recording: false,
    looping: false,
    metronomeOn: false,
    quantizeOn: false,
    snapAbsoluteOn: false,
    clockSendEnabled: false,
    quantizeGrid: '1/16',
    clockSource: 'internal',
    bpm: 120,
    recordingStartedAt: null,
    play: vi.fn(),
    pause: vi.fn(),
    record: vi.fn(),
    rewind: vi.fn(),
    cue: vi.fn(),
    phraseForward: vi.fn(),
    phraseBack: vi.fn(),
    toggleLoop: vi.fn(),
    toggleMetronome: vi.fn(),
    toggleQuantize: vi.fn(),
    toggleSnapAbsolute: vi.fn(),
    toggleClockSend: vi.fn(),
    setBpm: vi.fn(),
    setQuantizeGrid: vi.fn(),
    setClockSource: vi.fn(),
    ...overrides,
  };
}

// raw byte builders
const noteOnBytes = (ch: number, note: number, vel: number) =>
  new Uint8Array([0x90 | (ch - 1), note, vel]);
const noteOffBytes = (ch: number, note: number) => new Uint8Array([0x80 | (ch - 1), note, 0]);
const ccBytes = (ch: number, cc: number, val: number) => new Uint8Array([0xb0 | (ch - 1), cc, val]);
const clockByte = () => new Uint8Array([0xf8]);

describe('parseControlMessage', () => {
  it('parses a note-on as a press edge with velocity value', () => {
    const p = parseControlMessage('p', noteOnBytes(1, 60, 100));
    expect(p).toMatchObject({ edge: 'press', value: 100 });
    expect(p?.wire.kind).toBe('noteOn');
  });

  it('parses a note-off (0x80) as a release edge', () => {
    const p = parseControlMessage('p', noteOffBytes(1, 60));
    expect(p?.edge).toBe('release');
  });

  it('parses a zero-velocity note-on as a release edge', () => {
    const p = parseControlMessage('p', noteOnBytes(1, 60, 0));
    expect(p?.edge).toBe('release');
  });

  it('returns null for System Real-Time clock bytes', () => {
    expect(parseControlMessage('p', clockByte())).toBeNull();
  });
});

function freshTakeover() {
  return new Map<TargetKey, TakeoverEntry>();
}

describe('applyControlMessage — triggers', () => {
  const state: ControlMapState = {
    version: 1,
    mappings: [
      { target: 'play', source: { kind: 'note', portId: 'p', channel: 1, data: 60 }, edge: 'press', minValue: 1 },
    ],
  };

  it('fires the registry action on a matching press', () => {
    const surface = fakeSurface();
    const fired = applyControlMessage(parseControlMessage('p', noteOnBytes(1, 60, 100))!, state, surface, freshTakeover());
    expect(fired).toContain('play');
    expect(surface.play).toHaveBeenCalledTimes(1);
  });

  it('ignores the release when the edge is press', () => {
    const surface = fakeSurface();
    applyControlMessage(parseControlMessage('p', noteOffBytes(1, 60))!, state, surface, freshTakeover());
    expect(surface.play).not.toHaveBeenCalled();
  });

  it('ignores a below-threshold press', () => {
    const thr: ControlMapState = {
      version: 1,
      mappings: [
        { target: 'play', source: { kind: 'note', portId: 'p', channel: 1, data: 60 }, edge: 'press', minValue: 10 },
      ],
    };
    const surface = fakeSurface();
    applyControlMessage(parseControlMessage('p', noteOnBytes(1, 60, 5))!, thr, surface, freshTakeover());
    expect(surface.play).not.toHaveBeenCalled();
  });

  it('passes barsPerPhrase to a phrase target', () => {
    const phraseState: ControlMapState = {
      version: 1,
      mappings: [
        { target: 'phraseForward', source: { kind: 'note', portId: 'p', channel: 1, data: 61 }, barsPerPhrase: 16 },
      ],
    };
    const surface = fakeSurface();
    applyControlMessage(parseControlMessage('p', noteOnBytes(1, 61, 100))!, phraseState, surface, freshTakeover());
    expect(surface.phraseForward).toHaveBeenCalledWith(16);
  });

  it('does not match when nothing is mapped', () => {
    const surface = fakeSurface();
    const fired = applyControlMessage(parseControlMessage('p', noteOnBytes(1, 99, 100))!, state, surface, freshTakeover());
    expect(fired).toEqual([]);
  });

  it('fires every target a source is bound to (one event → many actions)', () => {
    const multi: ControlMapState = {
      version: 1,
      mappings: [
        { target: 'play', source: { kind: 'note', portId: 'p', channel: 1, data: 60 }, edge: 'press', minValue: 1 },
        { target: 'toggleMetronome', source: { kind: 'note', portId: 'p', channel: 1, data: 60 }, edge: 'press', buttonMode: 'toggle', minValue: 1 },
      ],
    };
    const surface = fakeSurface({ playing: false, metronomeOn: false });
    const fired = applyControlMessage(parseControlMessage('p', noteOnBytes(1, 60, 100))!, multi, surface, freshTakeover());
    expect(fired).toEqual(['play', 'toggleMetronome']);
    expect(surface.play).toHaveBeenCalledTimes(1);
    expect(surface.toggleMetronome).toHaveBeenCalledTimes(1);
  });
});

describe('applyControlMessage — toggles', () => {
  it('momentary enables on press and disables on release', () => {
    const state: ControlMapState = {
      version: 1,
      mappings: [
        { target: 'toggleLoop', source: { kind: 'note', portId: 'p', channel: 1, data: 60 }, buttonMode: 'momentary', minValue: 1 },
      ],
    };
    const off = fakeSurface({ looping: false });
    applyControlMessage(parseControlMessage('p', noteOnBytes(1, 60, 100))!, state, off, freshTakeover());
    expect(off.toggleLoop).toHaveBeenCalledTimes(1); // off → on

    const on = fakeSurface({ looping: true });
    applyControlMessage(parseControlMessage('p', noteOffBytes(1, 60))!, state, on, freshTakeover());
    expect(on.toggleLoop).toHaveBeenCalledTimes(1); // release → off
  });

  it('toggle flips on press only', () => {
    const state: ControlMapState = {
      version: 1,
      mappings: [
        { target: 'toggleMetronome', source: { kind: 'note', portId: 'p', channel: 1, data: 60 }, buttonMode: 'toggle', edge: 'press', minValue: 1 },
      ],
    };
    const surface = fakeSurface();
    applyControlMessage(parseControlMessage('p', noteOnBytes(1, 60, 100))!, state, surface, freshTakeover());
    applyControlMessage(parseControlMessage('p', noteOffBytes(1, 60))!, state, surface, freshTakeover());
    expect(surface.toggleMetronome).toHaveBeenCalledTimes(1);
  });
});

describe('applyControlMessage — continuous BPM', () => {
  it('absolute scaling maps 0→min and 127→max', () => {
    const state: ControlMapState = {
      version: 1,
      mappings: [
        {
          target: 'setBpm',
          source: { kind: 'cc', portId: 'p', channel: 1, data: 14 },
          continuous: { mode: 'absolute', min: 60, max: 200, takeover: false },
        },
      ],
    };
    const surface = fakeSurface();
    applyControlMessage(parseControlMessage('p', ccBytes(1, 14, 0))!, state, surface, freshTakeover());
    expect(surface.setBpm).toHaveBeenLastCalledWith(60);
    applyControlMessage(parseControlMessage('p', ccBytes(1, 14, 127))!, state, surface, freshTakeover());
    expect(surface.setBpm).toHaveBeenLastCalledWith(200);
  });

  it('soft takeover suppresses jumps until the current value is crossed', () => {
    const state: ControlMapState = {
      version: 1,
      mappings: [
        {
          target: 'setBpm',
          source: { kind: 'cc', portId: 'p', channel: 1, data: 14 },
          continuous: { mode: 'absolute', min: 60, max: 200, takeover: true },
        },
      ],
    };
    const surface = fakeSurface({ bpm: 120 });
    const takeover = freshTakeover();
    // value 21 → ~83 BPM (below current 120): no change yet
    applyControlMessage(parseControlMessage('p', ccBytes(1, 14, 21))!, state, surface, takeover);
    expect(surface.setBpm).not.toHaveBeenCalled();
    // value 110 → ~181 BPM, crosses 120: picks up
    applyControlMessage(parseControlMessage('p', ccBytes(1, 14, 110))!, state, surface, takeover);
    expect(surface.setBpm).toHaveBeenCalledTimes(1);
  });

  it('relative encoder steps up then down', () => {
    const state: ControlMapState = {
      version: 1,
      mappings: [
        {
          target: 'setBpm',
          source: { kind: 'cc', portId: 'p', channel: 1, data: 14 },
          continuous: { mode: 'relative', min: 60, max: 200, takeover: false, encoding: 'twosComplement', step: 1 },
        },
      ],
    };
    const surface = fakeSurface({ bpm: 120 });
    applyControlMessage(parseControlMessage('p', ccBytes(1, 14, 1))!, state, surface, freshTakeover());
    expect(surface.setBpm).toHaveBeenLastCalledWith(121);
    applyControlMessage(parseControlMessage('p', ccBytes(1, 14, 127))!, state, surface, freshTakeover());
    expect(surface.setBpm).toHaveBeenLastCalledWith(119);
  });
});

describe('applyControlMessage — enum', () => {
  it('cycle advances to the next quantize grid on press', () => {
    const state: ControlMapState = {
      version: 1,
      mappings: [
        { target: 'cycleQuantizeGrid', source: { kind: 'note', portId: 'p', channel: 1, data: 60 }, enumMode: 'cycle', minValue: 1 },
      ],
    };
    const surface = fakeSurface({ quantizeGrid: '1/4' }); // index 0 → next is '1/8'
    applyControlMessage(parseControlMessage('p', noteOnBytes(1, 60, 100))!, state, surface, freshTakeover());
    expect(surface.setQuantizeGrid).toHaveBeenCalledWith('1/8');
  });

  it('select maps the lowest quarter to the first option', () => {
    const state: ControlMapState = {
      version: 1,
      mappings: [
        { target: 'cycleQuantizeGrid', source: { kind: 'cc', portId: 'p', channel: 1, data: 20 }, enumMode: 'select' },
      ],
    };
    const surface = fakeSurface({ quantizeGrid: '1/32' });
    applyControlMessage(parseControlMessage('p', ccBytes(1, 20, 0))!, state, surface, freshTakeover());
    expect(surface.setQuantizeGrid).toHaveBeenCalledWith('1/4');
  });
});
