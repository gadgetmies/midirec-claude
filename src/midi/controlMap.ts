/* Pure, React-free control-mapping model + helpers.

   This module owns the data model for mapping incoming MIDI to transport /
   settings actions, the single static target registry, source matching, the
   advanced-rule helpers (edge / threshold / button-mode / continuous / enum),
   and conflict resolution. It deliberately depends only on `midiLearn` types
   so the matching and rule logic stays unit-testable without React. */

import type { MidiLearnWireMessage } from './midiLearn';
import { QUANTIZE_GRIDS, type QuantizeGrid } from './quantizeGrid';
import type { ClockSource } from '../hooks/useTransport';

/* ── Types ───────────────────────────────────────────────────────────────── */

export type TargetKind = 'trigger' | 'toggle' | 'continuous' | 'enum';

export type SourceKind = 'note' | 'cc' | 'pressure' | 'pb';

export type TargetKey =
  // trigger
  | 'play'
  | 'pause'
  | 'record'
  | 'rewind'
  | 'cue'
  | 'phraseForward'
  | 'phraseBack'
  // toggle
  | 'toggleLoop'
  | 'toggleMetronome'
  | 'toggleQuantize'
  | 'toggleSnapAbsolute'
  | 'toggleClockSend'
  // continuous
  | 'setBpm'
  // enum
  | 'cycleQuantizeGrid'
  | 'cycleClockSource';

export type TriggerEdge = 'press' | 'release';
export type ButtonMode = 'toggle' | 'momentary';
export type ContinuousMode = 'absolute' | 'relative';
export type EnumMode = 'cycle' | 'select';

export interface ControlSource {
  kind: SourceKind;
  portId: string;
  /** 1–16. */
  channel: number;
  /** Note or CC number (0–127); 0 for pressure / pitch-bend. */
  data: number;
  /** When true, match on channel + data only and ignore `portId`. */
  anyPort?: boolean;
}

export interface ContinuousConfig {
  mode: ContinuousMode;
  min: number;
  max: number;
  /** Soft pickup in absolute mode. */
  takeover: boolean;
  /** Relative-mode encoder encoding; defaults to two's-complement. */
  encoding?: RelativeEncoding;
  /** Relative-mode step size applied per decoded tick; defaults to 1. */
  step?: number;
}

export interface FeedbackConfig {
  enabled: boolean;
  portId: string;
  channel: number;
  kind: 'note' | 'cc';
  data: number;
  onValue: number;
  offValue: number;
}

export interface ControlMapping {
  target: TargetKey;
  source: ControlSource;
  // Advanced — only fields relevant to the target's kind are honored.
  edge?: TriggerEdge;
  buttonMode?: ButtonMode;
  minValue?: number;
  continuous?: ContinuousConfig;
  enumMode?: EnumMode;
  barsPerPhrase?: number;
  feedback?: FeedbackConfig;
}

export interface ControlMapState {
  version: number;
  mappings: ControlMapping[];
  /** Input port ids the control receiver listens to. Empty/undefined = listen
      to every granted input. */
  listenInputIds?: string[];
}

export const CONTROL_MAP_VERSION = 1;

/* ── Source kind / data extraction ──────────────────────────────────────── */

export function sourceKindFromMessage(message: MidiLearnWireMessage): SourceKind {
  switch (message.kind) {
    case 'noteOn':
      return 'note';
    case 'controlChange':
      return 'cc';
    case 'channelPressure':
      return 'pressure';
    case 'pitchBend':
      return 'pb';
  }
}

/** The note / CC number a message carries; 0 for pressure / pitch-bend (which
    carry no per-control data byte that identifies a distinct control). */
export function sourceDataFromMessage(message: MidiLearnWireMessage): number {
  switch (message.kind) {
    case 'noteOn':
      return message.note;
    case 'controlChange':
      return message.controller;
    default:
      return 0;
  }
}

/** The "value" a message carries, used by advanced rules (0–127, or 0–16383
    for pitch-bend). */
export function valueFromMessage(message: MidiLearnWireMessage): number {
  switch (message.kind) {
    case 'noteOn':
      return message.velocity;
    case 'controlChange':
      return message.value;
    case 'channelPressure':
      return message.pressure;
    case 'pitchBend':
      return message.value14;
  }
}

/* ── Source matching ─────────────────────────────────────────────────────── */

export function matchSource(source: ControlSource, message: MidiLearnWireMessage): boolean {
  if (source.kind !== sourceKindFromMessage(message)) return false;
  if (source.channel !== message.channel1to16) return false;
  // Pressure / pitch-bend carry no identifying data byte — match on channel.
  if (source.kind === 'note' || source.kind === 'cc') {
    if (source.data !== sourceDataFromMessage(message)) return false;
  }
  if (!source.anyPort && source.portId !== message.portId) return false;
  return true;
}

export function findMatchingMapping(
  message: MidiLearnWireMessage,
  state: ControlMapState,
): ControlMapping | null {
  for (const mapping of state.mappings) {
    if (matchSource(mapping.source, message)) return mapping;
  }
  return null;
}

/** Every mapping whose source matches the message. A single source may be bound
    to multiple targets, so an incoming event can drive several actions. */
export function findMatchingMappings(
  message: MidiLearnWireMessage,
  state: ControlMapState,
): ControlMapping[] {
  return state.mappings.filter((m) => matchSource(m.source, message));
}

/** The single integration point other subsystems (e.g. the recorder) use to
    decide whether a message is consumed by control mapping. Accepts the parsed
    message, which is `null` for System Real-Time bytes (they never parse), so
    those never match. */
export function matchesActiveMapping(
  message: MidiLearnWireMessage | null,
  state: ControlMapState,
): boolean {
  if (!message) return false;
  return findMatchingMapping(message, state) !== null;
}

/* ── Enum option sets ────────────────────────────────────────────────────── */

export const QUANTIZE_GRID_OPTIONS: readonly QuantizeGrid[] = QUANTIZE_GRIDS;
export const CLOCK_SOURCE_OPTIONS: readonly ClockSource[] = [
  'internal',
  'external-clock',
  'external-mtc',
];

/* ── Advanced-rule helpers ──────────────────────────────────────────────── */

const DEFAULT_MIN_VALUE = 1;

/** A message fires only when its value meets the configured threshold. */
export function passesThreshold(value: number, minValue: number | undefined): boolean {
  return value >= (minValue ?? DEFAULT_MIN_VALUE);
}

/** A trigger/toggle fires only when the incoming edge matches the configured
    edge (defaulting to `press`). */
export function firesOnEdge(
  mappingEdge: TriggerEdge | undefined,
  incomingEdge: TriggerEdge,
): boolean {
  return (mappingEdge ?? 'press') === incomingEdge;
}

/** The next on/off state for a toggle target, or `null` for "no change".
    `toggle` flips on press and ignores release; `momentary` enables on press
    and disables on release. */
export function nextToggleState(
  buttonMode: ButtonMode,
  incomingEdge: TriggerEdge,
  currentOn: boolean,
): boolean | null {
  if (buttonMode === 'momentary') {
    return incomingEdge === 'press';
  }
  // toggle
  if (incomingEdge === 'press') return !currentOn;
  return null;
}

/** Scale an incoming `0–valueMax` value across `[min, max]`. */
export function scaleAbsolute(value: number, min: number, max: number, valueMax = 127): number {
  const clamped = Math.max(0, Math.min(valueMax, value));
  return min + (clamped / valueMax) * (max - min);
}

/** Soft-takeover crossing test: did the target's current value get crossed
    between the previous and next scaled readings? */
export function takeoverCrossed(current: number, prevScaled: number, nextScaled: number): boolean {
  const lo = Math.min(prevScaled, nextScaled);
  const hi = Math.max(prevScaled, nextScaled);
  return current >= lo && current <= hi;
}

export type RelativeEncoding = 'twosComplement' | 'signMagnitude' | 'offsetBinary';

/** Decode a relative-encoder CC value into a signed step count. Supports the
    three common vendor encodings. */
export function decodeRelative(value: number, encoding: RelativeEncoding): number {
  switch (encoding) {
    case 'twosComplement':
      // 1..63 = +1..+63, 65..127 = -63..-1, 0 = no move.
      if (value === 0) return 0;
      return value < 64 ? value : value - 128;
    case 'signMagnitude': {
      // bit 6 (0x40) is the sign; lower 6 bits the magnitude.
      const magnitude = value & 0x3f;
      return value & 0x40 ? -magnitude : magnitude;
    }
    case 'offsetBinary':
      // 64-centred: 65 = +1, 63 = -1.
      return value - 64;
  }
}

/** Advance an enum index, wrapping at the end. */
export function enumCycleIndex(currentIndex: number, length: number): number {
  if (length <= 0) return 0;
  return (currentIndex + 1) % length;
}

/** Map an incoming `0–valueMax` value across an enum's options. */
export function enumSelectIndex(value: number, length: number, valueMax = 127): number {
  if (length <= 0) return 0;
  const clamped = Math.max(0, Math.min(valueMax, value));
  const index = Math.floor((clamped / (valueMax + 1)) * length);
  return Math.max(0, Math.min(length - 1, index));
}

function beatsPerBarFromSig(sig: string): number {
  const num = Number.parseInt(sig.split('/')[0] ?? '4', 10);
  return Number.isFinite(num) && num > 0 ? num : 4;
}

/** Milliseconds in one bar at the given tempo + time signature. */
export function barLengthMs(bpm: number, sig: string): number {
  return beatsPerBarFromSig(sig) * (60000 / bpm);
}

/** The target playhead position (ms) for a phrase jump: seek by `bars` bars
    from the current bar, snapped to the bar, clamped at 0. `direction` is +1
    (forward) or -1 (back). */
export function phraseSeekMs(
  currentMs: number,
  bpm: number,
  sig: string,
  bars: number,
  direction: 1 | -1,
): number {
  const barMs = barLengthMs(bpm, sig);
  if (!Number.isFinite(barMs) || barMs <= 0) return Math.max(0, currentMs);
  const currentBar = Math.floor(currentMs / barMs);
  const targetBar = currentBar + direction * bars;
  return Math.max(0, targetBar * barMs);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/* ── Incoming message parsing (with edge + value) ───────────────────────── */

export interface ParsedControl {
  /** The wire message used for source matching. Note-offs are represented as a
      `noteOn` with velocity 0 so they still match a note source. */
  wire: MidiLearnWireMessage;
  /** The incoming edge: `press` (note-on / nonzero CC|pressure) or `release`
      (note-off / zero CC|pressure). */
  edge: TriggerEdge;
  /** The control value (velocity / CC value / pressure, 0–127; or 0–16383 for
      pitch-bend). */
  value: number;
}

/** Parse raw MIDI bytes for control mapping, deriving the edge and value.
    Unlike `parseMidiLearnMessage`, this keeps note-offs (as a release edge) so
    momentary / release-edge mappings work. Returns `null` for System
    Real-Time / SysEx / unrecognized status bytes, so those never match. */
export function parseControlMessage(portId: string, data: Uint8Array): ParsedControl | null {
  if (!data || data.length < 1) return null;
  const status = data[0]!;
  const kindNibble = status & 0xf0;
  const channel1to16 = (status & 0x0f) + 1;
  if (kindNibble === 0x90) {
    const note = data[1] ?? 0;
    const velocity = data[2] ?? 0;
    if (velocity === 0) {
      return { wire: { kind: 'noteOn', portId, channel1to16, note, velocity: 0 }, edge: 'release', value: 0 };
    }
    return { wire: { kind: 'noteOn', portId, channel1to16, note, velocity }, edge: 'press', value: velocity };
  }
  if (kindNibble === 0x80) {
    const note = data[1] ?? 0;
    return { wire: { kind: 'noteOn', portId, channel1to16, note, velocity: 0 }, edge: 'release', value: 0 };
  }
  if (kindNibble === 0xb0) {
    const controller = data[1] ?? 0;
    const value = data[2] ?? 0;
    return {
      wire: { kind: 'controlChange', portId, channel1to16, controller, value },
      edge: value > 0 ? 'press' : 'release',
      value,
    };
  }
  if (kindNibble === 0xd0) {
    const pressure = data[1] ?? 0;
    return {
      wire: { kind: 'channelPressure', portId, channel1to16, pressure },
      edge: pressure > 0 ? 'press' : 'release',
      value: pressure,
    };
  }
  if (kindNibble === 0xe0) {
    const lsb = data[1] ?? 0;
    const msb = data[2] ?? 0;
    const value14 = (msb << 7) | lsb;
    return { wire: { kind: 'pitchBend', portId, channel1to16, value14 }, edge: 'press', value: value14 };
  }
  return null;
}

/* ── Dispatch surface + target registry ─────────────────────────────────── */

/** The action/state surface the registry dispatches against. The provider
    builds this from `useTransport` + `useMidiClockSend`; tests pass a fake.
    Named `transport`-like per the design's `dispatch(transport, value?)`. */
export interface ControlSurface {
  // state reads
  playing: boolean;
  recording: boolean;
  looping: boolean;
  metronomeOn: boolean;
  quantizeOn: boolean;
  snapAbsoluteOn: boolean;
  clockSendEnabled: boolean;
  quantizeGrid: QuantizeGrid;
  clockSource: ClockSource;
  bpm: number;
  /** Non-null when a take is stamped (so resuming continues recording, like the
      Titlebar play button). */
  recordingStartedAt: number | null;
  // actions
  play(): void;
  pause(): void;
  record(): void;
  rewind(): void;
  cue(): void;
  phraseForward(bars: number): void;
  phraseBack(bars: number): void;
  toggleLoop(): void;
  toggleMetronome(): void;
  toggleQuantize(): void;
  toggleSnapAbsolute(): void;
  toggleClockSend(): void;
  setBpm(bpm: number): void;
  setQuantizeGrid(grid: QuantizeGrid): void;
  setClockSource(src: ClockSource): void;
}

export type TargetStateValue = boolean | number | string;

export interface TargetDef {
  key: TargetKey;
  label: string;
  kind: TargetKind;
  /** Performs the action. `value` carries the resolved value for toggle
      (1 = on, 0 = off; undefined = flip), continuous (the BPM), and enum (the
      option index). */
  dispatch(surface: ControlSurface, value?: number): void;
  /** Reads the target's current state for feedback / overlay display. */
  stateSelector(surface: ControlSurface): TargetStateValue;
  /** enum kind only: the ordered option set. */
  enumOptions?: readonly string[];
}

function triggerDef(
  key: TargetKey,
  label: string,
  action: (surface: ControlSurface) => void,
): TargetDef {
  return { key, label, kind: 'trigger', dispatch: (s) => action(s), stateSelector: () => false };
}

function toggleDef(
  key: TargetKey,
  label: string,
  read: (surface: ControlSurface) => boolean,
  toggle: (surface: ControlSurface) => void,
): TargetDef {
  return {
    key,
    label,
    kind: 'toggle',
    dispatch: (surface, value) => {
      if (value === undefined) {
        toggle(surface);
        return;
      }
      const want = value >= 1;
      if (read(surface) !== want) toggle(surface);
    },
    stateSelector: read,
  };
}

function enumDef(
  key: TargetKey,
  label: string,
  options: readonly string[],
  read: (surface: ControlSurface) => string,
  set: (surface: ControlSurface, option: string) => void,
): TargetDef {
  return {
    key,
    label,
    kind: 'enum',
    enumOptions: options,
    dispatch: (surface, value) => {
      const index = Math.max(0, Math.min(options.length - 1, value ?? 0));
      const option = options[index];
      if (option !== undefined) set(surface, option);
    },
    stateSelector: read,
  };
}

export const TARGET_REGISTRY: Record<TargetKey, TargetDef> = {
  // Play is a toggle so a single control plays AND pauses; button mode lets it
  // be a flip (toggle) or play-while-held (momentary). Resuming mirrors the
  // Titlebar play button: when a take is stamped it continues recording rather
  // than starting plain playback.
  play: toggleDef(
    'play',
    'Play / Pause',
    (s) => s.playing,
    (s) => {
      if (s.playing) s.pause();
      else if (s.recordingStartedAt !== null) s.record();
      else s.play();
    },
  ),
  pause: triggerDef('pause', 'Pause', (s) => s.pause()),
  record: triggerDef('record', 'Record', (s) => s.record()),
  rewind: triggerDef('rewind', 'Rewind', (s) => s.rewind()),
  cue: triggerDef('cue', 'Cue', (s) => s.cue()),
  phraseForward: {
    key: 'phraseForward',
    label: 'Phrase Forward',
    kind: 'trigger',
    dispatch: (s, value) => s.phraseForward(value ?? DEFAULT_BARS_PER_PHRASE),
    stateSelector: () => false,
  },
  phraseBack: {
    key: 'phraseBack',
    label: 'Phrase Back',
    kind: 'trigger',
    dispatch: (s, value) => s.phraseBack(value ?? DEFAULT_BARS_PER_PHRASE),
    stateSelector: () => false,
  },
  toggleLoop: toggleDef('toggleLoop', 'Loop', (s) => s.looping, (s) => s.toggleLoop()),
  toggleMetronome: toggleDef(
    'toggleMetronome',
    'Metronome',
    (s) => s.metronomeOn,
    (s) => s.toggleMetronome(),
  ),
  toggleQuantize: toggleDef(
    'toggleQuantize',
    'Quantize',
    (s) => s.quantizeOn,
    (s) => s.toggleQuantize(),
  ),
  toggleSnapAbsolute: toggleDef(
    'toggleSnapAbsolute',
    'Snap',
    (s) => s.snapAbsoluteOn,
    (s) => s.toggleSnapAbsolute(),
  ),
  toggleClockSend: toggleDef(
    'toggleClockSend',
    'Clock Send',
    (s) => s.clockSendEnabled,
    (s) => s.toggleClockSend(),
  ),
  setBpm: {
    key: 'setBpm',
    label: 'BPM',
    kind: 'continuous',
    dispatch: (s, value) => {
      if (value !== undefined) s.setBpm(value);
    },
    stateSelector: (s) => s.bpm,
  },
  cycleQuantizeGrid: enumDef(
    'cycleQuantizeGrid',
    'Quantize Grid',
    QUANTIZE_GRID_OPTIONS,
    (s) => s.quantizeGrid,
    (s, option) => s.setQuantizeGrid(option as QuantizeGrid),
  ),
  cycleClockSource: enumDef(
    'cycleClockSource',
    'Clock Source',
    CLOCK_SOURCE_OPTIONS,
    (s) => s.clockSource,
    (s, option) => s.setClockSource(option as ClockSource),
  ),
};

export const TARGET_LIST: readonly TargetDef[] = Object.values(TARGET_REGISTRY);

/* ── Per-kind defaults ──────────────────────────────────────────────────── */

export const DEFAULT_BARS_PER_PHRASE = 8;

const PHRASE_TARGETS: ReadonlySet<TargetKey> = new Set<TargetKey>(['phraseForward', 'phraseBack']);

/** Build a `ControlMapping` for `target` bound to `source`, seeded with the
    advanced-field defaults appropriate to the target's kind. */
export function defaultMappingFor(target: TargetKey, source: ControlSource): ControlMapping {
  const def = TARGET_REGISTRY[target];
  const mapping: ControlMapping = { target, source };
  switch (def.kind) {
    case 'trigger':
      mapping.edge = 'press';
      mapping.minValue = 1;
      if (PHRASE_TARGETS.has(target)) mapping.barsPerPhrase = DEFAULT_BARS_PER_PHRASE;
      break;
    case 'toggle':
      mapping.edge = 'press';
      mapping.buttonMode = 'toggle';
      mapping.minValue = 1;
      break;
    case 'continuous':
      mapping.continuous = {
        mode: 'absolute',
        min: 60,
        max: 200,
        takeover: true,
        encoding: 'twosComplement',
        step: 1,
      };
      break;
    case 'enum':
      mapping.enumMode = 'cycle';
      break;
  }
  return mapping;
}

/* ── Conflict resolution ────────────────────────────────────────────────── */

export function sourcesEqual(a: ControlSource, b: ControlSource): boolean {
  return (
    a.kind === b.kind &&
    a.channel === b.channel &&
    a.data === b.data &&
    a.portId === b.portId &&
    Boolean(a.anyPort) === Boolean(b.anyPort)
  );
}

export interface AssignSourceResult {
  state: ControlMapState;
  /** Other targets already bound to the same source (kept — a source may drive
      multiple targets). Empty when the source is newly used. */
  alsoBoundTo: TargetKey[];
}

/** Bind `source` to `target`, enforcing one-source-to-one-target. Any existing
    mapping using an equal source is removed (and its target reported as
    `reassignedFrom`); any existing mapping for `target` is replaced. Existing
    advanced config for `target` is preserved across a relearn. */
export function assignSource(
  state: ControlMapState,
  target: TargetKey,
  source: ControlSource,
): AssignSourceResult {
  const existingForTarget = state.mappings.find((m) => m.target === target);
  // A source may drive multiple targets, so we keep other targets bound to the
  // same source; we only replace the mapping for THIS target (relearn).
  const alsoBoundTo = state.mappings
    .filter((m) => m.target !== target && sourcesEqual(m.source, source))
    .map((m) => m.target);
  const kept = state.mappings.filter((m) => m.target !== target);
  const mapping: ControlMapping = existingForTarget
    ? { ...existingForTarget, source }
    : defaultMappingFor(target, source);
  return {
    state: { ...state, mappings: [...kept, mapping] },
    alsoBoundTo,
  };
}

/** Remove the mapping for `target`, if any. */
export function clearTarget(state: ControlMapState, target: TargetKey): ControlMapState {
  return { ...state, mappings: state.mappings.filter((m) => m.target !== target) };
}

/* ── Empty state + JSON import/export ───────────────────────────────────── */

export function emptyControlMapState(): ControlMapState {
  return { version: CONTROL_MAP_VERSION, mappings: [], listenInputIds: [] };
}

export function serializeControlMap(state: ControlMapState): string {
  return JSON.stringify(
    {
      version: CONTROL_MAP_VERSION,
      mappings: state.mappings,
      listenInputIds: state.listenInputIds ?? [],
    },
    null,
    2,
  );
}

const VALID_TARGETS: ReadonlySet<string> = new Set<TargetKey>(
  Object.keys(TARGET_REGISTRY) as TargetKey[],
);
const VALID_SOURCE_KINDS: ReadonlySet<string> = new Set<SourceKind>([
  'note',
  'cc',
  'pressure',
  'pb',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

class ControlMapImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ControlMapImportError';
  }
}

function validateMapping(raw: unknown): ControlMapping {
  if (!isRecord(raw)) throw new ControlMapImportError('mapping is not an object');
  const target = raw.target;
  if (typeof target !== 'string' || !VALID_TARGETS.has(target)) {
    throw new ControlMapImportError(`unknown target: ${String(target)}`);
  }
  const source = raw.source;
  if (!isRecord(source)) throw new ControlMapImportError('mapping.source is not an object');
  if (typeof source.kind !== 'string' || !VALID_SOURCE_KINDS.has(source.kind)) {
    throw new ControlMapImportError(`invalid source kind: ${String(source.kind)}`);
  }
  if (typeof source.portId !== 'string') throw new ControlMapImportError('source.portId missing');
  if (typeof source.channel !== 'number') throw new ControlMapImportError('source.channel missing');
  if (typeof source.data !== 'number') throw new ControlMapImportError('source.data missing');
  // The raw object already conforms to ControlMapping's shape; pass it through
  // (advanced fields are optional and structurally validated by the type).
  return raw as unknown as ControlMapping;
}

/** Migrate a parsed payload of any known prior version up to the current
    `ControlMapState` shape. Version 0 (or a missing version) is treated as the
    pre-versioning shape, which is structurally identical. */
function migrate(version: number, mappings: unknown[]): ControlMapping[] {
  if (version > CONTROL_MAP_VERSION) {
    throw new ControlMapImportError(
      `unsupported version ${version} (max ${CONTROL_MAP_VERSION})`,
    );
  }
  // v0 → v1: no structural change; future versions add cases here.
  return mappings.map(validateMapping);
}

/** Validate, migrate, and normalize an imported mapping set. Throws on an
    invalid or unmigratable payload (callers should surface a message and leave
    the active set unchanged). Accepts either a JSON string or a parsed value. */
export function parseControlMap(input: unknown): ControlMapState {
  const raw = typeof input === 'string' ? (JSON.parse(input) as unknown) : input;
  if (!isRecord(raw)) throw new ControlMapImportError('payload is not an object');
  const version = typeof raw.version === 'number' ? raw.version : 0;
  if (!Array.isArray(raw.mappings)) {
    throw new ControlMapImportError('mappings must be an array');
  }
  const mappings = migrate(version, raw.mappings);
  const listenInputIds = Array.isArray(raw.listenInputIds)
    ? raw.listenInputIds.filter((id): id is string => typeof id === 'string')
    : [];
  return { version: CONTROL_MAP_VERSION, mappings, listenInputIds };
}

/* ── Live dispatch orchestration ────────────────────────────────────────── */

export interface TakeoverEntry {
  lastScaled: number;
  picked: boolean;
}

/** Apply a parsed message against the active mapping set: find the matching
    mapping, apply the advanced rules for its target's kind, and invoke the
    registry dispatch on `surface`. Returns the target that fired, or `null` if
    nothing matched / the rules suppressed the action.

    `takeover` carries soft-pickup state across calls, keyed by target. */
/** Apply a single mapping's advanced rules and dispatch it. Returns the target
    if it fired, else `null`. */
function applyOneMapping(
  mapping: ControlMapping,
  parsed: ParsedControl,
  surface: ControlSurface,
  takeover: Map<TargetKey, TakeoverEntry>,
): TargetKey | null {
  const def = TARGET_REGISTRY[mapping.target];
  const { edge, value } = parsed;

  switch (def.kind) {
    case 'trigger': {
      if (!firesOnEdge(mapping.edge, edge)) return null;
      if (edge === 'press' && !passesThreshold(value, mapping.minValue)) return null;
      def.dispatch(surface, mapping.barsPerPhrase);
      return mapping.target;
    }
    case 'toggle': {
      const buttonMode = mapping.buttonMode ?? 'toggle';
      if (buttonMode === 'momentary') {
        if (edge === 'press' && !passesThreshold(value, mapping.minValue)) return null;
        const next = nextToggleState('momentary', edge, def.stateSelector(surface) === true);
        if (next === null) return null;
        def.dispatch(surface, next ? 1 : 0);
        return mapping.target;
      }
      if (!firesOnEdge(mapping.edge, edge)) return null;
      if (edge === 'press' && !passesThreshold(value, mapping.minValue)) return null;
      def.dispatch(surface);
      return mapping.target;
    }
    case 'continuous': {
      const cfg = mapping.continuous;
      if (!cfg) return null;
      const current = Number(def.stateSelector(surface));
      if (cfg.mode === 'relative') {
        const delta = decodeRelative(value, cfg.encoding ?? 'twosComplement');
        if (delta === 0) return null;
        const next = clamp(current + delta * (cfg.step ?? 1), cfg.min, cfg.max);
        def.dispatch(surface, next);
        return mapping.target;
      }
      // absolute
      const scaled = scaleAbsolute(value, cfg.min, cfg.max);
      if (cfg.takeover) {
        const entry = takeover.get(mapping.target);
        if (!entry) {
          takeover.set(mapping.target, { lastScaled: scaled, picked: false });
          return null;
        }
        if (!entry.picked) {
          if (takeoverCrossed(current, entry.lastScaled, scaled)) {
            entry.picked = true;
            entry.lastScaled = scaled;
            def.dispatch(surface, scaled);
            return mapping.target;
          }
          entry.lastScaled = scaled;
          return null;
        }
        entry.lastScaled = scaled;
        def.dispatch(surface, scaled);
        return mapping.target;
      }
      def.dispatch(surface, scaled);
      return mapping.target;
    }
    case 'enum': {
      const options = def.enumOptions ?? [];
      if (options.length === 0) return null;
      const mode = mapping.enumMode ?? 'cycle';
      if (mode === 'cycle') {
        if (!firesOnEdge(mapping.edge, edge)) return null;
        if (edge === 'press' && !passesThreshold(value, mapping.minValue)) return null;
        const currentIndex = options.indexOf(String(def.stateSelector(surface)));
        const nextIndex = enumCycleIndex(currentIndex, options.length);
        def.dispatch(surface, nextIndex);
        return mapping.target;
      }
      // select
      def.dispatch(surface, enumSelectIndex(value, options.length));
      return mapping.target;
    }
  }
}

/** Apply a parsed message against the active mapping set. A single incoming
    event may drive multiple actions: EVERY mapping whose source matches is
    evaluated and dispatched. Returns the list of targets that fired.

    `takeover` carries soft-pickup state across calls, keyed by target. */
export function applyControlMessage(
  parsed: ParsedControl,
  state: ControlMapState,
  surface: ControlSurface,
  takeover: Map<TargetKey, TakeoverEntry>,
): TargetKey[] {
  const fired: TargetKey[] = [];
  for (const mapping of findMatchingMappings(parsed.wire, state)) {
    const target = applyOneMapping(mapping, parsed, surface, takeover);
    if (target) fired.push(target);
  }
  return fired;
}
