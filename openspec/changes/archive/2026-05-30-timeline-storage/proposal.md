## Why

The app currently keeps the entire timeline (channels, piano-roll notes, param-lane points, DJ action tracks/events, output mappings, transport settings) only in React state under `StageProvider` / `TransportProvider`. A reload, accidental close, or browser crash wipes the user's work; there is no way to set a session aside, come back to it later, or keep more than one timeline around. Users who record or compose anything beyond a one-shot demo have no recovery path and no way to organise multiple takes.

This change introduces **named timeline storage** in the browser so the user can save the current session under a name, list previously saved timelines, and load one back into the editor. The scope is the whole authoring session — every datum needed to reproduce the editor state on reload — minus transient UI fluff (scroll position, hover, dialog visibility).

## What Changes

- Add a **`timeline-storage`** capability covering the persisted format, the in-browser store, and the user-visible save/load/list flow.
- Persist the **whole authoring session**: channels (config, piano-roll rolls, param lanes, points), DJ action tracks (events, action map, output map, CC interpolation), transport authoring fields (BPM, time signature, swing, quantize state, loop region, clock source/destinations), and MIDI-learn mappings. UI-transient state (current scroll, marquee, dialog open flags, hover, currently-selected item, transport play/record mode, current playhead time) SHALL be excluded.
- Tag every saved payload with a **schema `version`** integer plus app `appVersion` string. This slice only loads payloads whose `version` equals the current code's `STORAGE_SCHEMA_VERSION`; older payloads SHALL surface a "saved in incompatible version" error rather than corrupt state. Migrations are a follow-up.
- Add **Save / Open icon controls to the Toolstrip**: a Save button opens a popover with a name input, an in-browser Save (writes to IndexedDB; overwrites if a timeline with that name already exists, with a confirmation toast), and a Download button that opens the existing Export dialog for `.mid`/`.jsonl` artifact output. An Open button opens a dropdown with the saved-timeline list (click-to-load, sorted most-recent first) and an Upload row that picks a `.jsonl`/`.ndjson` file from disk.
- Back the store with **IndexedDB** (`midirec` database, `timelines` object store, keyed by `name`). Fall back to an in-memory store with a one-shot toast if IndexedDB is unavailable (private mode, quota error, etc.) so the rest of the app still loads.
- Add a **JSONL codec** at `src/storage/timelineJsonl.ts` (`serializeTimelineToJsonl` / `parseTimelineJsonl`) that round-trips the same `TimelinePayload` surface as IndexedDB, using one line per high-level slice (`meta`, `transport`, `loop`, `channel`, `roll`, `lane`, `dj.track`). Same `STORAGE_SCHEMA_VERSION` and the same shape/version errors.
- Add a **whole-page drag-and-drop loader** (`useTimelineDrop`) that accepts `.jsonl`/`.ndjson` files dropped anywhere on the window and feeds them through the same hydrate boundary. Non-matching files surface a warning toast.
- Add a **`SaveBeforeOpenDialog`** that appears when the user opens (drop or upload) a file while `isDirty === true`. Exits are Save (commits current state under a typed name then opens), Discard (opens without saving), Cancel.
- Toast on every storage outcome — save success, load success, delete confirmation, quota/read errors, schema mismatch — through the existing `useToast`.
- Add a **`saveCurrentTimeline(name)`**, **`loadTimeline(name)`**, **`loadTimelineFromJsonlText(text)`**, **`deleteTimeline(name)`**, **`listTimelines()`**, and **`newTimeline()`** API on a new `useTimelineStorage` hook; `StageProvider` and `TransportProvider` expose write-back hooks so a loaded payload can rehydrate their state without bypassing existing setters.
- The save flow SHALL NOT persist the contents of the currently-recording buffer that hasn't yet been committed to a roll — saving while recording stops the recorder first, mirroring the existing transport-stop semantics.

**Non-goals**: cloud sync, schema migration from older saved versions, conflict resolution across multiple tabs.

## Capabilities

### New Capabilities

- `timeline-storage`: Persisted-session lifecycle (save, load, list, delete, new), versioned JSON-shaped payload, IndexedDB-backed browser store, JSONL file codec, drag-and-drop loading, Toolstrip Save/Open controls, save-before-open confirmation dialog, and the in-app API + write-back hooks that connect persisted payloads to existing providers.

### Modified Capabilities

- `app-shell`: The `StageProvider` and `TransportProvider` SHALL expose a documented write-back boundary used by `timeline-storage` to rehydrate state from a loaded payload (no other consumer is allowed to bypass setters this way).
- `session-model`: Adds a requirement that the authoritative session datums enumerated in this spec (channels, rolls, lanes, DJ tracks, action map, output map, transport-authoring fields, MIDI-learn mappings) form the **persistable session surface**, and that any future timed layer documented in `session-model` SHALL declare whether it joins this surface or is excluded as transient state.

## Impact

- **Code**:
  - New `src/storage/timelineStore.ts` — IndexedDB driver (`open`, `put`, `get`, `list`, `delete`), in-memory fallback, error mapping.
  - New `src/storage/timelinePayload.ts` — `serializeTimeline(state)` / `deserializeTimeline(payload)`, `STORAGE_SCHEMA_VERSION`, `PayloadShapeError` / `PayloadVersionError`, payload schema typed end-to-end.
  - New `src/storage/timelineJsonl.ts` — `serializeTimelineToJsonl(input)` / `parseTimelineJsonl(text)`, line-discriminator format (`meta`, `transport`, `loop`, `channel`, `roll`, `lane`, `dj.track`), same shape/version errors.
  - New `src/hooks/useTimelineStorage.tsx` — provider + hook exposing the lifecycle API including `loadTimelineFromJsonlText`.
  - New `src/hooks/useTimelineDrop.tsx` + CSS — whole-window drag-and-drop loader, drop overlay, file picker driven from the toolstrip Upload action.
  - New `src/components/dialog/SaveBeforeOpenDialog.tsx` — Save / Discard / Cancel modal shown when opening a file while `isDirty`.
  - New `src/components/toolstrip/StorageControls.tsx` + CSS — Save and Open icon buttons in the Toolstrip with popovers for name input + saved list + Upload + Download.
  - New `src/components/icons/transport.tsx` additions — `DiskIcon`, `DownloadIcon`, `FolderOpenIcon`, `UploadIcon`.
  - Edit `src/components/toolstrip/Toolstrip.tsx` — mount `<StorageControls>`.
  - Edit `src/hooks/useStage.tsx`, `src/hooks/useChannels.ts`, `src/hooks/useDJActionTracks.ts`, `src/hooks/useTransport.tsx` — add a `hydrate(slice)` boundary used only by the storage layer.
  - Edit `src/App.tsx` — wrap with `TimelineStorageProvider` and `TimelineDropProvider` so all consumers can call the API and drag-drop is live page-wide.
- **Tests**: new unit suites for `timelineStore` (round-trip, schema mismatch, missing/duplicate name, IndexedDB unavailable), `timelinePayload` (serialise → deserialise idempotence, version tag, UI-transient fields excluded), `timelineJsonl` (line discriminators, version + shape errors, round-trip), per-provider `hydrate` suites, `useTimelineStorage` (save → list → load flow under React Testing Library), `useTimelineDrop` (accept / reject extension, isDirty pause), and `StorageControls` (popover behaviour, confirmation flow, upload trigger).
- **Dependencies**: `fake-indexeddb` added to devDependencies for the store suite. IndexedDB is platform-native at runtime.
- **Data**: a new IndexedDB database `midirec` with object store `timelines` (key: `name`, value: versioned payload).
- **No** changes to MIDI runtime, scheduler, recorder, or export pipeline; storage sits adjacent to authoring state and feeds the same setters those subsystems already react to.
