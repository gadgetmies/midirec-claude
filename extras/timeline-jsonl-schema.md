# Timeline JSONL Schema (v1)

Self-contained reference for the `.jsonl` / `.ndjson` files produced by the Export dialog and consumed by drag-and-drop / Open. Hand this entire document to another agent — it includes every nested type needed to read or write the format.

Source of truth: `src/storage/timelineJsonl.ts`, `src/storage/timelinePayload.ts`, `src/hooks/useChannels.ts`, `src/hooks/useStage.tsx`, `src/data/dj.ts`, `src/hooks/useDJActionTracks.ts`, `src/components/piano-roll/notes.ts`, `src/components/param-lanes/ccPoints.ts`, `src/midi/quantizeGrid.ts`.

## File format

- UTF-8 text, one JSON object per line.
- Lines are separated by `\n` (CRLF tolerated on read).
- Blank lines tolerated on read; the writer emits a single trailing `\n` after the final object.
- Every object has a `kind: string` discriminator.
- **The first non-blank line MUST be `kind: "meta"`** — parsers throw `PayloadShapeError` otherwise.
- After `meta`, lines may appear in any order. The reader collects them into typed slices.
- Unknown `kind` values are skipped (forward-compatibility). The `meta.version` check is the only authoritative gate.

## Top-level line union

```ts
type TimelineJsonlLine =
  | { kind: 'meta';      version: number; appVersion: string; name: string; savedAt: number }
  | { kind: 'transport'; slice: TransportAuthoringSlice }
  | { kind: 'loop';      region: LoopRegion | null }
  | { kind: 'channel';   channel: Channel }       // 0..N lines
  | { kind: 'roll';      roll: PianoRollTrack }   // 0..N lines
  | { kind: 'lane';      lane: ParamLane }        // 0..N lines
  | { kind: 'dj.track';  track: DJActionTrack };  // 0..N lines
```

### meta

- `version` (number) — schema version. **Must equal `1`.** Mismatch → `PayloadVersionError`.
- `appVersion` (string) — producing app version (e.g. `"0.3.2"`). Informational only; no compatibility check.
- `name` (string) — session name (trimmed by the writer; may be empty).
- `savedAt` (number) — Unix epoch milliseconds at serialise time (`Date.now()`).

### transport

`slice: TransportAuthoringSlice` (see below). Exactly one `transport` line is expected; if absent, the reader keeps the default `emptyTransportAuthoring()`.

### loop

`region: LoopRegion | null`. `null` means no loop region set. Exactly one `loop` line is expected.

### channel / roll / lane

Zero or more of each. Order within a kind is preserved.

### dj.track

Zero or more. Order is preserved.

## Nested types

### TransportAuthoringSlice

```ts
interface TransportAuthoringSlice {
  bpm: number;                 // beats per minute, e.g. 124
  sig: string;                 // time signature, e.g. "4/4"
  quantizeOn: boolean;
  quantizeGrid: '1/4' | '1/8' | '1/16' | '1/32';
  snapAbsoluteOn: boolean;
  looping: boolean;
  metronomeOn: boolean;
  clockSource: 'internal' | 'external-clock' | 'external-mtc';
  cuePointTicks: number;       // integer MIDI ticks; defaults to 0 if missing on legacy files
}
```

### LoopRegion

```ts
interface LoopRegion {
  start: number;  // ticks
  end: number;    // ticks
}
```

### Channel

```ts
type ChannelId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;

interface TrackInputListenRow {
  inputDeviceId: string;       // Web MIDI input port id; "" = any
  channels: ChannelId[];       // sorted, deduped on normalize
}

interface Channel {
  id: ChannelId;
  name: string;
  color: string;               // CSS color string
  collapsed: boolean;
  muted: boolean;
  soloed: boolean;
  inputSources: TrackInputListenRow[];
}
```

### PianoRollTrack

```ts
interface Note {
  tTicks: number;     // integer MIDI ticks from session start
  durTicks: number;   // integer MIDI ticks
  pitch: number;      // 0..127
  vel: number;        // 0..127
}

interface PianoRollTrack {
  channelId: ChannelId;
  notes: Note[];
  muted: boolean;
  soloed: boolean;
  collapsed: boolean;
}
```

### ParamLane

```ts
interface CCPoint {
  tTicks: number;     // integer MIDI ticks
  v: number;          // normalized 0..1; engine maps to MIDI value at emit time
}

interface ParamLane {
  channelId: ChannelId;
  kind: 'cc' | 'pb' | 'at';
  cc?: number;        // 0..127, required when kind === 'cc'
  name: string;
  color: string;
  points: CCPoint[];
  muted: boolean;
  soloed: boolean;
  collapsed: boolean;
}
```

### DJActionTrack

```ts
type DJTrackId = string;
type CategoryId = 'deck' | 'browser' | 'mixer' | 'fx' | 'global';
type DeviceId   = 'deck1' | 'deck2' | 'deck3' | 'deck4' | 'fx1' | 'fx2' | 'mixer' | 'global';
type TriggerMode    = 'momentary' | 'toggle';
type MidiInputKind  = 'note' | 'cc' | 'at' | 'pb';
type OutputKind     = 'note' | 'cc' | 'pb';

interface ActionMapEntry {
  id: string;
  cat: CategoryId;
  label: string;
  short: string;
  device: DeviceId;
  pad?: boolean;
  pressure?: boolean;
  trigger?: TriggerMode;
  midiInputDeviceIds?: string[];
  midiInputKind?: MidiInputKind;
  midiInputChannel?: number;   // 1..16
  midiInputNote?: number;      // 0..127
  midiInputCc?: number;        // 0..127
}

interface OutputMapping {
  device: DeviceId;
  channel: number;             // 1..16
  pitch: number;               // 0..127
  cc?: number;                 // 0..127 when present
  out?: OutputKind;            // explicit wins; else cc!==undefined ⇒ 'cc', else 'note'
  midiOutputDeviceId?: string;
}

interface PressurePoint {
  t: number;   // note-relative 0..1 (0 = note-on, 1 = note-off)
  v: number;   // 0..1; engine maps to MIDI 0..127 at emit time
}

interface ActionEvent {
  pitch: number;               // 0..127, input pitch (keys into actionMap/outputMap)
  tTicks: number;              // integer MIDI ticks
  durTicks: number;            // integer MIDI ticks
  vel: number;                 // 0..127
  pressure?: PressurePoint[];  // undefined = synthesise, [] = explicitly cleared
}

interface DJTrackRouting {
  channels: ChannelId[];
}

interface DJActionTrack {
  id: DJTrackId;
  name: string;
  color: string;
  midiChannel: number;                             // 1..16
  actionMap: Record<number, ActionMapEntry>;       // keyed by input pitch
  outputMap: Record<number, OutputMapping>;        // keyed by input pitch; optional overrides
  events: ActionEvent[];
  inputRouting: DJTrackRouting;
  outputRouting: DJTrackRouting;
  collapsed: boolean;
  muted: boolean;
  soloed: boolean;
  mutedRows: number[];                             // pitches
  soloedRows: number[];                            // pitches
  defaultMidiInputDeviceId: string;                // "" = first available at record time
  defaultMidiOutputDeviceId: string;               // "" = session primary output
}
```

## Tick semantics

- All `tTicks` / `durTicks` / `cuePointTicks` are **integer MIDI ticks** from session start.
- The codec round-trips integers exactly — no float coercion.
- Default tick resolution is project-defined (`DEFAULT_MIDI_TPQ`); the schema does not embed TPQ, so producers and consumers must agree out of band. (In practice the in-repo value is the only one in use.)

## Error model

Reader throws one of:

- `PayloadVersionError(payloadVersion, expectedVersion, name?)` — `meta.version` does not equal `1`.
- `PayloadShapeError(message)` — malformed JSON on a line, missing `kind`, missing required nested field (e.g. `transport.slice`, `channel.channel`, `roll.roll`, `lane.lane`, `dj.track.track`), or no `meta` line was seen.

Legacy tolerance:

- `transport.slice.cuePointTicks` missing → defaults to `0`.
- Unknown `kind` values → silently skipped.

## Minimal valid example

```jsonl
{"kind":"meta","version":1,"appVersion":"0.3.2","name":"demo","savedAt":1735689600000}
{"kind":"transport","slice":{"bpm":124,"sig":"4/4","quantizeOn":true,"quantizeGrid":"1/16","snapAbsoluteOn":false,"looping":false,"metronomeOn":true,"clockSource":"internal","cuePointTicks":0}}
{"kind":"loop","region":null}
{"kind":"channel","channel":{"id":1,"name":"Lead","color":"#7aa2f7","collapsed":false,"muted":false,"soloed":false,"inputSources":[]}}
{"kind":"roll","roll":{"channelId":1,"notes":[{"tTicks":0,"durTicks":480,"pitch":60,"vel":100}],"muted":false,"soloed":false,"collapsed":false}}
```

## Serialiser pseudocode (TypeScript)

```ts
function serialize(input: {
  name: string;
  transport: TransportAuthoringSlice;
  loopRegion: LoopRegion | null;
  channels: Channel[];
  rolls: PianoRollTrack[];
  lanes: ParamLane[];
  djActionTracks: DJActionTrack[];
  appVersion: string;
}): string {
  const lines: object[] = [];
  lines.push({ kind: 'meta', version: 1, appVersion: input.appVersion, name: input.name.trim(), savedAt: Date.now() });
  lines.push({ kind: 'transport', slice: input.transport });
  lines.push({ kind: 'loop', region: input.loopRegion });
  for (const channel of input.channels)        lines.push({ kind: 'channel',  channel });
  for (const roll    of input.rolls)           lines.push({ kind: 'roll',     roll });
  for (const lane    of input.lanes)           lines.push({ kind: 'lane',     lane });
  for (const track   of input.djActionTracks)  lines.push({ kind: 'dj.track', track });
  return lines.map(l => JSON.stringify(l)).join('\n') + '\n';
}
```

## Parser contract (read order)

1. Split text on `\r?\n`, trim, drop empty lines.
2. For each line, `JSON.parse` → require `typeof kind === 'string'`.
3. Dispatch on `kind`. On `meta`, check `version === 1` (else `PayloadVersionError`).
4. After all lines: if no `meta` was seen → `PayloadShapeError("missing meta line ...")`.
5. Return slices ready to hydrate each subsystem:
   - `{ channels, rolls, lanes }` → channels provider
   - `djActionTracks[]` → DJ action tracks provider
   - `transportAuthoring` → transport provider
   - `loopRegion` → stage provider
