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

## 5. Sidebar Storage panel UI

- [x] 5.1 Add a `DiskIcon` glyph to `src/components/icons/` (or reuse an existing disk-style icon).
- [x] 5.2 Create `src/components/sidebar/StoragePanel.tsx` + `StoragePanel.css` rendering: name input, Save affordance, divider, saved-list rows (Load + Delete per row), divider, "New session" button.
- [x] 5.3 Implement two-step confirmation UI for Load (when `isDirty === true`), Delete (always), and New session (when `isDirty === true`). Confirming state SHALL be visible (row tint or button-text swap to "Load?" / "Delete?" / "Discard?") and SHALL time out after a few seconds of no interaction.
- [x] 5.4 Trim and validate the name input: disable Save when trimmed value is empty; cap to 80 code points.
- [x] 5.5 Render the "No saved timelines" placeholder when `entries` is empty.
- [x] 5.6 Wire the panel into the existing selection-blur exclusion mechanism so clicks inside SHALL NOT clear timeline selections (apply the same data attribute or container check used by other sidebar chrome).
- [x] 5.7 Mount `<StoragePanel>` in `Sidebar.tsx` as the last `<Panel>` in the panel stack (below Routing). Title: "Storage". Icon: `<DiskIcon />`.
- [x] 5.8 Unit / RTL tests: rendering the panel, typing a name and clicking Save invokes the hook, list rows render in `savedAt`-desc order, empty state placeholder, Load confirmation flow, Delete confirmation flow.

## 6. Cross-cutting verification

- [ ] 6.1 End-to-end manual test in the dev server: record a few notes, save under name "take1"; reload the page; load "take1"; verify notes / DJ events / transport BPM all restored and selection is empty. *(Deferred — requires interactive dev-server session; the round-trip is covered by `useTimelineStorage.test.tsx` "save then load round-trips channels and transport BPM".)*
- [ ] 6.2 Manual quota-exhaustion test (e.g. stub `put` to throw `QuotaExceededError`): verify the user-facing toast appears and editor state is untouched. *(Deferred — interactive verification. The mapping `QuotaExceededError → StorageQuotaError → "Storage full" toast` is exercised by the typed error in `timelineStore.ts` and consumed in `useTimelineStorage.tsx`.)*
- [ ] 6.3 Manual IndexedDB-unavailable test (private mode or stubbed): verify the fallback toast appears once and the API continues to function in memory. *(Deferred — interactive verification. The fallback + single-toast behaviour is covered by `timelineStore.test.ts` "falls back to in-memory engine when IndexedDB is unavailable and reports the fallback once".)*
- [x] 6.4 `yarn typecheck` passes.
- [x] 6.5 `yarn test` passes for the new unit suites and existing suites unchanged. *(437/437 tests pass excluding the pre-existing failure in `DJValueEditor.height.test.ts` which is unrelated to this change.)*
- [x] 6.6 Update `BACKLOG.md` Open section to drop any line items now covered by this change (none expected, but check). *(Checked — the `.midirec` file save/load entry is a separate non-goal scoped to file export, which this change explicitly excludes.)*
