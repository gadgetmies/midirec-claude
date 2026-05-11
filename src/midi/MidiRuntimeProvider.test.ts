import { describe, expect, test } from 'vitest';
import {
  initialMidiRuntimeState,
  midiRuntimeReducer,
  type MidiRuntimeState,
} from './MidiRuntimeProvider';
import type { MidiDevice } from './access';

const fakeAccess = {} as unknown as MIDIAccess;
const dev = (id: string, state: 'connected' | 'disconnected' = 'connected'): MidiDevice => ({
  id,
  name: id,
  manufacturer: '',
  state,
});

describe('initialMidiRuntimeState', () => {
  test('unsupported when Web MIDI is missing', () => {
    expect(initialMidiRuntimeState(false)).toEqual({ status: 'unsupported' });
  });

  test('requesting when supported', () => {
    expect(initialMidiRuntimeState(true)).toEqual({ status: 'requesting' });
  });
});

describe('midiRuntimeReducer', () => {
  test('request transitions requesting to requesting (idempotent)', () => {
    const next = midiRuntimeReducer({ status: 'requesting' }, { type: 'request' });
    expect(next).toEqual({ status: 'requesting' });
  });

  test('request from denied transitions to requesting', () => {
    const next = midiRuntimeReducer(
      { status: 'denied', error: new Error('x') },
      { type: 'request' },
    );
    expect(next).toEqual({ status: 'requesting' });
  });

  test('request from unsupported is a no-op (unsupported is terminal)', () => {
    const next = midiRuntimeReducer({ status: 'unsupported' }, { type: 'request' });
    expect(next).toEqual({ status: 'unsupported' });
  });

  test('granted carries access plus device arrays', () => {
    const next = midiRuntimeReducer(
      { status: 'requesting' },
      {
        type: 'granted',
        access: fakeAccess,
        inputs: [dev('a'), dev('b')],
        outputs: [dev('c')],
      },
    );
    expect(next.status).toBe('granted');
    if (next.status !== 'granted') throw new Error('unreachable');
    expect(next.inputs).toHaveLength(2);
    expect(next.outputs).toHaveLength(1);
    expect(next.access).toBe(fakeAccess);
  });

  test('denied carries the error', () => {
    const err = new Error('nope');
    const next = midiRuntimeReducer({ status: 'requesting' }, { type: 'denied', error: err });
    expect(next).toEqual({ status: 'denied', error: err });
  });

  test('hotplug updates device arrays in granted state', () => {
    const state: MidiRuntimeState = {
      status: 'granted',
      access: fakeAccess,
      inputs: [dev('a')],
      outputs: [],
    };
    const next = midiRuntimeReducer(state, {
      type: 'hotplug',
      inputs: [dev('a'), dev('b')],
      outputs: [dev('c')],
    });
    expect(next.status).toBe('granted');
    if (next.status !== 'granted') throw new Error('unreachable');
    expect(next.inputs.map((d) => d.id)).toEqual(['a', 'b']);
    expect(next.outputs.map((d) => d.id)).toEqual(['c']);
    expect(next.access).toBe(fakeAccess);
  });

  test('hotplug outside granted state is ignored', () => {
    const next = midiRuntimeReducer(
      { status: 'requesting' },
      { type: 'hotplug', inputs: [dev('a')], outputs: [] },
    );
    expect(next).toEqual({ status: 'requesting' });
  });
});
