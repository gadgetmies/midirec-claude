import type { ReactNode } from 'react';
import { useMidiControl, useOptionalMidiControl } from '../../midi/MidiControlProvider';
import { useControlMapStore } from '../../hooks/useControlMapStore';
import type { TargetKey } from '../../midi/controlMap';
import { mappingForTarget, sourceBadgeLabel } from './mapMode';
import './midiMap.css';

/** The in-place badge for a mappable control. Mounted only while map mode is
    active (by `MapAnchor`), so the map providers are guaranteed present. Shows
    the current source (e.g. `C4`, `CC14`) or "unmapped", and arms / disarms the
    target on click. */
export function MapBadge({ target }: { target: TargetKey }) {
  const { armedTarget, arm } = useMidiControl();
  const { state } = useControlMapStore();
  const mapping = mappingForTarget(state, target);
  const armed = armedTarget === target;
  const label = mapping ? sourceBadgeLabel(mapping.source) : '';
  return (
    <button
      type="button"
      className="mr-map-badge"
      data-mr-map-target={target}
      data-armed={armed || undefined}
      data-unmapped={!mapping || undefined}
      aria-pressed={armed}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        arm(armed ? null : target);
      }}
      title={
        armed
          ? 'Listening — move a MIDI control to map it'
          : mapping
            ? `Mapped to ${sourceBadgeLabel(mapping.source)} · click to remap`
            : 'Click, then move a MIDI control to map it'
      }
    >
      {armed ? 'learn…' : label}
    </button>
  );
}

/** Wraps a mappable control so its badge overlays it in map mode. Renders the
    badge only while map mode is active; outside a `MidiControlProvider` it just
    renders its children (so focused component tests need no extra providers). */
export function MapAnchor({ target, children }: { target: TargetKey; children: ReactNode }) {
  const control = useOptionalMidiControl();
  const mapMode = control?.mapMode ?? false;
  return (
    <span className="mr-map-anchor" data-map-mode={mapMode || undefined}>
      {children}
      {mapMode && <MapBadge target={target} />}
    </span>
  );
}
