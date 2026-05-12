import { useStage } from '../../hooks/useStage';
import { useStatusbar } from '../../hooks/useStatusbar';
import { useTransport, type ClockSource } from '../../hooks/useTransport';
import { useMidiInputs } from '../../midi/MidiRuntimeProvider';
import { useToast } from '../toast/Toast';
import {
  ChevDownIcon,
  CueIcon,
  FfwIcon,
  LoopIcon,
  MetroIcon,
  PauseIcon,
  PlayIcon,
  QuantizeIcon,
  RecIcon,
  RewIcon,
  StopIcon,
} from '../icons/transport';
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
  const { selectedChannelId } = useStage();
  const { inputs } = useMidiInputs();
  const toast = useToast();

  const hasInput = inputs.length > 0;
  const hasChannel = selectedChannelId !== null;
  const recDisabled = !hasInput || !hasChannel;
  const recDisabledTitle = !hasInput
    ? 'No MIDI input available'
    : 'Select a channel to record into';

  const {
    playing,
    recording,
    looping,
    metronomeOn,
    quantizeOn,
    quantizeGrid,
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
        <div className="mr-meta">
          <span className="mr-meta__lbl">Clk</span>
          <span className="mr-meta__val mr-mono">{CLOCK_LABEL[clockSource]}</span>
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
        <span className="mr-quant__lbl mr-mono">Q</span>
        <button
          className="mr-tbtn mr-quant__power"
          type="button"
          data-on={quantizeOn || undefined}
          onClick={transport.toggleQuantize}
          aria-pressed={quantizeOn}
          title={quantizeOn ? 'Quantize on' : 'Quantize off — bypass'}
        >
          <QuantizeIcon />
        </button>
        <button
          className="mr-tbtn mr-quant__value mr-mono"
          type="button"
          data-on={quantizeOn || undefined}
          data-dim={!quantizeOn || undefined}
          disabled
          title={`Grid: ${quantizeGrid}${quantizeOn ? '' : ' (bypassed)'}`}
        >
          <span>{quantizeGrid}</span>
          <ChevDownIcon />
        </button>
      </div>

      <div className="mr-spacer" />

      <div className="mr-status">
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
