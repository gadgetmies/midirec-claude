import { useEffect, useRef, useState } from 'react';
import { useTransport } from '../../hooks/useTransport';
import { useMidiClockSend } from '../../midi/MidiClockSendProvider';
import { useMidiOutputs } from '../../midi/MidiRuntimeProvider';
import { ChevDownIcon } from '../icons/transport';
import './ClockSendPanel.css';

export function ClockSendPanel() {
  const [open, setOpen] = useState(true);
  const send = useMidiClockSend();
  const transport = useTransport();
  const { outputs, status: outputsStatus } = useMidiOutputs();

  const connectedSelectedIds = Array.from(send.selectedOutputIds).filter((id) =>
    outputs.some((o) => o.id === id),
  );
  const hasConnectedSelected = connectedSelectedIds.length > 0;
  const syncDisabled = !send.enabled || !hasConnectedSelected;

  /* Sync flash — 120 ms inverted-flash. */
  const syncBtnRef = useRef<HTMLButtonElement>(null);
  const [syncFlashing, setSyncFlashing] = useState(false);
  const handleSyncClick = () => {
    send.sync();
    setSyncFlashing(true);
    setTimeout(() => setSyncFlashing(false), 120);
  };

  const cadenceSource =
    transport.clockSource === 'external-clock' ||
    transport.clockSource === 'external-mtc'
      ? 'External (relay)'
      : 'Internal';
  const cadenceSourceColor =
    transport.clockSource === 'external-clock' ||
    transport.clockSource === 'external-mtc'
      ? 'var(--mr-cue)'
      : 'var(--mr-text-2)';

  const bpm = transport.bpm;
  const pulseHz = (bpm * 24) / 60;

  /* STATUS: track whether txPulse has advanced in the last 500 ms. */
  const lastPulseRef = useRef<number | null>(null);
  const [transmittingNow, setTransmittingNow] = useState(false);
  useEffect(() => {
    if (!send.enabled) {
      setTransmittingNow(false);
      lastPulseRef.current = null;
      return;
    }
    lastPulseRef.current = performance.now();
    setTransmittingNow(true);
    const t = setTimeout(() => setTransmittingNow(false), 500);
    return () => clearTimeout(t);
  }, [send.txPulse, send.enabled]);

  const offlineIds = Array.from(send.selectedOutputIds).filter(
    (id) => !outputs.some((o) => o.id === id),
  );

  let statusText: string;
  if (!send.enabled) statusText = 'idle';
  else if (connectedSelectedIds.length === 0) statusText = 'enabled · no outs';
  else statusText = `transmitting · ${connectedSelectedIds.length} outs`;
  const statusLedState = send.enabled && transmittingNow ? 'tx-on' : undefined;

  const notGranted = outputsStatus !== 'granted';

  return (
    <div className="mr-insp-clock-send" data-open={open ? 'true' : 'false'}>
      <button
        type="button"
        className="mr-panel__head mr-insp-clock-send__head mr-mono"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="mr-insp-clock-send__head-lbl">MIDI CLOCK SEND</span>
        <span
          className="mr-insp-clock-send__chev"
          data-open={open ? 'true' : 'false'}
          aria-hidden="true"
        >
          <ChevDownIcon />
        </span>
      </button>
      {open &&
        (notGranted ? (
          <div className="mr-insp-clock-send__body">
            <div className="mr-insp-clock-send__master">
              <button
                type="button"
                role="switch"
                aria-checked={false}
                aria-disabled="true"
                className="mr-switch"
                onClick={(e) => e.preventDefault()}
              />
              <span className="mr-insp-clock-send__cadence-src">{cadenceSource}</span>
            </div>
            <div className="mr-insp-clock-send__placeholder">
              MIDI access not granted
            </div>
          </div>
        ) : (
          <div className="mr-insp-clock-send__body">
            <div className="mr-insp-clock-send__master">
              <button
                type="button"
                role="switch"
                aria-checked={send.enabled}
                data-on={send.enabled || undefined}
                className="mr-switch mr-insp-clock-send__rocker"
                onClick={() => send.setEnabled(!send.enabled)}
                aria-label="Enable MIDI clock send"
              />
              <span
                className="mr-insp-clock-send__cadence-src mr-mono"
                style={{ color: cadenceSourceColor }}
              >
                {cadenceSource}
              </span>
            </div>

            <button
              ref={syncBtnRef}
              type="button"
              className="mr-insp-clock-send__sync mr-mono"
              data-flash={syncFlashing || undefined}
              disabled={syncDisabled}
              onClick={handleSyncClick}
              aria-label="Sync slaves now"
              title="Stop + Song Position Pointer + Continue/Start"
            >
              SYNC SLAVES
            </button>

            <div className="mr-row mr-insp-clock-send__row">
              <span className="mr-insp-clock-send__row-lbl mr-mono">CADENCE</span>
              <span className="mr-insp-clock-send__row-val mr-mono">
                {bpm.toFixed(1)} BPM · {pulseHz.toFixed(1)} Hz · 24 PPQ
              </span>
            </div>

            <div className="mr-row mr-insp-clock-send__row">
              <span className="mr-insp-clock-send__row-lbl mr-mono">STATUS</span>
              <span className="mr-insp-clock-send__row-val mr-mono">
                <span
                  className="mr-led"
                  {...(statusLedState ? { 'data-state': statusLedState } : {})}
                  aria-hidden="true"
                />
                {statusText}
              </span>
            </div>

            <div className="mr-insp-clock-send__outputs">
              {outputs.map((dev) => {
                const isSelected = send.selectedOutputIds.has(dev.id);
                const txPulse = send.txPulseByOutputId.get(dev.id) ?? 0;
                return (
                  <OutputRow
                    key={dev.id}
                    id={dev.id}
                    name={dev.name}
                    selected={isSelected}
                    enabled={send.enabled}
                    txPulse={txPulse}
                    onToggle={() => send.toggleOutput(dev.id)}
                  />
                );
              })}
              {offlineIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="checkbox"
                  aria-checked="true"
                  data-on="true"
                  className="mr-insp-clock-send__output"
                  onClick={() => send.toggleOutput(id)}
                >
                  <span className="mr-insp-clock-send__output-check" aria-hidden="true" />
                  <span className="mr-insp-clock-send__output-name mr-mono">
                    {id} <span className="mr-insp-clock-send__output-offline">(offline)</span>
                  </span>
                </button>
              ))}
            </div>

            <GridAlignmentSubsection />

            <div className="mr-insp-clock-send__footer">
              <button
                type="button"
                className="mr-insp-clock-send__footer-btn mr-mono"
                onClick={() => send.setSelectedOutputs(outputs.map((o) => o.id))}
                disabled={outputs.length === 0}
              >
                Select all
              </button>
              <button
                type="button"
                className="mr-insp-clock-send__footer-btn mr-mono"
                onClick={() => send.setSelectedOutputs([])}
                disabled={outputs.length === 0}
              >
                Clear
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}

function OutputRow({
  id,
  name,
  selected,
  enabled,
  txPulse,
  onToggle,
}: {
  id: string;
  name: string;
  selected: boolean;
  enabled: boolean;
  txPulse: number;
  onToggle: () => void;
}) {
  const ledRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!enabled) return;
    const el = ledRef.current;
    if (!el) return;
    el.classList.add('is-tx-pulse');
    const t = setTimeout(() => el.classList.remove('is-tx-pulse'), 100);
    return () => clearTimeout(t);
  }, [txPulse, enabled]);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      data-on={selected || undefined}
      data-output-id={id}
      className="mr-insp-clock-send__output"
      onClick={onToggle}
    >
      <span className="mr-insp-clock-send__output-check" aria-hidden="true" />
      <span className="mr-insp-clock-send__output-name mr-mono">{name}</span>
      <span
        ref={ledRef}
        className="mr-led"
        data-state={enabled && selected ? 'tx' : undefined}
        aria-hidden="true"
      />
    </button>
  );
}

function GridAlignmentSubsection() {
  const [open, setOpen] = useState(true);
  const send = useMidiClockSend();
  const { outputs } = useMidiOutputs();
  const grid = send.gridAlignment;

  /* Auto-fire pulse flash on Fire now button. We watch a "lastAutoFireAt"
     by detecting send.txPulseByOutputId growth on the target output — but
     simpler is to observe gridAlignment side-effects via a synthetic
     counter would require provider support. Instead, we just flash on
     manual click; auto-fire still works but doesn't visually feed back
     here (an acceptable cut for now). */
  const [fireFlashing, setFireFlashing] = useState(false);
  const flashFire = () => {
    setFireFlashing(true);
    setTimeout(() => setFireFlashing(false), 80);
  };

  const handleManualFire = () => {
    send.fireGridAlignment();
    flashFire();
  };

  const fireDisabled =
    grid.outputId === null ||
    !outputs.some((o) => o.id === grid.outputId);

  const m = grid.message;
  const isNote = m.kind === 'note';

  return (
    <div className="mr-insp-grid-align" data-open={open ? 'true' : 'false'}>
      <button
        type="button"
        className="mr-panel__head mr-insp-grid-align__head mr-mono"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="mr-insp-grid-align__head-lbl">GRID ALIGNMENT</span>
        <span
          className="mr-insp-grid-align__chev"
          data-open={open ? 'true' : 'false'}
          aria-hidden="true"
        >
          <ChevDownIcon />
        </span>
      </button>
      {open && (
        <div className="mr-insp-grid-align__body">
          <div className="mr-insp-grid-align__row">
            <button
              type="button"
              role="switch"
              aria-checked={grid.enabled}
              data-on={grid.enabled || undefined}
              className="mr-switch"
              onClick={() => send.setGridAlignment({ enabled: !grid.enabled })}
              aria-label="Enable Grid Alignment"
            />
            <span className="mr-insp-grid-align__row-lbl mr-mono">Enable</span>
          </div>

          <div className="mr-row mr-insp-grid-align__row">
            <span className="mr-insp-grid-align__row-lbl mr-mono">OUTPUT</span>
            <select
              className="mr-select"
              value={grid.outputId ?? ''}
              onChange={(e) =>
                send.setGridAlignment({
                  outputId: e.target.value === '' ? null : e.target.value,
                })
              }
            >
              <option value="">(none)</option>
              {outputs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mr-row mr-insp-grid-align__row">
            <span className="mr-insp-grid-align__row-lbl mr-mono">TRIGGER</span>
            <div className="mr-insp-grid-align__seg" role="radiogroup">
              {(['bar', 'phrase', 'manual'] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  role="radio"
                  aria-checked={grid.boundary === b}
                  data-on={grid.boundary === b || undefined}
                  className="mr-insp-grid-align__seg-btn mr-mono"
                  onClick={() => send.setGridAlignment({ boundary: b })}
                >
                  {b === 'bar' ? 'Bar' : b === 'phrase' ? 'Phrase' : 'Manual'}
                </button>
              ))}
            </div>
          </div>

          {grid.boundary === 'phrase' && (
            <div className="mr-row mr-insp-grid-align__row">
              <span className="mr-insp-grid-align__row-lbl mr-mono">PHRASE</span>
              <div className="mr-insp-grid-align__stepper">
                <button
                  type="button"
                  className="mr-insp-grid-align__step-btn mr-mono"
                  onClick={() =>
                    send.setGridAlignment({ phraseBars: grid.phraseBars - 1 })
                  }
                  aria-label="Decrease phrase bars"
                >
                  −
                </button>
                <input
                  type="number"
                  className="mr-input mr-insp-grid-align__step-input"
                  value={grid.phraseBars}
                  min={1}
                  max={32}
                  onChange={(e) =>
                    send.setGridAlignment({ phraseBars: Number(e.target.value) })
                  }
                />
                <button
                  type="button"
                  className="mr-insp-grid-align__step-btn mr-mono"
                  onClick={() =>
                    send.setGridAlignment({ phraseBars: grid.phraseBars + 1 })
                  }
                  aria-label="Increase phrase bars"
                >
                  +
                </button>
                <span className="mr-insp-grid-align__step-suffix mr-mono">bars</span>
              </div>
            </div>
          )}

          <div className="mr-row mr-insp-grid-align__row">
            <span className="mr-insp-grid-align__row-lbl mr-mono">MESSAGE</span>
            <div className="mr-insp-grid-align__seg" role="radiogroup">
              <button
                type="button"
                role="radio"
                aria-checked={isNote}
                data-on={isNote || undefined}
                className="mr-insp-grid-align__seg-btn mr-mono"
                onClick={() => {
                  if (isNote) return;
                  /* Flip kind, preserving channel; map cc→note, value→velocity. */
                  const ch = grid.message.channel;
                  const num = grid.message.kind === 'cc' ? grid.message.cc : grid.message.note;
                  const val = grid.message.kind === 'cc' ? grid.message.value : grid.message.velocity;
                  send.setGridAlignment({
                    message: { kind: 'note', channel: ch, note: num, velocity: val },
                  });
                }}
              >
                Note
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={!isNote}
                data-on={!isNote || undefined}
                className="mr-insp-grid-align__seg-btn mr-mono"
                onClick={() => {
                  if (!isNote) return;
                  const ch = grid.message.channel;
                  const num = grid.message.kind === 'note' ? grid.message.note : grid.message.cc;
                  const val =
                    grid.message.kind === 'note' ? grid.message.velocity : grid.message.value;
                  send.setGridAlignment({
                    message: { kind: 'cc', channel: ch, cc: num, value: val },
                  });
                }}
              >
                CC
              </button>
            </div>
          </div>

          <div className="mr-insp-grid-align__steppers">
            <NumStepper
              label="CH"
              value={m.channel}
              min={1}
              max={16}
              onChange={(v) =>
                send.setGridAlignment({
                  message:
                    m.kind === 'note'
                      ? { kind: 'note', channel: v, note: m.note, velocity: m.velocity }
                      : { kind: 'cc', channel: v, cc: m.cc, value: m.value },
                })
              }
            />
            <NumStepper
              label={isNote ? 'N#' : 'CC#'}
              value={m.kind === 'note' ? m.note : m.cc}
              min={0}
              max={127}
              onChange={(v) =>
                send.setGridAlignment({
                  message:
                    m.kind === 'note'
                      ? { kind: 'note', channel: m.channel, note: v, velocity: m.velocity }
                      : { kind: 'cc', channel: m.channel, cc: v, value: m.value },
                })
              }
            />
            <NumStepper
              label={isNote ? 'VEL' : 'VAL'}
              value={m.kind === 'note' ? m.velocity : m.value}
              min={0}
              max={127}
              onChange={(v) =>
                send.setGridAlignment({
                  message:
                    m.kind === 'note'
                      ? { kind: 'note', channel: m.channel, note: m.note, velocity: v }
                      : { kind: 'cc', channel: m.channel, cc: m.cc, value: v },
                })
              }
            />
          </div>

          <button
            type="button"
            className="mr-insp-grid-align__fire mr-mono"
            data-flash={fireFlashing || undefined}
            disabled={fireDisabled}
            onClick={handleManualFire}
          >
            Fire now
          </button>
        </div>
      )}
    </div>
  );
}

function NumStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mr-insp-grid-align__stepper-cell">
      <span className="mr-insp-grid-align__stepper-lbl mr-mono">{label}</span>
      <div className="mr-insp-grid-align__stepper">
        <button
          type="button"
          className="mr-insp-grid-align__step-btn mr-mono"
          onClick={() => onChange(value - 1)}
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <input
          type="number"
          className="mr-input mr-insp-grid-align__step-input"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
        />
        <button
          type="button"
          className="mr-insp-grid-align__step-btn mr-mono"
          onClick={() => onChange(value + 1)}
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}
