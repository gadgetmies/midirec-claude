/* Whole-page drop zone for .ndjson / .jsonl timeline files.

   Behaviour:
   - When the user drops a matching file, parse it and hydrate the editor.
   - If `isDirty === true`, pause the load and show a save-before-open modal
     (Save / Discard / Cancel). Save commits the current state under the
     user-typed name, then proceeds to the load. Discard loads without saving.
     Cancel keeps the existing editor state and drops the file.
   - Non-matching files are ignored with a warning toast. Multiple files are
     not supported in this slice — only the first is loaded.

   Exposes a render-prop API so the App.tsx mount site can render the
   pending modal (kept out of this hook so it stays render-tree-only). */

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
import { useTimelineStorage } from './useTimelineStorage';
import { useToast } from '../components/toast/Toast';
import {
  SaveBeforeOpenDialog,
  type SaveBeforeOpenChoice,
} from '../components/dialog/SaveBeforeOpenDialog';
import './useTimelineDrop.css';

const ACCEPTED_EXTENSIONS = ['.jsonl', '.ndjson'];

function isAcceptedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

interface PendingOpen {
  text: string;
  filename: string;
}

interface UseTimelineDropValue {
  /** Programmatically open a file (used by the toolstrip Upload action). */
  openFile: (file: File) => Promise<void>;
}

const TimelineDropContext = createContext<UseTimelineDropValue | null>(null);

export interface TimelineDropProviderProps {
  children: ReactNode;
}

export function TimelineDropProvider({ children }: TimelineDropProviderProps) {
  const storage = useTimelineStorage();
  const toast = useToast();
  const [pending, setPending] = useState<PendingOpen | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  /* Refs to avoid re-binding the document-level drop handler when the
     storage hook value changes (which it does after every save/load). */
  const storageRef = useRef(storage);
  storageRef.current = storage;
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const applyFileText = useCallback(async (text: string) => {
    await storageRef.current.loadTimelineFromJsonlText(text);
  }, []);

  const openFile = useCallback(async (file: File) => {
    if (!isAcceptedFile(file)) {
      toastRef.current.show(`Can’t open ${file.name} — expected .jsonl or .ndjson`, {
        kind: 'warn',
      });
      return;
    }
    const text = await file.text();
    if (storageRef.current.isDirty) {
      setPending({ text, filename: file.name });
      return;
    }
    await applyFileText(text);
  }, [applyFileText]);

  /* Track drag-enter / drag-leave on the document so the UI can show a
     drop overlay. Counter avoids the leave/enter flicker when the user
     drags over child elements (each child fires its own enter/leave). */
  useEffect(() => {
    let depth = 0;
    const hasFile = (e: DragEvent) => {
      return e.dataTransfer?.types?.includes('Files') ?? false;
    };
    const onEnter = (e: DragEvent) => {
      if (!hasFile(e)) return;
      depth++;
      setIsDragOver(true);
    };
    const onOver = (e: DragEvent) => {
      if (!hasFile(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFile(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setIsDragOver(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFile(e)) return;
      e.preventDefault();
      depth = 0;
      setIsDragOver(false);
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      void openFile(file);
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [openFile]);

  const handleResolve = useCallback(
    async (result: { choice: SaveBeforeOpenChoice; name: string }) => {
      const target = pending;
      setPending(null);
      if (!target) return;
      if (result.choice === 'cancel') return;
      if (result.choice === 'save') {
        await storageRef.current.saveCurrentTimeline(result.name);
      }
      await applyFileText(target.text);
    },
    [pending, applyFileText],
  );

  const value = useMemo<UseTimelineDropValue>(() => ({ openFile }), [openFile]);

  return (
    <TimelineDropContext.Provider value={value}>
      {children}
      {isDragOver && !pending && (
        <div className="mr-drop-overlay" role="status" aria-live="polite">
          <div className="mr-drop-overlay__card">Drop a .jsonl or .ndjson timeline to open</div>
        </div>
      )}
      {pending && (
        <SaveBeforeOpenDialog incomingLabel={pending.filename} onResolve={handleResolve} />
      )}
    </TimelineDropContext.Provider>
  );
}

export function useTimelineDrop(): UseTimelineDropValue {
  const ctx = useContext(TimelineDropContext);
  if (!ctx) {
    throw new Error('useTimelineDrop must be used inside <TimelineDropProvider>');
  }
  return ctx;
}
