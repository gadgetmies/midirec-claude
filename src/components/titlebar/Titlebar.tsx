import { useEffect, useRef, useState } from 'react';
import { useStatusbar } from '../../hooks/useStatusbar';
import { useTransport, type ClockSource } from '../../hooks/useTransport';
import { useMidiClock, type ClockSourceSelection } from '../../midi/MidiClockProvider';
import { useMidiClockSend } from '../../midi/MidiClockSendProvider';
import { useMidiInputs, useMidiOutputs } from '../../midi/MidiRuntimeProvider';
import { QUANTIZE_GRIDS, type QuantizeGrid } from '../../midi/quantizeGrid';
import { useToast } from '../toast/Toast';
import {
  ChevDownIcon,
  FfwIcon,
  LoopIcon,
  MetroIcon,
  PauseIcon,
  PlayIcon,
  RecIcon,
  RewIcon,
} from '../icons/transport';
import { BeatLed } from './BeatLed';
import { formatBig, formatMs } from './format';
import './Titlebar.css';

const CLOCK_LABEL: Record<ClockSource, string> = {
  internal: 'Int',
  'external-clock': 'Ext',
  'external-mtc': 'MTC',
};

export function Titlebar() {
  const transport = useTransport();
  const { active: midiActive } = useStatusbar();
  const { inputs } = useMidiInputs();
  const { outputs } = useMidiOutputs();
  const {
    selection: clockSelection,
    setSelection: setClockSelection,
    strictStart,
    setStrictStart,
  } = useMidiClock();
  const {
    enabled: sendEnabled,
    selectedOutputIds: sendSelectedOutputIds,
    txPulse,
    setEnabled: setSendEnabled,
    toggleOutput: toggleSendOutput,
    setSelectedOutputs: setSendSelectedOutputs,
    sync: syncSlaves,
  } = useMidiClockSend();
  const toast = useToast();
  const [gridMenuOpen, setGridMenuOpen] = useState(false);
  const gridChipRef = useRef<HTMLButtonElement>(null);
  const gridMenuRef = useRef<HTMLDivElement>(null);
  const [clkMenuOpen, setClkMenuOpen] = useState(false);
  const clkBtnRef = useRef<HTMLButtonElement>(null);
  const clkMenuRef = useRef<HTMLDivElement>(null);
  const [sndMenuOpen, setSndMenuOpen] = useState(false);
  const sndBtnRef = useRef<HTMLButtonElement>(null);
  const sndMenuRef = useRef<HTMLDivElement>(null);
  const sndLedRef = useRef<HTMLSpanElement>(null);

  const hasInput = inputs.length > 0;
  const recDisabled = !hasInput;
  const recDisabledTitle = 'No MIDI input available';

  const {
    playing,
    recording,
    looping,
    metronomeOn,
    quantizeOn,
    quantizeGrid,
    snapAbsoluteOn,
    timecodeMs,
    bar,
    bpm,
    sig,
    clockSource,
    recordingStartedAt,
  } = transport;

  const handlePlay = () => {
    if (playing) {
      transport.pause();
      return;
    }
    if (recordingStartedAt !== null) {
      transport.record();
      return;
    }
    transport.play();
    toast.show(`Started · ${bpm} BPM`);
  };

  const handleRewind = () => transport.rewind();
  const handleCue = () => transport.cue();

  const handleRec = () => {
    if (recording) {
      const events = Math.max(1, Math.floor(timecodeMs / 67));
      const sizeMb = ((events * 1.1) / 1024).toFixed(1);
      transport.pause();
      toast.show(`Recording saved · ${sizeMb} MB · ${events.toLocaleString()} events`, {
        shortcut: '⌘Z',
      });
      return;
    }
    transport.record();
  };

  useEffect(() => {
    if (!gridMenuOpen) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (gridMenuRef.current?.contains(target)) return;
      if (gridChipRef.current?.contains(target)) return;
      setGridMenuOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setGridMenuOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [gridMenuOpen]);

  useEffect(() => {
    if (!quantizeOn && gridMenuOpen) setGridMenuOpen(false);
  }, [quantizeOn, gridMenuOpen]);

  const handleSelectGrid = (grid: QuantizeGrid) => {
    transport.setQuantizeGrid(grid);
    setGridMenuOpen(false);
  };

  useEffect(() => {
    if (!clkMenuOpen) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (clkMenuRef.current?.contains(target)) return;
      if (clkBtnRef.current?.contains(target)) return;
      setClkMenuOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setClkMenuOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [clkMenuOpen]);

  const handleSelectClockSource = (sel: ClockSourceSelection) => {
    setClockSelection(sel);
    setClkMenuOpen(false);
  };

  /* Snd menu — outside-click / Escape close, matching the Clk pattern. */
  useEffect(() => {
    if (!sndMenuOpen) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (sndMenuRef.current?.contains(target)) return;
      if (sndBtnRef.current?.contains(target)) return;
      setSndMenuOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setSndMenuOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [sndMenuOpen]);

  /* TX LED pulse — apply CSS class on each txPulse advance, remove after
     100 ms. The class swap drives an 80 ms opacity keyframe. */
  useEffect(() => {
    if (!sendEnabled) return;
    const el = sndLedRef.current;
    if (!el) return;
    el.classList.add('is-tx-pulse');
    const t = setTimeout(() => el.classList.remove('is-tx-pulse'), 100);
    return () => {
      clearTimeout(t);
    };
  }, [txPulse, sendEnabled]);

  /* Compute Snd pill display text + color per spec. */
  const sndState: { text: string; color: string } = (() => {
    if (!sendEnabled) return { text: 'Off', color: 'var(--mr-text-3)' };
    if (sendSelectedOutputIds.size === 0) return { text: 'No outs', color: 'var(--mr-rec)' };
    if (sendSelectedOutputIds.size === 1) {
      const id = Array.from(sendSelectedOutputIds)[0];
      const dev = outputs.find((o) => o.id === id);
      const name = dev?.name ?? id;
      const truncated = name.length > 12 ? `${name.slice(0, 11)}…` : name;
      return { text: truncated, color: 'var(--mr-text-1)' };
    }
    return { text: `${sendSelectedOutputIds.size} outs`, color: 'var(--mr-text-1)' };
  })();

  return (
    <div className="mr-transport">
      <div className="mr-brand">
        <div className="mr-brand__mark" title="MIDI Recorder v0.4.2" />
      </div>

      <div className="mr-tgroup">
        <button
          className="mr-tbtn"
          type="button"
          onClick={handleRewind}
          title="Rewind to start"
          aria-label="Rewind"
        >
          <RewIcon />
        </button>
        <button
          className="mr-tbtn"
          type="button"
          data-on={playing || undefined}
          onClick={handlePlay}
          aria-label={playing ? 'Pause' : 'Play'}
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          className="mr-tbtn"
          type="button"
          onClick={handleCue}
          title="Set cue point / Stop and return to cue"
          aria-label="Cue"
        >
          <span className="mr-tbtn__text mr-mono">CUE</span>
        </button>
        <button
          className="mr-tbtn"
          type="button"
          data-rec="true"
          data-on={recording || undefined}
          onClick={handleRec}
          disabled={!recording && recDisabled}
          aria-label={recording ? 'Stop recording' : 'Record'}
          title={
            recording
              ? 'Stop recording'
              : recDisabled
                ? recDisabledTitle
                : 'Record'
          }
        >
          <RecIcon />
        </button>
        <button className="mr-tbtn" type="button" title="Skip end" aria-label="Fast forward">
          <FfwIcon />
        </button>
      </div>

      <div className="mr-timecode" data-recording={recording || undefined}>
        <span className="mr-timecode__big mr-mono">{formatBig(timecodeMs)}</span>
        <span className="mr-timecode__big mr-timecode__ms mr-mono">.{formatMs(timecodeMs)}</span>
      </div>

      <div className="mr-meta-row">
        <div className="mr-meta">
          <span className="mr-meta__lbl">Bar</span>
          <span className="mr-meta__val mr-mono">{bar}</span>
        </div>
        <div className="mr-meta">
          <span className="mr-meta__lbl">BPM</span>
          <span className="mr-meta__val mr-mono">{bpm}</span>
        </div>
        <div className="mr-meta mr-meta--clk">
          <span className="mr-meta__lbl">Clk</span>
          <button
            ref={clkBtnRef}
            className="mr-meta__val mr-meta__val--btn mr-mono"
            type="button"
            aria-haspopup="listbox"
            aria-expanded={clkMenuOpen}
            onClick={() => setClkMenuOpen((open) => !open)}
            title="MIDI clock source"
          >
            {CLOCK_LABEL[clockSource]}
            <ChevDownIcon />
          </button>
          {clkMenuOpen && (
            <div ref={clkMenuRef} className="mr-clk__menu" role="listbox">
              <button
                key="auto"
                type="button"
                role="option"
                aria-selected={clockSelection === 'auto'}
                data-on={clockSelection === 'auto' || undefined}
                className="mr-clk__menu-row mr-mono"
                onClick={() => handleSelectClockSource('auto')}
              >
                Auto
              </button>
              <button
                key="internal"
                type="button"
                role="option"
                aria-selected={clockSelection === 'internal'}
                data-on={clockSelection === 'internal' || undefined}
                className="mr-clk__menu-row mr-mono"
                onClick={() => handleSelectClockSource('internal')}
              >
                Internal
              </button>
              {inputs.map((dev) => (
                <button
                  key={dev.id}
                  type="button"
                  role="option"
                  aria-selected={clockSelection === dev.id}
                  data-on={clockSelection === dev.id || undefined}
                  className="mr-clk__menu-row mr-mono"
                  onClick={() => handleSelectClockSource(dev.id)}
                  title={dev.name}
                >
                  {dev.name}
                </button>
              ))}
              <div
                role="switch"
                aria-checked={strictStart}
                data-on={strictStart || undefined}
                className="mr-clk__menu-row--strict mr-mono"
                onClick={() => setStrictStart(!strictStart)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setStrictStart(!strictStart);
                  }
                }}
                tabIndex={0}
              >
                <span className="mr-clk__menu-row__main">
                  <span className="mr-clk__menu-row__lbl">Strict Start</span>
                  <span className="mr-clk__menu-row__sub">rewind to 0 on incoming Start</span>
                </span>
                <span className="mr-switch" data-on={strictStart || undefined} aria-hidden="true" />
              </div>
            </div>
          )}
        </div>
        <div className="mr-meta mr-meta--snd">
          <span className="mr-meta__lbl mr-meta__lbl--with-led">
            Snd
            <span
              ref={sndLedRef}
              className="mr-led"
              data-state={sendEnabled ? 'tx' : undefined}
              aria-hidden="true"
            />
          </span>
          <button
            ref={sndBtnRef}
            className="mr-meta__val mr-meta__val--btn mr-meta__val--btn-snd mr-mono"
            type="button"
            aria-haspopup="listbox"
            aria-expanded={sndMenuOpen}
            onClick={() => setSndMenuOpen((open) => !open)}
            title={sndState.text}
            style={{ color: sndState.color }}
          >
            <span className="mr-meta__val-text">{sndState.text}</span>
            <ChevDownIcon />
          </button>
          {sndMenuOpen && (
            <div ref={sndMenuRef} className="mr-snd__menu mr-clk__menu" role="listbox">
              <button
                type="button"
                role="switch"
                aria-checked={sendEnabled}
                data-on={sendEnabled || undefined}
                className="mr-clk__menu-row mr-snd__menu-row mr-snd__menu-row--toggle mr-mono"
                onClick={() => setSendEnabled(!sendEnabled)}
              >
                <span className="mr-snd__menu-row__lbl">Enable send</span>
                <span
                  className="mr-switch"
                  data-on={sendEnabled || undefined}
                  aria-hidden="true"
                />
              </button>
              {outputs.map((dev) => (
                <button
                  key={dev.id}
                  type="button"
                  role="option"
                  aria-checked={sendSelectedOutputIds.has(dev.id)}
                  aria-selected={sendSelectedOutputIds.has(dev.id)}
                  data-on={sendSelectedOutputIds.has(dev.id) || undefined}
                  className="mr-clk__menu-row mr-snd__menu-row mr-mono"
                  onClick={() => toggleSendOutput(dev.id)}
                  title={dev.name}
                >
                  <span className="mr-snd__menu-row__check" aria-hidden="true" />
                  <span className="mr-snd__menu-row__name">{dev.name}</span>
                </button>
              ))}
              <div className="mr-snd__menu-footer">
                <button
                  type="button"
                  className="mr-snd__menu-footer-btn mr-mono"
                  onClick={() => setSendSelectedOutputs(outputs.map((o) => o.id))}
                  disabled={outputs.length === 0}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="mr-snd__menu-footer-btn mr-mono"
                  onClick={() => setSendSelectedOutputs([])}
                  disabled={outputs.length === 0}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="mr-snd__menu-footer-btn mr-mono"
                  onClick={() => syncSlaves()}
                  disabled={
                    !sendEnabled ||
                    !Array.from(sendSelectedOutputIds).some((id) =>
                      outputs.some((o) => o.id === id),
                    )
                  }
                >
                  Sync slaves now
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="mr-meta">
          <span className="mr-meta__lbl">Sig</span>
          <span className="mr-meta__val mr-mono">{sig}</span>
        </div>
      </div>

      <div className="mr-tgroup">
        <button
          className="mr-tbtn"
          type="button"
          data-on={looping || undefined}
          onClick={transport.toggleLoop}
          aria-pressed={looping}
          title="Loop"
        >
          <LoopIcon />
        </button>
        <button
          className="mr-tbtn"
          type="button"
          data-on={metronomeOn || undefined}
          onClick={transport.toggleMetronome}
          aria-pressed={metronomeOn}
          title="Metronome"
        >
          <MetroIcon />
        </button>
      </div>

      <div className="mr-tgroup mr-quant" title="Quantize on record & edit">
        <button
          className="mr-quant__lbl mr-mono"
          type="button"
          data-on={quantizeOn || undefined}
          onClick={transport.toggleQuantize}
          aria-pressed={quantizeOn}
          title={quantizeOn ? 'Quantize on' : 'Quantize off — bypass'}
        >
          Q
        </button>
        <button
          className="mr-quant__lbl mr-mono"
          type="button"
          data-on={snapAbsoluteOn || undefined}
          data-disabled={!quantizeOn ? 'true' : undefined}
          onClick={
            quantizeOn
              ? transport.toggleSnapAbsolute
              : (e) => {
                  e.preventDefault();
                }
          }
          aria-pressed={snapAbsoluteOn}
          title={
            !quantizeOn
              ? 'Enable Quantize to use Snap Absolute'
              : snapAbsoluteOn
                ? 'Snap Absolute on - drag aligns items to grid'
                : 'Snap Absolute off - drag preserves off-grid offset'
          }
        >
          A
        </button>
        <div className="mr-quant__value-wrap">
          <button
            ref={gridChipRef}
            className="mr-tbtn mr-quant__value mr-mono"
            type="button"
            data-on={quantizeOn || undefined}
            data-dim={!quantizeOn || undefined}
            disabled={!quantizeOn}
            aria-haspopup="listbox"
            aria-expanded={gridMenuOpen}
            onClick={() => setGridMenuOpen((open) => !open)}
            title={`Grid: ${quantizeGrid}${quantizeOn ? '' : ' (bypassed)'}`}
          >
            <span>{quantizeGrid}</span>
            <ChevDownIcon />
          </button>
          {gridMenuOpen && (
            <div ref={gridMenuRef} className="mr-quant__menu" role="listbox">
              {QUANTIZE_GRIDS.map((g) => (
                <button
                  key={g}
                  type="button"
                  role="option"
                  aria-selected={g === quantizeGrid}
                  data-on={g === quantizeGrid || undefined}
                  className="mr-quant__menu-row mr-mono"
                  onClick={() => handleSelectGrid(g)}
                >
                  {g}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mr-spacer" />

      <div className="mr-status">
        <BeatLed />
        <span className="mr-status__sep mr-mono">·</span>
        <span className="mr-led" {...(midiActive ? { 'data-state': 'midi' } : {})} />
        <span className="mr-status__label mr-mono">MIDI IN</span>
      </div>
    </div>
  );
}
