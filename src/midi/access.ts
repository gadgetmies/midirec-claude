export type MidiDevice = {
  id: string;
  name: string;
  manufacturer: string;
  state: 'connected' | 'disconnected';
};

export type RequestMIDIAccessFn = NonNullable<Navigator['requestMIDIAccess']>;

type AccessCache =
  | { kind: 'idle' }
  | { kind: 'pending'; promise: Promise<MIDIAccess> }
  | { kind: 'resolved'; access: MIDIAccess }
  | { kind: 'rejected'; error: Error };

let cache: AccessCache = { kind: 'idle' };

export function isSupported(nav: Navigator = navigator): boolean {
  return typeof nav.requestMIDIAccess === 'function';
}

export function requestAccess(
  requestFn: RequestMIDIAccessFn = navigator.requestMIDIAccess!.bind(navigator),
): Promise<MIDIAccess> {
  if (cache.kind === 'pending') return cache.promise;
  if (cache.kind === 'resolved') return Promise.resolve(cache.access);
  if (cache.kind === 'rejected') return Promise.reject(cache.error);
  const promise = requestFn({ sysex: false })
    .then((access) => {
      cache = { kind: 'resolved', access };
      return access;
    })
    .catch((err: unknown) => {
      const error = err instanceof Error ? err : new Error(String(err));
      cache = { kind: 'rejected', error };
      throw error;
    });
  cache = { kind: 'pending', promise };
  return promise;
}

/** Reset the cached access. For tests only. */
export function __resetAccessCacheForTests(): void {
  cache = { kind: 'idle' };
}

export function subscribe(
  access: MIDIAccess,
  listener: (event: MIDIConnectionEvent) => void,
): () => void {
  const handler = (event: Event) => listener(event as MIDIConnectionEvent);
  access.addEventListener('statechange', handler);
  return () => access.removeEventListener('statechange', handler);
}

export function toMidiDevice(port: MIDIInput | MIDIOutput): MidiDevice {
  return {
    id: port.id,
    name: port.name && port.name.length > 0 ? port.name : '(unnamed device)',
    manufacturer: port.manufacturer ?? '',
    state: port.state,
  };
}

export function listInputs(access: MIDIAccess): MidiDevice[] {
  return Array.from(access.inputs.values()).map(toMidiDevice);
}

export function listOutputs(access: MIDIAccess): MidiDevice[] {
  return Array.from(access.outputs.values()).map(toMidiDevice);
}
