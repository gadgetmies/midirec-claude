import { useEffect } from 'react';
import { useOptionalMidiControl } from '../../midi/MidiControlProvider';
import './midiMap.css';

function isTextEntry(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
}

/** Titlebar control toggling MIDI map mode, plus the `M` keyboard shortcut.
    Renders nothing outside a `MidiControlProvider`. */
export function MapModeToggle() {
  const control = useOptionalMidiControl();
  const toggleMapMode = control?.toggleMapMode;

  useEffect(() => {
    if (!toggleMapMode) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTextEntry(event.target)) return;
      if (event.key === 'm' || event.key === 'M') {
        event.preventDefault();
        toggleMapMode!();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleMapMode]);

  if (!control) return null;
  const { mapMode } = control;

  return (
    <button
      type="button"
      className="mr-tbtn mr-map-toggle"
      data-on={mapMode || undefined}
      aria-pressed={mapMode}
      onClick={toggleMapMode}
      title="MIDI map mode (M)"
    >
      <span className="mr-tbtn__text mr-mono">MAP</span>
    </button>
  );
}
