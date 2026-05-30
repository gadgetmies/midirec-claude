## Why

The app currently keeps the entire timeline (channels, piano-roll notes, param-lane points, DJ action tracks/events, output mappings, transport settings) only in React state under `StageProvider` / `TransportProvider`. A reload, accidental close, or browser crash wipes the user's work; there is no way to set a session aside, come back to it later, or keep more than one timeline around. Users who record or compose anything beyond a one-shot demo have no recovery path and no way to organise multiple takes.

This change introduces **named timeline storage** in the browser so the user can save the current session under a name, list previously saved timelines, and load one back into the editor. The scope is the whole authoring session — every datum needed to reproduce the editor state on reload — minus transient UI fluff (scroll position, hover, dialog visibility).

## What Changes

- Add a **`timeline-storage`** capability covering the persisted format, the in-browser store, and the user-visible save/load/list flow.
- Persist the **whole authoring session**: channels (config, piano-roll rolls, param lanes, points), DJ action tracks (events, action map, output map, CC interpolation), transport authoring fields (BPM, time signature, swing, quantize state, loop region, clock source/destinations), and MIDI-learn mappings. UI-transient state (current scroll, marquee, dialog open flags, hover, currently-selected item, transport play/record mode, current playhead time) SHALL be excluded.
- Tag every saved payload with a **schema `version`** integer plus app `appVersion` string. This slice only loads payloads whose `version` equals the current code's `STORAGE_SCHEMA_VERSION`; older payloads SHALL surface a "saved in incompatible version" error rather than corrupt state. Migrations are a follow-up.
- Add a **Storage section to the Sidebar** with a name input, a Save button (saves under the current name; overwrites if a timeline with that name already exists, with a confirmation toast), a list of saved timelines (most-recent first) where each row exposes Load and Delete, and a "New" button that resets the editor to an empty default session after confirming.
- Back the store with **IndexedDB** (`midirec` database, `timelines` object store, keyed by `name`). Fall back to an in-memory store with a one-shot toast if IndexedDB is unavailable (private mode, quota error, etc.) so the rest of the app still loads.
- Toast on every storage outcome — save success, load success, delete confirmation, quota/read errors, schema mismatch — through the existing `useToast`.
- Add a **`saveCurrentTimeline(name)`**, **`loadTimeline(name)`**, **`deleteTimeline(name)`**, **`listTimelines()`**, and **`newTimeline()`** API on a new `useTimelineStorage` hook; `StageProvider` and `TransportProvider` expose write-back hooks so a loaded payload can rehydrate their state without bypassing existing setters.
- The save flow SHALL NOT persist the contents of the currently-recording buffer that hasn't yet been committed to a roll — saving while recording stops the recorder first, mirroring the existing transport-stop semantics.

**Non-goals**: cloud sync, sharing/export of saved timelines (the existing Export dialog handles MIDI/JSONL artifact export), schema migration from older saved versions, conflict resolution across multiple tabs.

## Capabilities

### New Capabilities

- `timeline-storage`: Persisted-session lifecycle (save, load, list, delete, new), versioned JSON-shaped payload, IndexedDB-backed browser store, Sidebar Storage panel, and the in-app API + write-back hooks that connect persisted payloads to existing providers.

### Modified Capabilities

- `sidebar`: A Storage panel is added between existing panels; needs new requirements for its layout, the name input, Save / list / Load / Delete / New controls, and selection-blur exclusion (clicking inside the Storage panel SHALL NOT clear timeline selections — same predicate already used for other sidebar chrome).
- `app-shell`: The `StageProvider` and `TransportProvider` SHALL expose a documented write-back boundary used by `timeline-storage` to rehydrate state from a loaded payload (no other consumer is allowed to bypass setters this way).
- `session-model`: Adds a requirement that the authoritative session datums enumerated in this spec (channels, rolls, lanes, DJ tracks, action map, output map, transport-authoring fields, MIDI-learn mappings) form the **persistable session surface**, and that any future timed layer documented in `session-model` SHALL declare whether it joins this surface or is excluded as transient state.

## Impact

- **Code**:
  - New `src/storage/timelineStore.ts` — IndexedDB driver (`open`, `put`, `get`, `getAllNames`, `delete`), in-memory fallback, error mapping.
  - New `src/storage/timelinePayload.ts` — `serializeTimeline(state)` / `deserializeTimeline(payload)`, `STORAGE_SCHEMA_VERSION`, payload schema typed end-to-end.
  - New `src/hooks/useTimelineStorage.tsx` — provider + hook exposing the lifecycle API.
  - New `src/components/sidebar/StoragePanel.tsx` + CSS — name input, Save, saved-list rows with Load / Delete, New.
  - Edit `src/components/sidebar/Sidebar.tsx` — mount the Storage panel; ensure `[data-mr-selection-region]`-style exclusion if needed.
  - Edit `src/hooks/useStage.tsx`, `src/hooks/useChannels.ts`, `src/hooks/useDJActionTracks.ts`, `src/hooks/useTransport.tsx` — add a `hydrate(state)` / `reset()` boundary used only by the storage layer.
  - Edit `src/App.tsx` — wrap with `TimelineStorageProvider` so all consumers can call the API.
- **Tests**: new unit suites for `timelineStore` (round-trip, schema mismatch, missing/duplicate name, IndexedDB unavailable), `timelinePayload` (serialise → deserialise idempotence, version tag, UI-transient fields excluded), and `useTimelineStorage` (Sidebar save → list → load flow under React Testing Library).
- **Dependencies**: none new. IndexedDB is platform-native; the existing typecheck/test toolchain covers it.
- **Data**: a new IndexedDB database `midirec` with object store `timelines` (key: `name`, value: versioned payload).
- **No** changes to MIDI runtime, scheduler, recorder, or export pipeline; storage sits adjacent to authoring state and feeds the same setters those subsystems already react to.
