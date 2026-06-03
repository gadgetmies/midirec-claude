import { describe, expect, it, vi } from 'vitest';
import {
  assignSource,
  decodeRelative,
  defaultMappingFor,
  enumCycleIndex,
  enumSelectIndex,
  firesOnEdge,
  matchSource,
  matchesActiveMapping,
  nextToggleState,
  passesThreshold,
  phraseSeekMs,
  scaleAbsolute,
  sourcesEqual,
  takeoverCrossed,
  TARGET_REGISTRY,
  type ControlMapState,
  type ControlSource,
  type ControlSurface,
} from './controlMap';
import type { MidiLearnWireMessage } from './midiLearn';

function noteOn(
  portId: string,
  channel1to16: number,
  note: number,
  velocity = 100,
): MidiLearnWireMessage {
  return { kind: 'noteOn', portId, channel1to16, note, velocity };
}

function cc(
  portId: string,
  channel1to16: number,
  controller: number,
  value = 64,
): MidiLearnWireMessage {
  return { kind: 'controlChange', portId, channel1to16, controller, value };
}

function pressure(portId: string, channel1to16: number, p = 50): MidiLearnWireMessage {
  return { kind: 'channelPressure', portId, channel1to16, pressure: p };
}

function pitchBend(portId: string, channel1to16: number, value14 = 8192): MidiLearnWireMessage {
  return { kind: 'pitchBend', portId, channel1to16, value14 };
}

const noteSource: ControlSource = {
  kind: 'note',
  portId: 'port-A',
  channel: 1,
  data: 60,
};

describe('matchSource', () => {
  it('matches a note message on the same port, channel, and note', () => {
    expect(matchSource(noteSource, noteOn('port-A', 1, 60))).toBe(true);
  });

  it('does not match a different note number', () => {
    expect(matchSource(noteSource, noteOn('port-A', 1, 61))).toBe(false);
  });

  it('does not match a different channel', () => {
    expect(matchSource(noteSource, noteOn('port-A', 2, 60))).toBe(false);
  });

  it('does not match a different message kind', () => {
    expect(matchSource(noteSource, cc('port-A', 1, 60))).toBe(false);
  });

  describe('port specificity', () => {
    it('does not match a different port id when anyPort is false', () => {
      expect(matchSource({ ...noteSource, anyPort: false }, noteOn('port-B', 1, 60))).toBe(false);
    });

    it('matches any port id when anyPort is true', () => {
      expect(matchSource({ ...noteSource, anyPort: true }, noteOn('port-B', 1, 60))).toBe(true);
    });
  });

  describe('cc sources', () => {
    const ccSource: ControlSource = { kind: 'cc', portId: 'port-A', channel: 3, data: 14 };
    it('matches a CC by controller number', () => {
      expect(matchSource(ccSource, cc('port-A', 3, 14))).toBe(true);
    });
    it('does not match a different controller number', () => {
      expect(matchSource(ccSource, cc('port-A', 3, 15))).toBe(false);
    });
  });

  describe('pressure and pitch-bend sources ignore data', () => {
    it('matches channel pressure on channel regardless of data', () => {
      const src: ControlSource = { kind: 'pressure', portId: 'port-A', channel: 5, data: 0 };
      expect(matchSource(src, pressure('port-A', 5))).toBe(true);
    });
    it('matches pitch bend on channel regardless of data', () => {
      const src: ControlSource = { kind: 'pb', portId: 'port-A', channel: 7, data: 0 };
      expect(matchSource(src, pitchBend('port-A', 7))).toBe(true);
    });
  });
});

describe('matchesActiveMapping', () => {
  const state: ControlMapState = {
    version: 1,
    mappings: [
      { target: 'play', source: { kind: 'note', portId: 'port-A', channel: 1, data: 60 } },
      { target: 'setBpm', source: { kind: 'cc', portId: 'port-A', channel: 1, data: 14 } },
    ],
  };

  it('returns true when a parsed message matches a mapping source', () => {
    expect(matchesActiveMapping(noteOn('port-A', 1, 60), state)).toBe(true);
  });

  it('returns true for a CC matching another mapping', () => {
    expect(matchesActiveMapping(cc('port-A', 1, 14), state)).toBe(true);
  });

  it('returns false when no mapping matches', () => {
    expect(matchesActiveMapping(noteOn('port-A', 1, 62), state)).toBe(false);
  });

  it('returns false for a null message (e.g. System Real-Time bytes never parse)', () => {
    expect(matchesActiveMapping(null, state)).toBe(false);
  });

  it('returns false against an empty mapping set', () => {
    expect(matchesActiveMapping(noteOn('port-A', 1, 60), { version: 1, mappings: [] })).toBe(false);
  });
});

/* ── Advanced-rule helpers (task 1.5) ───────────────────────────────────── */

describe('passesThreshold', () => {
  it('passes when value meets the threshold', () => {
    expect(passesThreshold(10, 10)).toBe(true);
  });
  it('fails when value is below the threshold', () => {
    expect(passesThreshold(5, 10)).toBe(false);
  });
  it('defaults to a minimum of 1 when undefined', () => {
    expect(passesThreshold(0, undefined)).toBe(false);
    expect(passesThreshold(1, undefined)).toBe(true);
  });
});

describe('firesOnEdge', () => {
  it('fires on press when the mapping edge is press (default)', () => {
    expect(firesOnEdge(undefined, 'press')).toBe(true);
    expect(firesOnEdge(undefined, 'release')).toBe(false);
  });
  it('fires on release when the mapping edge is release', () => {
    expect(firesOnEdge('release', 'release')).toBe(true);
    expect(firesOnEdge('release', 'press')).toBe(false);
  });
});

describe('nextToggleState', () => {
  it('toggle mode flips on press and ignores release', () => {
    expect(nextToggleState('toggle', 'press', false)).toBe(true);
    expect(nextToggleState('toggle', 'press', true)).toBe(false);
    expect(nextToggleState('toggle', 'release', false)).toBeNull();
  });
  it('momentary mode enables on press and disables on release', () => {
    expect(nextToggleState('momentary', 'press', false)).toBe(true);
    expect(nextToggleState('momentary', 'release', true)).toBe(false);
  });
});

describe('scaleAbsolute', () => {
  it('maps 0 to min and 127 to max', () => {
    expect(scaleAbsolute(0, 60, 200)).toBe(60);
    expect(scaleAbsolute(127, 60, 200)).toBe(200);
  });
  it('maps the midpoint near the centre of the range', () => {
    expect(scaleAbsolute(64, 0, 127)).toBeCloseTo(64, 0);
  });
});

describe('takeoverCrossed', () => {
  it('reports crossing when the current value lies between readings', () => {
    expect(takeoverCrossed(120, 90, 130)).toBe(true);
  });
  it('reports no crossing when both readings are on one side', () => {
    expect(takeoverCrossed(120, 80, 90)).toBe(false);
  });
});

describe('decodeRelative', () => {
  it('decodes twos-complement increments and decrements', () => {
    expect(decodeRelative(1, 'twosComplement')).toBe(1);
    expect(decodeRelative(127, 'twosComplement')).toBe(-1);
  });
  it('decodes offset-binary (64-centred) increments and decrements', () => {
    expect(decodeRelative(65, 'offsetBinary')).toBe(1);
    expect(decodeRelative(63, 'offsetBinary')).toBe(-1);
  });
  it('decodes sign-magnitude increments and decrements', () => {
    expect(decodeRelative(0x01, 'signMagnitude')).toBe(1);
    expect(decodeRelative(0x41, 'signMagnitude')).toBe(-1);
  });
});

describe('enum stepping', () => {
  it('enumCycleIndex advances and wraps', () => {
    expect(enumCycleIndex(0, 4)).toBe(1);
    expect(enumCycleIndex(3, 4)).toBe(0);
  });
  it('enumSelectIndex maps the lowest quarter to the first option', () => {
    expect(enumSelectIndex(0, 4)).toBe(0);
    expect(enumSelectIndex(20, 4)).toBe(0);
  });
  it('enumSelectIndex maps the top of the range to the last option', () => {
    expect(enumSelectIndex(127, 4)).toBe(3);
  });
});

describe('phraseSeekMs', () => {
  it('advances by N bars snapped to the bar', () => {
    // 4/4 at 120 BPM: 1 bar = 4 beats * 500ms = 2000ms; 8 bars = 16000ms.
    expect(phraseSeekMs(0, 120, '4/4', 8, 1)).toBe(16000);
  });
  it('clamps backward jumps at zero', () => {
    expect(phraseSeekMs(2000, 120, '4/4', 8, -1)).toBe(0);
  });
});

/* ── Target registry (task 1.3) ─────────────────────────────────────────── */

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

describe('TARGET_REGISTRY', () => {
  it('declares key, label, kind, dispatch, and stateSelector for every target', () => {
    for (const def of Object.values(TARGET_REGISTRY)) {
      expect(typeof def.key).toBe('string');
      expect(typeof def.label).toBe('string');
      expect(['trigger', 'toggle', 'continuous', 'enum']).toContain(def.kind);
      expect(typeof def.dispatch).toBe('function');
      expect(typeof def.stateSelector).toBe('function');
    }
  });

  it('a trigger target dispatches its transport action', () => {
    const surface = fakeSurface();
    TARGET_REGISTRY.rewind.dispatch(surface);
    expect(surface.rewind).toHaveBeenCalledTimes(1);
  });

  it('the play target toggles play/pause', () => {
    const stopped = fakeSurface({ playing: false });
    TARGET_REGISTRY.play.dispatch(stopped);
    expect(stopped.play).toHaveBeenCalledTimes(1);

    const playing = fakeSurface({ playing: true });
    TARGET_REGISTRY.play.dispatch(playing);
    expect(playing.pause).toHaveBeenCalledTimes(1);
  });

  it('the play target resumes recording when a take is stamped (matches the UI)', () => {
    const stamped = fakeSurface({ playing: false, recordingStartedAt: 1234 });
    TARGET_REGISTRY.play.dispatch(stamped);
    expect(stamped.record).toHaveBeenCalledTimes(1);
    expect(stamped.play).not.toHaveBeenCalled();
  });

  it('phraseForward dispatches with the bars value', () => {
    const surface = fakeSurface();
    TARGET_REGISTRY.phraseForward.dispatch(surface, 8);
    expect(surface.phraseForward).toHaveBeenCalledWith(8);
  });

  it('a toggle target flips when dispatched with no value', () => {
    const surface = fakeSurface({ looping: false });
    TARGET_REGISTRY.toggleLoop.dispatch(surface);
    expect(surface.toggleLoop).toHaveBeenCalledTimes(1);
  });

  it('a toggle target only toggles to reach the desired value (momentary)', () => {
    const on = fakeSurface({ looping: true });
    TARGET_REGISTRY.toggleLoop.dispatch(on, 1); // already on → no flip
    expect(on.toggleLoop).not.toHaveBeenCalled();

    const off = fakeSurface({ looping: false });
    TARGET_REGISTRY.toggleLoop.dispatch(off, 1); // off → on
    expect(off.toggleLoop).toHaveBeenCalledTimes(1);
  });

  it('the continuous target sets bpm to the resolved value', () => {
    const surface = fakeSurface();
    TARGET_REGISTRY.setBpm.dispatch(surface, 128);
    expect(surface.setBpm).toHaveBeenCalledWith(128);
  });

  it('an enum target sets the option at the given index', () => {
    const surface = fakeSurface();
    TARGET_REGISTRY.cycleQuantizeGrid.dispatch(surface, 0); // index 0 = '1/4'
    expect(surface.setQuantizeGrid).toHaveBeenCalledWith('1/4');
  });

  it('toggle stateSelector reads the boolean state', () => {
    expect(TARGET_REGISTRY.toggleLoop.stateSelector(fakeSurface({ looping: true }))).toBe(true);
  });

  it('enum stateSelector reads the current option', () => {
    expect(
      TARGET_REGISTRY.cycleQuantizeGrid.stateSelector(fakeSurface({ quantizeGrid: '1/8' })),
    ).toBe('1/8');
  });
});

/* ── Per-kind defaults + conflict resolution (tasks 1.2 / 1.6) ──────────── */

describe('defaultMappingFor', () => {
  it('gives a trigger target a press edge and a min value', () => {
    const m = defaultMappingFor('play', { kind: 'note', portId: 'p', channel: 1, data: 60 });
    expect(m.edge).toBe('press');
    expect(m.minValue).toBe(1);
  });
  it('gives a toggle target a toggle button mode', () => {
    const m = defaultMappingFor('toggleLoop', { kind: 'note', portId: 'p', channel: 1, data: 60 });
    expect(m.buttonMode).toBe('toggle');
  });
  it('gives setBpm an absolute 60-200 range with takeover', () => {
    const m = defaultMappingFor('setBpm', { kind: 'cc', portId: 'p', channel: 1, data: 14 });
    expect(m.continuous).toEqual(
      expect.objectContaining({ mode: 'absolute', min: 60, max: 200, takeover: true }),
    );
  });
  it('gives an enum target a cycle mode', () => {
    const m = defaultMappingFor('cycleQuantizeGrid', {
      kind: 'note',
      portId: 'p',
      channel: 1,
      data: 60,
    });
    expect(m.enumMode).toBe('cycle');
  });
  it('gives a phrase target a default bars-per-phrase of 8', () => {
    const m = defaultMappingFor('phraseForward', {
      kind: 'note',
      portId: 'p',
      channel: 1,
      data: 60,
    });
    expect(m.barsPerPhrase).toBe(8);
  });
});

describe('sourcesEqual', () => {
  const a: ControlSource = { kind: 'note', portId: 'p', channel: 1, data: 60 };
  it('treats identical sources as equal', () => {
    expect(sourcesEqual(a, { ...a })).toBe(true);
  });
  it('treats different data as not equal', () => {
    expect(sourcesEqual(a, { ...a, data: 61 })).toBe(false);
  });
});

describe('assignSource (multi-target binding)', () => {
  const src: ControlSource = { kind: 'note', portId: 'p', channel: 1, data: 60 };

  it('adds a fresh mapping when the source and target are both new', () => {
    const state: ControlMapState = { version: 1, mappings: [] };
    const { state: next, alsoBoundTo } = assignSource(state, 'play', src);
    expect(next.mappings).toHaveLength(1);
    expect(next.mappings[0]!.target).toBe('play');
    expect(alsoBoundTo).toEqual([]);
  });

  it('keeps both targets when a source is bound to a second target', () => {
    const state: ControlMapState = {
      version: 1,
      mappings: [{ target: 'play', source: src }],
    };
    const { state: next, alsoBoundTo } = assignSource(state, 'record', src);
    expect(next.mappings).toHaveLength(2);
    expect(next.mappings.map((m) => m.target).sort()).toEqual(['play', 'record']);
    // Both still carry the same source (one event drives both).
    expect(next.mappings.every((m) => m.source.data === 60)).toBe(true);
    expect(alsoBoundTo).toEqual(['play']);
  });

  it('replaces the existing source when the target is relearned', () => {
    const oldSrc: ControlSource = { kind: 'note', portId: 'p', channel: 1, data: 50 };
    const state: ControlMapState = {
      version: 1,
      mappings: [{ target: 'play', source: oldSrc }],
    };
    const { state: next } = assignSource(state, 'play', src);
    expect(next.mappings).toHaveLength(1);
    expect(next.mappings[0]!.source.data).toBe(60);
  });
});
