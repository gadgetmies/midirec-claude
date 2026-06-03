import { describe, expect, it, vi } from 'vitest';
import {
  emitFeedback,
  feedbackEmissionsForState,
  type FeedbackEmission,
} from './controlFeedback';
import type { ControlMapState, ControlSurface, FeedbackConfig, TargetKey } from './controlMap';
import type { ClockOutput } from './clockSender';

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

const fb: FeedbackConfig = {
  enabled: true,
  portId: 'led-port',
  channel: 1,
  kind: 'note',
  data: 36,
  onValue: 127,
  offValue: 0,
};

const loopFeedback: ControlMapState = {
  version: 1,
  mappings: [
    {
      target: 'toggleLoop',
      source: { kind: 'note', portId: 'ctrl', channel: 1, data: 60 },
      feedback: fb,
    },
  ],
};

describe('feedbackEmissionsForState', () => {
  it('emits onValue when a toggle target turns on', () => {
    const last = new Map<TargetKey, number>();
    // seed last with off so the on-transition registers a change
    feedbackEmissionsForState(loopFeedback, fakeSurface({ looping: false }), last);
    const emissions = feedbackEmissionsForState(loopFeedback, fakeSurface({ looping: true }), last);
    expect(emissions).toHaveLength(1);
    expect(emissions[0]).toMatchObject({ portId: 'led-port', kind: 'note', data: 36, value: 127 });
  });

  it('does not re-emit when the state is unchanged', () => {
    const last = new Map<TargetKey, number>();
    feedbackEmissionsForState(loopFeedback, fakeSurface({ looping: true }), last);
    const again = feedbackEmissionsForState(loopFeedback, fakeSurface({ looping: true }), last);
    expect(again).toHaveLength(0);
  });

  it('force-emits the current state for an initial sync', () => {
    const last = new Map<TargetKey, number>();
    const emissions = feedbackEmissionsForState(loopFeedback, fakeSurface({ looping: false }), last, {
      force: true,
    });
    expect(emissions).toHaveLength(1);
    expect(emissions[0]!.value).toBe(0); // offValue
  });

  it('ignores mappings without feedback enabled', () => {
    const noFb: ControlMapState = {
      version: 1,
      mappings: [{ target: 'toggleLoop', source: { kind: 'note', portId: 'c', channel: 1, data: 60 } }],
    };
    expect(feedbackEmissionsForState(noFb, fakeSurface(), new Map(), { force: true })).toHaveLength(0);
  });
});

describe('emitFeedback', () => {
  function makeOutput(id: string): ClockOutput & { sent: number[][] } {
    const sent: number[][] = [];
    return { id, sent, send: (data) => sent.push(Array.from(data as number[])) };
  }

  it('sends a note message to the resolved output port', () => {
    const out = makeOutput('led-port');
    const emissions: FeedbackEmission[] = [
      { portId: 'led-port', channel: 1, kind: 'note', data: 36, value: 127 },
    ];
    emitFeedback(emissions, (id) => (id === 'led-port' ? out : null));
    expect(out.sent).toHaveLength(1);
    expect(out.sent[0]).toEqual([0x90, 36, 127]);
  });

  it('silently skips when the feedback port is missing', () => {
    const emissions: FeedbackEmission[] = [
      { portId: 'absent', channel: 1, kind: 'note', data: 36, value: 127 },
    ];
    expect(() => emitFeedback(emissions, () => null)).not.toThrow();
  });
});
