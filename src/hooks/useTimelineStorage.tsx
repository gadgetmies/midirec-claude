/* useTimelineStorage — save / load / list / delete / new for named timeline
   payloads. The only allowed caller of each provider's `hydrate(...)`.

   Contract: see openspec/changes/timeline-storage/specs/timeline-storage/spec.md.
   Provider boundary rule: see openspec/changes/timeline-storage/specs/app-shell/spec.md. */

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
  PayloadShapeError,
  PayloadVersionError,
  deserializeTimeline,
  emptySessionPayload,
  serializeTimeline,
  type DeserializedSlices,
  type SerializeInput,
  type TimelinePayload,
  type TransportAuthoringSlice,
} from '../storage/timelinePayload';
import {
  JSONL_FILE_EXT,
  parseTimelineJsonl,
  serializeTimelineToJsonl,
} from '../storage/timelineJsonl';
import {
  StorageQuotaError,
  createTimelineStore,
  type TimelineStore,
  type TimelineSummary,
} from '../storage/timelineStore';
import { useStage } from './useStage';
import { useTransport } from './useTransport';
import { useToast } from '../components/toast/Toast';

export interface UseTimelineStorageValue {
  entries: TimelineSummary[];
  /** Name of the timeline currently in the editor — set after a successful
      save / load (and cleared on `newTimeline()`). Empty when the editor
      holds unsaved-from-scratch content. */
  currentName: string;
  saveCurrentTimeline: (name: string) => Promise<void>;
  loadTimeline: (name: string) => Promise<void>;
  deleteTimeline: (name: string) => Promise<void>;
  newTimeline: () => Promise<void>;
  /** Serialise the current editor state to JSONL and trigger a file download. */
  downloadCurrentTimelineJsonl: (name: string) => void;
  /** Parse the given JSONL text and hydrate the editor with it. Returns the
      name from the payload's meta line (or empty string if unnamed). Stops a
      running recorder before hydration, the same way `loadTimeline` does. */
  loadTimelineFromJsonlText: (text: string) => Promise<{ name: string } | null>;
  /** True iff the current editor state differs from the last save / load /
      new snapshot. Computed lazily on access. */
  readonly isDirty: boolean;
}

const TimelineStorageContext = createContext<UseTimelineStorageValue | null>(null);

function transportAuthoringFromTransport(t: {
  bpm: number;
  sig: string;
  quantizeOn: boolean;
  quantizeGrid: TransportAuthoringSlice['quantizeGrid'];
  snapAbsoluteOn: boolean;
  looping: boolean;
  metronomeOn: boolean;
  clockSource: TransportAuthoringSlice['clockSource'];
}): TransportAuthoringSlice {
  return {
    bpm: t.bpm,
    sig: t.sig,
    quantizeOn: t.quantizeOn,
    quantizeGrid: t.quantizeGrid,
    snapAbsoluteOn: t.snapAbsoluteOn,
    looping: t.looping,
    metronomeOn: t.metronomeOn,
    clockSource: t.clockSource,
  };
}

export function TimelineStorageProvider({ children }: { children: ReactNode }) {
  const stage = useStage();
  const transport = useTransport();
  const toast = useToast();

  const storeRef = useRef<TimelineStore | null>(null);
  const fallbackToastedRef = useRef(false);
  const [entries, setEntries] = useState<TimelineSummary[]>([]);
  const [currentName, setCurrentName] = useState<string>('');

  /* The "clean" payload — set on each save / load / new. `isDirty` is true
     iff a fresh snapshot serialises to something different. */
  const lastSnapshotRef = useRef<string | null>(null);

  /* Capture stage / transport / toast snapshots in refs so async work always
     reads the latest values without needing to re-bind closures.
     `useToast()` returns a fresh object per render — using `toast` directly
     in useEffect / useCallback deps would re-fire those on every render. */
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const transportRef = useRef(transport);
  transportRef.current = transport;
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const collectSerializeInput = useCallback((): SerializeInput => {
    const s = stageRef.current;
    const t = transportRef.current;
    return {
      channels: s.channels,
      rolls: s.rolls,
      lanes: s.lanes,
      djActionTracks: s.djActionTracks,
      transport: transportAuthoringFromTransport(t),
      loopRegion: s.loopRegion,
    };
  }, []);

  const snapshotString = useCallback((): string => {
    const payload = serializeTimeline(collectSerializeInput(), '');
    return JSON.stringify(payload.session);
  }, [collectSerializeInput]);

  const markClean = useCallback(() => {
    lastSnapshotRef.current = snapshotString();
  }, [snapshotString]);

  const refreshEntries = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return;
    try {
      const list = await store.list();
      setEntries(list);
    } catch (err) {
      toastRef.current.show(`Couldn’t read saved timelines (${(err as Error).message})`, { kind: 'warn' });
    }
  }, []);

  /* Open the store on mount. The fallback path emits exactly one toast even
     across StrictMode double-invokes. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const store = await createTimelineStore({
        onFallback: () => {
          if (!fallbackToastedRef.current) {
            fallbackToastedRef.current = true;
            toastRef.current.show('Storage unavailable — saved timelines won’t survive reload', {
              kind: 'warn',
              durationMs: 4000,
            });
          }
        },
      });
      if (cancelled) return;
      storeRef.current = store;
      markClean();
      await refreshEntries();
    })();
    return () => {
      cancelled = true;
    };
  }, [markClean, refreshEntries]);

  const saveCurrentTimeline = useCallback(
    async (rawName: string) => {
      const store = storeRef.current;
      if (!store) return;
      const name = rawName.trim();
      if (name.length === 0) return;

      // Stop a running recorder so its buffered notes commit before serialise.
      if (transportRef.current.recording) {
        transportRef.current.stop();
      }

      const isOverwrite = entries.some((e) => e.name === name);
      const payload = serializeTimeline(collectSerializeInput(), name);
      try {
        await store.put(payload);
      } catch (err) {
        if (err instanceof StorageQuotaError) {
          toastRef.current.show('Storage full — delete a saved timeline to free space', {
            kind: 'warn',
          });
        } else {
          toastRef.current.show(`Couldn’t save ${name} (${(err as Error).message})`, {
            kind: 'warn',
          });
        }
        return;
      }
      lastSnapshotRef.current = JSON.stringify(payload.session);
      setCurrentName(name);
      await refreshEntries();
      toastRef.current.show(isOverwrite ? `Overwrote ${name}` : `Saved ${name}`, { kind: 'ok' });
    },
    [entries, collectSerializeInput, refreshEntries],
  );

  const loadTimeline = useCallback(
    async (name: string) => {
      const store = storeRef.current;
      if (!store) return;
      let payload: TimelinePayload | null = null;
      try {
        payload = await store.get(name);
      } catch (err) {
        toastRef.current.show(`Couldn’t read ${name} (${(err as Error).message})`, { kind: 'warn' });
        return;
      }
      if (!payload) {
        toastRef.current.show(`Couldn’t find ${name}`, { kind: 'warn' });
        return;
      }
      try {
        const slices = deserializeTimeline(payload);
        transportRef.current.stop();
        const s = stageRef.current;
        s.channelsHydrate(slices.channels);
        s.djActionTracksHydrate(slices.djActionTracks);
        transportRef.current.hydrate(slices.transportAuthoring);
        s.hydrateLoopRegion(slices.loopRegion);
        lastSnapshotRef.current = JSON.stringify(payload.session);
        setCurrentName(name);
        toastRef.current.show(`Loaded ${name}`, { kind: 'ok' });
      } catch (err) {
        if (err instanceof PayloadVersionError) {
          toastRef.current.show(`Can’t open ${name} — saved in an incompatible version`, {
            kind: 'warn',
          });
          return;
        }
        if (err instanceof PayloadShapeError) {
          toastRef.current.show(`Couldn’t load ${name} — payload is malformed`, { kind: 'warn' });
          return;
        }
        throw err;
      }
    },
    [],
  );

  const deleteTimeline = useCallback(
    async (name: string) => {
      const store = storeRef.current;
      if (!store) return;
      try {
        await store.delete(name);
      } catch (err) {
        toastRef.current.show(`Couldn’t delete ${name} (${(err as Error).message})`, {
          kind: 'warn',
        });
        return;
      }
      await refreshEntries();
      toastRef.current.show(`Deleted ${name}`, { kind: 'ok' });
    },
    [refreshEntries],
  );

  const newTimeline = useCallback(async () => {
    transportRef.current.stop();
    const empty = emptySessionPayload();
    const s = stageRef.current;
    s.channelsHydrate({ channels: empty.channels, rolls: empty.rolls, lanes: empty.lanes });
    s.djActionTracksHydrate(empty.djActionTracks);
    transportRef.current.hydrate(empty.transportAuthoring);
    s.hydrateLoopRegion(empty.loopRegion);
    /* Record what the editor SHOULD serialise to after hydration finishes.
       Reading from stageRef here would capture the pre-hydrate state. */
    lastSnapshotRef.current = JSON.stringify({
      channels: empty.channels,
      rolls: empty.rolls,
      lanes: empty.lanes,
      djActionTracks: empty.djActionTracks,
      transportAuthoring: empty.transportAuthoring,
      loopRegion: empty.loopRegion,
    });
    setCurrentName('');
    toastRef.current.show('New session', { kind: 'ok' });
  }, []);

  const applyDeserializedSlices = useCallback((slices: DeserializedSlices) => {
    transportRef.current.stop();
    const s = stageRef.current;
    s.channelsHydrate(slices.channels);
    s.djActionTracksHydrate(slices.djActionTracks);
    transportRef.current.hydrate(slices.transportAuthoring);
    s.hydrateLoopRegion(slices.loopRegion);
    lastSnapshotRef.current = JSON.stringify({
      channels: slices.channels.channels,
      rolls: slices.channels.rolls,
      lanes: slices.channels.lanes,
      djActionTracks: slices.djActionTracks,
      transportAuthoring: slices.transportAuthoring,
      loopRegion: slices.loopRegion,
    });
  }, []);

  const downloadCurrentTimelineJsonl = useCallback(
    (rawName: string) => {
      const trimmed = rawName.trim();
      const input = collectSerializeInput();
      const text = serializeTimelineToJsonl({ ...input, name: trimmed });
      const filename = `${trimmed.length > 0 ? trimmed : 'timeline'}.${JSONL_FILE_EXT}`;
      const blob = new Blob([text], { type: 'application/x-ndjson' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toastRef.current.show(`Downloaded ${filename}`, { kind: 'ok' });
    },
    [collectSerializeInput],
  );

  const loadTimelineFromJsonlText = useCallback(
    async (text: string) => {
      try {
        const parsed = parseTimelineJsonl(text);
        applyDeserializedSlices(parsed.slices);
        setCurrentName(parsed.name);
        const label = parsed.name.length > 0 ? parsed.name : 'timeline';
        toastRef.current.show(`Loaded ${label}`, { kind: 'ok' });
        return { name: parsed.name };
      } catch (err) {
        if (err instanceof PayloadVersionError) {
          toastRef.current.show(
            `Can’t open dropped file — saved in an incompatible version (v${err.payloadVersion})`,
            { kind: 'warn' },
          );
          return null;
        }
        if (err instanceof PayloadShapeError) {
          toastRef.current.show(`Couldn’t parse dropped file — ${err.message}`, { kind: 'warn' });
          return null;
        }
        throw err;
      }
    },
    [applyDeserializedSlices],
  );

  const value = useMemo<UseTimelineStorageValue>(() => {
    return {
      entries,
      currentName,
      saveCurrentTimeline,
      loadTimeline,
      deleteTimeline,
      newTimeline,
      downloadCurrentTimelineJsonl,
      loadTimelineFromJsonlText,
      get isDirty() {
        const baseline = lastSnapshotRef.current;
        if (baseline === null) return false;
        return baseline !== snapshotString();
      },
    };
  }, [
    entries,
    currentName,
    saveCurrentTimeline,
    loadTimeline,
    deleteTimeline,
    newTimeline,
    downloadCurrentTimelineJsonl,
    loadTimelineFromJsonlText,
    snapshotString,
  ]);

  return (
    <TimelineStorageContext.Provider value={value}>{children}</TimelineStorageContext.Provider>
  );
}

export function useTimelineStorage(): UseTimelineStorageValue {
  const ctx = useContext(TimelineStorageContext);
  if (!ctx) {
    throw new Error('useTimelineStorage must be used inside <TimelineStorageProvider>');
  }
  return ctx;
}
