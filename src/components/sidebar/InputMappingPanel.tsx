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
import { useMidiInputs } from '../../midi/MidiRuntimeProvider';
import type { MidiDevice } from '../../midi/access';
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

function clampMidiChannel(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(16, Math.round(n)));
}

function clampMidiNote(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(127, Math.round(n)));
}

function normalizeMidiInputDeviceIds(ids: string[] | undefined): string[] {
  if (!ids?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = raw.trim();
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

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

function deckActionDedupeKey(e: ActionMapEntry): string {
  return `${e.label}\0${e.short}`;
}

function actionRowsForMapSelect(cat: CategoryId): Array<{ pitch: number; entry: ActionMapEntry }> {
  const rows = actionsInCategory(cat);
  if (cat !== 'deck') return rows;
  const byKey = new Map<string, { pitch: number; entry: ActionMapEntry }>();
  for (const row of rows) {
    const k = deckActionDedupeKey(row.entry);
    const cur = byKey.get(k);
    if (!cur || row.pitch < cur.pitch) byKey.set(k, row);
  }
  return [...byKey.values()].sort((a, b) => a.pitch - b.pitch);
}

function actionIdForSelect(entry: ActionMapEntry, cat: CategoryId): string {
  if (cat !== 'deck') return entry.id;
  const rows = actionsInCategory('deck');
  const rowForId = rows.find((r) => r.entry.id === entry.id);
  if (!rowForId) return entry.id;
  const k = deckActionDedupeKey(rowForId.entry);
  let best = rowForId;
  for (const r of rows) {
    if (deckActionDedupeKey(r.entry) !== k) continue;
    if (r.pitch < best.pitch) best = r;
  }
  return best.entry.id;
}

export function InputMappingPanel() {
  const stage = useStage();
  const { inputs } = useMidiInputs();
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
      writeEntry({
        cat,
        id: '',
        label: '',
        short: '',
        midiInputDeviceIds: entry.midiInputDeviceIds,
        midiInputChannel: entry.midiInputChannel,
        midiInputNote: entry.midiInputNote,
      });
      return;
    }
    writeEntry({
      cat,
      id: first.id,
      label: first.label,
      short: first.short,
      pad: first.pad,
      pressure: first.pressure,
      midiInputDeviceIds: entry.midiInputDeviceIds,
      midiInputChannel: entry.midiInputChannel,
      midiInputNote: entry.midiInputNote,
    });
  };

  const handleAction = (id: string) => {
    if (entry.cat === 'deck') {
      const rows = actionsInCategory('deck');
      const picked = rows.find((r) => r.entry.id === id);
      if (!picked) {
        writeEntry({
          id,
          midiInputDeviceIds: entry.midiInputDeviceIds,
          midiInputChannel: entry.midiInputChannel,
          midiInputNote: entry.midiInputNote,
        });
        return;
      }
      const k = deckActionDedupeKey(picked.entry);
      const siblings = rows.filter((r) => deckActionDedupeKey(r.entry) === k);
      const useRow =
        siblings.find((r) => r.entry.device === entry.device) ??
        siblings.slice().sort((a, b) => a.pitch - b.pitch)[0]!;
      writeEntry({
        id: useRow.entry.id,
        label: useRow.entry.label,
        short: useRow.entry.short,
        device: useRow.entry.device,
        pad: useRow.entry.pad,
        pressure: useRow.entry.pressure,
        midiInputDeviceIds: entry.midiInputDeviceIds,
        midiInputChannel: entry.midiInputChannel,
        midiInputNote: entry.midiInputNote,
      });
      return;
    }
    const found = actionsInCategory(entry.cat).find((r) => r.entry.id === id);
    if (!found) {
      writeEntry({
        id,
        midiInputDeviceIds: entry.midiInputDeviceIds,
        midiInputChannel: entry.midiInputChannel,
        midiInputNote: entry.midiInputNote,
      });
      return;
    }
    writeEntry({
      id: found.entry.id,
      label: found.entry.label,
      short: found.entry.short,
      device: found.entry.device,
      pad: found.entry.pad,
      pressure: found.entry.pressure,
      midiInputDeviceIds: entry.midiInputDeviceIds,
      midiInputChannel: entry.midiInputChannel,
      midiInputNote: entry.midiInputNote,
    });
  };

  return (
    <div data-mr-dj-selection-region="true">
      <Panel icon={<FilterIcon />} title="Map Note">
        <Form
          entry={entry}
          pitch={pitch}
          midiInputs={inputs}
          commitPartial={writeEntry}
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
  midiInputs: MidiDevice[];
  commitPartial: (next: Partial<ActionMapEntry>) => void;
  onCategory: (cat: CategoryId) => void;
  onAction: (id: string) => void;
  onDevice: (device: DeviceId) => void;
  onTrigger: (trigger: TriggerMode) => void;
  onDelete: () => void;
}

function Form({
  entry,
  pitch,
  midiInputs,
  commitPartial,
  onCategory,
  onAction,
  onDevice,
  onTrigger,
  onDelete,
}: FormProps) {
  const mapActionRows = useMemo(() => actionRowsForMapSelect(entry.cat), [entry.cat]);
  const actionSelectId = actionIdForSelect(entry, entry.cat);
  const captureNote = entry.midiInputNote ?? pitch;
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
            listens {pitchLabel(captureNote)} · note {captureNote} · row {pitch}
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
          value={actionSelectId}
          onChange={(e) => onAction(e.target.value)}
        >
          {mapActionRows.map(({ pitch: p, entry: e }) => (
            <option key={p} value={e.id}>
              {e.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mr-map-form__grid">
        <div className="mr-map-form__section">
          <span className="mr-map-form__lbl">Surface (color)</span>
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

      <div className="mr-map-form__section">
        <span className="mr-map-form__lbl">MIDI in · devices</span>
        {midiInputs.length === 0 ? (
          <p className="mr-map-form__note">No MIDI inputs — grant access to choose ports.</p>
        ) : (
          <>
            <p className="mr-map-form__note">
              All off uses the DJ track default (Track input). Enable one or more ports so this action listens on
              the same note from each of them.
            </p>
            <div className="mr-map-form__midi-devs">
              {midiInputs.map((d) => {
                const cur = normalizeMidiInputDeviceIds(entry.midiInputDeviceIds);
                const on = cur.includes(d.id);
                return (
                  <div key={d.id} className="mr-row mr-map-form__midi-dev">
                    <span className="mr-row-lbl">{d.name}</span>
                    <button
                      type="button"
                      className="mr-switch"
                      data-on={on ? 'true' : 'false'}
                      aria-pressed={on}
                      aria-label={`Listen on ${d.name} for this action`}
                      onClick={() => {
                        const next = on ? cur.filter((x) => x !== d.id) : [...cur, d.id];
                        commitPartial({
                          midiInputDeviceIds: next.length > 0 ? next : undefined,
                        });
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="mr-map-form__grid">
        <div className="mr-map-form__section">
          <span className="mr-map-form__lbl">MIDI in · ch</span>
          <input
            type="number"
            min={1}
            max={16}
            className="mr-input"
            value={entry.midiInputChannel ?? 1}
            onChange={(e) =>
              commitPartial({
                midiInputChannel: clampMidiChannel(
                  e.target.valueAsNumber,
                  entry.midiInputChannel ?? 1,
                ),
              })
            }
          />
        </div>
        <div className="mr-map-form__section">
          <span className="mr-map-form__lbl">MIDI in · note</span>
          <input
            type="number"
            min={0}
            max={127}
            className="mr-input"
            value={captureNote}
            onChange={(e) =>
              commitPartial({
                midiInputNote: clampMidiNote(e.target.valueAsNumber, captureNote),
              })
            }
          />
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
