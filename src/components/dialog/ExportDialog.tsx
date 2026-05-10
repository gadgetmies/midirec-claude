import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { useStage, type LoopRegion, type ResolvedSelection } from '../../hooks/useStage';
import { useToast } from '../toast/Toast';
import type {
  ChannelId,
  ParamLane,
  PianoRollTrack,
} from '../../hooks/useChannels';
import './Dialog.css';

type Format = 'mid' | 'ndjson';
type Range = 'whole' | 'selection' | 'loop';

const EXT: Record<Format, string> = { mid: 'mid', ndjson: 'ndjson' };

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultFilename(format: Format): string {
  return `session-${todayISO()}.${EXT[format]}`;
}

function computeRange(
  range: Range,
  rolls: PianoRollTrack[],
  lanes: ParamLane[],
  resolvedSelection: ResolvedSelection | null,
  loopRegion: LoopRegion | null,
): [number, number] {
  if (range === 'loop' && loopRegion) {
    return [loopRegion.start, loopRegion.end];
  }
  if (range === 'selection' && resolvedSelection) {
    const roll = rolls.find((r) => r.channelId === resolvedSelection.channelId);
    if (roll) {
      let lo = Infinity;
      let hi = -Infinity;
      for (const idx of resolvedSelection.indexes) {
        const n = roll.notes[idx];
        if (!n) continue;
        if (n.t < lo) lo = n.t;
        if (n.t + n.dur > hi) hi = n.t + n.dur;
      }
      if (Number.isFinite(lo)) return [lo, hi];
    }
  }
  let hi = 0;
  for (const r of rolls) {
    for (const n of r.notes) {
      const end = n.t + n.dur;
      if (end > hi) hi = end;
    }
  }
  for (const l of lanes) {
    for (const p of l.points) {
      if (p.t > hi) hi = p.t;
    }
  }
  return [0, hi];
}

function countEventsInRange(
  rolls: PianoRollTrack[],
  lanes: ParamLane[],
  [t0, t1]: [number, number],
  tracksOn: Set<ChannelId>,
  includeCC: boolean,
): number {
  let count = 0;
  for (const r of rolls) {
    if (!tracksOn.has(r.channelId)) continue;
    for (const n of r.notes) {
      if (n.t >= t0 && n.t < t1) count++;
    }
  }
  if (includeCC) {
    for (const l of lanes) {
      if (!tracksOn.has(l.channelId)) continue;
      for (const p of l.points) {
        if (p.t >= t0 && p.t < t1) count++;
      }
    }
  }
  return count;
}

function countChannelEvents(
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
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled') && el.offsetParent !== null,
  );
}

export function ExportDialog() {
  const stage = useStage();
  const { channels, rolls, lanes, resolvedSelection, loopRegion, closeExportDialog } = stage;
  const { show: showToast } = useToast();

  const [format, setFormat] = useState<Format>('mid');
  const [filename, setFilename] = useState<string>(() => defaultFilename('mid'));
  const [userEdited, setUserEdited] = useState(false);
  const [range, setRange] = useState<Range>('whole');
  const [tracksOn, setTracksOn] = useState<Set<ChannelId>>(
    () => new Set(channels.map((c) => c.id)),
  );
  const [quantize, setQuantize] = useState(false);
  const [includeCC, setIncludeCC] = useState(true);

  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  const selectionAvailable = resolvedSelection !== null;
  const loopAvailable = loopRegion !== null;

  const resolvedRange = useMemo(
    () => computeRange(range, rolls, lanes, resolvedSelection, loopRegion),
    [range, rolls, lanes, resolvedSelection, loopRegion],
  );

  const eventCount = useMemo(
    () => countEventsInRange(rolls, lanes, resolvedRange, tracksOn, includeCC),
    [rolls, lanes, resolvedRange, tracksOn, includeCC],
  );

  const bars = useMemo(() => {
    const span = resolvedRange[1] - resolvedRange[0];
    return Math.round((span / 4) * 10) / 10;
  }, [resolvedRange]);

  const tracksCheckedCount = tracksOn.size;
  const canSave = eventCount > 0 && tracksOn.size > 0 && resolvedRange[1] > resolvedRange[0];

  const handleFormatChange = useCallback(
    (next: Format) => {
      setFormat(next);
      if (!userEdited) setFilename(defaultFilename(next));
    },
    [userEdited],
  );

  const handleFilenameChange = useCallback((value: string) => {
    setFilename(value);
    setUserEdited(true);
  }, []);

  const toggleTrack = useCallback((id: ChannelId) => {
    setTracksOn((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSave = useCallback(() => {
    if (!canSave) return;
    showToast(`Exported "${filename}" · ${eventCount} events`);
    closeExportDialog();
  }, [canSave, filename, eventCount, showToast, closeExportDialog]);

  const handleScrimClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
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
            <FormatCard
              title="Standard MIDI File"
              subtitle=".mid · type 1"
              on={format === 'mid'}
              onSelect={() => handleFormatChange('mid')}
            />
            <FormatCard
              title="NDJSON"
              subtitle=".ndjson · raw events"
              on={format === 'ndjson'}
              onSelect={() => handleFormatChange('ndjson')}
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
              <RangeRadio
                label="Whole session"
                value="whole"
                checked={range === 'whole'}
                onChange={setRange}
              />
              <RangeRadio
                label="Selection"
                value="selection"
                checked={range === 'selection'}
                disabled={!selectionAvailable}
                onChange={setRange}
              />
              <RangeRadio
                label="Loop region"
                value="loop"
                checked={range === 'loop'}
                disabled={!loopAvailable}
                onChange={setRange}
              />
            </div>
          </div>

          <div className="mr-row mr-row--top">
            <span className="mr-row-lbl">Tracks</span>
            <div className="mr-trk-list">
              {channels.map((channel) => {
                const counts = countChannelEvents(channel.id, rolls, lanes);
                return (
                  <label key={channel.id} className="mr-trk-row">
                    <input
                      type="checkbox"
                      checked={tracksOn.has(channel.id)}
                      onChange={() => toggleTrack(channel.id)}
                    />
                    <span
                      className="mr-trk-swatch"
                      style={{ '--ch-color': channel.color } as CSSProperties}
                    />
                    <span className="mr-trk-name">{channel.name}</span>
                    <span className="mr-trk-count">
                      {counts.notes} notes · {counts.points} points
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

interface FormatCardProps {
  title: string;
  subtitle: string;
  on: boolean;
  onSelect: () => void;
}

function FormatCard({ title, subtitle, on, onSelect }: FormatCardProps) {
  return (
    <button
      type="button"
      className="mr-fmt-card"
      data-on={on ? 'true' : 'false'}
      aria-pressed={on}
      onClick={onSelect}
    >
      <span className="mr-fmt-card__title">{title}</span>
      <span className="mr-fmt-card__sub">{subtitle}</span>
    </button>
  );
}

interface RangeRadioProps {
  label: string;
  value: Range;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: Range) => void;
}

function RangeRadio({ label, value, checked, disabled, onChange }: RangeRadioProps) {
  return (
    <label className="mr-range-radio" data-disabled={disabled ? 'true' : undefined}>
      <input
        type="radio"
        name="mr-export-range"
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
      />
      <span>{label}</span>
    </label>
  );
}
