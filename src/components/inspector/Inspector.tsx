import { useState } from 'react';
import { useStage } from '../../hooks/useStage';
import type { Note } from '../piano-roll/notes';
import { formatBBT, formatPitch, summarizeSelection } from './summary';
import './Inspector.css';

type Tab = 'Note' | 'Pressure' | 'Channel';

const TABS: Tab[] = ['Note', 'Pressure', 'Channel'];
const TICKS_PER_BEAT = 480;
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
  const { resolvedSelection, rolls, channels } = useStage();

  if (!resolvedSelection || resolvedSelection.indexes.length === 0) {
    return null;
  }

  const roll = rolls.find((r) => r.channelId === resolvedSelection.channelId);
  if (!roll) return null;

  if (resolvedSelection.indexes.length === 1) {
    const note = roll.notes[resolvedSelection.indexes[0]];
    if (!note) return null;
    return <SingleNoteView note={note} channelId={resolvedSelection.channelId} />;
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

function SingleNoteView({ note, channelId }: { note: Note; channelId: number }) {
  const tickOffset = Math.round((note.t % 1) * TICKS_PER_BEAT);
  const velocity127 = Math.round(note.vel * 127);
  const fillPct = Math.max(0, Math.min(1, note.vel)) * 100;

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
        <span className="mr-kv__v">{formatBBT(note.t)} · {tickOffset}t</span>
      </div>
      <div className="mr-kv">
        <span className="mr-kv__k">Length</span>
        <span className="mr-kv__v">{note.dur.toFixed(3)}s</span>
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
      ? `${summary.length.uniform.toFixed(3)}s`
      : `mixed (${summary.length.range[0].toFixed(2)} – ${summary.length.range[1].toFixed(2)}s)`;
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
