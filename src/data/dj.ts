/* DJ data tables — ported verbatim from
   design_handoff_midi_recorder/prototype/dj.jsx:10-77.

   Drives:
   - `dj-action-tracks` capability (Slice 7a): default seeded `actionMap` for
     the demo session's DJ track.
   - `dj-action-tracks` Slice 7b: action-label keys column rendering,
     trigger/velocity/pressure mode discriminators.

   `as const` everywhere so literal types survive — `DJ_DEVICES.deck1.color`
   is the literal string, not just `string`. */

export type CategoryId = 'deck' | 'browser' | 'mixer' | 'fx' | 'global';

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

/** Incoming message type for DJ action row record routing (Map Note panel). */
export type MidiInputKind = 'note' | 'cc' | 'at' | 'pb';

export interface ActionMapEntry {
  id: string;
  cat: CategoryId;
  label: string;
  short: string;
  device: DeviceId;
  pad?: boolean;
  pressure?: boolean;
  trigger?: TriggerMode;
  /** Web MIDI port ids. Non-empty = listen only on these ports (same note/channel). Empty/omitted = DJ track default port, or any subscribed port when track default is also empty. */
  midiInputDeviceIds?: string[];
  /** When set, selects how incoming MIDI is matched for this row. If omitted, inferred from legacy `midiInputCc` / defaults to note. */
  midiInputKind?: MidiInputKind;
  /** MIDI wire channel 1–16 for incoming notes; defaults to 1 when unset. */
  midiInputChannel?: number;
  /** Incoming note 0–127; defaults to the action row pitch when unset. Used when `midiInputKind` is `note` (or inferred note). */
  midiInputNote?: number;
  /** Control change number 0–127. Used when `midiInputKind` is `cc`. */
  midiInputCc?: number;
}

/* The MIDI emitted on playback when an action fires. Distinct from the
   input binding in ActionMapEntry (which says "incoming pitch X means this
   action"). An action may have no output mapping at all (the entry can be
   absent from `track.outputMap`); the engine then treats the action as a
   no-emit binding. Channel is 1..16, pitch is 0..127. When `cc` is set,
   playback emits Control Change with that controller number instead of
   note-on/note-off. */
export interface OutputMapping {
  device: DeviceId;
  channel: number;
  pitch: number;
  cc?: number;
}

/** Default output MIDI CC numbers for continuous mixer template actions (DJ mixer surface). */
const MIXER_ACTION_DEFAULT_OUTPUT_CC: Partial<Record<string, number>> = {
  xfade_pos: 16,
  ch1_vol: 7,
  ch2_vol: 7,
  ch1_eq_hi: 17,
  ch1_eq_mid: 18,
  ch1_eq_lo: 19,
  ch2_eq_hi: 20,
  ch2_eq_mid: 21,
  ch2_eq_lo: 22,
};

export function defaultMixerOutputCc(actionId: string): number | undefined {
  const n = MIXER_ACTION_DEFAULT_OUTPUT_CC[actionId];
  return n !== undefined ? n : undefined;
}

export function resolvedMidiInputKind(e: ActionMapEntry): MidiInputKind {
  if (e.midiInputKind) return e.midiInputKind;
  if (e.midiInputCc !== undefined) return 'cc';
  return 'note';
}

export function mergeMidiInputKind(nextKind: MidiInputKind, _entry: ActionMapEntry): Partial<ActionMapEntry> {
  const patch: Partial<ActionMapEntry> = { midiInputKind: nextKind };
  if (nextKind === 'note') {
    patch.midiInputCc = undefined;
  } else if (nextKind === 'cc') {
    patch.midiInputNote = undefined;
  } else {
    patch.midiInputNote = undefined;
    patch.midiInputCc = undefined;
  }
  return patch;
}

export function normalizeOutputMapping(m: OutputMapping): OutputMapping {
  const channel = Math.max(1, Math.min(16, Math.round(Number(m.channel)) || 1));
  const pitch = Math.max(0, Math.min(127, Math.round(Number(m.pitch)) || 0));
  const next: OutputMapping = { device: m.device, channel, pitch };
  if (m.cc !== undefined && Number.isFinite(m.cc)) {
    next.cc = Math.max(0, Math.min(127, Math.round(m.cc)));
  }
  return next;
}

export function normalizeActionMapEntry(e: ActionMapEntry): ActionMapEntry {
  let base: ActionMapEntry = e;
  if ((base.id === 'load_a' || base.id === 'load_b') && base.cat === 'mixer') {
    base = { ...base, cat: 'browser' };
  }
  const n: ActionMapEntry = { ...base };
  if (n.midiInputChannel !== undefined) {
    n.midiInputChannel = Math.max(1, Math.min(16, Math.round(n.midiInputChannel)));
  }
  if (n.midiInputNote !== undefined) {
    n.midiInputNote = Math.max(0, Math.min(127, Math.round(n.midiInputNote)));
  }
  if (n.midiInputCc === undefined) {
    delete n.midiInputCc;
  } else {
    n.midiInputCc = Math.max(0, Math.min(127, Math.round(n.midiInputCc)));
  }
  if (n.midiInputKind === undefined) {
    delete n.midiInputKind;
  }
  const kind = resolvedMidiInputKind(n);
  if (kind === 'note') {
    delete n.midiInputCc;
  } else if (kind === 'cc') {
    delete n.midiInputNote;
  } else {
    delete n.midiInputNote;
    delete n.midiInputCc;
  }
  return n;
}

/* A single aftertouch sample on a pressure-bearing action event. `t` is
   note-relative in [0,1] (0 = note-on, 1 = note-off) so curves survive note
   shifts without re-mapping. `v` is [0,1]; the audio engine maps this to
   MIDI 0..127 at emit time. Owned by Slice 9. */
export interface PressurePoint {
  t: number;
  v: number;
}

/* How the per-event pressure curve is rendered, both in the action-track
   lane body and in the Inspector's pressure editor. A user preference, not
   a data transformation. */
export type PressureRenderMode = 'curve' | 'step';

/* One occurrence of an action on the timeline. Structurally a superset of
   `Note` from src/components/piano-roll/notes.ts — adds an optional
   `pressure` curve for aftertouch-bearing actions.

   The `pressure` field has three meaningful states:
   - `undefined` — never edited; renderers synthesise from
     `synthesizePressure(event)`.
   - `[]` — explicitly cleared; renderers draw no aftertouch.
   - non-empty — stored points; renderers rasterise via
     `rasterizePressure(...)`. */
export interface ActionEvent {
  pitch: number;
  t: number;
  dur: number;
  vel: number;
  pressure?: PressurePoint[];
}

/* Render mode dispatched from an action's flags. Precedence (highest first):
   pressure-bearing > velocity-sensitive > trigger > fallback.
   - trigger: momentary deck buttons (Play/Cue/Sync/Rev templates) via id set; not pressure-bearing.
   - velocity-sensitive: `pad === true` and not pressure-bearing.
   - pressure-bearing: `pressure === true`.
   - fallback: anything else (e.g. FX, pads, loop controls without trigger id). */
export type ActionMode = 'trigger' | 'velocity-sensitive' | 'pressure-bearing' | 'fallback';

const TRIGGER_STYLE_ACTION_IDS = new Set([
  'play',
  'play_b',
  'cue',
  'cue_b',
  'sync',
  'sync_b',
  'rev',
]);

export function actionMode(action: ActionMapEntry): ActionMode {
  if (action.pressure === true) return 'pressure-bearing';
  if (action.pad === true) return 'velocity-sensitive';
  if (TRIGGER_STYLE_ACTION_IDS.has(action.id)) return 'trigger';
  return 'fallback';
}

/** Row order top → bottom: ascending `short`, then pitch for stable tie-breaks. */
export function djActionRowOrderTopToBottom(
  actionMap: Record<number, ActionMapEntry>,
): number[] {
  return Object.keys(actionMap)
    .map(Number)
    .sort((a, b) => {
      const sa = actionMap[a]!.short;
      const sb = actionMap[b]!.short;
      const c = sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' });
      return c !== 0 ? c : a - b;
    });
}


/* Action categories — Map Note chips + grouping in DEFAULT_ACTION_MAP. */
export const DJ_CATEGORIES: Record<CategoryId, { label: string }> = {
  deck:    { label: 'Deck'    },
  browser: { label: 'Browser' },
  mixer:   { label: 'Mixer'   },
  fx:      { label: 'FX'      },
  global:  { label: 'Global'  },
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
  48: { id: 'play',      cat: 'deck', label: 'Play / Pause', short: 'PLAY',  device: 'deck1' },
  49: { id: 'cue',       cat: 'deck', label: 'Cue',          short: 'CUE',   device: 'deck1' },
  50: { id: 'sync',      cat: 'deck', label: 'Sync',         short: 'SYNC',  device: 'deck1' },
  51: { id: 'rev',       cat: 'deck', label: 'Reverse',      short: 'REV',   device: 'deck1' },
  52: { id: 'loop_in',   cat: 'deck', label: 'Loop In',      short: 'L·IN',  device: 'deck1' },
  53: { id: 'loop_out',  cat: 'deck', label: 'Loop Out',     short: 'L·OUT', device: 'deck1' },
  54: { id: 'loop_x2',   cat: 'deck', label: 'Loop ×2', short: 'L×2',   device: 'deck1' },
  55: { id: 'loop_half', cat: 'deck', label: 'Loop ÷2', short: 'L÷2',   device: 'deck1' },
  56: { id: 'hc1',       cat: 'deck', label: 'Hot Cue 1',    short: 'HC1',   device: 'deck1', pad: true, pressure: true },
  57: { id: 'hc2',       cat: 'deck', label: 'Hot Cue 2',    short: 'HC2',   device: 'deck1', pad: true },
  58: { id: 'hc3',       cat: 'deck', label: 'Hot Cue 3',    short: 'HC3',   device: 'deck1', pad: true },
  59: { id: 'hc4',       cat: 'deck', label: 'Hot Cue 4',    short: 'HC4',   device: 'deck1', pad: true },
  // FX 1
  60: { id: 'fx1_on',    cat: 'fx',        label: 'FX 1 On',      short: 'ON',    device: 'fx1' },
  61: { id: 'fx1_beat',  cat: 'fx',        label: 'FX 1 Beats',   short: 'BEATS', device: 'fx1' },
  62: { id: 'fx1_dry',   cat: 'fx',        label: 'FX 1 Dry/Wet', short: 'D/W',   device: 'fx1' },
  // FX 2
  63: { id: 'fx2_on',    cat: 'fx',        label: 'FX 2 On',      short: 'ON',    device: 'fx2' },
  64: { id: 'fx2_beat',  cat: 'fx',        label: 'FX 2 Beats',   short: 'BEATS', device: 'fx2' },
  // Deck 2
  65: { id: 'play_b',    cat: 'deck', label: 'Play / Pause', short: 'PLAY',  device: 'deck2' },
  66: { id: 'cue_b',     cat: 'deck', label: 'Cue',          short: 'CUE',   device: 'deck2' },
  67: { id: 'sync_b',    cat: 'deck', label: 'Sync',         short: 'SYNC',  device: 'deck2' },
  68: { id: 'loop_in_b', cat: 'deck', label: 'Loop In',      short: 'L·IN',  device: 'deck2' },
  69: { id: 'hc1_b',     cat: 'deck', label: 'Hot Cue 1',    short: 'HC1',   device: 'deck2', pad: true, pressure: true },
  70: { id: 'hc2_b',     cat: 'deck', label: 'Hot Cue 2',    short: 'HC2',   device: 'deck2', pad: true },
  // Mixer
  73: { id: 'load_a',    cat: 'browser', label: 'Load Deck 1',  short: 'LD·1', device: 'mixer' },
  74: { id: 'load_b',    cat: 'browser', label: 'Load Deck 2',  short: 'LD·2', device: 'mixer' },
  // Global
  75: { id: 'tap',       cat: 'global', label: 'Tap Tempo',    short: 'TAP',   device: 'global' },
  76: { id: 'beat_jump', cat: 'deck', label: 'Beat Jump',    short: 'BJ',    device: 'deck1', pad: true },
  77: { id: 'beat_jump_b', cat: 'deck', label: 'Beat Jump',    short: 'BJ',    device: 'deck2', pad: true },
  78: { id: 'hc3_b',     cat: 'deck', label: 'Hot Cue 3',    short: 'HC3',   device: 'deck2', pad: true },
  79: { id: 'hc4_b',     cat: 'deck', label: 'Hot Cue 4',    short: 'HC4',   device: 'deck2', pad: true },
  80: { id: 'xfade_pos', cat: 'mixer',     label: 'Crossfader',   short: 'XF',    device: 'mixer', pad: true },
  81: { id: 'ch1_vol',   cat: 'mixer',     label: 'Ch 1 Volume',  short: '2V',    device: 'mixer', pad: true },
  82: { id: 'ch2_vol',   cat: 'mixer',     label: 'Ch 2 Volume',  short: '1V',    device: 'mixer', pad: true },
  83: { id: 'ch1_eq_hi', cat: 'mixer',     label: 'Ch 1 EQ High', short: '1H',    device: 'mixer', pad: true },
  84: { id: 'ch1_eq_mid', cat: 'mixer',    label: 'Ch 1 EQ Mid',  short: '1M',    device: 'mixer', pad: true },
  85: { id: 'ch1_eq_lo', cat: 'mixer',     label: 'Ch 1 EQ Low',  short: '1L',    device: 'mixer', pad: true },
  86: { id: 'ch2_eq_hi', cat: 'mixer',     label: 'Ch 2 EQ High', short: '2H',    device: 'mixer', pad: true },
  87: { id: 'ch2_eq_mid', cat: 'mixer',    label: 'Ch 2 EQ Mid',  short: '2M',    device: 'mixer', pad: true },
  88: { id: 'ch2_eq_lo', cat: 'mixer',     label: 'Ch 2 EQ Low',  short: '2L',    device: 'mixer', pad: true },
  89: { id: 'beat_jump_size', cat: 'deck', label: 'Beat Jump Size', short: 'BJ·S', device: 'deck1', pad: true },
  90: { id: 'beat_jump_size_b', cat: 'deck', label: 'Beat Jump Size', short: 'BJ·S', device: 'deck2', pad: true },
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
