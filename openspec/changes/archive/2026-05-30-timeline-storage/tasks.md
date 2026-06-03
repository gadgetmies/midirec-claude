## 1. Payload schema and serialisation

- [x] 1.1 Define `TimelinePayload` and `SessionPayload` TypeScript types in `src/storage/timelinePayload.ts`, mirroring the persistable surface enumerated in `session-model`.
- [x] 1.2 Export the constant `STORAGE_SCHEMA_VERSION = 1` and an `APP_VERSION` resolver (read from `package.json` at build time).
- [x] 1.3 Implement `serializeTimeline(state, name): TimelinePayload`, pulling slices from `useChannels`, `useDJActionTracks`, `useTransport`, and `useStage` snapshots. Explicitly drop every transient-state field listed in the session-model spec.
- [x] 1.4 Implement `deserializeTimeline(payload): { channels, djActionTracks, transportAuthoring, loopRegion, midiLearn }`, returning per-provider slices ready to feed into each `hydrate(...)`. Validate payload shape and reject if `version !== STORAGE_SCHEMA_VERSION`.
- [x] 1.5 Unit tests for `serializeTimeline` / `deserializeTimeline`: round-trip preserves integer tick values, payload omits transient-state fields, version mismatch yields a typed rejection.

## 2. IndexedDB driver

- [x] 2.1 Implement `TimelineStore` in `src/storage/timelineStore.ts` with `open` / `put` / `get` / `list` / `delete`. Use database `midirec`, object store `timelines`, key path `name`; create the store inside `onupgradeneeded`.
- [x] 2.2 Map `DOMException`-style errors to typed errors: `StorageQuotaError`, `StorageUnavailableError`, `StorageReadError`.
- [x] 2.3 Implement the in-memory `Map<string, TimelinePayload>` fallback, activated when `open()` rejects. Emit the "Storage unavailable" toast exactly once.
- [x] 2.4 Unit tests (jsdom or fake-indexeddb): round-trip put/get, overwrite under same name, list sort order by `savedAt` desc, delete, list is empty after wipe, fallback path activates on `open` rejection.
- [x] 2.5 Add `fake-indexeddb` to devDependencies if not already present; configure test setup to register the global.

## 3. Provider hydrate boundaries

- [x] 3.1 `useChannels.ts`: add a `hydrate(slice)` reducer action accepting `{ channels, rolls, lanes, midiLearnMappings }`. Verify reducer-derived data (e.g. lane derivations) re-runs after dispatch.
- [x] 3.2 `useDJActionTracks.ts`: add `hydrate(slice)` accepting the full `DJActionTrack[]` plus any reducer-private state needed for consistency.
- [x] 3.3 `useTransport.tsx`: add `hydrate(transportAuthoring)` covering `bpm`, `sig`, `quantizeOn`, `quantizeGrid`, `snapAbsoluteOn`, `looping`, `metronomeOn`, `clockSource`. SHALL NOT touch `mode`, `playing`, `recording`, `timecodeMs`, `bar`, `recordingStartedAt`.
- [x] 3.4 `useStage.tsx`: expose a `hydrateLoopRegion(loopRegion)` setter (or fold into an existing setter pattern). Reset all transient stage flags (`marquee`, selections, `dialogOpen`) to their construction defaults on hydrate.
- [x] 3.5 Add a unit test per provider asserting that calling `hydrate` updates state and that derived selectors reflect the new slice on the next render.
- [x] 3.6 Tag each `hydrate` action with a short comment ("// Only `useTimelineStorage` may dispatch this — see app-shell spec.") so future readers know the boundary.

## 4. useTimelineStorage hook and provider

- [x] 4.1 Create `src/hooks/useTimelineStorage.tsx` with `TimelineStorageProvider` and a `useTimelineStorage` hook.
- [x] 4.2 Wire the provider to read snapshots from `useChannels`, `useDJActionTracks`, `useTransport`, `useStage` and to dispatch into each provider's `hydrate(...)`.
- [x] 4.3 Implement `saveCurrentTimeline(name)`: if `transport.recording`, call `transport.stop()` first; then `serializeTimeline(...)` and `TimelineStore.put(...)`. Detect "new" vs "overwrite" by checking `entries` before the put. Emit success toasts ("Saved *name*" / "Overwrote *name*").
- [x] 4.4 Implement `loadTimeline(name)`: read via `TimelineStore.get`; if missing, toast "Couldn't find *name*". If `version !== STORAGE_SCHEMA_VERSION`, toast incompatible-version message and return without mutating state. Otherwise: `transport.stop()`, clear scheduler pending events, dispatch each `hydrate(...)` in sequence, toast success.
- [x] 4.5 Implement `deleteTimeline(name)` and `newTimeline()` (the latter dispatches empty-session defaults through each `hydrate(...)`).
- [x] 4.6 Implement `entries` — refresh via `TimelineStore.list()` on mount and after every save / delete / new.
- [x] 4.7 Implement `isDirty` via lazy serialisation + string compare against the last save/load/new snapshot.
- [x] 4.8 Mount `<TimelineStorageProvider>` inside `App.tsx`'s provider tree, as a descendant of `StageProvider` and `TransportProvider`.
- [x] 4.9 Unit + integration tests: save flow stops recorder before serialising; load happy path; load on incompatible version preserves state; new session resets to defaults; isDirty flips correctly across save / edit cycles.

## 5. Toolstrip Storage controls UI

- [x] 5.1 Add `DiskIcon`, `DownloadIcon`, `FolderOpenIcon`, and `UploadIcon` glyphs to `src/components/icons/transport.tsx` (or reuse existing disk-style icons).
- [x] 5.2 Create `src/components/toolstrip/StorageControls.tsx` + `StorageControls.css` rendering two adjacent Toolstrip icon buttons (`Save`, `Open`) with anchored popovers: the Save popover holds a name input, Save/Overwrite action, and a Download action; the Open popover holds the saved-entry click-to-load rows and an Upload row with a hidden file input.
- [x] 5.3 Implement the two-step confirmation UI for Load (when `isDirty === true`): first click swaps the row text to "Load?" and arms a few-seconds timer; second click within the window dispatches `loadTimeline(name)`; click-outside, Escape, popover close, or timer expiry cancel.
- [x] 5.4 Trim and validate the name input: disable Save when trimmed value is empty; cap to 80 Unicode code points; Enter inside the input triggers Save; the input is focused on popover open and reseeded from `currentName` after a successful save / load / new.
- [x] 5.5 Render the "No saved timelines" placeholder in the Open popover when `entries` is empty (the Upload row still renders below the divider).
- [x] 5.6 Wire the Save popover's Download button to `useStage().openExportDialog()` so it reuses the existing `.mid`/`.jsonl` export pipeline without touching the storage layer.
- [x] 5.7 Wire popover open/close behaviour: outside `pointerdown` and Escape close both popovers; opening one closes the other; the trigger button and popover root both carry `data-mr-storage-toolstrip="true"` so DOM-aware predicates can identify them.
- [x] 5.8 Mount `<StorageControls>` inside `src/components/toolstrip/Toolstrip.tsx`.
- [x] 5.9 Unit / RTL tests: Toolstrip renders Save + Open buttons, typing a name and clicking Save invokes the hook, list rows render in `savedAt`-desc order, empty-state placeholder, Load confirmation flow, Upload forwards to `useTimelineDrop().openFile`, Download opens the Export dialog.

## 6. JSONL codec

- [x] 6.1 Create `src/storage/timelineJsonl.ts` exporting `serializeTimelineToJsonl(input)`, `parseTimelineJsonl(text)`, `JSONL_FILE_EXT = 'jsonl'`, and the `TimelineJsonlLine` discriminated union (`meta`, `transport`, `loop`, `channel`, `roll`, `lane`, `dj.track`).
- [x] 6.2 Wire `parseTimelineJsonl` to raise `PayloadVersionError` on `meta.version !== STORAGE_SCHEMA_VERSION` and `PayloadShapeError` on malformed JSON, unknown `kind`, or missing `meta` line (with the offending line index in the message where applicable).
- [x] 6.3 Unit tests: round-trip preserves every slice and every `tTicks`/`durTicks` as exact integers; version mismatch raises `PayloadVersionError`; malformed lines and unknown kinds raise `PayloadShapeError`.

## 7. Drag-and-drop loading

- [x] 7.1 Create `src/hooks/useTimelineDrop.tsx` + `useTimelineDrop.css` exporting `<TimelineDropProvider>` and `useTimelineDrop()`. Attach `dragenter`/`dragover`/`dragleave`/`drop` listeners to `window`; track depth to avoid child-element flicker.
- [x] 7.2 Render a `.mr-drop-overlay` (`role="status"`) when a file-bearing drag is over the window and no dialog is currently open. Overlay text: "Drop a .jsonl or .ndjson timeline to open".
- [x] 7.3 Accept only `.jsonl` and `.ndjson` extensions (case-insensitive). Non-matching files emit a warning toast identifying the filename and accepted extensions, and do not dispatch any hydrate.
- [x] 7.4 When the editor is not dirty, read the file's text and call `useTimelineStorage().loadTimelineFromJsonlText(text)`. When the editor *is* dirty, hold the pending text + filename and render `<SaveBeforeOpenDialog>` instead.
- [x] 7.5 Expose `openFile(file)` on the hook's context value so the Toolstrip's Upload row can drive the same code path as a drop.
- [x] 7.6 Mount `<TimelineDropProvider>` in `App.tsx` inside `<TimelineStorageProvider>` and `<ToastProvider>`.
- [x] 7.7 Add `loadTimelineFromJsonlText(text)` to `useTimelineStorage` so the drop provider can hydrate without touching IndexedDB. Surface `PayloadVersionError` / `PayloadShapeError` as user-facing toasts without mutating editor state.
- [x] 7.8 Unit / RTL tests: accepted file hydrates; rejected file emits the warning toast and does not hydrate; dirty editor pauses for the dialog; Save/Discard/Cancel resolutions dispatch the correct sequence; `useTimelineDrop()` outside the provider throws.

## 8. SaveBeforeOpenDialog

- [x] 8.1 Create `src/components/dialog/SaveBeforeOpenDialog.tsx` rendering a modal scrim + dialog reusing `.mr-dialog-scrim` / `.mr-dialog` chrome with three exits (`save`, `discard`, `cancel`).
- [x] 8.2 Implement the focus-trap: focus the first focusable element on mount; restore focus to the previously focused element on unmount. Escape, scrim click, and Cancel button all resolve as `'cancel'`.
- [x] 8.3 Disable the Save button while the trimmed name input is empty; resolve `'save'` with the trimmed name on activation.
- [x] 8.4 Unit / RTL tests covered through `useTimelineDrop` integration tests (`useTimelineDrop.test.tsx`): Save commits then opens; Discard opens without saving; Cancel drops the pending open.

## 9. Cross-cutting verification

## 6. Cross-cutting verification

- [ ] 9.1 End-to-end manual test in the dev server: record a few notes, save under name "take1"; reload the page; load "take1"; verify notes / DJ events / transport BPM all restored and selection is empty. *(Deferred — requires interactive dev-server session; the round-trip is covered by `useTimelineStorage.test.tsx` "save then load round-trips channels and transport BPM".)*
- [ ] 9.2 Manual quota-exhaustion test (e.g. stub `put` to throw `QuotaExceededError`): verify the user-facing toast appears and editor state is untouched. *(Deferred — interactive verification. The mapping `QuotaExceededError → StorageQuotaError → "Storage full" toast` is exercised by the typed error in `timelineStore.ts` and consumed in `useTimelineStorage.tsx`.)*
- [ ] 9.3 Manual IndexedDB-unavailable test (private mode or stubbed): verify the fallback toast appears once and the API continues to function in memory. *(Deferred — interactive verification. The fallback + single-toast behaviour is covered by `timelineStore.test.ts` "falls back to in-memory engine when IndexedDB is unavailable and reports the fallback once".)*
- [x] 9.4 `yarn typecheck` passes.
- [x] 9.5 `yarn test` passes for the new unit suites and existing suites unchanged. *(437/437 tests pass excluding the pre-existing failure in `DJValueEditor.height.test.ts` which is unrelated to this change.)*
- [x] 9.6 Update `BACKLOG.md` Open section to drop any line items now covered by this change. *(The `.midirec` file save/load entry is partially covered: this change ships JSONL file round-trip via drag-and-drop and the Toolstrip Upload row, but the dedicated `.midirec` packaging is still a separate item.)*
