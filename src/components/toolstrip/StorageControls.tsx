/* Toolstrip Save / Open controls. Two icon buttons:
   - Save: opens a popover with the name input, an in-browser Save button,
     and a Download button (writes the JSONL file to disk).
   - Open: opens a dropdown with the saved-timeline list (click-to-load) and
     an Upload row that picks a file from disk.

   Confirmation flow matches the sidebar StoragePanel: Load asks for a second
   click when the editor `isDirty`; the popover row swaps to "Load?". */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useStage } from '../../hooks/useStage';
import { useTimelineDrop } from '../../hooks/useTimelineDrop';
import { useTimelineStorage } from '../../hooks/useTimelineStorage';
import {
  DiskIcon,
  DownloadIcon,
  FolderOpenIcon,
  UploadIcon,
} from '../icons/transport';
import './StorageControls.css';

const NAME_MAX_CODE_POINTS = 80;
const CONFIRM_WINDOW_MS = 3000;

function trimToCodePoints(value: string, max: number): string {
  const codePoints = Array.from(value);
  if (codePoints.length <= max) return value;
  return codePoints.slice(0, max).join('');
}

export function StorageControls() {
  const storage = useTimelineStorage();
  const { entries, currentName, saveCurrentTimeline, loadTimeline, isDirty } = storage;
  const { openFile } = useTimelineDrop();
  const { openExportDialog } = useStage();

  /* Seed the name input from the currently-loaded timeline. The useEffect
     below syncs it whenever `currentName` changes — i.e. after a successful
     save / load / new — so re-saving under the same name is a one-click
     action. The user's in-flight typing isn't disturbed because the dep is
     only `currentName`, not every keystroke. */
  const [nameInput, setNameInput] = useState(currentName);
  useEffect(() => {
    setNameInput(currentName);
  }, [currentName]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [openOpen, setOpenOpen] = useState(false);
  const [pendingLoad, setPendingLoad] = useState<string | null>(null);
  const pendingTimerRef = useRef<number | null>(null);

  const saveBtnRef = useRef<HTMLButtonElement | null>(null);
  const savePopRef = useRef<HTMLDivElement | null>(null);
  const openBtnRef = useRef<HTMLButtonElement | null>(null);
  const openPopRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (pendingTimerRef.current != null) window.clearTimeout(pendingTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (saveOpen) {
      /* Focus the name input on open so typing is immediate. Microtask delay
         so the input is mounted before focus runs. */
      queueMicrotask(() => nameInputRef.current?.focus());
    }
  }, [saveOpen]);

  /* Close popovers on outside click + Escape. */
  useEffect(() => {
    if (!saveOpen && !openOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (saveOpen) {
        if (savePopRef.current?.contains(target)) return;
        if (saveBtnRef.current?.contains(target)) return;
        setSaveOpen(false);
      }
      if (openOpen) {
        if (openPopRef.current?.contains(target)) return;
        if (openBtnRef.current?.contains(target)) return;
        setOpenOpen(false);
        setPendingLoad(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSaveOpen(false);
        setOpenOpen(false);
        setPendingLoad(null);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [saveOpen, openOpen]);

  const clearPending = useCallback(() => {
    setPendingLoad(null);
    if (pendingTimerRef.current != null) {
      window.clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
  }, []);

  const armPending = useCallback((name: string) => {
    setPendingLoad(name);
    if (pendingTimerRef.current != null) window.clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = window.setTimeout(() => {
      setPendingLoad(null);
      pendingTimerRef.current = null;
    }, CONFIRM_WINDOW_MS);
  }, []);

  const trimmedName = nameInput.trim();
  const saveDisabled = trimmedName.length === 0;
  const overwrites = entries.some((e) => e.name === trimmedName);

  const handleSave = useCallback(async () => {
    if (saveDisabled) return;
    await saveCurrentTimeline(trimmedName);
    setSaveOpen(false);
  }, [saveDisabled, saveCurrentTimeline, trimmedName]);

  const handleDownload = useCallback(() => {
    setSaveOpen(false);
    openExportDialog();
  }, [openExportDialog]);

  const handleLoad = useCallback(
    async (name: string) => {
      if (isDirty && pendingLoad !== name) {
        armPending(name);
        return;
      }
      clearPending();
      setOpenOpen(false);
      await loadTimeline(name);
    },
    [isDirty, pendingLoad, armPending, clearPending, loadTimeline],
  );

  const handleUploadPick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = ''; // allow re-picking the same file
      if (!file) return;
      setOpenOpen(false);
      await openFile(file);
    },
    [openFile],
  );

  return (
    <>
      <span className="mr-tool-storage" data-mr-storage-toolstrip="true">
        <button
          ref={saveBtnRef}
          type="button"
          className="mr-tool"
          aria-haspopup="dialog"
          aria-expanded={saveOpen}
          aria-label="Save timeline"
          title="Save"
          onClick={() => {
            setSaveOpen((v) => !v);
            setOpenOpen(false);
          }}
        >
          <DiskIcon />
        </button>
        {saveOpen && (
          <div
            ref={savePopRef}
            className="mr-tool-storage__popover mr-tool-storage__popover--save"
            role="dialog"
            aria-label="Save timeline popover"
            data-mr-storage-toolstrip="true"
          >
            <label className="mr-tool-storage__label" htmlFor="mr-tool-storage-name">
              Name
            </label>
            <input
              ref={nameInputRef}
              id="mr-tool-storage-name"
              type="text"
              className="mr-tool-storage__name"
              placeholder="Name…"
              value={nameInput}
              maxLength={NAME_MAX_CODE_POINTS * 4}
              onChange={(e) =>
                setNameInput(trimToCodePoints(e.target.value, NAME_MAX_CODE_POINTS))
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleSave();
                }
              }}
            />
            <div className="mr-tool-storage__actions">
              <button
                type="button"
                className="mr-btn"
                disabled={saveDisabled}
                title={
                  saveDisabled
                    ? 'Enter a name to save'
                    : overwrites
                      ? `Overwrite ${trimmedName} in browser storage`
                      : `Save ${trimmedName} to browser storage`
                }
                onClick={() => void handleSave()}
              >
                {overwrites && !saveDisabled ? 'Overwrite' : 'Save'}
              </button>
              <button
                type="button"
                className="mr-btn"
                title="Open the export dialog (.mid / .jsonl)"
                onClick={handleDownload}
              >
                <DownloadIcon aria-hidden="true" />
                <span>Download</span>
              </button>
            </div>
          </div>
        )}
      </span>

      <span className="mr-tool-storage" data-mr-storage-toolstrip="true">
        <button
          ref={openBtnRef}
          type="button"
          className="mr-tool"
          aria-haspopup="menu"
          aria-expanded={openOpen}
          aria-label="Open timeline"
          title="Open"
          onClick={() => {
            setOpenOpen((v) => !v);
            setSaveOpen(false);
          }}
        >
          <FolderOpenIcon />
        </button>
        {openOpen && (
          <div
            ref={openPopRef}
            className="mr-tool-storage__popover mr-tool-storage__popover--open"
            role="menu"
            data-mr-storage-toolstrip="true"
          >
            {entries.length === 0 ? (
              <p className="mr-tool-storage__empty">No saved timelines</p>
            ) : (
              entries.map((entry) => {
                const confirming = pendingLoad === entry.name;
                return (
                  <button
                    key={entry.name}
                    type="button"
                    className="mr-tool-storage__popover-row"
                    data-confirming={confirming ? 'true' : undefined}
                    onClick={() => void handleLoad(entry.name)}
                    title={confirming ? 'Click again to load' : `Load ${entry.name}`}
                  >
                    <span className="mr-tool-storage__popover-name">{entry.name}</span>
                    {confirming && (
                      <span className="mr-tool-storage__popover-confirm">Load?</span>
                    )}
                  </button>
                );
              })
            )}
            <div className="mr-tool-storage__popover-divider" />
            <button
              type="button"
              className="mr-tool-storage__popover-row mr-tool-storage__popover-upload"
              onClick={handleUploadPick}
              title="Open a .jsonl or .ndjson file from disk"
            >
              <UploadIcon aria-hidden="true" />
              <span className="mr-tool-storage__popover-name">Upload .jsonl…</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jsonl,.ndjson,application/x-ndjson,application/json"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
        )}
      </span>
    </>
  );
}
