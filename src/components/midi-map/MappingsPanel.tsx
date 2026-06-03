import { useMidiControl } from '../../midi/MidiControlProvider';
import { useControlMapStore } from '../../hooks/useControlMapStore';
import { TARGET_REGISTRY, type TargetKey } from '../../midi/controlMap';
import { TARGET_KIND_LABEL, TARGET_KIND_ORDER, sourceBadgeLabel } from './mapMode';
import './midiMap.css';

/** The Sidebar-dock Mappings list shown in map mode: every current mapping,
    grouped by target kind. Selecting a row arms that target (for relearn /
    config); the clear button removes the mapping. */
export function MappingsPanel() {
  const { armedTarget, arm } = useMidiControl();
  const { state, clear } = useControlMapStore();

  const byKind = TARGET_KIND_ORDER.map((kind) => ({
    kind,
    label: TARGET_KIND_LABEL[kind],
    mappings: state.mappings.filter((m) => TARGET_REGISTRY[m.target].kind === kind),
  })).filter((g) => g.mappings.length > 0);

  return (
    <div className="mr-map-panel" data-mr-map-panel="mappings">
      <div className="mr-map-panel__head mr-mono">MIDI Mappings</div>
      {state.mappings.length === 0 && (
        <p className="mr-map-panel__empty">
          No mappings yet. Click a control&rsquo;s badge, then move a MIDI control to map it.
        </p>
      )}
      {byKind.map((group) => (
        <div key={group.kind} className="mr-map-group" data-kind={group.kind}>
          <div className="mr-map-group__head mr-mono">{group.label}</div>
          {group.mappings.map((m) => {
            const def = TARGET_REGISTRY[m.target];
            const armed = armedTarget === m.target;
            return (
              <div
                key={m.target}
                className="mr-map-row"
                data-mr-map-row={m.target}
                data-armed={armed || undefined}
              >
                <button
                  type="button"
                  className="mr-map-row__select"
                  aria-pressed={armed}
                  onClick={() => arm(armed ? null : (m.target as TargetKey))}
                >
                  <span className="mr-map-row__label">{def.label}</span>
                  <span className="mr-map-row__source mr-mono">{sourceBadgeLabel(m.source)}</span>
                </button>
                <button
                  type="button"
                  className="mr-map-row__clear"
                  aria-label={`Clear ${def.label} mapping`}
                  title="Clear mapping"
                  onClick={() => clear(m.target)}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
