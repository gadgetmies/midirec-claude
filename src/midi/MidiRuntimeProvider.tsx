import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { useToast } from '../components/toast/Toast';
import {
  isSupported,
  listInputs,
  listOutputs,
  requestAccess,
  subscribe,
  type MidiDevice,
  type RequestMIDIAccessFn,
} from './access';

export type MidiRuntimeStatus = 'unsupported' | 'requesting' | 'granted' | 'denied';

export type MidiRuntimeState =
  | { status: 'unsupported' }
  | { status: 'requesting' }
  | { status: 'granted'; access: MIDIAccess; inputs: MidiDevice[]; outputs: MidiDevice[] }
  | { status: 'denied'; error: Error };

export type MidiRuntimeAction =
  | { type: 'request' }
  | { type: 'granted'; access: MIDIAccess; inputs: MidiDevice[]; outputs: MidiDevice[] }
  | { type: 'denied'; error: Error }
  | { type: 'hotplug'; inputs: MidiDevice[]; outputs: MidiDevice[] };

export function midiRuntimeReducer(
  state: MidiRuntimeState,
  action: MidiRuntimeAction,
): MidiRuntimeState {
  switch (action.type) {
    case 'request':
      if (state.status === 'unsupported') return state;
      return { status: 'requesting' };
    case 'granted':
      return {
        status: 'granted',
        access: action.access,
        inputs: action.inputs,
        outputs: action.outputs,
      };
    case 'denied':
      return { status: 'denied', error: action.error };
    case 'hotplug':
      if (state.status !== 'granted') return state;
      return { ...state, inputs: action.inputs, outputs: action.outputs };
    default:
      return state;
  }
}

export function initialMidiRuntimeState(supported: boolean): MidiRuntimeState {
  if (!supported) return { status: 'unsupported' };
  return { status: 'requesting' };
}

interface MidiRuntimeValue {
  state: MidiRuntimeState;
  retry: () => void;
}

const MidiRuntimeContext = createContext<MidiRuntimeValue | null>(null);

interface MidiRuntimeProviderProps {
  children: ReactNode;
  /** Test seam — defaults to navigator.requestMIDIAccess. */
  requestMIDIAccessImpl?: RequestMIDIAccessFn;
  /** Test seam — defaults to typeof navigator.requestMIDIAccess === 'function'. */
  supported?: boolean;
}

export function MidiRuntimeProvider({
  children,
  requestMIDIAccessImpl,
  supported,
}: MidiRuntimeProviderProps) {
  const supportedInit = supported ?? isSupported();
  const [state, dispatch] = useReducer(
    midiRuntimeReducer,
    supportedInit,
    initialMidiRuntimeState,
  );
  const grantToastFiredRef = useRef(false);
  const requestEpochRef = useRef(0);
  const toast = useToast();

  const runRequest = useCallback(() => {
    const epoch = ++requestEpochRef.current;
    requestAccess(requestMIDIAccessImpl).then(
      (access) => {
        if (epoch !== requestEpochRef.current) return;
        dispatch({
          type: 'granted',
          access,
          inputs: listInputs(access),
          outputs: listOutputs(access),
        });
      },
      (err: unknown) => {
        if (epoch !== requestEpochRef.current) return;
        const error = err instanceof Error ? err : new Error(String(err));
        dispatch({ type: 'denied', error });
      },
    );
  }, [requestMIDIAccessImpl]);

  useEffect(() => {
    if (state.status === 'unsupported') return;
    if (state.status === 'requesting') {
      runRequest();
    }
  }, [state.status, runRequest]);

  useEffect(() => {
    if (state.status !== 'granted') return;
    const { access } = state;
    return subscribe(access, () => {
      dispatch({
        type: 'hotplug',
        inputs: listInputs(access),
        outputs: listOutputs(access),
      });
    });
  }, [state.status, state.status === 'granted' ? state.access : null]);

  useEffect(() => {
    if (state.status !== 'granted' || grantToastFiredRef.current) return;
    grantToastFiredRef.current = true;
    const n = state.inputs.length;
    const m = state.outputs.length;
    const inputWord = n === 1 ? 'input' : 'inputs';
    const outputWord = m === 1 ? 'output' : 'outputs';
    toast.show(`MIDI ready · ${n} ${inputWord} · ${m} ${outputWord}`, { kind: 'ok' });
  }, [state, toast]);

  const retry = useCallback(() => {
    if (state.status === 'unsupported' || state.status === 'granted') return;
    dispatch({ type: 'request' });
  }, [state.status]);

  const value = useMemo<MidiRuntimeValue>(() => ({ state, retry }), [state, retry]);

  return <MidiRuntimeContext.Provider value={value}>{children}</MidiRuntimeContext.Provider>;
}

export function useMidiRuntime(): MidiRuntimeValue {
  const ctx = useContext(MidiRuntimeContext);
  if (!ctx) {
    throw new Error('useMidiRuntime must be used inside <MidiRuntimeProvider>');
  }
  return ctx;
}

export interface MidiInputsValue {
  status: MidiRuntimeStatus;
  inputs: MidiDevice[];
}

export function useMidiInputs(): MidiInputsValue {
  const ctx = useContext(MidiRuntimeContext);
  if (!ctx) {
    throw new Error('useMidiInputs must be used inside <MidiRuntimeProvider>');
  }
  const { state } = ctx;
  if (state.status === 'granted') return { status: state.status, inputs: state.inputs };
  return { status: state.status, inputs: [] };
}

export interface MidiOutputsValue {
  status: MidiRuntimeStatus;
  outputs: MidiDevice[];
}

export function useMidiOutputs(): MidiOutputsValue {
  const ctx = useContext(MidiRuntimeContext);
  if (!ctx) {
    throw new Error('useMidiOutputs must be used inside <MidiRuntimeProvider>');
  }
  const { state } = ctx;
  if (state.status === 'granted') return { status: state.status, outputs: state.outputs };
  return { status: state.status, outputs: [] };
}
