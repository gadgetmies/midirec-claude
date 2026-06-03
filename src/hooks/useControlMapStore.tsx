import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  assignSource,
  clearTarget,
  emptyControlMapState,
  parseControlMap,
  serializeControlMap,
  type ControlMapping,
  type ControlMapState,
  type ControlSource,
  type TargetKey,
} from '../midi/controlMap';
import { createControlMapStore, type ControlMapStore } from '../storage/controlMapStore';

export interface ControlMapStoreValue {
  /** The active mapping set. */
  state: ControlMapState;
  /** True once the persisted state has been loaded at app start. */
  loaded: boolean;
  /** Bind `source` to `target`, replacing only that target's existing mapping.
      A source may drive multiple targets, so other targets sharing the source
      are kept. Returns those other targets (empty when the source is new). */
  assign(target: TargetKey, source: ControlSource): TargetKey[];
  /** Remove the mapping for `target`. */
  clear(target: TargetKey): void;
  /** Merge a partial advanced-config patch into the mapping for `target`. */
  updateMapping(target: TargetKey, patch: Partial<ControlMapping>): void;
  /** Set the input ports the control receiver listens to (empty = all). */
  setListenInputs(ids: string[]): void;
  /** Serialize the active set to JSON for export. */
  exportJson(): string;
  /** Validate + migrate + replace the active set from JSON. Throws on an
      invalid payload, leaving the active set unchanged. */
  importJson(input: unknown): void;
}

const ControlMapStoreContext = createContext<ControlMapStoreValue | null>(null);

interface ControlMapStoreProviderProps {
  children: ReactNode;
  /** Test seam — defaults to the IndexedDB-backed store. */
  createStore?: () => Promise<ControlMapStore>;
}

export function ControlMapStoreProvider({ children, createStore }: ControlMapStoreProviderProps) {
  const [state, setState] = useState<ControlMapState>(emptyControlMapState);
  const [loaded, setLoaded] = useState(false);
  const storeRef = useRef<ControlMapStore | null>(null);
  const factory = createStore ?? createControlMapStore;

  // Mirror the latest state so synchronous actions (assign returning the
  // reassigned target, exportJson) read it without re-creating themselves.
  const stateRef = useRef(state);
  stateRef.current = state;

  // Load the persisted state once at start. Mappings referencing absent ports
  // are retained as-is (they simply won't match until the port appears).
  useEffect(() => {
    let cancelled = false;
    factory().then((store) => {
      if (cancelled) return;
      storeRef.current = store;
      store.load().then((persisted) => {
        if (cancelled) return;
        if (persisted) setState(persisted);
        setLoaded(true);
      });
    });
    return () => {
      cancelled = true;
    };
    // factory is stable for the provider's lifetime; intentionally run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on every change once loaded (avoid clobbering stored state with the
  // empty default before the initial load resolves).
  useEffect(() => {
    if (!loaded) return;
    storeRef.current?.save(state);
  }, [state, loaded]);

  const assign = useCallback<ControlMapStoreValue['assign']>((target, source) => {
    const result = assignSource(stateRef.current, target, source);
    setState(result.state);
    return result.alsoBoundTo;
  }, []);

  const clear = useCallback<ControlMapStoreValue['clear']>((target) => {
    setState((prev) => clearTarget(prev, target));
  }, []);

  const updateMapping = useCallback<ControlMapStoreValue['updateMapping']>((target, patch) => {
    setState((prev) => ({
      ...prev,
      mappings: prev.mappings.map((m) =>
        m.target === target ? { ...m, ...patch, target: m.target } : m,
      ),
    }));
  }, []);

  const setListenInputs = useCallback<ControlMapStoreValue['setListenInputs']>((ids) => {
    setState((prev) => ({ ...prev, listenInputIds: ids }));
  }, []);

  const exportJson = useCallback<ControlMapStoreValue['exportJson']>(
    () => serializeControlMap(stateRef.current),
    [],
  );

  const importJson = useCallback<ControlMapStoreValue['importJson']>((input) => {
    // parseControlMap throws on an invalid/unmigratable payload — surface it to
    // the caller and leave the active set unchanged.
    const next = parseControlMap(input);
    setState(next);
  }, []);

  const value = useMemo<ControlMapStoreValue>(
    () => ({ state, loaded, assign, clear, updateMapping, setListenInputs, exportJson, importJson }),
    [state, loaded, assign, clear, updateMapping, setListenInputs, exportJson, importJson],
  );

  return (
    <ControlMapStoreContext.Provider value={value}>{children}</ControlMapStoreContext.Provider>
  );
}

export function useControlMapStore(): ControlMapStoreValue {
  const ctx = useContext(ControlMapStoreContext);
  if (!ctx) {
    throw new Error('useControlMapStore must be used inside <ControlMapStoreProvider>');
  }
  return ctx;
}
