## MODIFIED Requirements

### Requirement: DJActionTrack carries synthetic action events

The `DJActionTrack` data shape SHALL include an `events: ActionEvent[]` field. `ActionEvent` SHALL have the shape:

```ts
interface ActionEvent {
  pitch: number;                // MIDI pitch — must correspond to a key in actionMap to render
  t: number;                    // start time in beats
  dur: number;                  // duration in beats (used for non-trigger rendering modes)
  vel: number;                  // velocity 0..1 (used for velocity-sensitive rendering mode)
  pressure?: PressurePoint[];   // per-event aftertouch curve; absence means "use synthesised default"
}
```

`ActionEvent` SHALL be a superset of `Note` from `src/components/piano-roll/notes.ts` — the additional `pressure` field is optional and does not appear on `Note`. The renderer SHALL treat events as ground-truth — events whose `pitch` is not a key in the containing track's `actionMap` SHALL be filtered out at render time without error.

The `pressure` field has three meaningful states:

- `undefined` — never edited. Renderers (both `ActionRoll` and the Inspector's pressure editor) SHALL compute the visible curve via `synthesizePressure(event)` from `src/data/pressure.ts`.
- `[]` — explicitly cleared. Renderers SHALL draw no pressure data (flat at zero); the editor's summary SHALL report `0 events · peak 0.00 · avg 0.00`.
- non-empty `PressurePoint[]` — stored points. Renderers SHALL rasterise these via `rasterizePressure` and draw the result.

The default seeded track (`id === 'dj1'`) SHALL include an `events` array of length ≥ 10 with deterministic content sufficient to demonstrate all three note-rendering modes (trigger, velocity-sensitive, pressure-bearing). Every event's `pitch` SHALL be a key in the seeded `actionMap`. Seeded events SHALL leave `pressure` unset (i.e. `undefined`) so the synthesised curve continues to render for unedited events.

#### Scenario: Events field exists on the seeded track

- **WHEN** the app first renders
- **THEN** `useStage().djActionTracks[0].events` SHALL be an array
- **AND** the array SHALL have length ≥ 10
- **AND** every entry SHALL be a valid `ActionEvent` (`pitch`, `t`, `dur`, `vel` all defined)
- **AND** every entry's `pitch` SHALL be a key in `useStage().djActionTracks[0].actionMap`

#### Scenario: Events outside the action map are filtered at render time

- **WHEN** a `<DJActionTrack>` is rendered with an `events` array containing an entry whose `pitch` is not present in `track.actionMap`
- **THEN** that entry SHALL NOT render any `.mr-djtrack__note` element
- **AND** no error SHALL be logged or thrown
- **AND** other valid entries SHALL render unaffected

#### Scenario: Seeded events have undefined pressure

- **WHEN** the app first renders
- **THEN** for every entry in `useStage().djActionTracks[0].events`, the `pressure` field SHALL be `undefined`

### Requirement: Action notes render in three modes per action.cat / pad / pressure flags

Each `.mr-djtrack__note` SHALL select its rendering mode based on the corresponding `actionMap[event.pitch]` entry:

- **trigger** mode applies when `action.cat ∈ {'transport', 'cue', 'hotcue'}` AND `action.pressure !== true`. The note SHALL render as a 6px-wide rectangle with `background: devColor(action.device)` and a soft outer glow (`box-shadow: 0 0 6px color-mix(in oklab, ${devColor} 60%, transparent)`). The note's width SHALL NOT depend on `event.dur`.
- **velocity-sensitive** mode applies when `action.pad === true` AND `action.pressure !== true`. The note SHALL render as a variable-width bar of width `max(3, event.dur * pxPerBeat)` with background `color-mix(in oklab, ${devColor} ${40 + event.vel * 50}%, transparent)` (encoding velocity into opacity). A single 2px-wide white tick SHALL render at the note's left edge with opacity `0.4 + event.vel * 0.5` to indicate velocity at note-on.
- **pressure-bearing** mode applies when `action.pressure === true`. The note SHALL render as a wider bar (typically `> 30px`) with background `color-mix(in oklab, ${devColor} 85%, transparent)`. The note's interior SHALL render an SVG containing pressure cells; each cell SHALL be a vertical rect representing the pressure value at that horizontal sample. An "AT" badge SHALL render at the top-right of the note element when the note's rendered width exceeds 30px.

Pressure-cell rendering SHALL source values from the event's `pressure` field if defined, OR from `synthesizePressure(event)` if `event.pressure` is `undefined`. The number of rendered cells SHALL match the length of the source curve (14 for the synthesised default; for stored pressure the renderer rasterises via `rasterizePressure(event.pressure, cellCount)` where `cellCount` SHALL be the same value used today, 14, so the visual cadence is unchanged).

When `useStage().pressureRenderMode === 'step'`, the cells SHALL render unchanged. When the mode is `'curve'`, the cells SHALL render unchanged for Slice 9 (a future polyline overlay is deferred). The `.mr-djtrack__note` SHALL carry `data-pressure-mode={pressureRenderMode}` on pressure-bearing notes so future render branches and tests can read the mode from the DOM.

When an action satisfies more than one mode's predicate (e.g. `pressure: true` AND `pad: true` — the prototype's `Hot Cue 1` on deck1 does), **pressure-bearing** SHALL take precedence over velocity-sensitive, and velocity-sensitive SHALL take precedence over trigger.

#### Scenario: Trigger mode rendering

- **WHEN** a `.mr-djtrack__note` renders for an event whose action has `cat === 'transport'` and no `pressure` and no `pad`
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

### Requirement: Stage exposes dj-action-track state and per-track toggles

The `StageState` interface returned by `useStage()` SHALL expose:

- `djActionTracks: DJActionTrack[]` — the current list of dj-action-tracks. Default seed contains exactly one entry per the data-shape requirement above.
- `toggleDJTrackCollapsed(id: DJTrackId): void` — flips the `collapsed` flag on the named track. No-op if the id is unknown.
- `toggleDJTrackMuted(id: DJTrackId): void` — flips `muted`. No-op for unknown ids.
- `toggleDJTrackSoloed(id: DJTrackId): void` — flips `soloed`. No-op for unknown ids.
- `toggleDJTrackRowMuted(id: DJTrackId, pitch: number): void` — flips the pitch's membership in the named track's `mutedRows`. No-op for unknown ids or pitches not in the track's `actionMap`.
- `toggleDJTrackRowSoloed(id: DJTrackId, pitch: number): void` — flips the pitch's membership in the named track's `soloedRows`. Same no-op conditions.
- `setActionEntry(id: DJTrackId, pitch: number, entry: ActionMapEntry): void` — writes `entry` to the named track's `actionMap[pitch]`, replacing whatever was previously there (or adding if absent). No-op for unknown track ids.
- `deleteActionEntry(id: DJTrackId, pitch: number): void` — removes the pitch key from the named track's `actionMap` AND removes the pitch from `outputMap`, `mutedRows`, `soloedRows`. No-op for unknown track ids or absent pitches. If `djActionSelection` references the deleted `(trackId, pitch)`, it SHALL be cleared to `null`. If `djEventSelection` references the same `(trackId, pitch)`, it SHALL also be cleared to `null`.
- `setOutputMapping(id: DJTrackId, pitch: number, mapping: OutputMapping): void` — writes `mapping` to the named track's `outputMap[pitch]`. No-op for unknown track ids. The pitch MAY be a key that did not previously have an outputMap entry; this is how new output bindings are added.
- `deleteOutputMapping(id: DJTrackId, pitch: number): void` — removes the pitch key from the named track's `outputMap`. No-op for unknown track ids or absent pitches.
- `setEventPressure(trackId: DJTrackId, pitch: number, eventIdx: number, points: PressurePoint[]): void` — writes `points` to `track.events[eventIdx].pressure` provided `track.events[eventIdx]` exists AND `track.events[eventIdx].pitch === pitch`. No-op for unknown track ids, out-of-range event indexes, or pitch mismatches.
- `clearEventPressure(trackId: DJTrackId, pitch: number, eventIdx: number): void` — equivalent to `setEventPressure(trackId, pitch, eventIdx, [])`. Provided as a separate action for clarity at the call site.
- `djActionSelection: { trackId: DJTrackId; pitch: number } | null` — the currently-selected DJ action row, surfaced to the Sidebar's Map Note panel and the Inspector's Output panel. Initial value `null`.
- `setDJActionSelection(target: { trackId: DJTrackId; pitch: number } | null): void` — sets or clears the dj-action selection.
- `djEventSelection: { trackId: DJTrackId; pitch: number; eventIdx: number } | null` — the currently-selected DJ action *event*, surfaced to the Inspector's pressure editor. Initial value `null`. Orthogonal to `djActionSelection`; both MAY be set simultaneously (in fact, the typical case for the pressure editor).
- `setDJEventSelection(target: { trackId: DJTrackId; pitch: number; eventIdx: number } | null): void` — sets or clears the dj-event selection.
- `pressureRenderMode: 'curve' | 'step'` — session-level preference for how pressure data renders, both in the editor and in the action-track lane bodies. Default `'curve'`.
- `setPressureRenderMode(mode: 'curve' | 'step'): void` — sets the render mode.

The state SHALL persist across re-renders in `useState` keyed off the `useDJActionTracks` hook (for the track list) and `useStage` itself (for selections and render mode). It SHALL NOT reset on Toolstrip state changes, dialog opens, or any other unrelated state transitions.

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

#### Scenario: deleteActionEntry also clears djEventSelection when it matches

- **WHEN** `deleteActionEntry('dj1', 56)` is called and `djEventSelection === { trackId: 'dj1', pitch: 56, eventIdx: 2 }`
- **THEN** the next render SHALL have `djEventSelection === null`

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

#### Scenario: setDJEventSelection opens and closes the event selection

- **WHEN** `setDJEventSelection({ trackId: 'dj1', pitch: 56, eventIdx: 2 })` is called while `djEventSelection === null`
- **THEN** the next render SHALL have `djEventSelection === { trackId: 'dj1', pitch: 56, eventIdx: 2 }`
- **WHEN** `setDJEventSelection(null)` is then called
- **THEN** the next render SHALL have `djEventSelection === null`

#### Scenario: setEventPressure writes the points array

- **WHEN** `setEventPressure('dj1', 56, 2, [{ t: 0, v: 0.5 }])` is called and `track.events[2]` exists with `pitch === 56`
- **THEN** the next render SHALL have `track.events[2].pressure` deep-equal `[{ t: 0, v: 0.5 }]`
- **AND** other fields on `track.events[2]` SHALL be unchanged

#### Scenario: setEventPressure is a no-op for out-of-range eventIdx

- **WHEN** `setEventPressure('dj1', 56, 9999, [])` is called and `track.events.length < 9999`
- **THEN** `djActionTracks` SHALL be referentially equal across renders
- **AND** no error SHALL be thrown

#### Scenario: setEventPressure is a no-op when pitch does not match the event

- **WHEN** `setEventPressure('dj1', 60, 2, [])` is called and `track.events[2].pitch === 56` (not 60)
- **THEN** `djActionTracks` SHALL be referentially equal across renders

#### Scenario: clearEventPressure writes an empty array

- **WHEN** `clearEventPressure('dj1', 56, 2)` is called for a valid event
- **THEN** the next render SHALL have `track.events[2].pressure === []`

#### Scenario: pressureRenderMode default and toggle

- **WHEN** the app first renders
- **THEN** `useStage().pressureRenderMode` SHALL be `'curve'`
- **WHEN** `setPressureRenderMode('step')` is called
- **THEN** the next render SHALL have `pressureRenderMode === 'step'`

## ADDED Requirements

### Requirement: Clicking an action event in ActionRoll selects the event

The `<ActionRoll>` component SHALL register a `pointerdown` (or `click`) handler on each `.mr-djtrack__note` element. When the user activates a note by primary pointer click, the handler SHALL:

1. Call `useStage().setDJEventSelection({ trackId, pitch: event.pitch, eventIdx })`, where `eventIdx` is the index of the event in `track.events`.
2. Call `useStage().setDJActionSelection({ trackId, pitch: event.pitch })` if `djActionSelection` does not already match — so the Output panel opens (or stays open) for the row that contains the event.

The handler SHALL stop event propagation so the click does not also fire the lane's background handlers.

The `.mr-djtrack__note` element SHALL carry `data-selected="true"` when `djEventSelection.trackId === trackId && djEventSelection.pitch === event.pitch && djEventSelection.eventIdx === eventIdx`, so CSS can render a persistent highlight on the selected event. The attribute SHALL be removed when the condition ceases.

#### Scenario: Clicking an event sets djEventSelection

- **WHEN** the user clicks the `.mr-djtrack__note` corresponding to `track.events[2]` on track `dj1` (with `event.pitch === 56`), and `djEventSelection === null`
- **THEN** `setDJEventSelection` SHALL be called once with `{ trackId: 'dj1', pitch: 56, eventIdx: 2 }`
- **AND** `setDJActionSelection` SHALL be called once with `{ trackId: 'dj1', pitch: 56 }` (because `djActionSelection` did not match)
- **AND** the next render SHALL have the clicked note element carry `data-selected="true"`
- **AND** other `.mr-djtrack__note` elements SHALL NOT carry `data-selected="true"`

#### Scenario: Clicking a different event retargets the selection

- **WHEN** `djEventSelection === { trackId: 'dj1', pitch: 56, eventIdx: 2 }` and the user clicks the `.mr-djtrack__note` for `track.events[3]` (with `event.pitch === 56`)
- **THEN** `setDJEventSelection` SHALL be called with `{ trackId: 'dj1', pitch: 56, eventIdx: 3 }`
- **AND** the note for `events[2]` SHALL NOT carry `data-selected="true"`
- **AND** the note for `events[3]` SHALL carry `data-selected="true"`

#### Scenario: Clicking an event on a different row updates both selections

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 56 }` AND `djEventSelection === { trackId: 'dj1', pitch: 56, eventIdx: 2 }`, and the user clicks the `.mr-djtrack__note` for an event whose `event.pitch === 60`
- **THEN** `setDJActionSelection` SHALL be called with `{ trackId: 'dj1', pitch: 60 }`
- **AND** `setDJEventSelection` SHALL be called with a value whose `pitch === 60`

### Requirement: Clicking outside the DJ track blurs djEventSelection

The existing outside-click handler that clears `djActionSelection` (per the "Outside-click blurs the selection" requirement) SHALL also clear `djEventSelection` under the same predicate: a `pointerdown` whose target is NOT inside any `.mr-djtrack` AND NOT inside any `[data-mr-dj-selection-region="true"]` SHALL set both selections to `null`.

The two selections SHALL be cleared atomically (within the same render cycle); there SHALL NOT be an intermediate render where one is `null` and the other is not.

#### Scenario: Outside click clears both selections

- **WHEN** `djActionSelection !== null` AND `djEventSelection !== null` AND the user clicks the ruler (which is not `.mr-djtrack` and not inside any `[data-mr-dj-selection-region]`)
- **THEN** the next render SHALL have both `djActionSelection === null` AND `djEventSelection === null`

#### Scenario: Click inside the Pressure section keeps both selections

- **WHEN** `djActionSelection !== null` AND `djEventSelection !== null` AND the user clicks inside the Inspector's `.mr-pressure` element (which carries `data-mr-dj-selection-region="true"`)
- **THEN** both selections SHALL be unchanged
