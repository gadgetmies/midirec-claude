## ADDED Requirements

### Requirement: Persisted timeline payload is a versioned, name-keyed JSON envelope

The codebase SHALL define a `TimelinePayload` shape with these fields, in this order:

- `version: number` — schema version of the payload. The current version constant SHALL be exported as `STORAGE_SCHEMA_VERSION` from `src/storage/timelinePayload.ts` and SHALL equal `1` at the time of this slice.
- `appVersion: string` — the editor's product version at save time (informational; not used for compatibility decisions).
- `name: string` — the user-chosen identifier under which the payload is stored. SHALL be non-empty after trim and SHALL contain at most 80 Unicode code points.
- `savedAt: number` — wall-clock milliseconds since epoch at save time.
- `session: SessionPayload` — the persistable session surface enumerated by `session-model` (channels, piano-roll rolls, param lanes, DJ action tracks with action / output maps and events, loop region, transport-authoring fields, MIDI-learn mappings).

The payload SHALL NOT include transient UI state: selection (channel selection, marquee, piano-roll selection, DJ action / event selection), dialog open flags, scroll position, hover state, current transport `mode`/`playing`/`recording` flags, `timecodeMs`, `bar`, `recordingStartedAt`, or any derived horizon/extent value (`sessionHorizonFloorBeats`, `layoutHorizonBeats`, etc.). Loading a payload SHALL leave those at their construction defaults.

#### Scenario: Payload carries the version tag

- **WHEN** `serializeTimeline(state, name)` is called
- **THEN** the returned `TimelinePayload.version` SHALL equal `STORAGE_SCHEMA_VERSION`
- **AND** `TimelinePayload.appVersion` SHALL be a non-empty string
- **AND** `TimelinePayload.savedAt` SHALL be `Date.now()` at call time
- **AND** `TimelinePayload.name` SHALL equal the `name` argument after trim

#### Scenario: Payload excludes transient UI state

- **WHEN** the editor has a non-null `marquee`, a non-empty `selectedIdx`, an open Export dialog (`dialogOpen === true`), a non-default `scrollLeft`, and an active recording (`transport.recording === true`)
- **AND** `serializeTimeline(state, "X")` is called (after the recording has been stopped per the save flow)
- **THEN** the returned payload's `session` object SHALL NOT contain any property named `marquee`, `selectedIdx`, `selectedChannelId`, `resolvedSelection`, `dialogOpen`, `djActionSelection`, `djEventSelection`, `mode`, `playing`, `recording`, `timecodeMs`, `bar`, `recordingStartedAt`, `sessionHorizonFloorBeats`, or `layoutHorizonBeats`

#### Scenario: Round-trip preserves authoring state

- **WHEN** a session is serialised, then the resulting payload is fed through `deserializeTimeline(payload)`, and the returned slice is dispatched to each provider's `hydrate(...)`
- **THEN** every field listed under the "persistable session surface" in `session-model` SHALL equal its pre-save value
- **AND** `Note.tTicks`, `Note.durTicks`, `ActionEvent.tTicks`, `ActionEvent.durTicks`, and `CCPoint.tTicks` SHALL be exact integer round-trips (no float coercion)

### Requirement: IndexedDB-backed timeline store with in-memory fallback

The codebase SHALL expose a `TimelineStore` driver at `src/storage/timelineStore.ts` whose public surface SHALL be:

- `open(): Promise<void>` — initialises the underlying engine.
- `put(payload: TimelinePayload): Promise<void>` — writes `payload` keyed by `payload.name`; overwrites any existing entry under the same name.
- `get(name: string): Promise<TimelinePayload | null>` — returns the payload stored under `name`, or `null` if no such entry exists.
- `list(): Promise<Array<{ name: string; savedAt: number }>>` — returns all stored summaries, sorted by `savedAt` descending.
- `delete(name: string): Promise<void>` — removes the entry under `name`; no-op if no such entry exists.

The default engine SHALL be IndexedDB:

- Database name: `midirec`.
- Object store: `timelines`.
- Key path: the payload's `name` field.
- `onupgradeneeded` SHALL create the `timelines` store if it does not exist.

If `indexedDB.open(...)` rejects or `indexedDB` is undefined, the store SHALL fall back to an in-memory `Map<string, TimelinePayload>` and SHALL emit a single startup toast through the toast system reading "Storage unavailable — saved timelines won't survive reload" (exact wording is implementation-defined, but it SHALL identify storage as unavailable and mention non-persistence). The fallback SHALL be transparent: all other `TimelineStore` methods continue to function for the lifetime of the page.

`put(payload)` SHALL surface `QuotaExceededError` as a typed `StorageQuotaError` to its caller; `useTimelineStorage` SHALL convert that to a toast reading "Storage full — delete a saved timeline to free space" without mutating the in-memory editor state.

#### Scenario: Round-trip put / get

- **WHEN** the IndexedDB store is opened, `put(payload)` is awaited, then `get(payload.name)` is awaited
- **THEN** the returned value SHALL deep-equal `payload`

#### Scenario: Same-name put overwrites the prior entry

- **WHEN** `put({ ..., name: "X", savedAt: 1000, ... })` is followed by `put({ ..., name: "X", savedAt: 2000, ... })`
- **THEN** `get("X")` SHALL return the second payload (with `savedAt: 2000`)
- **AND** `list()` SHALL contain exactly one entry for `name: "X"`

#### Scenario: List sorts by savedAt descending

- **WHEN** three payloads are written with `savedAt` values `1000`, `3000`, `2000` (names `A`, `B`, `C`)
- **THEN** `list()` SHALL return entries in the order `[{name:'B', savedAt:3000}, {name:'C', savedAt:2000}, {name:'A', savedAt:1000}]`

#### Scenario: Delete removes the entry

- **WHEN** `put(payloadX)` then `delete("X")` then `get("X")`
- **THEN** `get("X")` SHALL resolve to `null`
- **AND** `list()` SHALL NOT contain any entry for `"X"`

#### Scenario: IndexedDB unavailable triggers fallback

- **WHEN** the environment's `indexedDB.open(...)` rejects (e.g. private-mode quota error)
- **AND** the storage layer initialises
- **THEN** the toast system SHALL emit exactly one message identifying storage as unavailable
- **AND** subsequent `put` / `get` / `list` / `delete` calls SHALL succeed against an in-memory store for the rest of the page lifetime
- **AND** no second "unavailable" toast SHALL be emitted

### Requirement: useTimelineStorage exposes save / load / list / delete / new

The codebase SHALL expose a `useTimelineStorage` hook (and a `TimelineStorageProvider`) at `src/hooks/useTimelineStorage.tsx`. The hook's return type SHALL include at minimum:

- `entries: Array<{ name: string; savedAt: number }>` — live-refreshed summaries of saved timelines, sorted by `savedAt` descending.
- `saveCurrentTimeline(name: string): Promise<void>` — serialises the current editor state and writes it under `name`. If `transport.recording === true`, SHALL call `transport.stop()` first so the recorder commits its buffer. Emits a toast on completion ("Saved *name*" if new, "Overwrote *name*" if an entry under that name already existed).
- `loadTimeline(name: string): Promise<void>` — reads the payload by `name`, calls `transport.stop()`, clears scheduler/recorder pending events, then dispatches each per-provider `hydrate(...)` action in sequence: channels, DJ action tracks, transport-authoring, loop region, MIDI-learn mappings. Emits a toast on completion ("Loaded *name*"). If the payload's `version !== STORAGE_SCHEMA_VERSION`, SHALL emit a toast reading "Can't open *name* — saved in an incompatible version" and SHALL NOT mutate any editor state.
- `deleteTimeline(name: string): Promise<void>` — removes the entry and emits a toast ("Deleted *name*").
- `newTimeline(): Promise<void>` — dispatches each per-provider `hydrate(...)` with the empty-session default (no channels, no DJ tracks, default transport-authoring fields) and emits a toast ("New session").
- `isDirty: boolean` — true iff the current editor state differs from the last save/load/new snapshot, computed lazily at the moment any of `loadTimeline` / `newTimeline` is invoked. Used to gate destructive actions behind a confirmation flow.

The hook SHALL refresh `entries` after every `saveCurrentTimeline` / `deleteTimeline` / `newTimeline` call so the UI list stays in sync without manual re-query.

#### Scenario: Save stops a recording before serialising

- **WHEN** `transport.recording === true` and `saveCurrentTimeline("take1")` is awaited
- **THEN** `transport.stop()` SHALL be called before `TimelineStore.put` is invoked
- **AND** the resulting saved payload's piano-roll rolls / DJ events SHALL include every note that the recorder had committed by the time `stop()` returned
- **AND** a success toast SHALL be emitted on completion

#### Scenario: Save new versus save overwrite

- **WHEN** `saveCurrentTimeline("alpha")` is awaited and no entry under "alpha" previously existed
- **THEN** the success toast SHALL read "Saved alpha"
- **WHEN** `saveCurrentTimeline("alpha")` is awaited again with mutated state
- **THEN** the success toast SHALL read "Overwrote alpha"
- **AND** `TimelineStore.list()` SHALL still contain exactly one entry for `"alpha"`

#### Scenario: Load reads, rehydrates, and toasts

- **GIVEN** a payload `{ version: 1, name: "beta", session: ... }` exists in storage
- **WHEN** `loadTimeline("beta")` is awaited
- **THEN** `transport.stop()` SHALL be called before any `hydrate` dispatch
- **AND** the channels reducer's `hydrate` action SHALL receive the payload's `channels`
- **AND** the DJ action tracks reducer's `hydrate` action SHALL receive the payload's `djActionTracks`
- **AND** the transport reducer's `hydrate` action SHALL receive the payload's `transport-authoring` subset (`bpm`, `sig`, `quantizeOn`, `quantizeGrid`, `snapAbsoluteOn`, `looping`, `metronomeOn`, `clockSource`)
- **AND** `useStage().loopRegion` SHALL equal the payload's `loopRegion`
- **AND** a success toast SHALL be emitted

#### Scenario: Load refuses incompatible schema versions

- **GIVEN** a payload `{ version: 999, name: "old", ... }` exists in storage
- **WHEN** `loadTimeline("old")` is awaited
- **THEN** no `hydrate` action SHALL be dispatched
- **AND** no editor state SHALL be mutated
- **AND** a toast SHALL be emitted identifying `"old"` and noting the incompatible version
- **AND** the call SHALL resolve normally (no thrown error escapes the hook)

#### Scenario: New session restores empty defaults

- **WHEN** `newTimeline()` is awaited from a state with non-empty channels, DJ tracks, and notes
- **THEN** `useChannels().channels` SHALL equal the empty-session default
- **AND** `useDJActionTracks().djActionTracks` SHALL equal the empty-session default
- **AND** `useTransport().bpm` / `.sig` / `.quantizeOn` etc. SHALL equal their construction defaults
- **AND** a success toast SHALL be emitted

#### Scenario: isDirty after a save is false; after an edit becomes true

- **WHEN** `saveCurrentTimeline("c")` resolves
- **THEN** `isDirty` (evaluated at the next lifecycle call) SHALL be `false`
- **WHEN** any persistable session datum mutates (e.g. a note is added) after the save
- **AND** `isDirty` is next evaluated
- **THEN** `isDirty` SHALL be `true`

### Requirement: Sidebar Storage panel surfaces the lifecycle UI

The codebase SHALL expose a `<StoragePanel>` component at `src/components/sidebar/StoragePanel.tsx`. The Sidebar (`Sidebar.tsx`) SHALL mount exactly one `<StoragePanel>` instance inside a `<Panel>` with title "Storage" and a disk-style icon, between the Routing panel and the bottom of the sidebar's panel stack.

The panel's body SHALL contain, in this order from top to bottom:

- A single-line text input bound to local component state. Placeholder SHALL read "Name…". The input SHALL trim leading/trailing whitespace on commit and SHALL reject empty strings (by disabling the Save button while the trimmed value is empty).
- A "Save" affordance immediately to the right of the input. Activating Save SHALL call `useTimelineStorage().saveCurrentTimeline(trimmedName)`. If an entry under that name already exists, the affordance's title attribute SHALL read "Overwrite *name*"; otherwise "Save *name*".
- A horizontal divider.
- A vertically stacked list of saved-entry rows, one per `entries[i]`. Each row SHALL render the entry's `name` (truncated with `text-overflow: ellipsis` if it overflows), a "Load" affordance, and a "Delete" affordance. Rows SHALL be sorted by `savedAt` descending. If `entries` is empty the list region SHALL render the muted text "No saved timelines" instead.
- A horizontal divider.
- A "New session" button at the bottom. Activating it SHALL call `useTimelineStorage().newTimeline()`.

When `useTimelineStorage().isDirty === true`, the **Load** affordance on a row SHALL show a confirmation step before dispatching: clicking it once enters a confirming visual state (e.g. row tint + "Load?" label) and the dispatch SHALL only occur on a second activation within a few seconds, or be cancelled by a click outside. The **New session** button SHALL use the same confirmation pattern when `isDirty === true`. The **Delete** affordance SHALL always require the same confirmation step regardless of `isDirty`.

Clicks anywhere inside `<StoragePanel>` SHALL NOT clear timeline selections (`djActionSelection`, `djEventSelection`, piano-roll selection): the panel's root element SHALL participate in the same selection-blur exclusion mechanism used by the other sidebar chrome.

#### Scenario: Storage panel renders all controls

- **WHEN** the app is rendered
- **THEN** `.mr-sidebar` SHALL contain exactly one `<Panel title="Storage">`
- **AND** the panel body SHALL contain, in order: a single text input, a Save affordance, a saved-list region, and a "New session" button
- **AND** the Save affordance SHALL be disabled when the trimmed input value is empty

#### Scenario: Save commits via the hook

- **WHEN** the user types "demo" into the input and clicks Save
- **THEN** `useTimelineStorage().saveCurrentTimeline("demo")` SHALL be called exactly once
- **AND** the saved-list region SHALL re-render with a new row whose label reads "demo"

#### Scenario: Empty list renders the placeholder

- **WHEN** `useTimelineStorage().entries` is the empty array
- **THEN** the saved-list region SHALL render the muted text "No saved timelines"
- **AND** SHALL NOT render any row elements

#### Scenario: Load confirms when dirty

- **GIVEN** `useTimelineStorage().isDirty === true`
- **WHEN** the user clicks the Load affordance on a row labeled "alpha"
- **THEN** `loadTimeline("alpha")` SHALL NOT be called on the first activation
- **AND** the row SHALL enter a visible confirming state
- **WHEN** the user clicks the Load affordance again within the confirmation window
- **THEN** `loadTimeline("alpha")` SHALL be called exactly once

#### Scenario: Delete always confirms

- **WHEN** the user clicks the Delete affordance on a row labeled "beta" while `isDirty === false`
- **THEN** `deleteTimeline("beta")` SHALL NOT be called on the first activation
- **AND** the row SHALL enter a visible confirming state
- **WHEN** the user clicks Delete again within the confirmation window
- **THEN** `deleteTimeline("beta")` SHALL be called exactly once

#### Scenario: Clicking inside the panel preserves selection

- **GIVEN** `useStage().djActionSelection !== null`
- **WHEN** the user clicks the Storage panel's name input, the Save affordance, any saved-list row, the "New session" button, or empty space inside the panel body
- **THEN** `djActionSelection` SHALL remain non-null
- **AND** any other live timeline selection SHALL remain unchanged
