import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  __resetAccessCacheForTests,
  listInputs,
  listOutputs,
  requestAccess,
  subscribe,
  toMidiDevice,
} from './access';

type FakePort = Pick<MIDIInput, 'id' | 'name' | 'manufacturer' | 'state' | 'type'>;

function makePort(over: Partial<FakePort>): FakePort {
  return {
    id: 'port-1',
    name: 'Test Port',
    manufacturer: 'Test Mfr',
    state: 'connected',
    type: 'input',
    ...over,
  };
}

function makeAccess(inputs: FakePort[], outputs: FakePort[]): MIDIAccess {
  const inputMap = new Map(inputs.map((p) => [p.id, p as unknown as MIDIInput]));
  const outputMap = new Map(outputs.map((p) => [p.id, p as unknown as MIDIOutput]));
  const listeners = new Set<(event: Event) => void>();
  return {
    inputs: inputMap as unknown as MIDIAccess['inputs'],
    outputs: outputMap as unknown as MIDIAccess['outputs'],
    sysexEnabled: false,
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'statechange' && typeof listener === 'function') {
        listeners.add(listener);
      }
    },
    removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'statechange' && typeof listener === 'function') {
        listeners.delete(listener);
      }
    },
    dispatchEvent: (event: Event) => {
      listeners.forEach((l) => l(event));
      return true;
    },
    onstatechange: null,
  } as unknown as MIDIAccess;
}

afterEach(() => {
  __resetAccessCacheForTests();
});

describe('toMidiDevice', () => {
  test('passes through full name and manufacturer', () => {
    const result = toMidiDevice(makePort({ id: 'a', name: 'Korg', manufacturer: 'Korg Inc' }) as MIDIInput);
    expect(result).toEqual({ id: 'a', name: 'Korg', manufacturer: 'Korg Inc', state: 'connected' });
  });

  test('empty name falls back to (unnamed device)', () => {
    const result = toMidiDevice(makePort({ name: '' }) as MIDIInput);
    expect(result.name).toBe('(unnamed device)');
  });

  test('null/undefined manufacturer falls back to empty string', () => {
    const port = makePort({ manufacturer: undefined as unknown as string });
    const result = toMidiDevice(port as MIDIInput);
    expect(result.manufacturer).toBe('');
  });

  test('preserves connected vs disconnected state', () => {
    expect(toMidiDevice(makePort({ state: 'connected' }) as MIDIInput).state).toBe('connected');
    expect(toMidiDevice(makePort({ state: 'disconnected' }) as MIDIInput).state).toBe(
      'disconnected',
    );
  });
});

describe('requestAccess', () => {
  test('invokes the request function at most once across repeated calls', async () => {
    const access = makeAccess([], []);
    const requestFn = vi.fn().mockResolvedValue(access);
    const first = requestAccess(requestFn);
    const second = requestAccess(requestFn);
    await Promise.all([first, second]);
    expect(requestFn).toHaveBeenCalledTimes(1);
    const third = await requestAccess(requestFn);
    expect(third).toBe(access);
    expect(requestFn).toHaveBeenCalledTimes(1);
  });

  test('caches the rejection so re-calls return the same error without re-invoking', async () => {
    const requestFn = vi.fn().mockRejectedValue(new Error('denied'));
    await expect(requestAccess(requestFn)).rejects.toThrow('denied');
    await expect(requestAccess(requestFn)).rejects.toThrow('denied');
    expect(requestFn).toHaveBeenCalledTimes(1);
  });
});

describe('subscribe', () => {
  test('forwards statechange events and unsubscribes cleanly', () => {
    const access = makeAccess([], []);
    const listener = vi.fn();
    const unsubscribe = subscribe(access, listener);
    access.dispatchEvent(new Event('statechange'));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    access.dispatchEvent(new Event('statechange'));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('listInputs / listOutputs', () => {
  test('map ports through toMidiDevice', () => {
    const access = makeAccess(
      [makePort({ id: 'in1', name: 'In 1' }), makePort({ id: 'in2', name: '' })],
      [makePort({ id: 'out1', name: 'Out 1', type: 'output' })],
    );
    expect(listInputs(access).map((d) => d.id)).toEqual(['in1', 'in2']);
    expect(listInputs(access)[1]!.name).toBe('(unnamed device)');
    expect(listOutputs(access).map((d) => d.id)).toEqual(['out1']);
  });
});
