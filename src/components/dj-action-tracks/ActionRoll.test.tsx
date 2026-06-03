import { describe, expect, test, vi, afterEach, beforeAll } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { beatsToSessionTicks } from '../../midi/sessionTicks';
import {
  DEFAULT_ACTION_MAP,
  normalizeOutputMapping,
  type ActionMapEntry,
} from '../../data/dj';
import type { DJActionTrack } from '../../hooks/useDJActionTracks';
import { ActionRoll } from './ActionRoll';

const hz16 = beatsToSessionTicks(16);
const stageMock = vi.hoisted(() => ({
  djEventSelection: null as {
    trackId: string;
    pitch: number;
    eventIdx: number;
  } | null,
  djActionSelection: null as { trackId: string; pitch: number } | null,
  setDJEventSelection: vi.fn(),
  setDJActionSelection: vi.fn(),
  setDJEventTTicks: vi.fn(),
  pressureRenderMode: 'curve' as const,
}));

vi.mock('../../hooks/useStage', () => ({
  useStage: () => stageMock,
}));

beforeAll(() => {
  const proto = Element.prototype as unknown as {
    setPointerCapture?: (pointerId: number) => void;
    releasePointerCapture?: (pointerId: number) => void;
    hasPointerCapture?: (pointerId: number) => boolean;
  };
  if (typeof proto.setPointerCapture !== 'function') {
    const captured = new WeakMap<Element, Set<number>>();
    proto.setPointerCapture = function (this: Element, pointerId: number) {
      let set = captured.get(this);
      if (!set) {
        set = new Set();
        captured.set(this, set);
      }
      set.add(pointerId);
    };
    proto.releasePointerCapture = function (this: Element, pointerId: number) {
      captured.get(this)?.delete(pointerId);
    };
    proto.hasPointerCapture = function (this: Element, pointerId: number) {
      return captured.get(this)?.has(pointerId) ?? false;
    };
  }
});

afterEach(() => {
  cleanup();
  stageMock.djEventSelection = null;
  stageMock.djActionSelection = null;
  stageMock.setDJEventSelection.mockReset();
  stageMock.setDJActionSelection.mockReset();
  stageMock.setDJEventTTicks.mockReset();
});

/* Synthetic pad-only entry used by tests that need a velocity-sensitive
   action row. The seeded DEFAULT_ACTION_MAP no longer has any cue-family
   entry that is velocity-only (all are pressure-bearing). */
const velocityPad: ActionMapEntry = {
  id: 'velPad',
  cat: 'deck',
  label: 'Velocity Pad',
  short: 'VP',
  device: 'deck1',
  pad: true,
};

function miniTrack(over: Partial<DJActionTrack> = {}): DJActionTrack {
  return {
    id: 'dj1',
    name: 'DJ',
    color: '#fff',
    midiChannel: 1,
    actionMap: { 80: DEFAULT_ACTION_MAP[80]! },
    outputMap: {
      80: normalizeOutputMapping({ device: 'mixer', channel: 16, pitch: 80, cc: 16 }),
    },
    events: [{ pitch: 80, tTicks: 0, durTicks: beatsToSessionTicks(2), vel: 0.75 }],
    inputRouting: { channels: [] },
    outputRouting: { channels: [] },
    collapsed: false,
    muted: false,
    soloed: false,
    mutedRows: [],
    soloedRows: [],
    defaultMidiInputDeviceId: '',
    defaultMidiOutputDeviceId: '',
    ...over,
  };
}

function renderRoll(over: Partial<DJActionTrack> = {}, extraProps: Record<string, unknown> = {}) {
  return render(
    <ActionRoll
      track={miniTrack(over)}
      soloing={false}
      layoutHorizonTicks={hz16}
      pxPerBeat={88}
      rowHeight={24}
      playheadTicks={0}
      {...extraProps}
    />,
  );
}

describe('ActionRoll', () => {
  test('CC-output row renders mr-djtrack__cc, not velocity note class', () => {
    const { container } = renderRoll();
    expect(container.querySelector('.mr-djtrack__cc')).toBeTruthy();
    expect(container.querySelector('.mr-djtrack__note--velocity')).toBeNull();
  });

  test('deck trigger row still renders mr-djtrack__note--trigger', () => {
    const { container } = renderRoll({
      actionMap: { 48: DEFAULT_ACTION_MAP[48]! },
      outputMap: {},
      events: [{ pitch: 48, tTicks: 0, durTicks: beatsToSessionTicks(0.1), vel: 1 }],
    });
    expect(container.querySelector('.mr-djtrack__note--trigger')).toBeTruthy();
    expect(container.querySelector('.mr-djtrack__cc')).toBeNull();
  });

  test('pad row without CC output still uses velocity-sensitive note', () => {
    const { container } = renderRoll({
      actionMap: { 57: velocityPad },
      outputMap: {},
      events: [{ pitch: 57, tTicks: 0, durTicks: beatsToSessionTicks(1), vel: 0.5 }],
    });
    expect(container.querySelector('.mr-djtrack__note--velocity')).toBeTruthy();
    expect(container.querySelector('.mr-djtrack__cc')).toBeNull();
  });

  test('merges CC events on the same pitch when starts are under 1 beat apart', () => {
    const { container } = renderRoll({
      events: [
        { pitch: 80, tTicks: beatsToSessionTicks(1.2), durTicks: beatsToSessionTicks(0.1), vel: 0.5 },
        { pitch: 80, tTicks: beatsToSessionTicks(0.2), durTicks: beatsToSessionTicks(0.1), vel: 0.9 },
        { pitch: 80, tTicks: beatsToSessionTicks(0.6), durTicks: beatsToSessionTicks(0.1), vel: 0.7 },
      ],
    });
    expect(container.querySelectorAll('.mr-djtrack__cc').length).toBe(1);
  });

  test('keeps separate CC bars when starts are 1 beat apart or more', () => {
    const { container } = renderRoll({
      events: [
        { pitch: 80, tTicks: 0, durTicks: beatsToSessionTicks(0.1), vel: 0.5 },
        { pitch: 80, tTicks: beatsToSessionTicks(1), durTicks: beatsToSessionTicks(0.1), vel: 0.6 },
      ],
    });
    expect(container.querySelectorAll('.mr-djtrack__cc').length).toBe(2);
  });

  test('CC group uses one rect per message, merging colliding pixel columns', () => {
    const { container } = renderRoll({
      events: [
        { pitch: 80, tTicks: 0, durTicks: beatsToSessionTicks(0.05), vel: 0.3 },
        { pitch: 80, tTicks: beatsToSessionTicks(0.001), durTicks: beatsToSessionTicks(0.05), vel: 0.9 },
        { pitch: 80, tTicks: beatsToSessionTicks(0.5), durTicks: beatsToSessionTicks(0.05), vel: 0.5 },
      ],
    });
    expect(container.querySelectorAll('rect').length).toBe(2);
  });
});

describe('ActionRoll drag-to-move (single events)', () => {
  test('sub-threshold pointer motion fires selection, not move', () => {
    const { container } = renderRoll({
      actionMap: { 48: DEFAULT_ACTION_MAP[48]! },
      outputMap: {},
      events: [{ pitch: 48, tTicks: 0, durTicks: beatsToSessionTicks(0.1), vel: 1 }],
    });
    const note = container.querySelector('.mr-djtrack__note--trigger') as Element;
    fireEvent.pointerDown(note, { pointerId: 1, clientX: 50 });
    fireEvent.pointerMove(note, { pointerId: 1, clientX: 51 });
    fireEvent.pointerUp(note, { pointerId: 1, clientX: 51 });
    expect(stageMock.setDJEventSelection).toHaveBeenCalledTimes(1);
    expect(stageMock.setDJEventSelection).toHaveBeenCalledWith({
      trackId: 'dj1',
      pitch: 48,
      eventIdx: 0,
    });
    expect(stageMock.setDJEventTTicks).not.toHaveBeenCalled();
  });

  test('quantize-on drag snaps the delta to grid on commit', () => {
    const { container } = renderRoll(
      {
        actionMap: { 48: DEFAULT_ACTION_MAP[48]! },
        outputMap: {},
        events: [{ pitch: 48, tTicks: 0, durTicks: beatsToSessionTicks(0.1), vel: 1 }],
      },
      { quantizeOn: true, quantizeGrid: '1/16' },
    );
    const note = container.querySelector('.mr-djtrack__note--trigger') as Element;
    /* pxPerTick = 88/480; deltaPx = 27 → deltaTicksRaw = round(27 / (88/480)) = 147
       → snapped delta = round(147 / 120) * 120 = 120, finalTick = 0 + 120 = 120. */
    fireEvent.pointerDown(note, { pointerId: 1, clientX: 0 });
    fireEvent.pointerMove(note, { pointerId: 1, clientX: 27 });
    fireEvent.pointerUp(note, { pointerId: 1, clientX: 27 });
    expect(stageMock.setDJEventTTicks).toHaveBeenCalledTimes(1);
    expect(stageMock.setDJEventTTicks).toHaveBeenCalledWith('dj1', 48, 0, 120);
    expect(stageMock.setDJEventSelection).not.toHaveBeenCalled();
  });

  test('off-grid event preserves its offset when snap-dragged', () => {
    const { container } = renderRoll(
      {
        actionMap: { 48: DEFAULT_ACTION_MAP[48]! },
        outputMap: {},
        events: [{ pitch: 48, tTicks: 154, durTicks: beatsToSessionTicks(0.1), vel: 1 }],
      },
      { quantizeOn: true, quantizeGrid: '1/16' },
    );
    const note = container.querySelector('.mr-djtrack__note--trigger') as Element;
    /* deltaTicksRaw = round(22 / (88/480)) = 120, snapped = 120, final = 154+120 = 274. */
    fireEvent.pointerDown(note, { pointerId: 1, clientX: 0 });
    fireEvent.pointerMove(note, { pointerId: 1, clientX: 22 });
    fireEvent.pointerUp(note, { pointerId: 1, clientX: 22 });
    expect(stageMock.setDJEventTTicks).toHaveBeenCalledTimes(1);
    expect(stageMock.setDJEventTTicks).toHaveBeenCalledWith('dj1', 48, 0, 274);
  });

  test('quantize-off drag commits raw pixel-converted ticks', () => {
    const { container } = renderRoll(
      {
        actionMap: { 48: DEFAULT_ACTION_MAP[48]! },
        outputMap: {},
        events: [{ pitch: 48, tTicks: 480, durTicks: beatsToSessionTicks(0.1), vel: 1 }],
      },
      { quantizeOn: false },
    );
    const note = container.querySelector('.mr-djtrack__note--trigger') as Element;
    fireEvent.pointerDown(note, { pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(note, { pointerId: 1, clientX: 50 });
    fireEvent.pointerUp(note, { pointerId: 1, clientX: 50 });
    /* deltaPx = -50, deltaTicks = round(-50 / (88/480)) = round(-272.727) = -273. */
    expect(stageMock.setDJEventTTicks).toHaveBeenCalledTimes(1);
    expect(stageMock.setDJEventTTicks).toHaveBeenCalledWith('dj1', 48, 0, 480 - 273);
  });

  test('drag past the left edge clamps tick to 0', () => {
    const { container } = renderRoll({
      actionMap: { 48: DEFAULT_ACTION_MAP[48]! },
      outputMap: {},
      events: [{ pitch: 48, tTicks: 60, durTicks: beatsToSessionTicks(0.1), vel: 1 }],
    });
    const note = container.querySelector('.mr-djtrack__note--trigger') as Element;
    fireEvent.pointerDown(note, { pointerId: 1, clientX: 200 });
    fireEvent.pointerMove(note, { pointerId: 1, clientX: -4800 });
    fireEvent.pointerUp(note, { pointerId: 1, clientX: -4800 });
    expect(stageMock.setDJEventTTicks).toHaveBeenCalledTimes(1);
    expect(stageMock.setDJEventTTicks).toHaveBeenCalledWith('dj1', 48, 0, 0);
  });

  test('pointercancel aborts the gesture', () => {
    const { container } = renderRoll({
      actionMap: { 48: DEFAULT_ACTION_MAP[48]! },
      outputMap: {},
      events: [{ pitch: 48, tTicks: 100, durTicks: beatsToSessionTicks(0.1), vel: 1 }],
    });
    const note = container.querySelector('.mr-djtrack__note--trigger') as Element;
    fireEvent.pointerDown(note, { pointerId: 1, clientX: 0 });
    fireEvent.pointerMove(note, { pointerId: 1, clientX: 40 });
    fireEvent.pointerCancel(note, { pointerId: 1, clientX: 40 });
    expect(stageMock.setDJEventTTicks).not.toHaveBeenCalled();
    expect(stageMock.setDJEventSelection).not.toHaveBeenCalled();
  });

  test('absolute mode realigns an off-grid single event', () => {
    const { container } = renderRoll(
      {
        actionMap: { 48: DEFAULT_ACTION_MAP[48]! },
        outputMap: {},
        events: [{ pitch: 48, tTicks: 154, durTicks: beatsToSessionTicks(0.1), vel: 1 }],
      },
      { quantizeOn: true, quantizeGrid: '1/16', snapAbsoluteOn: true },
    );
    const note = container.querySelector('.mr-djtrack__note--trigger') as Element;
    /* deltaTicksRaw = 120; (154+120)/120 = 2.28 → round = 2 → finalTick = 240. */
    fireEvent.pointerDown(note, { pointerId: 1, clientX: 0 });
    fireEvent.pointerMove(note, { pointerId: 1, clientX: 22 });
    fireEvent.pointerUp(note, { pointerId: 1, clientX: 22 });
    expect(stageMock.setDJEventTTicks).toHaveBeenCalledTimes(1);
    expect(stageMock.setDJEventTTicks).toHaveBeenCalledWith('dj1', 48, 0, 240);
  });

  test('absolute mode with on-grid start equals delta mode for single events', () => {
    const { container, unmount } = renderRoll(
      {
        actionMap: { 48: DEFAULT_ACTION_MAP[48]! },
        outputMap: {},
        events: [{ pitch: 48, tTicks: 0, durTicks: beatsToSessionTicks(0.1), vel: 1 }],
      },
      { quantizeOn: true, quantizeGrid: '1/16', snapAbsoluteOn: true },
    );
    const note = container.querySelector('.mr-djtrack__note--trigger') as Element;
    fireEvent.pointerDown(note, { pointerId: 1, clientX: 0 });
    fireEvent.pointerMove(note, { pointerId: 1, clientX: 27 });
    fireEvent.pointerUp(note, { pointerId: 1, clientX: 27 });
    expect(stageMock.setDJEventTTicks).toHaveBeenCalledWith('dj1', 48, 0, 120);
    unmount();
    stageMock.setDJEventTTicks.mockReset();
    const r2 = renderRoll(
      {
        actionMap: { 48: DEFAULT_ACTION_MAP[48]! },
        outputMap: {},
        events: [{ pitch: 48, tTicks: 0, durTicks: beatsToSessionTicks(0.1), vel: 1 }],
      },
      { quantizeOn: true, quantizeGrid: '1/16' },
    );
    const note2 = r2.container.querySelector('.mr-djtrack__note--trigger') as Element;
    fireEvent.pointerDown(note2, { pointerId: 1, clientX: 0 });
    fireEvent.pointerMove(note2, { pointerId: 1, clientX: 27 });
    fireEvent.pointerUp(note2, { pointerId: 1, clientX: 27 });
    expect(stageMock.setDJEventTTicks).toHaveBeenCalledWith('dj1', 48, 0, 120);
  });

  test('snapAbsoluteOn has no effect on single event when quantize is off', () => {
    const { container } = renderRoll(
      {
        actionMap: { 48: DEFAULT_ACTION_MAP[48]! },
        outputMap: {},
        events: [{ pitch: 48, tTicks: 154, durTicks: beatsToSessionTicks(0.1), vel: 1 }],
      },
      { quantizeOn: false, snapAbsoluteOn: true },
    );
    const note = container.querySelector('.mr-djtrack__note--trigger') as Element;
    fireEvent.pointerDown(note, { pointerId: 1, clientX: 0 });
    fireEvent.pointerMove(note, { pointerId: 1, clientX: 100 });
    fireEvent.pointerUp(note, { pointerId: 1, clientX: 100 });
    expect(stageMock.setDJEventTTicks).toHaveBeenCalledTimes(1);
    expect(stageMock.setDJEventTTicks).toHaveBeenCalledWith(
      'dj1',
      48,
      0,
      154 + Math.round(100 / (88 / 480)),
    );
  });

  test('absolute mode clamps single event to non-negative', () => {
    const { container } = renderRoll(
      {
        actionMap: { 48: DEFAULT_ACTION_MAP[48]! },
        outputMap: {},
        events: [{ pitch: 48, tTicks: 60, durTicks: beatsToSessionTicks(0.1), vel: 1 }],
      },
      { quantizeOn: true, quantizeGrid: '1/16', snapAbsoluteOn: true },
    );
    const note = container.querySelector('.mr-djtrack__note--trigger') as Element;
    fireEvent.pointerDown(note, { pointerId: 1, clientX: 200 });
    fireEvent.pointerMove(note, { pointerId: 1, clientX: -4800 });
    fireEvent.pointerUp(note, { pointerId: 1, clientX: -4800 });
    expect(stageMock.setDJEventTTicks).toHaveBeenCalledTimes(1);
    expect(stageMock.setDJEventTTicks).toHaveBeenCalledWith('dj1', 48, 0, 0);
  });

  test('absolute mode commits exactly once per gesture for single events', () => {
    const { container } = renderRoll(
      {
        actionMap: { 48: DEFAULT_ACTION_MAP[48]! },
        outputMap: {},
        events: [{ pitch: 48, tTicks: 154, durTicks: beatsToSessionTicks(0.1), vel: 1 }],
      },
      { quantizeOn: true, quantizeGrid: '1/16', snapAbsoluteOn: true },
    );
    const note = container.querySelector('.mr-djtrack__note--trigger') as Element;
    fireEvent.pointerDown(note, { pointerId: 1, clientX: 0 });
    fireEvent.pointerMove(note, { pointerId: 1, clientX: 11 });
    fireEvent.pointerMove(note, { pointerId: 1, clientX: 16 });
    fireEvent.pointerMove(note, { pointerId: 1, clientX: 22 });
    fireEvent.pointerUp(note, { pointerId: 1, clientX: 22 });
    expect(stageMock.setDJEventTTicks).toHaveBeenCalledTimes(1);
  });

  test('velocity-sensitive event is draggable', () => {
    const { container } = renderRoll(
      {
        actionMap: { 57: velocityPad },
        outputMap: {},
        events: [{ pitch: 57, tTicks: 0, durTicks: beatsToSessionTicks(1), vel: 0.5 }],
      },
      { quantizeOn: false },
    );
    const note = container.querySelector('.mr-djtrack__note--velocity') as Element;
    fireEvent.pointerDown(note, { pointerId: 1, clientX: 0 });
    fireEvent.pointerMove(note, { pointerId: 1, clientX: 88 });
    fireEvent.pointerUp(note, { pointerId: 1, clientX: 88 });
    expect(stageMock.setDJEventTTicks).toHaveBeenCalledTimes(1);
    /* 88 px ÷ (88/480) = 480. */
    expect(stageMock.setDJEventTTicks).toHaveBeenCalledWith('dj1', 57, 0, 480);
  });
});

describe('ActionRoll drag-to-move (CC groups)', () => {
  test('CC group drag shifts every member by the same delta', () => {
    const { container } = renderRoll(
      {
        events: [
          { pitch: 80, tTicks: 480, durTicks: beatsToSessionTicks(0.1), vel: 0.3 },
          { pitch: 80, tTicks: 540, durTicks: beatsToSessionTicks(0.1), vel: 0.6 },
          { pitch: 80, tTicks: 600, durTicks: beatsToSessionTicks(0.1), vel: 0.9 },
        ],
      },
      { quantizeOn: false },
    );
    const cc = container.querySelector('.mr-djtrack__cc') as Element;
    /* Earliest member at 480; deltaPx=44 → rawDelta=round(44 / (88/480))=240 ticks.
       quantize off → earliestFinal = 480+240 = 720, groupDelta = 240 →
       members commit at 720, 780, 840 (relative spacing preserved). */
    fireEvent.pointerDown(cc, { pointerId: 1, clientX: 0 });
    fireEvent.pointerMove(cc, { pointerId: 1, clientX: 44 });
    fireEvent.pointerUp(cc, { pointerId: 1, clientX: 44 });
    expect(stageMock.setDJEventTTicks).toHaveBeenCalledTimes(3);
    expect(stageMock.setDJEventTTicks).toHaveBeenNthCalledWith(1, 'dj1', 80, 0, 720);
    expect(stageMock.setDJEventTTicks).toHaveBeenNthCalledWith(2, 'dj1', 80, 1, 780);
    expect(stageMock.setDJEventTTicks).toHaveBeenNthCalledWith(3, 'dj1', 80, 2, 840);
  });

  test('CC group sub-threshold pointer motion still selects the group', () => {
    const { container } = renderRoll({
      events: [
        { pitch: 80, tTicks: 0, durTicks: beatsToSessionTicks(0.1), vel: 0.3 },
        { pitch: 80, tTicks: 100, durTicks: beatsToSessionTicks(0.1), vel: 0.6 },
      ],
    });
    const cc = container.querySelector('.mr-djtrack__cc') as Element;
    fireEvent.pointerDown(cc, { pointerId: 1, clientX: 10 });
    fireEvent.pointerMove(cc, { pointerId: 1, clientX: 11 });
    fireEvent.pointerUp(cc, { pointerId: 1, clientX: 11 });
    expect(stageMock.setDJEventSelection).toHaveBeenCalledTimes(1);
    expect(stageMock.setDJEventSelection).toHaveBeenCalledWith({
      trackId: 'dj1',
      pitch: 80,
      eventIdx: 0,
    });
    expect(stageMock.setDJEventTTicks).not.toHaveBeenCalled();
  });

  test('absolute mode realigns CC group by its earliest member', () => {
    const { container } = renderRoll(
      {
        events: [
          { pitch: 80, tTicks: 154, durTicks: beatsToSessionTicks(0.1), vel: 0.3 },
          { pitch: 80, tTicks: 214, durTicks: beatsToSessionTicks(0.1), vel: 0.6 },
          { pitch: 80, tTicks: 274, durTicks: beatsToSessionTicks(0.1), vel: 0.9 },
        ],
      },
      { quantizeOn: true, quantizeGrid: '1/16', snapAbsoluteOn: true },
    );
    const cc = container.querySelector('.mr-djtrack__cc') as Element;
    /* deltaTicksRaw = round(22 / (88/480)) = 120
       earliestFinal = round((154+120)/120)*120 = 240
       groupDelta = 240-154 = 86 → members: 240, 300, 360. */
    fireEvent.pointerDown(cc, { pointerId: 1, clientX: 0 });
    fireEvent.pointerMove(cc, { pointerId: 1, clientX: 22 });
    fireEvent.pointerUp(cc, { pointerId: 1, clientX: 22 });
    expect(stageMock.setDJEventTTicks).toHaveBeenCalledTimes(3);
    expect(stageMock.setDJEventTTicks).toHaveBeenNthCalledWith(1, 'dj1', 80, 0, 240);
    expect(stageMock.setDJEventTTicks).toHaveBeenNthCalledWith(2, 'dj1', 80, 1, 300);
    expect(stageMock.setDJEventTTicks).toHaveBeenNthCalledWith(3, 'dj1', 80, 2, 360);
  });

  test('delta mode CC group preserves off-grid offsets (regression guard)', () => {
    const { container } = renderRoll(
      {
        events: [
          { pitch: 80, tTicks: 154, durTicks: beatsToSessionTicks(0.1), vel: 0.3 },
          { pitch: 80, tTicks: 214, durTicks: beatsToSessionTicks(0.1), vel: 0.6 },
          { pitch: 80, tTicks: 274, durTicks: beatsToSessionTicks(0.1), vel: 0.9 },
        ],
      },
      { quantizeOn: true, quantizeGrid: '1/16' },
    );
    const cc = container.querySelector('.mr-djtrack__cc') as Element;
    fireEvent.pointerDown(cc, { pointerId: 1, clientX: 0 });
    fireEvent.pointerMove(cc, { pointerId: 1, clientX: 22 });
    fireEvent.pointerUp(cc, { pointerId: 1, clientX: 22 });
    expect(stageMock.setDJEventTTicks).toHaveBeenCalledTimes(3);
    expect(stageMock.setDJEventTTicks).toHaveBeenNthCalledWith(1, 'dj1', 80, 0, 274);
    expect(stageMock.setDJEventTTicks).toHaveBeenNthCalledWith(2, 'dj1', 80, 1, 334);
    expect(stageMock.setDJEventTTicks).toHaveBeenNthCalledWith(3, 'dj1', 80, 2, 394);
  });

  test('absolute mode clamps CC group earliest to non-negative', () => {
    const { container } = renderRoll(
      {
        events: [
          { pitch: 80, tTicks: 60, durTicks: beatsToSessionTicks(0.1), vel: 0.3 },
          { pitch: 80, tTicks: 120, durTicks: beatsToSessionTicks(0.1), vel: 0.6 },
        ],
      },
      { quantizeOn: true, quantizeGrid: '1/16', snapAbsoluteOn: true },
    );
    const cc = container.querySelector('.mr-djtrack__cc') as Element;
    /* huge negative drag: earliestFinal clamps to 0, groupDelta = -60. */
    fireEvent.pointerDown(cc, { pointerId: 1, clientX: 1000 });
    fireEvent.pointerMove(cc, { pointerId: 1, clientX: -5000 });
    fireEvent.pointerUp(cc, { pointerId: 1, clientX: -5000 });
    expect(stageMock.setDJEventTTicks).toHaveBeenCalledTimes(2);
    expect(stageMock.setDJEventTTicks).toHaveBeenNthCalledWith(1, 'dj1', 80, 0, 0);
    expect(stageMock.setDJEventTTicks).toHaveBeenNthCalledWith(2, 'dj1', 80, 1, 60);
  });

  test('pointercancel mid-drag leaves the group untouched', () => {
    const { container } = renderRoll({
      events: [
        { pitch: 80, tTicks: 0, durTicks: beatsToSessionTicks(0.1), vel: 0.3 },
        { pitch: 80, tTicks: 100, durTicks: beatsToSessionTicks(0.1), vel: 0.6 },
      ],
    });
    const cc = container.querySelector('.mr-djtrack__cc') as Element;
    fireEvent.pointerDown(cc, { pointerId: 1, clientX: 0 });
    fireEvent.pointerMove(cc, { pointerId: 1, clientX: 80 });
    fireEvent.pointerCancel(cc, { pointerId: 1, clientX: 80 });
    expect(stageMock.setDJEventTTicks).not.toHaveBeenCalled();
    expect(stageMock.setDJEventSelection).not.toHaveBeenCalled();
  });
});
