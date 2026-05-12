## Context

The `web-midi-access` change (archived 2026-05-11) gave us live `MIDIAccess`, a `MidiRuntimeProvider`, and `useMidiInputs()` / `useMidiOutputs()`. Devices are real; selection state is also real (`useStatusbar().selectedInputId` for inputs, populated either explicitly or implicitly by the runtime).

The `transport-titlebar` capability already has a `record()` action that flips `mode` to `'record'` and a `stop()` that flips back to `'idle'` (resetting `timecodeMs`). The record button already pulses while armed (`mrPulse` keyframe). The piece missing today is the bridge: nothing translates inbound `MIDIMessageEvent`s into `Note` records on the active channel's roll.

Channels carry a `PianoRollTrack` per channel (`useChannels.rolls`); the active channel is `useStage().selectedChannelId`. There is no `appendNote` action yet — existing actions only toggle flags or add empty param lanes. The recorder needs a way to write a `Note` into the matching roll without breaking referential identity for other channels.

`Note` already exists in the session model (`src/components/piano-roll/notes.ts`, fields `{ t, dur, pitch, vel }`) and is the same shape regardless of whether it was seeded or captured live — the recorder produces records identical in shape to what `makeNotes()` produces today.

**Input selection — interim accommodation**: this slice was originally scoped to gate on `useStatusbar().selectedInputId`, but `useStatusbar` is a stub today with no selection state. The "Pickers for MIDI input and clock source" backlog entry is the slice that adds explicit selection. Rather than expand this slice's scope to also add selection state, the recorder uses `useMidiInputs().inputs[0]` as the de facto selected input. When the pickers slice lands, the recorder swaps this in for `useStatusbar().selectedInputId` (small, contained change). Disabled-state tooltips reflect the interim wording (`No MIDI input available`) rather than the eventual `No input device selected`.

## Goals / Non-Goals

**Goals:**

- A user with a real MIDI input selected and a channel selected can press record, play notes on the hardware, see them appear in the active channel's piano roll *during* recording (not only after stop), and see them at the correct pitches and times (in beats, derived from `performance.now() − recordingStartedAt`).
- Listener lifecycle is leak-free across record cycles, input switches, and component unmounts.
- Hung notes (held when stop is pressed) are finalized with a truncated duration rather than dropped.
- Bursts of inbound messages don't produce a render storm: multiple notes arriving in the same frame produce one commit.
- The slice's scope is small enough to land in 0.5–1 day per the backlog estimate; advanced routing/CC capture/playback are explicitly deferred.

**Non-Goals:**

- Playback scheduling and output device handling — third E2E slice.
- Multi-channel record routing by incoming MIDI channel byte — separate slice.
- CC, pitch-bend, aftertouch capture — separate slice.
- Per-channel record arm UI — bundled with multi-channel routing.
- Auto-creating channels when an unknown MIDI channel byte arrives — bundled with multi-channel routing + channels-affordances.
- Panic note-offs on record-stop targeting an *output* — that's a playback concern. (Recording-side hung-note finalization is in scope; output-side panic is not.)
- Quantize-on-input — `quantizeOn` exists on transport state but does not affect captured note times in this slice.

## Decisions

### 1. `recordingStartedAt` lives on `TransportState`, not on the recorder hook

We need a stable per-take time origin so notes captured at different moments inside the same take share a coherent time axis. Putting it on `TransportState`:

- Reuses the existing `record()` / `stop()` / `pause()` dispatch as the natural set/clear points — no separate `useEffect` watching `mode` transitions to track an origin.
- Makes the origin observable by other consumers (the future playback scheduler, a future "recording elapsed" indicator) without exposing recorder internals.
- Keeps the recorder hook stateless beyond its in-flight active-note map.

Set: when the reducer handles `record`, set `recordingStartedAt = performance.now()`. Clear: when it handles `stop` or `pause`, set `recordingStartedAt = null`. The existing `record` reducer branch resets `timecodeMs` to 0 only when entering from `'idle'`; we follow the same rule for `recordingStartedAt` (only set on `idle → record`; re-entering `record` from `record` is a no-op, which the existing reducer doesn't do anyway).

**Alternative considered**: keep the timestamp inside the recorder hook (`useRef<number | null>`). Rejected — couples the time origin to one consumer and makes the future scheduler reach into recorder internals.

### 2. Keep `recording: boolean` / `record()` — no `isRecording` / `startRecording` / `stopRecording`

The backlog text proposed adding `isRecording`, `startRecording`, `stopRecording` to `useTransport`. The existing API already has `recording: boolean` (derived from `mode === 'record'`) and a `record()` action; stopping is `stop()`. Duplicating these as new names would either create two-action confusion or require a breaking rename of every existing caller (Titlebar, demos, tests).

Decision: the proposal's "add `isRecording`, `startRecording`, `stopRecording`" is interpreted as *the conceptual machinery needs to exist*, not *those exact names*. The names `recording` / `record` / `stop` are already correct.

**Alternative considered**: rename `recording` → `isRecording` for stylistic consistency with `useStage` etc. Rejected — pure churn, breaks every consumer, no behavior change.

### 3. Recorder is a single hook mounted once at the app root

`useMidiRecorder()` mounts in `App.tsx` next to `<MidiRuntimeProvider>`, `<TransportProvider>`, `<StageProvider>`, etc. It reads `useTransport()`, `useStage()`, `useMidiInputs()`, and `useChannels()` and orchestrates the listener lifecycle from a single effect. It returns `null` (or nothing) — its job is the side effect, not data.

The mount lives inside a tiny `<MidiRecorderRunner />` component that simply calls `useMidiRecorder()` and returns `null`, so the root `App` keeps its existing provider-stack shape.

**Alternative considered**: a `MidiRecorderProvider` that exposes recorder state via context. Rejected — no consumer needs recorder internals in this slice; the only outputs are `appendNote` dispatches.

### 4. Listener lifecycle keyed on `(recording, selectedInputId)`

A `useEffect` with dependency array `[recording, selectedInputId, access]` does the following:

- If `!recording || !selectedInputId || !access`: do nothing, return no cleanup.
- Else: resolve `access.inputs.get(selectedInputId)`. If undefined, do nothing (the device disappeared between selection and arming).
- Else: install an `onmidimessage` handler. Capture any previously-installed handler in the closure (`const prev = input.onmidimessage`) and call it in the new handler before processing the message (chain forward).
- Cleanup: reset `input.onmidimessage = prev`, then finalize any open active notes (hung-note path).

This means: arming record while no input is selected does nothing; switching inputs mid-record swaps the listener; stopping record finalizes and detaches.

**Why `onmidimessage` and not `addEventListener('midimessage', ...)`**: Web MIDI spec defines `MIDIInput` as an `EventTarget` (so `addEventListener` works) AND as having an `onmidimessage` property. Chromium and Safari both honor both. We use `onmidimessage` to make the chain-forward behavior explicit and to match what the existing Statusbar `MIDI IN` LED tap (if any) likely does. If two consumers both want the slot, the recorder's prev-handler chaining preserves the earlier consumer. (If a future refactor unifies all consumers under `addEventListener`, the chain logic can go away.)

**Alternative considered**: subscribe to `onmidimessage` on every input simultaneously and filter by `selectedInputId` inside the handler. Rejected — more handler installations, more state, no benefit (we only need to listen to the selected device).

### 5. Note time is in beats, derived from `(now − recordingStartedAt) × bpm / 60000`

`Note.t` is in beats throughout the codebase. The recorder computes `t = ((performance.now() − recordingStartedAt) / 1000) × (bpm / 60) = (now − recordingStartedAt) × bpm / 60000`. `bpm` is read from `useTransport()` at the moment of capture (not at record-start), so tempo changes mid-take are reflected in subsequent notes' beat times. For this slice tempo changes mid-record are not a use case, so the choice is forward-looking but not load-bearing today.

`Note.dur` is computed from `(noteOffTime − noteOnTime)` in the same way. The active-note map stores `noteStartedAt: number` (a `performance.now()` value) per pitch, so duration is derived without re-reading `recordingStartedAt`.

### 6. Active-note map keyed by pitch, not by channel+pitch

Single-channel routing this slice → channel byte ignored → keying on pitch alone is sufficient. The map is `Map<pitch, { startedAt: number; velocity: number }>`. When two note-ons arrive for the same pitch without an intervening note-off (the "re-trigger without release" case some controllers send for legato), the existing entry is overwritten — the earlier note is dropped. This is a known limitation; a follow-up could finalize-and-replace, but it would require choosing a `dur` for the dropped note. Drop-on-re-trigger is simpler and matches the typical "one ring at a time per pitch" hardware behavior.

**Alternative considered**: key by `(channel, pitch)` from the start to ease the multi-channel-routing follow-up. Rejected — adds a meaningless dimension today and the follow-up will touch the map shape anyway.

### 7. Frame-coalesced dispatch

The recorder maintains a `pendingNotes: Note[]` array. On note-off finalization, push to the array and schedule a `requestAnimationFrame` flush if one isn't already scheduled. The flush dispatches each pending note via `appendNote(channelId, note)`. Within one rAF cycle, multiple notes batch into multiple dispatches **but** React 18's automatic batching coalesces them into one commit.

Why not a single bulk `appendNotes(channelId, notes[])` action: introducing a multi-note variant of `appendNote` doubles the API surface (and the spec scenarios) for a problem React 18 already solves. If profiling later shows per-dispatch overhead, the action can be added then. For now, automatic batching is the cheaper path.

**Alternative considered**: dispatch every note immediately, no coalescing. Rejected — a rapid arpeggio could fire 10 dispatches per frame; even with automatic batching that's 10 reducer runs per frame, vs 1 with the rAF coalesce. The coalesce is cheap insurance.

### 8. `appendNote` is referentially identity-preserving for unchanged rolls

`useChannels` reducer branch for `appendNote`:

- Find the roll with matching `channelId`. If not found, no-op (return state unchanged).
- Build a new roll record with `notes: [...roll.notes, note]`.
- Build a new `rolls` array where only the matching index is replaced; other rolls keep their reference.
- Return `{ ...state, rolls: newRolls }`.

This matches the pattern already used by `flipRollField`. Consumers of unchanged rolls (other channels' `<Track>` renders) don't re-render.

### 9. Hung-note finalization happens at listener detach, with `dur` derived from `now`

When the effect cleanup runs (record turned off, input switched, or recorder unmounted), every entry remaining in the active-note map is finalized: `dur = (performance.now() − entry.startedAt) × bpm / 60000`, dispatched, and the map cleared. This handles three cases at once: user pressed stop while holding a note; user unplugged the device while holding a note (the cleanup runs because `access.inputs.get(...)` is no longer the same identity on next render); user switched input devices mid-record.

**Alternative considered**: leave hung notes as zero-duration markers. Rejected — they look like accidents in the piano roll and break visual review of takes.

**Origin capture (subtle)**: the `recordingStartedAt` value used for the `t` calculation MUST be captured at effect setup (closure-scoped const) rather than read live from a ref. Reason: when `stop()` runs, the reducer clears `recordingStartedAt = null` in the same React commit that flips `recording` to `false`. The effect's cleanup then runs with a ref that has already been overwritten. Reading `recordingStartedAt` from a `latestRef` at cleanup time yields `null` → fallback to `entry.startedAt` → `t === 0` → the hung note appears to span back to the beginning of the take. Capturing `const origin = recordingStartedAt;` at effect setup binds the correct value into the cleanup's closure. `recordingStartedAt` is added to the effect's dep array so the closure re-binds whenever the origin changes (which only happens on enter/exit of record mode).

### 10. Record button disabled tooltip lives on the existing button, no new component

The button already exists in the Titlebar transport group. Wire `disabled = (selectedInputId == null) || (selectedChannelId == null)` and a `title` prop (or a small custom tooltip if one is already in use in the codebase — defer to whatever the rest of the Titlebar buttons use). The tooltip text is whichever condition is the cause, with "no input" winning when both are true (the user can't record without an input regardless of channel selection).

## Risks / Trade-offs

- **[Risk]** `onmidimessage` is a single-slot handler; another consumer (e.g., the Statusbar LED tap, future input-mapping panel) may also want it. → **Mitigation**: chain-forward inside the recorder (`prev = input.onmidimessage; input.onmidimessage = (e) => { prev?.call(input, e); ...recorder logic }`). Cleanup restores `prev`. Document that consumers must follow the same convention.
- **[Risk]** A device disconnects mid-record (mid-take). The cleanup path detaches the listener (effect re-runs because `access.inputs.get(...)` no longer yields the same port; assuming the runtime updates the `inputs` array via `statechange`), and hung notes are finalized. → **Mitigation**: confirmed by the existing `midi-runtime` hotplug requirement. The recorder relies on `useMidiInputs()` reflecting the disappearance.
- **[Risk]** Re-trigger on the same pitch without a note-off drops the earlier note. → **Accepted trade-off** for this slice; documented in decision 6. Revisit if real users hit it.
- **[Risk]** `performance.now()` and `MIDIMessageEvent.timeStamp` differ: the message timestamp is the more accurate hardware-level moment. For this slice we use `performance.now()` at the moment the handler runs, accepting up to ~1 frame of jitter (16ms). → **Accepted trade-off**; a future precision slice could swap to `event.timeStamp`.
- **[Risk]** The user records into a channel with seeded notes (the seed has 22 notes on channel 1, 16 on channel 2). New notes append without overwriting. The roll could become visually cluttered. → **Accepted**: this is correct behavior; "Clear roll" / "New session" affordances are separate concerns.
- **[Risk]** `bpm` mid-take changes propagate to subsequent notes' beat positions but earlier notes are already stored. If the user fiddles with tempo mid-recording, the timeline can desynchronize. → **Accepted**; tempo edits mid-record aren't a target workflow.
- **[Risk]** React's StrictMode double-mounts effects in development, which would chain `prev` twice if the cleanup doesn't perfectly restore. → **Mitigation**: write the chain logic to be StrictMode-safe — always restore `input.onmidimessage = prev` in cleanup, and ensure `prev` capture happens *inside* the install, not in module scope.

## Migration Plan

- No data migration. Existing seeded sessions render unchanged. New takes append to whichever channel is selected.
- Rollback: removing the `<MidiRecorderRunner />` from `App.tsx` reverts to the pre-slice behavior (devices visible, nothing captured). `recordingStartedAt` field on `TransportState` is additive and harmless if unused.

## Open Questions

- **Q1**: Should `pause()` also finalize hung notes, or should holding through a pause be allowed? → **Resolved**: `pause()` clears `recordingStartedAt` and `recording` flips to false, so the effect cleanup runs, which finalizes hung notes. Same behavior as `stop()`. The only difference between pause and stop remains the `timecodeMs` reset.
- **Q2**: When `selectedInputId` switches mid-record, do we keep the in-progress take or split it? → **Resolved**: keep the take. The listener detaches from device A (finalizing hung notes from A), then attaches to device B. Subsequent notes from B append to the same channel's roll seamlessly. No "device boundary" marker is recorded.
- **Q3**: What if the user clicks record with `selectedChannelId == null`? → **Resolved**: the button is disabled in this case (decision 10), so the dispatch can't happen. Defensive guard inside the recorder: if `recording && selectedChannelId == null`, no listener is attached and no notes are captured.
