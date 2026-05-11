/* Sidebar panel: the input mapping form for the currently-selected DJ
   action row. Renders only when `djActionSelection !== null` AND the
   referenced track + entry resolve. Auto-saves on every field change —
   there is no Done/Cancel button (the panel is permanently visible while
   a row is selected; commits are immediate, mirroring how mute/solo and
   collapse toggles work elsewhere in the app).

   Logically: this surface controls "what incoming MIDI note becomes this
   action" — pure input-side semantics, hence "recording" context. The
   companion output-mapping form lives in the Inspector on the right. */

import { useMemo } from 'react';
import { Panel } from './Panel';
import { FilterIcon } from '../icons/transport';
import { useStage } from '../../hooks/useStage';
import {
  DEFAULT_ACTION_MAP,
  DJ_CATEGORIES,
  DJ_DEVICES,
  devColor,
  devLabel,
  pitchLabel,
  type ActionMapEntry,
  type CategoryId,
  type DeviceId,
  type TriggerMode,
} from '../../data/dj';

const CATEGORY_KEYS = Object.keys(DJ_CATEGORIES) as CategoryId[];
const DEVICE_KEYS = Object.keys(DJ_DEVICES) as DeviceId[];

function actionsInCategory(cat: CategoryId): Array<{ pitch: number; entry: ActionMapEntry }> {
  return Object.entries(DEFAULT_ACTION_MAP)
    .map(([p, entry]) => ({ pitch: Number(p), entry }))
    .filter((row) => row.entry.cat === cat)
    .sort((a, b) => a.pitch - b.pitch);
}

function firstActionInCategory(cat: CategoryId): ActionMapEntry | undefined {
  return actionsInCategory(cat)[0]?.entry;
}

export function InputMappingPanel() {
  const stage = useStage();
  const { djActionSelection, djActionTracks, setActionEntry, deleteActionEntry } = stage;

  if (!djActionSelection) return null;

  const track = djActionTracks.find((t) => t.id === djActionSelection.trackId);
  const entry = track?.actionMap[djActionSelection.pitch];
  if (!track || !entry) return null;

  const trackId = track.id;
  const { pitch } = djActionSelection;

  const writeEntry = (next: Partial<ActionMapEntry>) => {
    /* Auto-save: merge next into the current entry. label/short/pad/pressure
       are derived from DEFAULT_ACTION_MAP when the action id changes. */
    const merged: ActionMapEntry = { ...entry, ...next };
    setActionEntry(trackId, pitch, merged);
  };

  const handleCategory = (cat: CategoryId) => {
    if (cat === entry.cat) return;
    const first = firstActionInCategory(cat);
    if (!first) {
      writeEntry({ cat, id: '', label: '', short: '' });
      return;
    }
    writeEntry({
      cat,
      id: first.id,
      label: first.label,
      short: first.short,
      pad: first.pad,
      pressure: first.pressure,
    });
  };

  const handleAction = (id: string) => {
    const found = actionsInCategory(entry.cat).find((r) => r.entry.id === id);
    if (!found) {
      writeEntry({ id });
      return;
    }
    writeEntry({
      id: found.entry.id,
      label: found.entry.label,
      short: found.entry.short,
      device: found.entry.device,
      pad: found.entry.pad,
      pressure: found.entry.pressure,
    });
  };

  return (
    <div data-mr-dj-selection-region="true">
      <Panel icon={<FilterIcon />} title="Map Note">
        <Form
          entry={entry}
          pitch={pitch}
          onCategory={handleCategory}
          onAction={handleAction}
          onDevice={(d) => writeEntry({ device: d })}
          onTrigger={(t) => writeEntry({ trigger: t })}
          onDelete={() => deleteActionEntry(trackId, pitch)}
        />
      </Panel>
    </div>
  );
}

interface FormProps {
  entry: ActionMapEntry;
  pitch: number;
  onCategory: (cat: CategoryId) => void;
  onAction: (id: string) => void;
  onDevice: (device: DeviceId) => void;
  onTrigger: (trigger: TriggerMode) => void;
  onDelete: () => void;
}

function Form({ entry, pitch, onCategory, onAction, onDevice, onTrigger, onDelete }: FormProps) {
  const filtered = useMemo(() => actionsInCategory(entry.cat), [entry.cat]);
  return (
    <div className="mr-map-form">
      <div className="mr-map-form__hd">
        <div
          className="mr-insp-swatch mr-map-form__swatch"
          style={{ background: devColor(entry.device) }}
        />
        <div className="mr-map-form__hd-meta">
          <div className="mr-map-form__hd-title">{entry.label || '— unmapped —'}</div>
          <div className="mr-map-form__hd-sub">
            {pitchLabel(pitch)} · note {pitch}
          </div>
        </div>
      </div>

      <div className="mr-map-form__section">
        <span className="mr-map-form__lbl">Category</span>
        <div className="mr-map-form__chips">
          {CATEGORY_KEYS.map((key) => {
            const cat = DJ_CATEGORIES[key];
            const active = entry.cat === key;
            const color = catColor(key);
            return (
              <button
                key={key}
                type="button"
                className="mr-chip"
                data-on={active ? 'true' : undefined}
                style={
                  active
                    ? {
                        borderColor: color,
                        color,
                        background: `color-mix(in oklab, ${color} 14%, transparent)`,
                      }
                    : undefined
                }
                onClick={() => onCategory(key)}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mr-map-form__section">
        <span className="mr-map-form__lbl">Action</span>
        <select
          className="mr-select"
          value={entry.id}
          onChange={(e) => onAction(e.target.value)}
        >
          {filtered.map(({ pitch: p, entry: e }) => (
            <option key={p} value={e.id}>
              {e.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mr-map-form__grid">
        <div className="mr-map-form__section">
          <span className="mr-map-form__lbl">Device</span>
          <select
            className="mr-select"
            value={entry.device}
            onChange={(e) => onDevice(e.target.value as DeviceId)}
          >
            {DEVICE_KEYS.map((key) => (
              <option key={key} value={key}>
                {devLabel(key)}
              </option>
            ))}
          </select>
        </div>
        <div className="mr-map-form__section">
          <span className="mr-map-form__lbl">Trigger</span>
          <select
            className="mr-select"
            value={entry.trigger ?? 'momentary'}
            onChange={(e) => onTrigger(e.target.value as TriggerMode)}
          >
            <option value="momentary">momentary</option>
            <option value="toggle">toggle</option>
          </select>
        </div>
      </div>

      <div className="mr-map-form__ft">
        <button type="button" className="mr-btn" data-danger="true" onClick={onDelete}>
          Delete mapping
        </button>
      </div>
    </div>
  );
}

function catColor(cat: CategoryId): string {
  const first = firstActionInCategory(cat);
  return first ? devColor(first.device) : 'var(--mr-accent)';
}
