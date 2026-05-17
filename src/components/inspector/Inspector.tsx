import { useCallback, useEffect, useRef, useState } from 'react';
import { useStage } from '../../hooks/useStage';
import type { Note } from '../piano-roll/notes';
import {
  canonicalPhraseBarBeatFromTicks,
  formatBBT,
  formatPitch,
  parsePhraseBarBeatToTicks,
  summarizeSelection,
} from './summary';
import {
  DJ_DEVICES,
  defaultMixerOutputCc,
  devColor,
  devLabel,
  pitchLabel,
  type ActionMapEntry,
  type DeviceId,
  type OutputMapping,
} from '../../data/dj';
import type { DJActionTrack } from '../../hooks/useDJActionTracks';
import { useMidiOutputs } from '../../midi/MidiRuntimeProvider';
import { useMidiLearn } from '../../midi/useMidiLearn';
import type { MidiLearnWireMessage } from '../../midi/midiLearn';
import type { ChannelId } from '../../hooks/useChannels';
import { PressureEditor } from './PressureEditor';
import { sessionTicksToBeats } from '../../midi/sessionTicks';
import { DEFAULT_MIDI_TPQ } from '../../midi/timelineTicks';
import './Inspector.css';

const DEVICE_KEYS = Object.keys(DJ_DEVICES) as DeviceId[];

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function OutputMappingMidiLearn({
  showCcOut,
  commit,
}: {
  showCcOut: boolean;
  commit: (next: Partial<OutputMapping>) => void;
}) {
  const [armed, setArmed] = useState(false);
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const tryCapture = useCallback(
    (msg: MidiLearnWireMessage): boolean => {
      if (msg.kind === 'noteOn') {
        commitRef.current({
          channel: clampInt(msg.channel1to16, 1, 16, 1),
          pitch: clampInt(msg.note, 0, 127, 0),
          cc: undefined,
        });
        return true;
      }
      if (showCcOut && msg.kind === 'controlChange') {
        commitRef.current({
          channel: clampInt(msg.channel1to16, 1, 16, 1),
          cc: clampInt(msg.controller, 0, 127, 0),
        });
        return true;
      }
      return false;
    },
    [showCcOut],
  );

  useMidiLearn({
    armed,
    setArmed,
    portFilter: () => true,
    tryCapture,
  });

  return (
    <div className="mr-kv">
      <span className="mr-kv__k">Learn</span>
      <button
        type="button"
        className="mr-btn mr-insp__field"
        aria-pressed={armed}
        onClick={() => setArmed((v) => !v)}
      >
        {armed ? 'Listening…' : 'MIDI learn'}
      </button>
    </div>
  );
}

type Tab = 'Note' | 'Pressure' | 'Channel';

const TABS: Tab[] = ['Note', 'Pressure', 'Channel'];
const TPQ = DEFAULT_MIDI_TPQ;
const BEATS_PER_BAR = 4;

// Bulk-action handlers land with the selection-interaction slice; for now
// every button is inert. Same convention as M/S chips and `+ Add Lane`.
const noop = () => {};

export function Inspector() {
  const [activeTab, setActiveTab] = useState<Tab>('Note');

  return (
    <div className="mr-insp">
      <div className="mr-insp-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            className="mr-insp-tab"
            data-on={tab === activeTab ? 'true' : undefined}
            aria-selected={tab === activeTab}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="mr-insp__body">
        {activeTab === 'Note' ? <NotePanel /> : null}
      </div>
    </div>
  );
}

function NotePanel() {
  const {
    resolvedSelection,
    rolls,
    channels,
    djActionSelection,
    djActionTracks,
    selectedTimelineTrack,
  } = useStage();

  /* DJ action-row selection takes precedence over channel/roll selection.
     When set, the Inspector renders the Action panel and ignores
     resolvedSelection. The Action panel handles missing entries (e.g.
     after a Delete) by rendering an empty body. */
  if (djActionSelection) {
    const track = djActionTracks.find((t) => t.id === djActionSelection.trackId);
    const entry = track?.actionMap[djActionSelection.pitch];
    if (!track || !entry) return null;
    return (
      <ActionPanel
        track={track}
        pitch={djActionSelection.pitch}
        entry={entry}
      />
    );
  }

  if (selectedTimelineTrack?.kind === 'dj') {
    const track = djActionTracks.find((t) => t.id === selectedTimelineTrack.trackId);
    if (track) {
      return <DJTrackOutputMappingPanel track={track} />;
    }
  }

  if (!resolvedSelection || resolvedSelection.indexes.length === 0) {
    return null;
  }

  const roll = rolls.find((r) => r.channelId === resolvedSelection.channelId);
  if (!roll) return null;

  if (resolvedSelection.indexes.length === 1) {
    const note = roll.notes[resolvedSelection.indexes[0]];
    if (!note) return null;
    return (
      <SingleNoteView
        note={note}
        noteIndex={resolvedSelection.indexes[0]}
        channelId={resolvedSelection.channelId}
      />
    );
  }

  const channel = channels.find((c) => c.id === resolvedSelection.channelId);
  return (
    <MultiNoteView
      notes={roll.notes}
      indexes={resolvedSelection.indexes}
      channelLabel={channel ? `CH ${channel.id}` : `CH ${resolvedSelection.channelId}`}
    />
  );
}

function DJTrackOutputMappingPanel({ track }: { track: DJActionTrack }) {
  const { outputs } = useMidiOutputs();
  const { setOutputMapping, setDJTrackDefaultMidiOutputDevice } = useStage();
  const rowOrder = Object.keys(track.actionMap)
    .map(Number)
    .filter((p) => Object.prototype.hasOwnProperty.call(track.actionMap, p))
    .sort((a, b) => a - b);

  return (
    <div data-mr-dj-selection-region="true" className="mr-insp__dj-track-map">
      <div className="mr-insp__hd">
        <div className="mr-insp-swatch" style={{ background: track.color }} />
        <div className="mr-insp__hd-meta">
          <div className="mr-insp__hd-title">{track.name}</div>
          <div className="mr-insp__hd-sub">DJ track · output mapping</div>
        </div>
      </div>

      <div className="mr-insp-eyebrow">Track MIDI output</div>
      <div className="mr-kv">
        <span className="mr-kv__k">Default port</span>
        <select
          className="mr-select mr-insp__field"
          value={track.defaultMidiOutputDeviceId}
          onChange={(e) => setDJTrackDefaultMidiOutputDevice(track.id, e.target.value)}
        >
          <option value="">Session default (first output)</option>
          {outputs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name || d.id}
            </option>
          ))}
        </select>
      </div>

      <div className="mr-insp-eyebrow">Actions</div>
      <div className="mr-insp__dj-track-map-rows">
        {rowOrder.map((pitch) => {
          const entry = track.actionMap[pitch]!;
          const existing = track.outputMap[pitch];
          const suggestedCc = defaultMixerOutputCc(entry.id);
          const showCcOut = suggestedCc !== undefined || existing?.cc !== undefined;
          const current: OutputMapping = existing ?? {
            device: entry.device,
            channel: track.midiChannel,
            pitch,
          };
          const commitRow = (next: Partial<OutputMapping>) => {
            const merged: OutputMapping = { ...current, ...next };
            if (next.cc === undefined && 'cc' in next) {
              delete merged.cc;
            }
            if (next.midiOutputDeviceId === undefined && 'midiOutputDeviceId' in next) {
              delete merged.midiOutputDeviceId;
            }
            setOutputMapping(track.id, pitch, merged);
          };
          const setMidiPort = (v: string) => {
            if (v === '') {
              const merged: OutputMapping = { ...current };
              delete merged.midiOutputDeviceId;
              setOutputMapping(track.id, pitch, merged);
            } else {
              commitRow({ midiOutputDeviceId: v });
            }
          };

          return (
            <div key={pitch} className="mr-insp__dj-track-map-row">
              <div className="mr-insp__dj-track-map-row-hd">
                <div
                  className="mr-insp-swatch mr-insp-swatch--row"
                  style={{ background: devColor(entry.device) }}
                />
                <div className="mr-insp__hd-meta">
                  <div className="mr-insp__hd-title">{entry.label}</div>
                  <div className="mr-insp__hd-sub">
                    in {pitchLabel(pitch)} · note {pitch}
                  </div>
                </div>
              </div>
              <div className="mr-kv">
                <span className="mr-kv__k">MIDI out</span>
                <select
                  className="mr-select mr-insp__field"
                  value={current.midiOutputDeviceId ?? ''}
                  onChange={(e) => setMidiPort(e.target.value)}
                >
                  <option value="">Track default</option>
                  {outputs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name || d.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mr-kv">
                <span className="mr-kv__k">Device</span>
                <select
                  className="mr-select mr-insp__field"
                  value={current.device}
                  onChange={(e) => commitRow({ device: e.target.value as DeviceId })}
                >
                  {DEVICE_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {devLabel(key)}
                    </option>
                  ))}
                </select>
              </div>
              <OutputMappingMidiLearn showCcOut={showCcOut} commit={commitRow} />
              <div className="mr-kv">
                <span className="mr-kv__k">Channel</span>
                <input
                  type="number"
                  min={1}
                  max={16}
                  className="mr-input mr-insp__field"
                  value={current.channel}
                  onChange={(e) =>
                    commitRow({ channel: clampInt(e.target.valueAsNumber, 1, 16, current.channel) })
                  }
                />
              </div>
              {showCcOut ? (
                <div className="mr-kv">
                  <span className="mr-kv__k">CC#</span>
                  <input
                    type="number"
                    min={0}
                    max={127}
                    className="mr-input mr-insp__field"
                    value={current.cc ?? ''}
                    placeholder={suggestedCc !== undefined ? String(suggestedCc) : undefined}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        commitRow({ cc: undefined });
                        return;
                      }
                      commitRow({ cc: clampInt(e.target.valueAsNumber, 0, 127, suggestedCc ?? 0) });
                    }}
                  />
                </div>
              ) : (
                <div className="mr-kv">
                  <span className="mr-kv__k">Pitch</span>
                  <div className="mr-insp__pitch-row">
                    <input
                      type="number"
                      min={0}
                      max={127}
                      className="mr-input mr-insp__field"
                      value={current.pitch}
                      onChange={(e) =>
                        commitRow({
                          pitch: clampInt(e.target.valueAsNumber, 0, 127, current.pitch),
                        })
                      }
                    />
                    <span className="mr-insp__pitch-label">{pitchLabel(current.pitch)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActionPanel({
  track,
  pitch,
  entry,
}: {
  track: DJActionTrack;
  pitch: number;
  entry: ActionMapEntry;
}) {
  const { setOutputMapping, deleteOutputMapping, djEventSelection, setDJEventTTicks } = useStage();
  const { outputs } = useMidiOutputs();
  const existing = track.outputMap[pitch];

  /* Both the Start editor and the Pressure section gate on the same
     condition: an event selection that matches this row AND the referenced
     event still exists on the track AND its pitch still matches the row.
     The Pressure section additionally requires `entry.pressure === true`. */
  const eventMatches =
    djEventSelection !== null &&
    djEventSelection.trackId === track.id &&
    djEventSelection.pitch === pitch &&
    djEventSelection.eventIdx >= 0 &&
    djEventSelection.eventIdx < track.events.length &&
    track.events[djEventSelection.eventIdx].pitch === pitch;
  const showStart = eventMatches;
  const showPressure = eventMatches && entry.pressure === true;
  const selectedEvent = eventMatches ? track.events[djEventSelection!.eventIdx] : null;

  const suggestedCc = defaultMixerOutputCc(entry.id);
  const showCcOut = suggestedCc !== undefined || existing?.cc !== undefined;

  /* Default the form values from either the existing mapping or sensible
     defaults derived from the input binding (output device matches input
     device; output pitch matches input pitch; output channel defaults to 1).
     The form is auto-save: editing any field commits via setOutputMapping. */
  const current: OutputMapping = existing ?? {
    device: entry.device,
    channel: track.midiChannel,
    pitch,
  };

  const commit = (next: Partial<OutputMapping>) => {
    const merged: OutputMapping = { ...current, ...next };
    if (next.cc === undefined && 'cc' in next) {
      delete merged.cc;
    }
    if (next.midiOutputDeviceId === undefined && 'midiOutputDeviceId' in next) {
      delete merged.midiOutputDeviceId;
    }
    setOutputMapping(track.id, pitch, merged);
  };

  const setMidiPort = (v: string) => {
    if (v === '') {
      const merged: OutputMapping = { ...current };
      delete merged.midiOutputDeviceId;
      setOutputMapping(track.id, pitch, merged);
    } else {
      commit({ midiOutputDeviceId: v });
    }
  };

  return (
    <div data-mr-dj-selection-region="true" className="mr-insp__action-panel">
      <div className="mr-insp__hd">
        <div
          className="mr-insp-swatch"
          style={{ background: devColor(entry.device) }}
        />
        <div className="mr-insp__hd-meta">
          <div className="mr-insp__hd-title">{entry.label}</div>
          <div className="mr-insp__hd-sub">
            in {pitchLabel(pitch)} · note {pitch}
          </div>
        </div>
      </div>

      <div className="mr-insp-eyebrow">Output</div>
      {!existing && (
        <div className="mr-insp__hint">
          No output configured. Editing any field below will create the mapping.
        </div>
      )}

      <div className="mr-kv">
        <span className="mr-kv__k">MIDI out</span>
        <select
          className="mr-select mr-insp__field"
          value={current.midiOutputDeviceId ?? ''}
          onChange={(e) => setMidiPort(e.target.value)}
        >
          <option value="">Track default</option>
          {outputs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name || d.id}
            </option>
          ))}
        </select>
      </div>
      <div className="mr-kv">
        <span className="mr-kv__k">Device</span>
        <select
          className="mr-select mr-insp__field"
          value={current.device}
          onChange={(e) => commit({ device: e.target.value as DeviceId })}
        >
          {DEVICE_KEYS.map((key) => (
            <option key={key} value={key}>
              {devLabel(key)}
            </option>
          ))}
        </select>
      </div>
      <OutputMappingMidiLearn showCcOut={showCcOut} commit={commit} />
      <div className="mr-kv">
        <span className="mr-kv__k">Channel</span>
        <input
          type="number"
          min={1}
          max={16}
          className="mr-input mr-insp__field"
          value={current.channel}
          onChange={(e) =>
            commit({ channel: clampInt(e.target.valueAsNumber, 1, 16, current.channel) })
          }
        />
      </div>
      <div className="mr-kv">
        <span className="mr-kv__k">Pitch</span>
        <div className="mr-insp__pitch-row">
          <input
            type="number"
            min={0}
            max={127}
            className="mr-input mr-insp__field"
            value={current.pitch}
            onChange={(e) =>
              commit({ pitch: clampInt(e.target.valueAsNumber, 0, 127, current.pitch) })
            }
          />
          <span className="mr-insp__pitch-label">{pitchLabel(current.pitch)}</span>
        </div>
      </div>
      {showCcOut ? (
        <div className="mr-kv">
          <span className="mr-kv__k">CC#</span>
          <input
            type="number"
            min={0}
            max={127}
            className="mr-input mr-insp__field"
            value={current.cc ?? ''}
            placeholder={suggestedCc !== undefined ? String(suggestedCc) : undefined}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') {
                commit({ cc: undefined });
                return;
              }
              commit({ cc: clampInt(e.target.valueAsNumber, 0, 127, suggestedCc ?? 0) });
            }}
          />
        </div>
      ) : null}

      {existing && (
        <div className="mr-insp__edit-action-row">
          <button
            type="button"
            className="mr-btn"
            data-danger="true"
            onClick={() => deleteOutputMapping(track.id, pitch)}
          >
            Delete output
          </button>
        </div>
      )}

      {showStart && selectedEvent && djEventSelection && (
        <DjEventStartEditor
          trackId={track.id}
          pitch={pitch}
          eventIdx={djEventSelection.eventIdx}
          tTicks={selectedEvent.tTicks}
          setDJEventTTicks={setDJEventTTicks}
        />
      )}

      {showPressure && djEventSelection && (
        <PressureEditor
          track={track}
          pitch={pitch}
          eventIdx={djEventSelection.eventIdx}
          entry={entry}
        />
      )}
    </div>
  );
}

function DjEventStartEditor({
  trackId,
  pitch,
  eventIdx,
  tTicks,
  setDJEventTTicks,
}: {
  trackId: string;
  pitch: number;
  eventIdx: number;
  tTicks: number;
  setDJEventTTicks: (
    id: string,
    pitch: number,
    eventIdx: number,
    nextTTicks: number,
  ) => void;
}) {
  const [bbtDraft, setBbtDraft] = useState(() =>
    canonicalPhraseBarBeatFromTicks(tTicks, TPQ),
  );
  const [ticksDraft, setTicksDraft] = useState(() => String(tTicks));

  useEffect(() => {
    setBbtDraft(canonicalPhraseBarBeatFromTicks(tTicks, TPQ));
    setTicksDraft(String(tTicks));
  }, [trackId, pitch, eventIdx, tTicks]);

  const commitPhraseBarBeat = useCallback(() => {
    const trimmed = bbtDraft.trim();
    const parsed = trimmed === '' ? null : parsePhraseBarBeatToTicks(trimmed);
    if (parsed === null) {
      setBbtDraft(canonicalPhraseBarBeatFromTicks(tTicks, TPQ));
      return;
    }
    const next = Math.max(0, parsed);
    if (next !== tTicks) setDJEventTTicks(trackId, pitch, eventIdx, next);
    else setBbtDraft(canonicalPhraseBarBeatFromTicks(tTicks, TPQ));
  }, [bbtDraft, eventIdx, pitch, setDJEventTTicks, tTicks, trackId]);

  const commitTicks = useCallback(() => {
    const raw = ticksDraft.trim();
    if (!/^[0-9]+$/.test(raw)) {
      setTicksDraft(String(tTicks));
      return;
    }
    const n = Number(raw);
    if (!Number.isSafeInteger(n) || n < 0) {
      setTicksDraft(String(tTicks));
      return;
    }
    if (n !== tTicks) setDJEventTTicks(trackId, pitch, eventIdx, n);
    else setTicksDraft(String(tTicks));
  }, [eventIdx, pitch, setDJEventTTicks, tTicks, ticksDraft, trackId]);

  return (
    <div className="mr-kv">
      <span className="mr-kv__k">Start</span>
      <div className="mr-insp__start-fields">
        <input
          title="Phrase · bar · beat (three numbers, matching timeline display)"
          className="mr-input mr-insp__field mr-insp__start-bbt"
          aria-label="Start phrase bar beat"
          value={bbtDraft}
          onChange={(e) => setBbtDraft(e.target.value)}
          onBlur={() => commitPhraseBarBeat()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitPhraseBarBeat();
              e.currentTarget.blur();
            }
          }}
        />
        <span className="mr-insp__start-sep" aria-hidden>
          /
        </span>
        <input
          title="Session start ticks (integer MIDI ticks from session zero)"
          className="mr-input mr-insp__field mr-insp__start-ticks"
          aria-label="Start ticks"
          inputMode="numeric"
          pattern="[0-9]*"
          value={ticksDraft}
          onChange={(e) => setTicksDraft(e.target.value)}
          onBlur={() => commitTicks()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitTicks();
              e.currentTarget.blur();
            }
          }}
        />
        <span className="mr-insp__ticks-suffix">t</span>
      </div>
    </div>
  );
}

function SingleNoteView({
  note,
  noteIndex,
  channelId,
}: {
  note: Note;
  noteIndex: number;
  channelId: ChannelId;
}) {
  const { updateNoteAt } = useStage();
  const [bbtDraft, setBbtDraft] = useState(() =>
    canonicalPhraseBarBeatFromTicks(note.tTicks, TPQ),
  );
  const [ticksDraft, setTicksDraft] = useState(() => String(note.tTicks));

  useEffect(() => {
    setBbtDraft(canonicalPhraseBarBeatFromTicks(note.tTicks, TPQ));
    setTicksDraft(String(note.tTicks));
  }, [channelId, noteIndex, note.tTicks, note.pitch, note.durTicks]);

  const commitPhraseBarBeat = useCallback(() => {
    const trimmed = bbtDraft.trim();
    const parsed = trimmed === '' ? null : parsePhraseBarBeatToTicks(trimmed);
    if (parsed === null) {
      setBbtDraft(canonicalPhraseBarBeatFromTicks(note.tTicks, TPQ));
      return;
    }
    const next = Math.max(0, parsed);
    if (next !== note.tTicks) updateNoteAt(channelId, noteIndex, { tTicks: next });
    else setBbtDraft(canonicalPhraseBarBeatFromTicks(note.tTicks, TPQ));
  }, [bbtDraft, channelId, note.tTicks, noteIndex, updateNoteAt]);

  const commitTicks = useCallback(() => {
    const raw = ticksDraft.trim();
    if (!/^[0-9]+$/.test(raw)) {
      setTicksDraft(String(note.tTicks));
      return;
    }
    const n = Number(raw);
    if (!Number.isSafeInteger(n) || n < 0) {
      setTicksDraft(String(note.tTicks));
      return;
    }
    if (n !== note.tTicks) updateNoteAt(channelId, noteIndex, { tTicks: n });
    else setTicksDraft(String(note.tTicks));
  }, [channelId, note.tTicks, noteIndex, ticksDraft, updateNoteAt]);

  const velocity127 = Math.round(note.vel * 127);
  const fillPct = Math.max(0, Math.min(1, note.vel)) * 100;
  const durBeats = sessionTicksToBeats(note.durTicks);

  return (
    <>
      <div className="mr-insp__hd">
        <div className="mr-insp-swatch" />
        <div className="mr-insp__hd-meta">
          <div className="mr-insp__hd-title">{formatPitch(note.pitch)}</div>
          <div className="mr-insp__hd-sub">note {note.pitch}</div>
        </div>
      </div>
      <div className="mr-kv">
        <span className="mr-kv__k">Start</span>
        <div className="mr-insp__start-fields">
          <input
            title="Phrase · bar · beat (three numbers, matching timeline display)"
            className="mr-input mr-insp__field mr-insp__start-bbt"
            aria-label="Start phrase bar beat"
            value={bbtDraft}
            onChange={(e) => setBbtDraft(e.target.value)}
            onBlur={() => commitPhraseBarBeat()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitPhraseBarBeat();
                e.currentTarget.blur();
              }
            }}
          />
          <span className="mr-insp__start-sep" aria-hidden>
            /
          </span>
          <input
            title="Session start ticks (integer MIDI ticks from session zero)"
            className="mr-input mr-insp__field mr-insp__start-ticks"
            aria-label="Start ticks"
            inputMode="numeric"
            pattern="[0-9]*"
            value={ticksDraft}
            onChange={(e) => setTicksDraft(e.target.value)}
            onBlur={() => commitTicks()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitTicks();
                e.currentTarget.blur();
              }
            }}
          />
          <span className="mr-insp__ticks-suffix">t</span>
        </div>
      </div>
      <div className="mr-kv">
        <span className="mr-kv__k">Length</span>
        <span className="mr-kv__v">{durBeats.toFixed(3)} beats</span>
      </div>
      <div className="mr-kv">
        <span className="mr-kv__k">Velocity</span>
        <div className="mr-insp-vel">
          <div className="mr-slider">
            <div className="mr-slider__fill" style={{ width: `${fillPct}%` }} />
            <div className="mr-slider__thumb" style={{ left: `${fillPct}%` }} />
          </div>
          <span className="mr-insp-vel__readout">{velocity127}</span>
        </div>
      </div>
      <div className="mr-kv">
        <span className="mr-kv__k">Channel</span>
        <span className="mr-kv__v">CH {channelId}</span>
      </div>
    </>
  );
}

function MultiNoteView({
  notes,
  indexes,
  channelLabel,
}: {
  notes: Note[];
  indexes: number[];
  channelLabel: string;
}) {
  const summary = summarizeSelection(notes, indexes, channelLabel);
  const meanVel127 = Math.round(summary.velocity.mean * 127);
  const fillPct = Math.max(0, Math.min(1, summary.velocity.mean)) * 100;
  const barCount = Math.max(
    1,
    Math.ceil((summary.range.t1 - summary.range.t0) / BEATS_PER_BAR),
  );
  const pitchesText = summary.pitches.map(formatPitch).join(' · ');
  const lengthText =
    summary.length.uniform !== null
      ? `${summary.length.uniform.toFixed(3)} beats`
      : `mixed (${summary.length.range[0].toFixed(2)} – ${summary.length.range[1].toFixed(2)} beats)`;
  const velocityReadout = summary.velocity.mixed ? `~${meanVel127}` : `${meanVel127}`;

  return (
    <>
      <div className="mr-insp__hd">
        <div className="mr-insp-swatch mr-insp-swatch--multi" />
        <div className="mr-insp__hd-meta">
          <div className="mr-insp__hd-title">{summary.count} notes selected</div>
          <div className="mr-insp__hd-sub">
            multi · {summary.pitches.length} pitches · {barCount} {barCount === 1 ? 'bar' : 'bars'}
          </div>
        </div>
      </div>
      <div className="mr-kv">
        <span className="mr-kv__k">Range</span>
        <span className="mr-kv__v">
          {formatBBT(summary.range.t0)} → {formatBBT(summary.range.t1)}
        </span>
      </div>
      <div className="mr-kv">
        <span className="mr-kv__k">Pitches</span>
        <span className="mr-kv__v">{pitchesText}</span>
      </div>
      <div className="mr-kv">
        <span className="mr-kv__k">Velocity</span>
        <div className="mr-insp-vel">
          <div className="mr-slider" data-mixed={summary.velocity.mixed ? 'true' : undefined}>
            <div className="mr-slider__fill" style={{ width: `${fillPct}%` }} />
            <div className="mr-slider__thumb" style={{ left: `${fillPct}%` }} />
          </div>
          <span className="mr-insp-vel__readout">{velocityReadout}</span>
        </div>
      </div>
      <div className="mr-kv">
        <span className="mr-kv__k">Length</span>
        <span className="mr-kv__v">{lengthText}</span>
      </div>
      <div className="mr-kv">
        <span className="mr-kv__k">Channel</span>
        <span className="mr-kv__v">{summary.channelLabel}</span>
      </div>
      <div className="mr-insp-divider" />
      <div className="mr-insp-eyebrow">Bulk actions</div>
      <div className="mr-insp-bulk-grid">
        <button type="button" className="mr-btn" onClick={noop}>Quantize</button>
        <button type="button" className="mr-btn" onClick={noop}>Nudge ←→</button>
        <button type="button" className="mr-btn" onClick={noop}>Transpose</button>
        <button type="button" className="mr-btn" onClick={noop}>Velocity ±</button>
        <button type="button" className="mr-btn mr-insp-bulk-grid__wide" onClick={noop}>
          Duplicate
        </button>
        <button
          type="button"
          className="mr-btn mr-insp-bulk-grid__wide"
          data-danger="true"
          onClick={noop}
        >
          Delete {summary.count}
        </button>
      </div>
    </>
  );
}
