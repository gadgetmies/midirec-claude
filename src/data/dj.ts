/* DJ data tables — ported verbatim from
   design_handoff_midi_recorder/prototype/dj.jsx:10-77.

   Drives:
   - `dj-action-tracks` capability (Slice 7a): default seeded `actionMap` for
     the demo session's DJ track.
   - `dj-action-tracks` Slice 7b: action-label keys column rendering,
     trigger/velocity/pressure mode discriminators.

   `as const` everywhere so literal types survive — `DJ_DEVICES.deck1.color`
   is the literal string, not just `string`. */

export type CategoryId =
  | 'transport'
  | 'cue'
  | 'hotcue'
  | 'loop'
  | 'fx'
  | 'deck'
  | 'mixer';

export type DeviceId =
  | 'deck1'
  | 'deck2'
  | 'deck3'
  | 'deck4'
  | 'fx1'
  | 'fx2'
  | 'mixer'
  | 'global';

export type TriggerMode = 'momentary' | 'toggle';

export interface ActionMapEntry {
  id: string;
  cat: CategoryId;
  label: string;
  short: string;
  device: DeviceId;
  pad?: boolean;
  pressure?: boolean;
  trigger?: TriggerMode;
}

/* The MIDI emitted on playback when an action fires. Distinct from the
   input binding in ActionMapEntry (which says "incoming pitch X means this
   action"). An action may have no output mapping at all (the entry can be
   absent from `track.outputMap`); the engine then treats the action as a
   no-emit binding. Channel is 1..16, pitch is 0..127. */
export interface OutputMapping {
  device: DeviceId;
  channel: number;
  pitch: number;
}

/* One occurrence of an action on the timeline. Structurally identical to
   `Note` from src/components/piano-roll/notes.ts — kept as a separate type
   so the routing-derivation slice can diverge them later if needed. */
export interface ActionEvent {
  pitch: number;
  t: number;
  dur: number;
  vel: number;
}

/* Render mode dispatched from an action's flags. Precedence (highest first):
   pressure-bearing > velocity-sensitive > trigger > fallback.
   - trigger: `cat ∈ {transport, cue, hotcue}` and not pressure-bearing.
   - velocity-sensitive: `pad === true` and not pressure-bearing.
   - pressure-bearing: `pressure === true`.
   - fallback: anything else (e.g. mixer/loop without pad/pressure). */
export type ActionMode = 'trigger' | 'velocity-sensitive' | 'pressure-bearing' | 'fallback';

export function actionMode(action: ActionMapEntry): ActionMode {
  if (action.pressure === true) return 'pressure-bearing';
  if (action.pad === true) return 'velocity-sensitive';
  if (action.cat === 'transport' || action.cat === 'cue' || action.cat === 'hotcue') {
    return 'trigger';
  }
  return 'fallback';
}


/* Action categories — used for grouping/labeling only. */
export const DJ_CATEGORIES: Record<CategoryId, { label: string }> = {
  transport: { label: 'Transport' },
  cue:       { label: 'Cue'       },
  hotcue:    { label: 'Hot Cue'   },
  loop:      { label: 'Loop'      },
  fx:        { label: 'FX'        },
  deck:      { label: 'Deck'      },
  mixer:     { label: 'Mixer'     },
} as const;

/* Devices — drive color. Each device == a controller surface
   (deck, fx unit, mixer, global). */
export const DJ_DEVICES = {
  deck1:  { label: 'Deck 1',   short: 'D1',  color: 'oklch(72% 0.16 200)' }, // teal-cyan
  deck2:  { label: 'Deck 2',   short: 'D2',  color: 'oklch(70% 0.20 30)'  }, // coral-red
  deck3:  { label: 'Deck 3',   short: 'D3',  color: 'oklch(76% 0.16 145)' }, // green
  deck4:  { label: 'Deck 4',   short: 'D4',  color: 'oklch(74% 0.16 80)'  }, // amber-yellow
  fx1:    { label: 'FX 1',     short: 'FX1', color: 'oklch(72% 0.18 310)' }, // magenta
  fx2:    { label: 'FX 2',     short: 'FX2', color: 'oklch(70% 0.16 270)' }, // violet
  mixer:  { label: 'Mixer',    short: 'MX',  color: 'oklch(78% 0.06 240)' }, // cool gray-blue
  global: { label: 'Global',   short: 'GL',  color: 'oklch(70% 0.04 80)'  }, // warm neutral
} as const satisfies Record<DeviceId, { label: string; short: string; color: string }>;

/* Default action map. Pitch → action. */
export const DEFAULT_ACTION_MAP: Record<number, ActionMapEntry> = {
  // Deck 1
  48: { id: 'play',      cat: 'transport', label: 'Play / Pause', short: 'PLAY',  device: 'deck1' },
  49: { id: 'cue',       cat: 'cue',       label: 'Cue',          short: 'CUE',   device: 'deck1' },
  50: { id: 'sync',      cat: 'transport', label: 'Sync',         short: 'SYNC',  device: 'deck1' },
  51: { id: 'rev',       cat: 'transport', label: 'Reverse',      short: 'REV',   device: 'deck1' },
  52: { id: 'loop_in',   cat: 'loop',      label: 'Loop In',      short: 'L·IN',  device: 'deck1' },
  53: { id: 'loop_out',  cat: 'loop',      label: 'Loop Out',     short: 'L·OUT', device: 'deck1' },
  54: { id: 'loop_x2',   cat: 'loop',      label: 'Loop ×2', short: 'L×2',   device: 'deck1' },
  55: { id: 'loop_half', cat: 'loop',      label: 'Loop ÷2', short: 'L÷2',   device: 'deck1' },
  56: { id: 'hc1',       cat: 'hotcue',    label: 'Hot Cue 1',    short: 'HC1',   device: 'deck1', pad: true, pressure: true },
  57: { id: 'hc2',       cat: 'hotcue',    label: 'Hot Cue 2',    short: 'HC2',   device: 'deck1', pad: true },
  58: { id: 'hc3',       cat: 'hotcue',    label: 'Hot Cue 3',    short: 'HC3',   device: 'deck1', pad: true },
  59: { id: 'hc4',       cat: 'hotcue',    label: 'Hot Cue 4',    short: 'HC4',   device: 'deck1', pad: true },
  // FX 1
  60: { id: 'fx1_on',    cat: 'fx',        label: 'FX 1 On',      short: 'ON',    device: 'fx1' },
  61: { id: 'fx1_beat',  cat: 'fx',        label: 'FX 1 Beats',   short: 'BEATS', device: 'fx1' },
  62: { id: 'fx1_dry',   cat: 'fx',        label: 'FX 1 Dry/Wet', short: 'D/W',   device: 'fx1' },
  // FX 2
  63: { id: 'fx2_on',    cat: 'fx',        label: 'FX 2 On',      short: 'ON',    device: 'fx2' },
  64: { id: 'fx2_beat',  cat: 'fx',        label: 'FX 2 Beats',   short: 'BEATS', device: 'fx2' },
  // Deck 2
  65: { id: 'play_b',    cat: 'transport', label: 'Play / Pause', short: 'PLAY',  device: 'deck2' },
  66: { id: 'cue_b',     cat: 'cue',       label: 'Cue',          short: 'CUE',   device: 'deck2' },
  67: { id: 'sync_b',    cat: 'transport', label: 'Sync',         short: 'SYNC',  device: 'deck2' },
  68: { id: 'loop_in_b', cat: 'loop',      label: 'Loop In',      short: 'L·IN',  device: 'deck2' },
  69: { id: 'hc1_b',     cat: 'hotcue',    label: 'Hot Cue 1',    short: 'HC1',   device: 'deck2' },
  70: { id: 'hc2_b',     cat: 'hotcue',    label: 'Hot Cue 2',    short: 'HC2',   device: 'deck2' },
  // Mixer
  71: { id: 'xfade_a',   cat: 'mixer',     label: 'Crossfade ◀', short: 'X◀',   device: 'mixer' },
  72: { id: 'xfade_b',   cat: 'mixer',     label: 'Crossfade ▶', short: 'X▶',   device: 'mixer' },
  73: { id: 'load_a',    cat: 'deck',      label: 'Load Deck 1',  short: 'LD·1', device: 'mixer' },
  74: { id: 'load_b',    cat: 'deck',      label: 'Load Deck 2',  short: 'LD·2', device: 'mixer' },
  // Global
  75: { id: 'tap',       cat: 'transport', label: 'Tap Tempo',    short: 'TAP',   device: 'global' },
};

/* ── Helpers ───────────────────────────────────────────────────────────── */

/* Fall back to the `global` device for unknown ids — matches the prototype's
   `(DJ_DEVICES[device] || DJ_DEVICES.global)` pattern. */
function deviceOrGlobal(d: DeviceId): { label: string; short: string; color: string } {
  return DJ_DEVICES[d] ?? DJ_DEVICES.global;
}

export function devColor(d: DeviceId): string {
  return deviceOrGlobal(d).color;
}

export function devShort(d: DeviceId): string {
  return deviceOrGlobal(d).short;
}

export function devLabel(d: DeviceId): string {
  return deviceOrGlobal(d).label;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/* Pitch → MIDI note label (e.g. 60 → "C4", 48 → "C3"). The octave numbering
   follows the prototype (`Math.floor(p / 12) - 1`), which puts middle C at C4. */
export function pitchLabel(p: number): string {
  const note = NOTE_NAMES[((p % 12) + 12) % 12];
  const octave = Math.floor(p / 12) - 1;
  return `${note}${octave}`;
}
