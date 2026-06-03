/* Pure presentation helpers for the MIDI map editor UI. */

import {
  TARGET_LIST,
  type ControlMapState,
  type ControlMapping,
  type ControlSource,
  type TargetKey,
  type TargetKind,
} from '../../midi/controlMap';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** A human note name for a MIDI note number, e.g. 60 -> `C4`. */
export function noteName(note: number): string {
  const name = NOTE_NAMES[((note % 12) + 12) % 12];
  const octave = Math.floor(note / 12) - 1;
  return `${name}${octave}`;
}

/** A short label for a learned source, e.g. `C4`, `CC14`, `AT`, `PB`. */
export function sourceBadgeLabel(source: ControlSource): string {
  switch (source.kind) {
    case 'note':
      return noteName(source.data);
    case 'cc':
      return `CC${source.data}`;
    case 'pressure':
      return 'AT';
    case 'pb':
      return 'PB';
  }
}

export const TARGET_KIND_ORDER: readonly TargetKind[] = ['trigger', 'toggle', 'continuous', 'enum'];

export const TARGET_KIND_LABEL: Record<TargetKind, string> = {
  trigger: 'Transport',
  toggle: 'Toggles',
  continuous: 'Continuous',
  enum: 'Selectors',
};

export interface TargetGroup {
  kind: TargetKind;
  label: string;
  targets: { key: TargetKey; label: string }[];
}

/** All mappable targets grouped by kind, in a stable display order. */
export function mappableTargetGroups(): TargetGroup[] {
  return TARGET_KIND_ORDER.map((kind) => ({
    kind,
    label: TARGET_KIND_LABEL[kind],
    targets: TARGET_LIST.filter((d) => d.kind === kind).map((d) => ({ key: d.key, label: d.label })),
  })).filter((g) => g.targets.length > 0);
}

/** The mapping bound to a target, or `null`. */
export function mappingForTarget(
  state: ControlMapState,
  target: TargetKey,
): ControlMapping | null {
  return state.mappings.find((m) => m.target === target) ?? null;
}
