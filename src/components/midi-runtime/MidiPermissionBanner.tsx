import { useMidiRuntime } from '../../midi/MidiRuntimeProvider';
import './MidiPermissionBanner.css';

const COPY: Record<'unsupported' | 'requesting' | 'denied', string> = {
  unsupported: 'Web MIDI not available in this browser.',
  requesting: 'Requesting MIDI access…',
  denied: 'MIDI access denied.',
};

export function MidiPermissionBanner() {
  const { state, retry } = useMidiRuntime();
  if (state.status === 'granted') return null;
  return (
    <div className="mr-midi-banner" data-status={state.status} role="status">
      <span className="mr-midi-banner__msg">{COPY[state.status]}</span>
      {state.status === 'denied' && (
        <button type="button" className="mr-midi-banner__retry" onClick={retry}>
          Retry
        </button>
      )}
    </div>
  );
}
