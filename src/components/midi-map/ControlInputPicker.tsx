import { useControlMapStore } from '../../hooks/useControlMapStore';
import { useMidiInputs } from '../../midi/MidiRuntimeProvider';
import './midiMap.css';

/** Picks which input devices the control receiver listens to. The "All devices"
    slide switch, when on, listens to every granted input; turning it off
    restricts listening to the checked devices. Shown in the (left) map dock. */
export function ControlInputPicker() {
  const { state, setListenInputs } = useControlMapStore();
  const { inputs } = useMidiInputs();
  const selected = state.listenInputIds ?? [];
  const allMode = selected.length === 0;

  const toggleAll = () => {
    // Off → pre-select every current input as an explicit set the user can
    // prune; on → clear back to "all".
    setListenInputs(allMode ? inputs.map((d) => d.id) : []);
  };

  const toggleDevice = (id: string) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    setListenInputs(next);
  };

  return (
    <div className="mr-map-panel" data-mr-map-panel="inputs">
      <div className="mr-map-panel__head mr-mono">Control inputs</div>
      <button
        type="button"
        role="switch"
        aria-checked={allMode}
        data-mr-listen-all
        className="mr-map-row__select mr-map-switch-row"
        onClick={toggleAll}
        title="Listen to every connected input"
      >
        <span className="mr-map-row__label">All devices</span>
        <span className="mr-switch" data-on={allMode ? 'true' : 'false'} aria-hidden="true" />
      </button>
      {!allMode && (
        <div className="mr-map-group" data-kind="inputs">
          {inputs.length === 0 && <p className="mr-map-panel__empty">No MIDI inputs available.</p>}
          {inputs.map((dev) => {
            const on = selected.includes(dev.id);
            return (
              <button
                key={dev.id}
                type="button"
                role="switch"
                aria-checked={on}
                data-mr-listen-input={dev.id}
                className="mr-map-row__select mr-map-switch-row"
                onClick={() => toggleDevice(dev.id)}
                title={dev.name}
              >
                <span className="mr-map-row__label">{dev.name}</span>
                <span className="mr-switch" data-on={on ? 'true' : 'false'} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
