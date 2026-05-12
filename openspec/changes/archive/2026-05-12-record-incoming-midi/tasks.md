## 1. Transport hook: `recordingStartedAt`

- [x] 1.1 Add `recordingStartedAt: number | null` field to `TransportState` interface in `src/hooks/useTransport.tsx`.
- [x] 1.2 Add `recordingStartedAt: number | null` to `InternalState`; initialize to `null` in `initialState`.
- [x] 1.3 In the reducer, set `recordingStartedAt = performance.now()` on the `'record'` action when transitioning from non-record mode. Preserve `recordingStartedAt` when re-entering record from record (existing reducer is idempotent here).
- [x] 1.4 In the reducer, clear `recordingStartedAt = null` on `'stop'` and `'pause'` actions.
- [x] 1.5 Expose `recordingStartedAt` on the memoized `TransportValue` returned by `TransportProvider`.

## 2. Channels hook: `appendNote`

- [x] 2.1 Add `appendNote: (channelId: ChannelId, note: Note) => void` to the `UseChannelsReturn` interface in `src/hooks/useChannels.ts`.
- [x] 2.2 Add `{ type: 'roll/appendNote'; channelId: ChannelId; note: Note }` to the `Action` union.
- [x] 2.3 Implement the `'roll/appendNote'` reducer branch: locate the roll by `channelId`; if not found, return state unchanged; otherwise build a new rolls array where only the targeted roll's index is replaced with `{ ...roll, notes: [...roll.notes, note] }`, preserving referential identity of other roll records.
- [x] 2.4 Memoize the `appendNote` action creator with `useCallback` and include it in the hook's returned object.
- [x] 2.5 Confirm `state.channels` and `state.lanes` are not modified by the new branch (referential identity preserved).

## 3. Recorder module: `src/midi/recorder.ts`

- [x] 3.1 Create `src/midi/recorder.ts`. Export `useMidiRecorder()` hook.
- [x] 3.2 Inside the hook, read `useTransport()` (for `recording`, `recordingStartedAt`, `bpm`), `useStage()` (for `selectedChannelId`, `appendNote`), `useMidiRuntime()` (for the `MIDIAccess`), and `useMidiInputs()` (for `status` and the device list — first entry is the de facto selection).
- [x] 3.3 Access path: read `MIDIAccess` from `useMidiRuntime().state.access` when granted; resolve port via `access.inputs.get(inputs[0].id)`.
- [x] 3.4 Maintain refs (not state): `activeNotesRef`, `pendingNotesRef`, `rafIdRef`.
- [x] 3.5 Maintain a `latestRef` updated each render so the listener closure always reads current values without re-installing on every render.
- [x] 3.6 Implement `flushPending()` that iterates `pendingNotesRef`, calls `latestRef.current.appendNote(channelId, note)` for each, clears the queue, clears `rafIdRef`.
- [x] 3.7 Implement `scheduleFlush()` that, if `rafIdRef` is null, calls `requestAnimationFrame(flushPending)` and stores the id.
- [x] 3.8 Implement the message handler for note-on and note-off.
  - Chain forward to `prev?.call(input, event)` first.
  - Read `status = event.data[0]`. Compute `nibble = status & 0xF0`.
  - On `nibble === 0x90` with `event.data[2] > 0`: open active-note entry keyed by `pitch = event.data[1]` with `{ startedAt: performance.now(), velocity: event.data[2], channelId: latestRef.current.selectedChannelId! }`. Overwrite if present.
  - On `nibble === 0x80` OR (`nibble === 0x90` AND `event.data[2] === 0`): look up active-note entry; if absent, return. Compute `t` and `dur` per the design (using `latestRef.current.recordingStartedAt` and `bpm`); push `{ channelId: entry.channelId, note: { t, dur, pitch, velocity: entry.velocity } }` to `pendingNotesRef`; delete the entry; call `scheduleFlush()`.
  - Ignore all other status bytes (no-op).
- [x] 3.9 Implement the listener lifecycle `useEffect` keyed on `[recording, selectedChannelId, status, inputId, runtimeState]`. Gates: recording, selectedChannelId !== null, status === 'granted', inputId !== null, port resolves. Cleanup finalizes hung notes, clears the map, and restores `prev` only if our handler is still installed (StrictMode safety).
- [x] 3.10 StrictMode walk-through: mount installs handler capturing prev1; cleanup restores prev1; second mount captures prev1 again. The `input.onmidimessage === handler` guard before restoring prevents stomping on a newer install.

## 4. Recorder mount

- [x] 4.1 Add a tiny `<MidiRecorderRunner />` component in `src/midi/recorder.ts` that calls `useMidiRecorder()` and returns `null`.
- [x] 4.2 Mount `<MidiRecorderRunner />` inside `App.tsx` as a sibling of `<AppShell />`, inside `<StageProvider>` so it has access to all required providers.

## 5. Titlebar: record button disabled state

- [x] 5.1 Located the record button at `src/components/titlebar/Titlebar.tsx:122–131`.
- [x] 5.2 Read `useMidiInputs().inputs` (first-available stand-in) and `useStage().selectedChannelId`.
- [x] 5.3 Compute `disabled = !hasInput || !hasChannel`. Use `!recording && recDisabled` so the button remains clickable while armed (to stop recording).
- [x] 5.4 Compute `tooltip = !hasInput ? 'No MIDI input available' : 'Select a channel to record into'`.
- [x] 5.5 Wired `disabled` and `title` onto the button; `data-rec`, `data-on`, icon unchanged.
- [x] 5.6 `data-on={recording || undefined}` still drives the pulse animation; `disabled` element can't fire `onClick`.

## 6. Type wiring and exports

- [x] 6.1 `Note` imported from `../components/piano-roll/notes`.
- [x] 6.2 Recorder reads `selectedChannelId` from `latestRef` at note-on time; bails if null. Guarantees the active-note entry's `channelId` is `ChannelId`, not nullable.
- [x] 6.3 `yarn typecheck` — clean. `yarn test` — 94/94 pass.

## 7. Manual verification

> Manual verification — requires real MIDI hardware and a browser session with the user present.

- [x] 7.1 Notes record into the active channel's roll. **Bug found**: playhead wrapped at `TOTAL_T` even when loop disabled — fixed by removing the modular wrap in `useStage.tsx`.
- [x] 7.2 Stop-while-holding finalizes hung note with truncated duration. **Bug found**: notes extended back to `t=0` because the reducer cleared `recordingStartedAt` before the recorder cleanup ran — fixed by capturing `origin` at effect setup in `recorder.ts`.
- [x] 7.3 Record button disabled when no MIDI input available. **Bug found**: button visually identical to enabled — fixed in `Titlebar.css` (`:disabled` rule now sets opacity 0.35, `not-allowed` cursor, suppressed hover).
- [x] 7.4 No-channel-selected disabled state — confirmed working (no channel deselection UI yet, but the gate is in place for when one lands).
- [ ] 7.5 MIDI IN LED on real activity — **DEFERRED to backlog ("Live MIDI IN LED tap")**. Pre-existing stub limitation.
- [x] 7.6 Play works without inputs (no gating on play button); record works without outputs (no output gating). Confirmed.
- [ ] 7.7 Reversible pause-during-record — **DEFERRED to backlog ("Pause-during-record reversibility")**. The t=0 extend bug is fixed by 7.2's fix.

## 8. Spec & documentation hygiene

- [x] 8.1 Ran `openspec validate --strict record-incoming-midi` — reports valid.
- [x] 8.2 Moved "Record incoming MIDI to the active channel" to `BACKLOG.md` Done section (2026-05-12, commit f588865).
- [x] 8.3 No deviation documented — the interim "first available input" gating is recorded in design.md, not in design/deviations.
