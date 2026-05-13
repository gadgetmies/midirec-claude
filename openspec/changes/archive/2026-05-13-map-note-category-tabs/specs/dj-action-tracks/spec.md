## ADDED Requirements

(none)

## MODIFIED Requirements

### Requirement: DJ data tables are exported as typed constants

The codebase SHALL expose a `src/data/dj.ts` module exporting:

- `DJ_CATEGORIES: Record<CategoryId, { label: string }>`. Keys: `'deck' | 'mixer' | 'fx' | 'global'`.
- `DJ_DEVICES: Record<DeviceId, { label: string; short: string; color: string }>` — verbatim. Keys: `'deck1' | 'deck2' | 'deck3' | 'deck4' | 'fx1' | 'fx2' | 'mixer' | 'global'`. Each entry's `color` is an OKLCH string.
- `DEFAULT_ACTION_MAP: Record<number, ActionMapEntry>` — same pitch coverage as today; every entry's `cat` SHALL be one of the four `CategoryId` literals. Former transport/cue/loop/hotcue semantics are represented with `cat: 'deck'` except where noted below. Tap Tempo SHALL use `cat: 'global'`. Load Deck actions (`load_a`, `load_b`) SHALL use `cat: 'mixer'`.
- `TriggerMode` type: `'momentary' | 'toggle'`.
- `ActionMapEntry` type: `{ id: string; cat: CategoryId; label: string; short: string; device: DeviceId; pad?: boolean; pressure?: boolean; trigger?: TriggerMode }`.
- `OutputMapping` type: `{ device: DeviceId; channel: number; pitch: number }`. `channel` is in the inclusive range `1..16`; `pitch` is in the inclusive range `0..127`.
- Helpers `devColor(d: DeviceId): string`, `devShort(d: DeviceId): string`, `devLabel(d: DeviceId): string`, `pitchLabel(p: number): string`.

The data SHALL be declared `as const` so TypeScript narrows the literal types; the helpers SHALL fall back to the `'global'` device for unknown ids, matching the prototype's `(DJ_DEVICES[device] || DJ_DEVICES.global)` pattern.

The `trigger` field SHALL be optional on every `ActionMapEntry`. When absent (as it is in every entry of `DEFAULT_ACTION_MAP`), readers SHALL treat the field as `'momentary'`. Writers (the Map Note panel) SHALL always persist an explicit value for deterministic round-tripping.

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

#### Scenario: Category keys are the four Map Note tabs

- **WHEN** a reader enumerates `Object.keys(DJ_CATEGORIES)` in insertion order
- **THEN** it SHALL yield exactly `deck`, `mixer`, `fx`, `global`

#### Scenario: Tap Tempo is categorized as global

- **WHEN** a reader inspects the `DEFAULT_ACTION_MAP` entry whose `id` is `tap`
- **THEN** `entry.cat` SHALL be `'global'`

### Requirement: Action notes render in three modes per action.cat / pad / pressure flags

Each `.mr-djtrack__note` SHALL select its rendering mode based on the corresponding `actionMap[event.pitch]` entry:

- **trigger** mode applies when `action` satisfies the codebase's trigger-style predicate for deck transport buttons (the predicate that replaces the retired rule `action.cat ∈ {'transport', 'cue', 'hotcue'}`), AND `action.pressure !== true`. The note SHALL render as a 6px-wide rectangle with `background: devColor(action.device)` and a soft outer glow (`box-shadow: 0 0 6px color-mix(in oklab, ${devColor} 60%, transparent)`). The note's width SHALL NOT depend on `event.dur`.
- **velocity-sensitive** mode applies when `action.pad === true` AND `action.pressure !== true`. The note SHALL render as a variable-width bar of width `max(3, event.dur * pxPerBeat)` with background `color-mix(in oklab, ${devColor} ${40 + event.vel * 50}%, transparent)` (encoding velocity into opacity). A single 2px-wide white tick SHALL render at the note's left edge with opacity `0.4 + event.vel * 0.5` to indicate velocity at note-on.
- **pressure-bearing** mode applies when `action.pressure === true`. The note SHALL render as a wider bar (typically `> 30px`) with background `color-mix(in oklab, ${devColor} 85%, transparent)`. The note's interior SHALL render an SVG containing pressure cells; each cell SHALL be a vertical rect representing the pressure value at that horizontal sample. An "AT" badge SHALL render at the top-right of the note element when the note's rendered width exceeds 30px.

Pressure-cell rendering SHALL source values from the event's `pressure` field if defined, OR from `synthesizePressure(event)` if `event.pressure` is `undefined`. The number of rendered cells SHALL match the length of the source curve (14 for the synthesised default; for stored pressure the renderer rasterises via `rasterizePressure(event.pressure, cellCount)` where `cellCount` SHALL be the same value used today, 14, so the visual cadence is unchanged).

When `useStage().pressureRenderMode === 'step'`, the cells SHALL render unchanged. When the mode is `'curve'`, the cells SHALL render unchanged for Slice 9 (a future polyline overlay is deferred). The `.mr-djtrack__note` SHALL carry `data-pressure-mode={pressureRenderMode}` on pressure-bearing notes so future render branches and tests can read the mode from the DOM.

When an action satisfies more than one mode's predicate (e.g. `pressure: true` AND `pad: true` — the prototype's `Hot Cue 1` on deck1 does), **pressure-bearing** SHALL take precedence over velocity-sensitive, and velocity-sensitive SHALL take precedence over trigger.

#### Scenario: Trigger mode rendering

- **WHEN** a `.mr-djtrack__note` renders for an event whose action uses `DEFAULT_ACTION_MAP` pitch `48` (Play / Pause on Deck 1: `id === 'play'`, `cat === 'deck'`) with no `pressure` and no `pad`
- **THEN** the note's rendered width SHALL be 6px
- **AND** the note SHALL carry the class `.mr-djtrack__note--trigger` (or equivalent data-mode attribute)
- **AND** the note SHALL NOT contain an `svg` child

#### Scenario: Velocity-sensitive mode rendering

- **WHEN** a `.mr-djtrack__note` renders for an event whose action has `pad: true` AND no `pressure`
- **THEN** the note's rendered width SHALL be `max(3, event.dur * pxPerBeat)` pixels
- **AND** the note SHALL contain a velocity tick element at its left edge

#### Scenario: Pressure-bearing mode rendering uses stored or synthesised data

- **WHEN** a `.mr-djtrack__note` renders for an event whose action has `pressure: true` AND `event.pressure === undefined`
- **THEN** the note SHALL contain an `svg` child with at least 10 `rect` elements representing pressure cells, drawn from `synthesizePressure(event)`
- **AND** if the note's rendered width is greater than 30px, an "AT" badge SHALL be visible at the top-right of the note
- **AND** the note SHALL carry `data-pressure-mode` equal to `'curve'` or `'step'`

- **WHEN** a `.mr-djtrack__note` renders for an event whose action has `pressure: true` AND `event.pressure` is a non-empty array
- **THEN** the cells' heights SHALL be derived from `rasterizePressure(event.pressure, cellCount)`

- **WHEN** a `.mr-djtrack__note` renders for an event whose action has `pressure: true` AND `event.pressure === []`
- **THEN** every cell SHALL render with the minimum visible height (or zero height)

#### Scenario: Mode precedence

- **WHEN** an action has both `pressure: true` AND `pad: true` (e.g. Hot Cue 1 on deck1)
- **THEN** notes for that action SHALL render in **pressure-bearing** mode
- **AND** the note SHALL contain the SVG pressure cells

## REMOVED Requirements

(none)
