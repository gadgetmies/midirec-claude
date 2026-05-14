import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type SyntheticEvent,
} from 'react';
import { useStage } from '../../hooks/useStage';
import { useToast } from '../toast/Toast';
import type {
  ChannelId,
  ParamLane,
  PianoRollTrack,
} from '../../hooks/useChannels';
import {
  buildExportRows,
  collectDjExportJsonLines,
  computeResolvedExportRange,
  countDjCatalogEvents,
  countExportTallyEvents,
  type ExportRow,
} from '../../session/exportDialogModel';
import {
  EXPORT_FILENAME_EXT,
  type ExportFormatChoice,
  useExportDialogRange,
  useExportFormatChoice,
} from './exportDialogRange';
import { ExportFormatCard } from './ExportFormatCard';
import { ExportRangeRadio } from './ExportRangeRadio';
import './Dialog.css';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultFilename(format: ExportFormatChoice): string {
  return `session-${todayISO()}.${EXPORT_FILENAME_EXT[format]}`;
}

function countChannelArtifacts(
  channelId: ChannelId,
  rolls: PianoRollTrack[],
  lanes: ParamLane[],
): { notes: number; points: number } {
  let notes = 0;
  let points = 0;
  for (const r of rolls) {
    if (r.channelId === channelId) notes += r.notes.length;
  }
  for (const l of lanes) {
    if (l.channelId === channelId) points += l.points.length;
  }
  return { notes, points };
}

function downloadTextBlob(contents: string, filename: string, mimeType: string): void {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /mac/i.test(navigator.platform || navigator.userAgent || '');
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (el) =>
      el instanceof HTMLElement &&
      !el.hasAttribute('disabled') &&
      el.offsetParent !== null,
  ) as HTMLElement[];
}

function initialTracksOn(rows: ExportRow[]) {
  return new Set(rows.map((r) => r.key));
}

export function ExportDialog() {
  const stage = useStage();
  const {
    channels,
    rolls,
    lanes,
    djActionTracks,
    resolvedSelection,
    loopRegion,
    closeExportDialog,
    soloing,
  } = stage;
  const { show: showToast } = useToast();

  const [format, setFormat] = useExportFormatChoice();
  const [filename, setFilename] = useState(() => defaultFilename('mid'));
  const [userEdited, setUserEdited] = useState(false);
  const [range, setRange] = useExportDialogRange();
  const [tracksOn, setTracksOn] = useState(() =>
    initialTracksOn(buildExportRows(channels, rolls, lanes, djActionTracks)),
  );
  const [quantize, setQuantize] = useState(false);
  const [includeCC, setIncludeCC] = useState(true);

  const dialogRef = useRef(null as HTMLDivElement | null);
  const previousFocusRef = useRef(null as Element | null);

  const exportRows = useMemo(
    () => buildExportRows(channels, rolls, lanes, djActionTracks),
    [channels, rolls, lanes, djActionTracks],
  );

  const selectionAvailable = resolvedSelection !== null;
  const loopAvailable = loopRegion !== null;

  const resolvedRange = useMemo(
    () =>
      computeResolvedExportRange(range, rolls, lanes, djActionTracks, resolvedSelection, loopRegion),
    [range, rolls, lanes, djActionTracks, resolvedSelection, loopRegion],
  );

  const eventCount = useMemo(
    () =>
      countExportTallyEvents(
        rolls,
        lanes,
        djActionTracks,
        resolvedRange,
        tracksOn,
        includeCC,
        soloing,
      ),
    [rolls, lanes, djActionTracks, resolvedRange, tracksOn, includeCC, soloing],
  );

  const bars = useMemo(() => {
    const span = resolvedRange[1] - resolvedRange[0];
    return Math.round((span / 4) * 10) / 10;
  }, [resolvedRange]);

  const tracksCheckedCount = tracksOn.size;
  const canSave = eventCount > 0 && tracksOn.size > 0 && resolvedRange[1] > resolvedRange[0];

  const channelById = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);

  const djTrackById = useMemo(() => new Map(djActionTracks.map((t) => [t.id, t])), [djActionTracks]);

  const handleFormatChange = useCallback(
    (next: ExportFormatChoice) => {
      setFormat(next);
      if (!userEdited) setFilename(defaultFilename(next));
    },
    [userEdited],
  );

  const handleFilenameChange = useCallback((value: string) => {
    setFilename(value);
    setUserEdited(true);
  }, []);

  const toggleRow = useCallback((key: string) => {
    setTracksOn((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleSave = useCallback(() => {
    if (!canSave) return;

    const [t0, t1] = resolvedRange;
    const safeName = filename.trim() || defaultFilename(format);

    if (format === 'jsonl') {
      const objs = collectDjExportJsonLines(djActionTracks, tracksOn, soloing, [t0, t1]);
      const text = objs.map((o) => JSON.stringify(o)).join('\n') + (objs.length ? '\n' : '');
      downloadTextBlob(text, safeName, 'application/json');
    }

    showToast(`Exported "${safeName}" · ${eventCount} events`);
    closeExportDialog();
  }, [
    canSave,
    resolvedRange,
    filename,
    format,
    djActionTracks,
    tracksOn,
    soloing,
    eventCount,
    showToast,
    closeExportDialog,
  ]);

  const handleScrimClick = useCallback(
    (e: SyntheticEvent) => {
      if (e.target === e.currentTarget) closeExportDialog();
    },
    [closeExportDialog],
  );

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const root = dialogRef.current;
    if (root) {
      const focusables = getFocusable(root);
      if (focusables.length > 0) focusables[0].focus();
    }
    return () => {
      const prev = previousFocusRef.current;
      if (prev instanceof HTMLElement) prev.focus();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closeExportDialog();
        return;
      }
      const cmdOrCtrl = isMacPlatform() ? e.metaKey : e.ctrlKey;
      if (cmdOrCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (canSave) handleSave();
        return;
      }
      if (e.key === 'Tab') {
        const root = dialogRef.current;
        if (!root) return;
        const focusables = getFocusable(root);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey) {
          if (active === first || !root.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last || !root.contains(active)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeExportDialog, handleSave, canSave]);

  return (
    <div className="mr-dialog-scrim" onClick={handleScrimClick}>
      <div
        className="mr-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mr-dialog-title"
        ref={dialogRef}
      >
        <div className="mr-dialog__hd">
          <h3 id="mr-dialog-title">Export recording</h3>
          <p>
            Choose format · {bars} bars · {tracksCheckedCount} tracks · {eventCount} events
          </p>
        </div>
        <div className="mr-dialog__body">
          <div className="mr-fmt-grid">
            <ExportFormatCard
              title="Standard MIDI File"
              subtitle=".mid · type 1"
              active={format === 'mid'}
              onSelect={() => handleFormatChange('mid')}
            />
            <ExportFormatCard
              title="JSON Lines"
              subtitle=".jsonl · raw events"
              active={format === 'jsonl'}
              onSelect={() => handleFormatChange('jsonl')}
            />
          </div>

          <div className="mr-row">
            <span className="mr-row-lbl">Filename</span>
            <input
              className="mr-input"
              type="text"
              value={filename}
              onChange={(e) => handleFilenameChange(e.target.value)}
              style={{ flex: 2 }}
            />
          </div>

          <div className="mr-row">
            <span className="mr-row-lbl">Range</span>
            <div className="mr-range-radios">
              <ExportRangeRadio
                lbl="Whole session"
                value="whole"
                checked={range === 'whole'}
                selectRange={setRange}
              />
              <ExportRangeRadio
                lbl="Selection"
                value="selection"
                checked={range === 'selection'}
                disabled={!selectionAvailable}
                selectRange={setRange}
              />
              <ExportRangeRadio
                lbl="Loop region"
                value="loop"
                checked={range === 'loop'}
                disabled={!loopAvailable}
                selectRange={setRange}
              />
            </div>
          </div>

          <div className="mr-row mr-row--top">
            <span className="mr-row-lbl">Tracks</span>
            <div className="mr-trk-list">
              {exportRows.map((row) => {
                if (row.kind === 'channel') {
                  const ch = channelById.get(row.channelId);
                  if (!ch) return null;
                  const counts = countChannelArtifacts(ch.id, rolls, lanes);
                  return (
                    <label key={row.key} className="mr-trk-row">
                      <input
                        type="checkbox"
                        checked={tracksOn.has(row.key)}
                        onChange={() => toggleRow(row.key)}
                      />
                      <span
                        className="mr-trk-swatch"
                        style={{ '--ch-color': ch.color } as CSSProperties}
                      />
                      <span className="mr-trk-name">{ch.name}</span>
                      <span className="mr-trk-count">
                        {counts.notes} notes · {counts.points} points
                      </span>
                    </label>
                  );
                }

                const t = djTrackById.get(row.trackId);
                if (!t) return null;
                const { actions, events } = countDjCatalogEvents(t);
                return (
                  <label key={row.key} className="mr-trk-row">
                    <input
                      type="checkbox"
                      checked={tracksOn.has(row.key)}
                      onChange={() => toggleRow(row.key)}
                    />
                    <span className="mr-trk-swatch" style={{ '--ch-color': t.color } as CSSProperties} />
                    <span className="mr-trk-name">{t.name}</span>
                    <span className="mr-trk-count">
                      {actions} actions · {events} events
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="mr-row">
            <span className="mr-row-lbl">Quantize on export</span>
            <button
              type="button"
              className="mr-switch"
              data-on={quantize ? 'true' : 'false'}
              aria-pressed={quantize}
              aria-label="Quantize on export"
              onClick={() => setQuantize((v) => !v)}
            />
          </div>

          <div className="mr-row">
            <span className="mr-row-lbl">Include CC lanes</span>
            <button
              type="button"
              className="mr-switch"
              data-on={includeCC ? 'true' : 'false'}
              aria-pressed={includeCC}
              aria-label="Include CC lanes"
              onClick={() => setIncludeCC((v) => !v)}
            />
          </div>
        </div>
        <div className="mr-dialog__ft">
          <button type="button" className="mr-btn" onClick={closeExportDialog}>
            Cancel
          </button>
          <button
            type="button"
            className="mr-btn"
            data-primary="true"
            disabled={!canSave}
            onClick={handleSave}
          >
            Save · ⌘S
          </button>
        </div>
      </div>
    </div>
  );
}

