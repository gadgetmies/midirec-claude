## MODIFIED Requirements

### Requirement: DJ data tables are exported as typed constants

The codebase SHALL expose a `src/data/dj.ts` module exporting:

- `DJ_CATEGORIES: Record<CategoryId, { label: string }>` — verbatim from the prototype's `dj.jsx`. Keys: `'transport' | 'cue' | 'hotcue' | 'loop' | 'fx' | 'deck' | 'mixer'`.
- `DJ_DEVICES: Record<DeviceId, { label: string; short: string; color: string }>` — verbatim. Keys: `'deck1' | 'deck2' | 'deck3' | 'deck4' | 'fx1' | 'fx2' | 'mixer' | 'global'`. Each entry's `color` is an OKLCH string.
- `DEFAULT_ACTION_MAP: Record<number, ActionMapEntry>` — verbatim. Keys are MIDI pitch numbers from 48 (C3) to 75 (D♯5). 28 entries.
- `TriggerMode` type: `'momentary' | 'toggle'`.
- `ActionMapEntry` type: `{ id: string; cat: CategoryId; label: string; short: string; device: DeviceId; pad?: boolean; pressure?: boolean; trigger?: TriggerMode }`.
- `OutputMapping` type: `{ device: DeviceId; channel: number; pitch: number }`. `channel` is in the inclusive range `1..16`; `pitch` is in the inclusive range `0..127`.
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

### Requirement: DJActionTrack data shape

The `dj-action-tracks` capability SHALL define the following types:

```ts
type DJTrackId = string;

// TODO(routing-ui-slice): expand the routing shape with pitch ranges and CC selectors
// when the routing-configuration UI is built. For Slice 7a the channel list is
// the only field we commit to.
interface DJTrackRouting {
  channels: ChannelId[];
}

interface ActionEvent {
  pitch: number;
  t: number;
  dur: number;
  vel: number;
}

interface DJActionTrack {
  id: DJTrackId;
  name: string;
  color: string;
  actionMap: Record<number, ActionMapEntry>;
  outputMap: Record<number, OutputMapping>;
  events: ActionEvent[];
  inputRouting: DJTrackRouting;
  outputRouting: DJTrackRouting;
  collapsed: boolean;
  muted: boolean;
  soloed: boolean;
  mutedRows: number[];
  soloedRows: number[];
}
```

`inputRouting` SHALL declare which incoming MIDI messages feed this track's action map. `outputRouting` SHALL declare where the track's actions emit on playback. Both fields exist on every dj-action-track; their full selector shapes (pitch ranges, CC selectors) are deferred to the routing-configuration slice.

The `actionMap` field SHALL be **the set of input bindings actively configured on this track** — NOT a reference to a catalog of all possible actions. The track's body SHALL render exactly one row per entry in `actionMap`. The catalog of available actions a user can pick from lives in `DEFAULT_ACTION_MAP` (exported from `src/data/dj.ts`), which is a SOURCE for the picker, not a track's actionMap.

The `outputMap` field SHALL hold per-pitch **output mappings**, keyed by the same pitch keys that drive `actionMap`. An action MAY have an `actionMap` entry but no corresponding `outputMap` entry (the action is configured but not yet wired to emit MIDI); the engine treats such bindings as no-emit. Deleting an action via `deleteActionEntry` SHALL also remove the matching `outputMap` entry. Initial seed sets `outputMap` to `{}`.

The `events` field SHALL be the list of action events associated with this track. In Slice 7b these are synthetic demo events seeded on the track; a future routing slice MAY replace this with events derived from channel-track notes via `inputRouting`.

The `mutedRows` and `soloedRows` fields SHALL track per-row M/S state, exactly as in Slice 7b.

The default seeded track SHALL contain a small demo subset of `DEFAULT_ACTION_MAP` (4 entries — pitches 48, 56, 60, 71 — spanning 3 devices), a synthetic `events` array of length ≥ 10 with deterministic content covering all three rendering modes, an empty `outputMap: {}`, and empty `mutedRows: []` / `soloedRows: []`.

#### Scenario: Default seeded track has the expected fields

- **WHEN** `useStage()` is first called
- **THEN** `djActionTracks[0]` SHALL have `id === 'dj1'`
- **AND** `djActionTracks[0].outputMap` SHALL be an empty object
- **AND** `Object.keys(djActionTracks[0].actionMap).length` SHALL be ≥ 4
- **AND** `djActionTracks[0].events.length` SHALL be ≥ 10

### Requirement: Stage exposes dj-action-track state and per-track toggles

The `StageState` interface returned by `useStage()` SHALL expose:

- `djActionTracks: DJActionTrack[]` — the current list of dj-action-tracks. Default seed contains exactly one entry per the data-shape requirement above.
- `toggleDJTrackCollapsed(id: DJTrackId): void` — flips the `collapsed` flag on the named track. No-op if the id is unknown.
- `toggleDJTrackMuted(id: DJTrackId): void` — flips `muted`. No-op for unknown ids.
- `toggleDJTrackSoloed(id: DJTrackId): void` — flips `soloed`. No-op for unknown ids.
- `toggleDJTrackRowMuted(id: DJTrackId, pitch: number): void` — flips the pitch's membership in the named track's `mutedRows`. No-op for unknown ids or pitches not in the track's `actionMap`.
- `toggleDJTrackRowSoloed(id: DJTrackId, pitch: number): void` — flips the pitch's membership in the named track's `soloedRows`. Same no-op conditions.
- `setActionEntry(id: DJTrackId, pitch: number, entry: ActionMapEntry): void` — writes `entry` to the named track's `actionMap[pitch]`, replacing whatever was previously there (or adding if absent). No-op for unknown track ids.
- `deleteActionEntry(id: DJTrackId, pitch: number): void` — removes the pitch key from the named track's `actionMap` AND removes the pitch from `outputMap`, `mutedRows`, `soloedRows`. No-op for unknown track ids or absent pitches. If `djActionSelection` references the deleted `(trackId, pitch)`, it SHALL be cleared to `null`.
- `setOutputMapping(id: DJTrackId, pitch: number, mapping: OutputMapping): void` — writes `mapping` to the named track's `outputMap[pitch]`. No-op for unknown track ids. The pitch MAY be a key that did not previously have an outputMap entry; this is how new output bindings are added.
- `deleteOutputMapping(id: DJTrackId, pitch: number): void` — removes the pitch key from the named track's `outputMap`. No-op for unknown track ids or absent pitches.
- `djActionSelection: { trackId: DJTrackId; pitch: number } | null` — the currently-selected DJ action row, surfaced to the Sidebar's Map Note panel and the Inspector's Output panel. Initial value `null`.
- `setDJActionSelection(target: { trackId: DJTrackId; pitch: number } | null): void` — sets or clears the dj-action selection.

The state SHALL persist across re-renders in `useState` keyed off the `useDJActionTracks` hook (for the track list) and `useStage` itself (for the selection). It SHALL NOT reset on Toolstrip state changes, dialog opens, or any other unrelated state transitions.

#### Scenario: toggleDJTrackMuted flips the muted flag

- **WHEN** `toggleDJTrackMuted('dj1')` is called while `djActionTracks[0].muted === false`
- **THEN** the next render SHALL have `djActionTracks[0].muted === true`
- **AND** other fields on the track SHALL be unchanged

#### Scenario: Unknown id is a no-op for any toggle

- **WHEN** any of the five toggle actions is called with an unknown `id`
- **THEN** `djActionTracks` SHALL be unchanged (referentially equal across renders)
- **AND** no error SHALL be thrown

#### Scenario: setActionEntry adds a new entry

- **WHEN** `setActionEntry('dj1', 72, entry)` is called and `djActionTracks[0].actionMap[72]` was previously `undefined`
- **THEN** the next render SHALL have `djActionTracks[0].actionMap[72]` equal to `entry`
- **AND** the count of keys in `actionMap` SHALL have increased by exactly 1

#### Scenario: setActionEntry replaces an existing entry

- **WHEN** `setActionEntry('dj1', 56, newEntry)` is called and `djActionTracks[0].actionMap[56]` was previously the seeded "Hot Cue 1" entry
- **THEN** the next render SHALL have `djActionTracks[0].actionMap[56]` equal to `newEntry`
- **AND** the count of keys in `actionMap` SHALL be unchanged

#### Scenario: setActionEntry is a no-op for unknown track id

- **WHEN** `setActionEntry('nonexistent', 60, entry)` is called
- **THEN** `djActionTracks` SHALL be unchanged (referentially equal across renders)
- **AND** no error SHALL be thrown

#### Scenario: deleteActionEntry removes the key and prunes derived state

- **WHEN** `deleteActionEntry('dj1', 56)` is called and `actionMap[56]` exists AND `outputMap[56]` is set AND `mutedRows.includes(56) === true`
- **THEN** the next render SHALL have `actionMap[56] === undefined`
- **AND** `outputMap[56] === undefined`
- **AND** `mutedRows.includes(56) === false`

#### Scenario: deleteActionEntry clears djActionSelection when it matches

- **WHEN** `deleteActionEntry('dj1', 56)` is called and `djActionSelection === { trackId: 'dj1', pitch: 56 }`
- **THEN** the next render SHALL have `djActionSelection === null`

#### Scenario: deleteActionEntry leaves djActionSelection unchanged when it does not match

- **WHEN** `deleteActionEntry('dj1', 60)` is called and `djActionSelection === { trackId: 'dj1', pitch: 56 }`
- **THEN** `djActionSelection` SHALL be unchanged

#### Scenario: deleteActionEntry is a no-op for unknown pitch

- **WHEN** `deleteActionEntry('dj1', 99)` is called and `actionMap[99]` was already absent
- **THEN** `djActionTracks` SHALL be unchanged (referentially equal across renders)

#### Scenario: setOutputMapping adds a new entry

- **WHEN** `setOutputMapping('dj1', 56, { device: 'deck2', channel: 3, pitch: 64 })` is called and `outputMap[56]` was previously `undefined`
- **THEN** the next render SHALL have `outputMap[56]` equal to that mapping

#### Scenario: setOutputMapping replaces an existing entry

- **WHEN** `setOutputMapping('dj1', 56, newMapping)` is called and `outputMap[56]` was a different mapping
- **THEN** the next render SHALL have `outputMap[56]` equal to `newMapping`
- **AND** the count of keys in `outputMap` SHALL be unchanged

#### Scenario: setOutputMapping is a no-op for unknown track id

- **WHEN** `setOutputMapping('nonexistent', 56, mapping)` is called
- **THEN** `djActionTracks` SHALL be unchanged (referentially equal across renders)

#### Scenario: deleteOutputMapping removes the key

- **WHEN** `deleteOutputMapping('dj1', 56)` is called and `outputMap[56]` was set
- **THEN** the next render SHALL have `outputMap[56] === undefined`

#### Scenario: deleteOutputMapping is a no-op when pitch is absent

- **WHEN** `deleteOutputMapping('dj1', 56)` is called and `outputMap[56]` was already absent
- **THEN** `djActionTracks` SHALL be unchanged (referentially equal across renders)

#### Scenario: setDJActionSelection opens and closes the selection

- **WHEN** `setDJActionSelection({ trackId: 'dj1', pitch: 56 })` is called while `djActionSelection === null`
- **THEN** the next render SHALL have `djActionSelection === { trackId: 'dj1', pitch: 56 }`
- **WHEN** `setDJActionSelection(null)` is then called
- **THEN** the next render SHALL have `djActionSelection === null`

## ADDED Requirements

### Requirement: Clicking an action row selects it

The `<ActionKeys>` component SHALL register a `pointerdown` (or `click`) handler on each `.mr-actkey` element. When the user activates a row by primary pointer click, the handler SHALL call `useStage().setDJActionSelection({ trackId, pitch })` for that row's pitch and the enclosing track's id.

The handler SHALL NOT fire when the click target is the M/S chip (a child of `.mr-actkey__chip`). Clicks on the M/S chip continue to flow to the chip's own toggle handlers, unchanged.

The handler SHALL also be wired to keyboard activation: pressing `Enter` or `Space` while an `.mr-actkey` has keyboard focus SHALL produce the same effect. The `.mr-actkey` element SHALL be focusable (`tabindex="0"`) to support this.

The `.mr-actkey` element SHALL carry `data-selected="true"` when `djActionSelection.trackId === trackId && djActionSelection.pitch === pitch`, so CSS can render a persistent "this row is the current target" highlight (a tinted accent background with inset accent border). The attribute SHALL be removed when the condition ceases.

#### Scenario: Clicking an action row selects it

- **WHEN** the user clicks the `.mr-actkey` for pitch 56 on the seeded track `dj1`, and `djActionSelection === null`
- **THEN** `setDJActionSelection` SHALL be called once with `{ trackId: 'dj1', pitch: 56 }`
- **AND** the next render SHALL have `djActionSelection === { trackId: 'dj1', pitch: 56 }`
- **AND** the `.mr-actkey` for pitch 56 SHALL carry `data-selected="true"`

#### Scenario: Clicking the M/S chip does not change selection

- **WHEN** the user clicks the M (Mute) button inside an `.mr-actkey__chip`
- **THEN** `setDJActionSelection` SHALL NOT be called
- **AND** `djActionSelection` SHALL be unchanged

#### Scenario: Clicking a different row retargets selection

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 56 }` and the user clicks the `.mr-actkey` for pitch 60
- **THEN** `setDJActionSelection` SHALL be called with `{ trackId: 'dj1', pitch: 60 }`
- **AND** the `.mr-actkey` for pitch 60 SHALL carry `data-selected="true"`
- **AND** the `.mr-actkey` for pitch 56 SHALL NOT carry `data-selected="true"`

#### Scenario: Keyboard activation selects the row

- **WHEN** an `.mr-actkey` has keyboard focus and the user presses `Enter`
- **THEN** `setDJActionSelection` SHALL be called once with that row's `{ trackId, pitch }`

#### Scenario: Action rows are focusable

- **WHEN** any `.mr-actkey` is rendered
- **THEN** the element SHALL carry `tabindex="0"`

### Requirement: Outside-click blurs the selection

While `djActionSelection !== null`, the stage SHALL register a window-level `pointerdown` handler that calls `setDJActionSelection(null)` when the click target is NEITHER inside a `.mr-djtrack` element NOR inside an element marked `[data-mr-dj-selection-region="true"]`. The handler SHALL be detached when the selection becomes `null`, OR when the component unmounts.

Surfaces that should retain the selection on clicks SHALL declare `data-mr-dj-selection-region="true"` on a wrapping element. In Slice 8 the two known regions are:

- The Sidebar's `<InputMappingPanel>` wrapper (the Map Note panel).
- The Inspector's Output action panel wrapper.

#### Scenario: Click outside both regions and outside any DJ track blurs selection

- **WHEN** `djActionSelection !== null` and the user clicks on the ruler element (which is not `.mr-djtrack` and not inside any `[data-mr-dj-selection-region]`)
- **THEN** the next render SHALL have `djActionSelection === null`

#### Scenario: Click inside a DJ track keeps selection

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 56 }` and the user clicks on the DJ track's lane area (inside `.mr-djtrack` but not on an `.mr-actkey`)
- **THEN** `djActionSelection` SHALL be unchanged

#### Scenario: Click inside the Map Note panel keeps selection

- **WHEN** `djActionSelection !== null` and the user clicks on the Sidebar's Map Note panel (inside a `[data-mr-dj-selection-region]`)
- **THEN** `djActionSelection` SHALL be unchanged

#### Scenario: Click inside the Inspector's Output panel keeps selection

- **WHEN** `djActionSelection !== null` and the user clicks the Channel input in the Inspector's Output panel
- **THEN** `djActionSelection` SHALL be unchanged

#### Scenario: Handler is inactive when selection is null

- **WHEN** `djActionSelection === null` and the user clicks anywhere
- **THEN** no `setDJActionSelection` SHALL be called by the outside-click handler
