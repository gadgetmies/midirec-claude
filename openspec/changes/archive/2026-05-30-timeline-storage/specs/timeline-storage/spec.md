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
- `currentName: string` — the name of the most recently saved or loaded timeline (or empty string after `newTimeline()`). Used to seed UI name inputs so re-saving is a one-click action.
- `saveCurrentTimeline(name: string): Promise<void>` — serialises the current editor state and writes it under `name`. If `transport.recording === true`, SHALL call `transport.stop()` first so the recorder commits its buffer. Emits a toast on completion ("Saved *name*" if new, "Overwrote *name*" if an entry under that name already existed).
- `loadTimeline(name: string): Promise<void>` — reads the payload by `name`, calls `transport.stop()`, clears scheduler/recorder pending events, then dispatches each per-provider `hydrate(...)` action in sequence: channels, DJ action tracks, transport-authoring, loop region, MIDI-learn mappings. Emits a toast on completion ("Loaded *name*"). If the payload's `version !== STORAGE_SCHEMA_VERSION`, SHALL emit a toast reading "Can't open *name* — saved in an incompatible version" and SHALL NOT mutate any editor state.
- `loadTimelineFromJsonlText(text: string): Promise<void>` — parses `text` via `parseTimelineJsonl`, then performs the same `transport.stop()` + hydrate sequence as `loadTimeline`. Surfaces `PayloadVersionError` and `PayloadShapeError` as user-facing toasts without mutating editor state.
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

### Requirement: Toolstrip Save / Open controls surface the lifecycle UI

The codebase SHALL expose a `<StorageControls>` component at `src/components/toolstrip/StorageControls.tsx`, and the Toolstrip (`Toolstrip.tsx`) SHALL mount exactly one instance. The component SHALL render two adjacent icon buttons:

- A **Save** button (`<DiskIcon>`, `aria-label="Save timeline"`) that toggles a popover (`role="dialog"`) containing:
  - A single-line name `<input>` seeded from `useTimelineStorage().currentName`, with placeholder `"Name…"`, kept in sync whenever `currentName` changes (but never overwritten while the user types). The input SHALL be focused when the popover opens. It SHALL trim leading/trailing whitespace before use and SHALL cap to 80 Unicode code points.
  - A primary Save action whose label reads `"Save"` when no entry under the trimmed name exists and `"Overwrite"` when one does. Activation SHALL call `useTimelineStorage().saveCurrentTimeline(trimmedName)` and SHALL be disabled when the trimmed value is empty. Pressing Enter inside the name input SHALL trigger the same action.
  - A Download action that opens the existing Export dialog (via `useStage().openExportDialog()`) for `.mid`/`.jsonl` artifact output. This action SHALL NOT touch the storage layer.
- An **Open** button (`<FolderOpenIcon>`, `aria-label="Open timeline"`) that toggles a dropdown (`role="menu"`) containing:
  - One click-to-load row per `useTimelineStorage().entries[i]`, sorted by `savedAt` descending. The row's label SHALL be the entry `name`.
  - A divider.
  - An Upload row that triggers a hidden `<input type="file" accept=".jsonl,.ndjson,application/x-ndjson,application/json">` picker; chosen files SHALL be forwarded to `useTimelineDrop().openFile(file)`.
  - If `entries` is empty, the saved-list region SHALL render the muted text `"No saved timelines"` in place of any rows (the Upload row SHALL still render below the divider).

When `useTimelineStorage().isDirty === true`, clicking a saved-entry row SHALL show a confirmation step before dispatching: the first click enters a confirming visual state (the row SHALL display the text `"Load?"`) and `loadTimeline(name)` SHALL only be called on a second click within a window of a few seconds, or be cancelled by a click outside / Escape / the popover closing.

Both popovers SHALL close on outside `pointerdown`, on Escape, and when the other popover opens. Outside-click detection SHALL ignore clicks inside either popover or on either trigger button. Both popovers' root nodes SHALL carry `data-mr-storage-toolstrip="true"` so other DOM-aware predicates can identify them.

The Toolstrip storage controls SHALL be the *only* in-app UI surface for browser-side save and load in this slice. There SHALL NOT be a sidebar Storage panel.

#### Scenario: Toolstrip renders the Save and Open buttons

- **WHEN** the app is rendered
- **THEN** the Toolstrip SHALL contain exactly one button with `aria-label="Save timeline"` and exactly one button with `aria-label="Open timeline"`
- **AND** each button SHALL be a sibling carrying `data-mr-storage-toolstrip="true"` on its wrapper

#### Scenario: Save popover commits via the hook

- **WHEN** the user clicks Save, types `"demo"` into the name input, and clicks the Save action
- **THEN** `useTimelineStorage().saveCurrentTimeline("demo")` SHALL be called exactly once
- **AND** the popover SHALL close
- **AND** the Open dropdown SHALL subsequently render a row labeled `"demo"`

#### Scenario: Save action label reflects overwrite state

- **GIVEN** an entry named `"alpha"` exists
- **WHEN** the user types `"alpha"` into the name input
- **THEN** the Save action SHALL render the text `"Overwrite"`
- **WHEN** the user changes the input to `"alpha-2"`
- **THEN** the Save action SHALL render the text `"Save"`

#### Scenario: Empty saved list shows the placeholder

- **WHEN** `useTimelineStorage().entries` is the empty array and the user opens the Open dropdown
- **THEN** the dropdown SHALL render the muted text `"No saved timelines"` in place of any rows
- **AND** SHALL still render the Upload row beneath the divider

#### Scenario: Load confirms when dirty

- **GIVEN** `useTimelineStorage().isDirty === true`
- **WHEN** the user opens the Open dropdown and clicks the row labeled `"alpha"`
- **THEN** `loadTimeline("alpha")` SHALL NOT be called on the first activation
- **AND** the row SHALL display the text `"Load?"`
- **WHEN** the user clicks the same row again within the confirmation window
- **THEN** `loadTimeline("alpha")` SHALL be called exactly once
- **AND** the Open dropdown SHALL close

#### Scenario: Upload forwards to the drop handler

- **WHEN** the user clicks the Upload row and picks a file from the OS picker
- **THEN** `useTimelineDrop().openFile(file)` SHALL be called with that file
- **AND** the Open dropdown SHALL close

#### Scenario: Download opens the Export dialog

- **WHEN** the user clicks the Save button to open its popover and then clicks Download
- **THEN** `useStage().openExportDialog()` SHALL be called exactly once
- **AND** no `TimelineStore` method SHALL be invoked
- **AND** the Save popover SHALL close

### Requirement: JSONL codec round-trips the payload

The codebase SHALL expose a JSONL codec at `src/storage/timelineJsonl.ts` with the public surface:

- `serializeTimelineToJsonl(input: SerializeJsonlInput): string` — produces a UTF-8 string in line-delimited JSON format with one JSON object per line, no trailing newline required between the final object and EOF.
- `parseTimelineJsonl(text: string): ParsedTimelineJsonl` — parses such a string and returns deserialised slices ready to feed into each provider's `hydrate(...)`.
- `JSONL_FILE_EXT = 'jsonl'` constant for callers writing files to disk.

Each line SHALL be a JSON object discriminated by a `kind` field. The codec SHALL accept and produce exactly these line kinds:

- `meta` — `{ kind, version, appVersion, name, savedAt }`. Exactly one line. The `version` field SHALL equal `STORAGE_SCHEMA_VERSION` on serialise; on parse, mismatch SHALL raise `PayloadVersionError`.
- `transport` — `{ kind, slice }` carrying the transport-authoring subset (`bpm`, `sig`, `quantizeOn`, `quantizeGrid`, `snapAbsoluteOn`, `looping`, `metronomeOn`, `clockSource`). Exactly one line.
- `loop` — `{ kind, region: LoopRegion | null }`. Exactly one line.
- `channel` — `{ kind, channel: Channel }`. Zero or more lines.
- `roll` — `{ kind, roll: PianoRollTrack }`. Zero or more lines.
- `lane` — `{ kind, lane: ParamLane }`. Zero or more lines.
- `dj.track` — `{ kind, track: DJActionTrack }`. Zero or more lines.

The codec SHALL round-trip the same `TimelinePayload` surface as the IndexedDB store: `parseTimelineJsonl(serializeTimelineToJsonl(input))` SHALL produce slices that, when dispatched through the provider hydrates, restore the same in-memory state. Integer tick values (`Note.tTicks`, `Note.durTicks`, `ActionEvent.tTicks`, `ActionEvent.durTicks`, `CCPoint.tTicks`) SHALL round-trip exactly with no float coercion.

`parseTimelineJsonl` SHALL surface a malformed line, an unknown `kind`, a missing `meta` line, or a shape mismatch as a typed `PayloadShapeError` whose message identifies the offending line index where applicable.

#### Scenario: Round-trip preserves every slice

- **GIVEN** a `SerializeJsonlInput` describing two channels, three rolls, one lane, one DJ action track, a non-default transport-authoring slice, and a non-null loop region
- **WHEN** the input is run through `serializeTimelineToJsonl` and then `parseTimelineJsonl`
- **THEN** the resulting slices SHALL equal the input slice values
- **AND** all `tTicks` / `durTicks` fields SHALL be preserved as exact integers

#### Scenario: Version mismatch is rejected

- **GIVEN** a JSONL string whose `meta` line has `version: 999`
- **WHEN** `parseTimelineJsonl(text)` is called
- **THEN** it SHALL throw a `PayloadVersionError`
- **AND** SHALL NOT return any slices

#### Scenario: Malformed input is rejected

- **GIVEN** a JSONL string with a non-JSON line, an unknown `kind`, or a missing `meta` line
- **WHEN** `parseTimelineJsonl(text)` is called
- **THEN** it SHALL throw a `PayloadShapeError`

### Requirement: Drag-and-drop loading via useTimelineDrop

The codebase SHALL expose a `<TimelineDropProvider>` + `useTimelineDrop()` pair at `src/hooks/useTimelineDrop.tsx`, and `App.tsx` SHALL mount the provider inside the React tree such that it is a descendant of `TimelineStorageProvider` and `ToastProvider`. The provider SHALL attach `dragenter` / `dragover` / `dragleave` / `drop` listeners to the `window` for the lifetime of the React tree.

When a file is dropped anywhere on the window (or chosen via `useTimelineDrop().openFile(file)`):

- If the file's name does not end with `.jsonl` or `.ndjson` (case-insensitive), the provider SHALL emit a warning toast reading "Can't open *filename* — expected .jsonl or .ndjson" and SHALL ignore the file.
- If `useTimelineStorage().isDirty === false`, the provider SHALL read the file's text and call `useTimelineStorage().loadTimelineFromJsonlText(text)`.
- If `useTimelineStorage().isDirty === true`, the provider SHALL display a `<SaveBeforeOpenDialog incomingLabel={filename}>` instead of loading. The load SHALL only proceed once the dialog resolves (see the dialog requirement below).
- If multiple files are dropped, only the first SHALL be processed in this slice.

While a file-bearing drag is over the window and no dialog is currently visible, the provider SHALL render a drop overlay (`.mr-drop-overlay`, `role="status"`) containing the text "Drop a .jsonl or .ndjson timeline to open". The overlay SHALL hide when the drag leaves the window or when a drop completes.

`useTimelineDrop()` SHALL throw if called outside of a `<TimelineDropProvider>`.

#### Scenario: Drop of an accepted file hydrates the editor

- **GIVEN** `useTimelineStorage().isDirty === false`
- **WHEN** a `.jsonl` file is dropped on the window
- **THEN** `useTimelineStorage().loadTimelineFromJsonlText(text)` SHALL be called with the file's text
- **AND** no `SaveBeforeOpenDialog` SHALL render

#### Scenario: Drop of an unaccepted file is ignored with a toast

- **WHEN** a `.txt` or `.mid` file is dropped on the window
- **THEN** a warning toast SHALL be emitted identifying the filename and the accepted extensions
- **AND** no `hydrate` action SHALL be dispatched

#### Scenario: Dirty editor pauses for the save-before-open dialog

- **GIVEN** `useTimelineStorage().isDirty === true`
- **WHEN** a `.jsonl` file is dropped
- **THEN** a `<SaveBeforeOpenDialog>` SHALL render with `incomingLabel` equal to the file name
- **AND** `loadTimelineFromJsonlText` SHALL NOT be called until the dialog resolves

### Requirement: SaveBeforeOpenDialog gates dirty opens

The codebase SHALL expose `<SaveBeforeOpenDialog>` at `src/components/dialog/SaveBeforeOpenDialog.tsx`. It SHALL render a modal scrim + dialog (reusing the existing `.mr-dialog-scrim` / `.mr-dialog` chrome) with three exits via its `onResolve({ choice, name })` callback:

- `'save'` — emitted when the user fills the name input with a non-empty trimmed value and activates the Save button. The parent SHALL call `useTimelineStorage().saveCurrentTimeline(name)` and only then proceed with the original open.
- `'discard'` — emitted when the user activates the Discard button. The parent SHALL proceed with the original open without saving.
- `'cancel'` — emitted on Escape, on clicking the scrim, or on activating the Cancel button. The parent SHALL drop the original open and leave editor state untouched.

The Save button SHALL be disabled while the trimmed name input is empty. The dialog SHALL focus the first focusable element on mount and SHALL restore focus to the previously-focused element on unmount.

`useTimelineDrop` SHALL be the only consumer of this dialog in this slice.

#### Scenario: Save exit commits then opens

- **GIVEN** the dialog is open because of a dirty open
- **WHEN** the user types `"wip"` into the name input and clicks Save
- **THEN** `onResolve({ choice: 'save', name: 'wip' })` SHALL fire
- **AND** the drop provider SHALL call `saveCurrentTimeline("wip")` before `loadTimelineFromJsonlText(text)`

#### Scenario: Discard exit opens without saving

- **WHEN** the user clicks Discard
- **THEN** `onResolve({ choice: 'discard', name: '' })` SHALL fire
- **AND** the drop provider SHALL call `loadTimelineFromJsonlText(text)` directly with no preceding save

#### Scenario: Cancel exit drops the pending open

- **WHEN** the user presses Escape, clicks the scrim, or clicks Cancel
- **THEN** `onResolve({ choice: 'cancel', name: '' })` SHALL fire
- **AND** the drop provider SHALL NOT call `saveCurrentTimeline` or `loadTimelineFromJsonlText`
- **AND** editor state SHALL remain unchanged
