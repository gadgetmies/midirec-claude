/* MIDI feedback output for control mapping.

   For toggle / enum mappings with `feedback.enabled`, this watches the target's
   state via the registry `stateSelector` and emits the configured note / CC to
   the feedback port on each change (plus an initial sync). Output writes reuse
   the raw `clockSender` emit helpers but are independent of the clock sender's
   enable state. When the feedback port is unavailable, emission is skipped
   silently. The state-diffing core is pure for testability; the runner
   component wires it to live providers. */

import {
  TARGET_REGISTRY,
  type ControlMapState,
  type ControlSurface,
  type TargetKey,
} from './controlMap';
import { emitCC, emitNoteOn, type ClockOutput } from './clockSender';

export interface FeedbackEmission {
  portId: string;
  channel: number;
  kind: 'note' | 'cc';
  data: number;
  value: number;
}

/** The value to send for a target's current state: toggles map to
    `onValue`/`offValue`; enums map the option index across `onValue..offValue`
    is not meaningful, so enums emit the option index directly. */
function feedbackValue(target: TargetKey, surface: ControlSurface, onValue: number, offValue: number): number {
  const def = TARGET_REGISTRY[target];
  const state = def.stateSelector(surface);
  if (def.kind === 'toggle') {
    return state === true ? onValue : offValue;
  }
  if (def.kind === 'enum') {
    const options = def.enumOptions ?? [];
    const idx = options.indexOf(String(state));
    return Math.max(0, idx);
  }
  return state === true ? onValue : offValue;
}

/** Compute the feedback emissions for the current state, diffing against the
    `last`-emitted values (mutated in place). With `force`, every feedback
    mapping emits regardless of change (used for the initial / map-exit sync). */
export function feedbackEmissionsForState(
  state: ControlMapState,
  surface: ControlSurface,
  last: Map<TargetKey, number>,
  opts: { force?: boolean } = {},
): FeedbackEmission[] {
  const emissions: FeedbackEmission[] = [];
  for (const mapping of state.mappings) {
    const fb = mapping.feedback;
    if (!fb || !fb.enabled) continue;
    const def = TARGET_REGISTRY[mapping.target];
    if (def.kind !== 'toggle' && def.kind !== 'enum') continue;
    const value = feedbackValue(mapping.target, surface, fb.onValue, fb.offValue);
    if (!opts.force && last.get(mapping.target) === value) continue;
    last.set(mapping.target, value);
    emissions.push({ portId: fb.portId, channel: fb.channel, kind: fb.kind, data: fb.data, value });
  }
  return emissions;
}

type OutputResolver = (portId: string) => ClockOutput | null;

/** Emit the given feedback messages, skipping any whose port is unavailable. */
export function emitFeedback(emissions: FeedbackEmission[], resolveOutput: OutputResolver): void {
  for (const e of emissions) {
    const out = resolveOutput(e.portId);
    if (!out) continue; // port missing → skip silently
    if (e.kind === 'note') {
      emitNoteOn([out], e.channel, e.data, e.value, 0);
    } else {
      emitCC([out], e.channel, e.data, e.value, 0);
    }
  }
}
