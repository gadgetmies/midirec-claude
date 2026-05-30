## 1. Failing tests for the reducer contract

- [x] 1.1 In `src/hooks/useTransport.test.tsx`, add `pause` from `record` preserves `recordingStartedAt` + `timecodeMs` + `playheadTicks`.
- [x] 1.2 Add `pause` from `play` is structurally a no-op except `mode → 'idle'`.
- [x] 1.3 Add `record` from idle with `recordingStartedAt === null` resets `timecodeMs` and `playheadTicks` to `0` and stamps `recordingStartedAt`.
- [x] 1.4 Add `record` from idle with `recordingStartedAt !== null` preserves position and `recordingStartedAt` (resume path).
- [x] 1.5 Add `record` from `play` preserves position and stamps a new `recordingStartedAt`.
- [x] 1.6 Add `rewind` from each of idle / play / record: position resets, mode preserved, `recordingStartedAt` preserved, `cuePointTicks` preserved.
- [x] 1.7 Add `cue` from idle: stores `playheadTicks` into `cuePointTicks`, no other change.
- [x] 1.8 Add `cue` from play: `mode → idle`, `playheadTicks → cuePointTicks`, `timecodeMs` ≈ ms equivalent of `cuePointTicks` at current `bpm` (±0.1 ms), `cuePointTicks` unchanged.
- [x] 1.9 Add `cue` from record: same as play, plus `recordingStartedAt → null`.
- [x] 1.10 Add `cuePointTicks` default is `0` and is independent of `seek`.
- [x] 1.11 Add a TypeScript-level assertion that `useTransport()` does not expose `stop` (`expectTypeOf<TransportValue>().not.toHaveProperty('stop')` or equivalent). Run the file; verify all 1.x tests fail (no `rewind`, `cue`, `cuePointTicks` on the API yet, `pause`/`record` still using old semantics).

## 2. Transport reducer changes

- [x] 2.1 In `src/hooks/useTransport.tsx`, add `cuePointTicks: number` to `TransportState` and `InternalState`; default `0` in `initialState`. Expose it on the memoized `TransportValue`.
- [x] 2.2 Add `rewind(): void` and `cue(): void` to `TransportActions`; add `'rewind'` and `'cue'` to the `Action` union; bind two `useCallback` dispatchers; include them in the memo value/deps.
- [x] 2.3 Update `pause` reducer to omit `recordingStartedAt: null` (just `mode: 'idle'`).
- [x] 2.4 Update `record` reducer to implement the four-branch contract from the spec (idle-fresh / idle-resume / play→record / record→record no-op).
- [x] 2.5 Add a `rewind` reducer case equivalent to `seek(0)` (set `timecodeMs: 0`, `playheadTicks: 0`; preserve mode, bpm, clockSource, recordingStartedAt, cuePointTicks).
- [x] 2.6 Add a `cue` reducer case with the mode-dependent branch from the spec. Add a `msFromTicksAtBpm(ticks, bpm)` helper if it is not already in the file.
- [x] 2.7 Remove the `stop` action: drop it from `TransportActions`, from the `Action` union, from the reducer's `switch`, from the callback wiring, and from the memo value and deps.
- [x] 2.8 Add `cuePointTicks: number` to `TransportAuthoringHydrateSlice`. Update the `hydrate` reducer case to (a) write the slice's `cuePointTicks` into state, (b) atomically reset `mode → 'idle'`, `timecodeMs → 0`, `playheadTicks → 0`, `recordingStartedAt → null`.
- [x] 2.9 Re-run section 1's tests; verify all 1.x pass.

## 3. Titlebar wiring

- [x] 3.1 In `src/components/titlebar/Titlebar.tsx`, destructure `recordingStartedAt` (and confirm `playing` is already in the destructure) from `useTransport()`.
- [x] 3.2 Rewrite `handlePlay` to branch on `recordingStartedAt` when not `playing`: pause if playing; otherwise `transport.record()` if `recordingStartedAt !== null` else `transport.play()` (keep the "Started · BPM" toast in the fresh-play branch).
- [x] 3.3 Add a `handleRewind` (or inline `() => transport.rewind()`) and wire it to the Rewind button's `onClick`. Update its `title` to `"Rewind to start"` and keep `aria-label="Rewind"`.
- [x] 3.4 Add a `handleCue` (or inline `() => transport.cue()`) and wire it to the Cue button's `onClick`. Update its `title` to `"Set cue point / Stop and return to cue"` and keep `aria-label="Cue"`.
- [x] 3.5 Delete the Stop button JSX entirely. Move the recording-saved toast from `handleStop` into the Record-toggle-off path of `handleRec` (call `pause()` rather than the deleted `stop()` there, then emit the toast). Delete `handleStop`.
- [x] 3.6 Confirm the rendered transport-group-A now contains exactly five buttons in the spec'd order via a quick `data-testid` audit or DOM inspection.

## 4. Titlebar tests

- [x] 4.1 In `src/components/titlebar/Titlebar.test.tsx`, drop the existing Stop-button-related tests.
- [x] 4.2 Add a test asserting transport-group-A renders exactly five `.mr-tbtn` buttons in the order rewind / cue / play / record / fast-forward, and asserting no button has `aria-label === 'Stop'`.
- [x] 4.3 Add a Rewind click test: render → click Rewind → assert `seek(0)` effect (i.e., `playheadTicks === 0`) via a spy or via reading the value through a probe component.
- [x] 4.4 Add a Cue-from-idle test: play, seek to a non-zero ticks via a deterministic action, pause, click Cue → assert `cuePointTicks` equals the playhead.
- [x] 4.5 Add a Cue-from-play test: simulate `mode === 'play'` with a non-zero `cuePointTicks`, click Cue → assert `mode === 'idle'` and playhead reset to `cuePointTicks`.
- [x] 4.6 Add a resume-record test: drive the harness into `mode === 'record'`, click Play-Pause → assert `recordingStartedAt` preserved and `mode === 'idle'`; click Play-Pause again → assert `mode === 'record'`, `recordingStartedAt` unchanged, position preserved.
- [x] 4.7 Add a play-after-pause-from-play test: drive into `mode === 'play'`, click Play-Pause → idle; click Play-Pause → `mode === 'play'`, the "Started · BPM" toast SHALL be emitted.

## 5. Persistence wiring (cuePointTicks + hydrate reset)

- [x] 5.1 In `src/storage/timelinePayload.ts`: add `cuePointTicks: number` to `TransportAuthoringSlice`. Update `serializeTimeline` to write `input.transport.cuePointTicks` into the payload. Update `deserializeTimeline` (via the shape pass-through) to surface `cuePointTicks`; if the persisted object lacks the field, default it to `0` for backward compatibility. Update `emptyTransportAuthoring()` to return `cuePointTicks: 0`.
- [x] 5.2 Update `src/storage/timelinePayload.test.ts` and `src/storage/timelineJsonl.test.ts` to include `cuePointTicks` in the serialise / deserialise / round-trip assertions, including a default-when-missing test.
- [x] 5.3 In `src/hooks/useTimelineStorage.tsx`: change `saveCurrentTimeline` to call `transportRef.current.pause()` instead of `stop()` (flush without snapping position). Drop the `stop()` calls in `loadTimeline`, `newTimeline`, and `applyDeserializedSlices` — `hydrate` now performs the runtime reset. Add `cuePointTicks` to whatever value the storage layer passes into `transport.hydrate(...)` (read from `transport.cuePointTicks` at save time; default `0` on the empty path).
- [x] 5.4 Update `src/hooks/useTransport.hydrate.test.tsx`: rewrite the "does not touch runtime/transient" scenario to assert hydrate now resets `mode`, `timecodeMs`, `playheadTicks`, `recordingStartedAt`, and writes `cuePointTicks`; drop the trailing `.stop()` cleanup call. Confirm the BPM-replacement scenario still passes.

## 6. Verify

- [x] 6.1 Run `yarn tsc --noEmit` from the repo root and confirm zero errors.
- [x] 6.2 Run `yarn vitest run src/hooks/useTransport src/components/titlebar/Titlebar.test.tsx src/storage src/hooks/useTimelineStorage` and confirm green.
- [x] 6.3 Run the full `yarn vitest run` and confirm only pre-existing failures remain (the `DJValueEditor.height.test.ts` `localStorage.clear` issue).
- [ ] 6.4 Run `openspec archive transport-cue-and-rewind --yes` to sync the `transport-titlebar` delta into the main spec and move the change to `openspec/changes/archive/YYYY-MM-DD-transport-cue-and-rewind/`. Note the archive-order coupling with the in-flight `timeline-storage` change (see proposal).
- [ ] 6.5 Commit the implementation as one feature commit (impl + tests + JSX). Commit the archive (spec sync + directory move) as a follow-up `chore(openspec):` commit, matching the project's existing pattern.
