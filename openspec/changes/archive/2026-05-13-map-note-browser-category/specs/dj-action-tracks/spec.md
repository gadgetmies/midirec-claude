## ADDED Requirements

(none)

## MODIFIED Requirements

### Requirement: DJ data tables are exported as typed constants

The codebase SHALL expose a `src/data/dj.ts` module exporting:

- `DJ_CATEGORIES: Record<CategoryId, { label: string }>`. Keys: `'deck' | 'browser' | 'mixer' | 'fx' | 'global'` in that insertion order.
- `DJ_DEVICES: Record<DeviceId, { label: string; short: string; color: string }>` — verbatim. Keys: `'deck1' | 'deck2' | 'deck3' | 'deck4' | 'fx1' | 'fx2' | 'mixer' | 'global'`. Each entry's `color` is an OKLCH string.
- `DEFAULT_ACTION_MAP: Record<number, ActionMapEntry>` — same pitch coverage as today; every entry's `cat` SHALL be one of the five `CategoryId` literals. Former transport/cue/loop/hotcue semantics are represented with `cat: 'deck'` except where noted below. Tap Tempo SHALL use `cat: 'global'`. Load Deck actions (`load_a`, `load_b`) SHALL use `cat: 'browser'` (their `device` remains `mixer` unless a future device split is specified). Continuous mixer controls (crossfader, per-channel volumes, per-channel EQ bands) in `DEFAULT_ACTION_MAP` SHALL remain `cat: 'mixer'` with `pad: true` as today; implementations SHALL pair them with **default output CC numbers** (see `design.md` in change `mixer-dj-cc-messages`) so playback targets CC without per-user configuration in the common case.
- `TriggerMode` type: `'momentary' | 'toggle'`.
- `ActionMapEntry` type: `{ id: string; cat: CategoryId; label: string; short: string; device: DeviceId; pad?: boolean; pressure?: boolean; trigger?: TriggerMode; midiInputCc?: number }`. The optional `midiInputCc` field, when present, SHALL be in the inclusive range `0..127` and SHALL select **incoming Control Change** as the record trigger for this row (see `midi-recording`).
- `OutputMapping` type: `{ device: DeviceId; channel: number; pitch: number; cc?: number }`. `channel` is in the inclusive range `1..16`; `pitch` is in the inclusive range `0..127`. The optional `cc` field, when present, SHALL be in the inclusive range `0..127` and SHALL mean **playback emits Control Change** with that controller number on the resolved MIDI channel instead of note-on/note-off (see `midi-playback`).
- Helpers `devColor(d: DeviceId): string`, `devShort(d: DeviceId): string`, `devLabel(d: DeviceId): string`, `pitchLabel(p: number): string`.

The data SHALL be declared `as const` so TypeScript narrows the literal types; the helpers SHALL fall back to the `'global'` device for unknown ids, matching the prototype's `(DJ_DEVICES[device] || DJ_DEVICES.global)` pattern.

The `trigger` field SHALL be optional on every `ActionMapEntry`. When absent (as it is in every entry of `DEFAULT_ACTION_MAP`), readers SHALL treat the field as `'momentary'`. Writers (the Map Note panel) SHALL always persist an explicit value to support deterministic round-tripping.

#### Scenario: Module is importable and typed

- **WHEN** another file imports `DJ_CATEGORIES`, `DJ_DEVICES`, `DEFAULT_ACTION_MAP`, `TriggerMode`, `ActionMapEntry`, `OutputMapping`, or any helper from `src/data/dj.ts`
- **THEN** TypeScript SHALL resolve the import without errors
- **AND** `DJ_DEVICES.deck1.color` SHALL be the literal string `"oklch(72% 0.16 200)"`
- **AND** `DEFAULT_ACTION_MAP[48].label` SHALL be the literal string `"Play / Pause"`

#### Scenario: pitchLabel formats correctly

- **WHEN** `pitchLabel(48)` is called
- **THEN** it SHALL return `"C3"`
- **AND** `pitchLabel(60)` SHALL return `"C4"`
- **AND** `pitchLabel(57)` SHALL return `"A3"`

#### Scenario: trigger field is optional and reads as momentary when absent

- **WHEN** a reader inspects `DEFAULT_ACTION_MAP[48].trigger`
- **THEN** the value SHALL be `undefined`
- **AND** the reader SHALL treat the absence as the value `'momentary'`
- **AND** `TriggerMode` SHALL be the literal union type `'momentary' | 'toggle'`

#### Scenario: OutputMapping fields are typed and bounded

- **WHEN** a reader inspects an `OutputMapping` value
- **THEN** its `device` SHALL be a `DeviceId`
- **AND** its `channel` and `pitch` SHALL be numbers (consumer-side clamping enforces `1..16` and `0..127` respectively)
- **AND** when `cc` is present, it SHALL be an integer in `0..127`

#### Scenario: Category keys match Map Note tabs

- **WHEN** a reader enumerates `Object.keys(DJ_CATEGORIES)` in insertion order
- **THEN** it SHALL yield exactly `deck`, `browser`, `mixer`, `fx`, `global`

#### Scenario: Tap Tempo is categorized as global

- **WHEN** a reader inspects the `DEFAULT_ACTION_MAP` entry whose `id` is `tap`
- **THEN** `entry.cat` SHALL be `'global'`

#### Scenario: Load Deck templates use browser category

- **WHEN** a reader inspects `DEFAULT_ACTION_MAP` entries whose `id` is `load_a` or `load_b`
- **THEN** each `entry.cat` SHALL be `'browser'`

#### Scenario: ActionMapEntry accepts optional incoming CC

- **WHEN** a persisted `ActionMapEntry` includes `midiInputCc: 12`
- **THEN** it SHALL be valid for `useStage().setActionEntry` and SHALL be stored verbatim (clamped to `0..127` on write)
- **AND** record-time matching SHALL prefer this CC binding over note-based matching when both could apply (see `midi-recording`)

## REMOVED Requirements

(none)
