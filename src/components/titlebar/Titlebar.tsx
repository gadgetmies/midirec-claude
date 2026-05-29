import { useEffect, useRef, useState } from 'react';
import { useStatusbar } from '../../hooks/useStatusbar';
import { useTransport, type ClockSource } from '../../hooks/useTransport';
import { useMidiClock, type ClockSourceSelection } from '../../midi/MidiClockProvider';
import { useMidiInputs } from '../../midi/MidiRuntimeProvider';
import { QUANTIZE_GRIDS, type QuantizeGrid } from '../../midi/quantizeGrid';
import { useToast } from '../toast/Toast';
import {
  ChevDownIcon,
  CueIcon,
  FfwIcon,
  LoopIcon,
  MetroIcon,
  PauseIcon,
  PlayIcon,
  RecIcon,
  RewIcon,
  StopIcon,
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
  const { selection: clockSelection, setSelection: setClockSelection } = useMidiClock();
  const toast = useToast();
  const [gridMenuOpen, setGridMenuOpen] = useState(false);
  const gridChipRef = useRef<HTMLButtonElement>(null);
  const gridMenuRef = useRef<HTMLDivElement>(null);
  const [clkMenuOpen, setClkMenuOpen] = useState(false);
  const clkBtnRef = useRef<HTMLButtonElement>(null);
  const clkMenuRef = useRef<HTMLDivElement>(null);

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
  } = transport;

  const handlePlay = () => {
    if (playing) {
      transport.pause();
      return;
    }
    transport.play();
    toast.show(`Started · ${bpm} BPM`);
  };

  const handleStop = () => {
    if (recording) {
      const events = Math.max(1, Math.floor(timecodeMs / 67));
      const sizeMb = ((events * 1.1) / 1024).toFixed(1);
      toast.show(`Recording saved · ${sizeMb} MB · ${events.toLocaleString()} events`, {
        shortcut: '⌘Z',
      });
    }
    transport.stop();
  };

  const handleRec = () => {
    if (recording) {
      handleStop();
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

  const statusLed = recording ? 'rec' : playing ? 'play' : undefined;
  const statusLabel = recording ? 'REC' : playing ? 'PLAY' : 'IDLE';
  const statusColor = recording
    ? 'var(--mr-rec)'
    : playing
      ? 'var(--mr-play)'
      : 'var(--mr-text-2)';

  return (
    <div className="mr-transport">
      <div className="mr-brand">
        <div className="mr-brand__mark" />
        <div className="mr-brand__text">
          <span className="mr-brand__name">MIDI Recorder</span>
          <span className="mr-brand__ver mr-mono">v0.4.2</span>
        </div>
      </div>

      <div className="mr-tgroup">
        <button className="mr-tbtn" type="button" title="Cue start" aria-label="Rewind">
          <RewIcon />
        </button>
        <button className="mr-tbtn" type="button" title="Skip back" aria-label="Cue">
          <CueIcon />
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
          onClick={handleStop}
          aria-label="Stop"
          title="Stop"
        >
          <StopIcon />
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
        <span className="mr-led" data-state={statusLed} />
        <span className="mr-status__label mr-mono" style={{ color: statusColor }}>
          {statusLabel}
        </span>
        <span className="mr-status__sep mr-mono">·</span>
        <span className="mr-led" {...(midiActive ? { 'data-state': 'midi' } : {})} />
        <span className="mr-status__label mr-mono">MIDI IN</span>
      </div>
    </div>
  );
}
