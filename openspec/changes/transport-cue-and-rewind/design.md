## Context

Five facts shape this design:

1. The transport bar is the Titlebar's only mode-control surface. Each button is a single tap.
2. `useTransport()` is the single source of truth for `mode`, `timecodeMs`, `playheadTicks`, `bpm`, and `recordingStartedAt`. Nothing else owns playback state.
3. `playheadTicks` is the visible playhead (per the `transport-playhead-ticks-monotonic` change) — pulse-counted under external clock, rAF-integrated under internal clock. `timecodeMs` tracks wall-clock advance and is mirrored through `seek` / `cue`.
4. The recording session is identified by `recordingStartedAt: number | null`. Setting it stamps the take's start time; clearing it ends the session.
5. The MIDI clock layer (`midi-clock` capability) dispatches `pause()` on incoming `0xFC` while in play mode and ignores real-time messages in record mode. We must not break either of those.

## Goals / Non-Goals

**Goals:**
- Each of the five visible transport buttons does exactly one well-defined thing.
- A user can: hit Record, play through part of the take, hit Play-Pause to pause, hit Play-Pause again to resume the take from the same position with the same `recordingStartedAt`.
- A user can mark the current playhead as a cue point during pause, then later hit Cue from play or record to stop and jump back to that mark.
- Rewind always brings the playhead back to position 0 without changing `mode`.

**Non-Goals:**
- Multiple cue points (one cue point is enough for the present need).
- A visible cue marker in the timeline (the state will be there; rendering is a separate change).
- Wiring Fast-forward (needs a "content end" definition).
- A keyboard shortcut layer (separate concern).
- Persisting `cuePointTicks` across reloads (it lives only in the transport reducer this slice).

## Decisions

**`cuePointTicks` stored on the transport reducer.**
The cue point is a playhead position, so it belongs with `playheadTicks` / `timecodeMs` in the same reducer. Storing it elsewhere (e.g., stage) would split mode/position/cue across two stores and force `Cue` to dispatch into both. Keeping it on transport makes `cue()` a single atomic state transition.

**Store the cue point in ticks, not milliseconds.**
Ticks are tempo-independent musical time. If the user sets a cue point at the downbeat of bar 5 and the BPM later changes, the cue should still be at the downbeat of bar 5. Storing ms would let the cue drift relative to the musical content. The `cue()` reducer derives `timecodeMs` from `cuePointTicks` at the current `bpm` when jumping.

**Single `cue()` action with mode-dependent behavior, not separate `setCuePoint()` / `jumpToCue()`.**
The UI affordance is one button. Exposing two actions would invite callers to pick the wrong one. The reducer reads `state.mode` and branches: `idle` → set, otherwise → stop-and-jump. This keeps the button handler trivial (`onClick={transport.cue}`).

**`cue()` while non-idle clears `recordingStartedAt`.**
Cue-from-record is the "discard this take and go back to the cue mark" gesture. Preserving `recordingStartedAt` would mean the next Play-Pause click resumes recording at the cue point — but the user explicitly chose to stop. Clearing keeps the gesture predictable.

**Remove `stop()` entirely rather than alias it to `cue()`.**
An alias would invite confusion ("which one do I call from external code?") and leave a vestigial action in the API. The only external caller of `stop()` is the (removed) Stop button. The `midi-clock` external-stop handler calls `pause()`, not `stop()`, so that path is unaffected.

**`pause()` preserves `recordingStartedAt`; `cue()` clears it.**
The semantic split is "temporary vs. final." `pause()` is the resumable variant, used by Play-Pause and by the MIDI external-stop hook. `cue()` is the terminal variant — it ends the take and repositions the playhead in one motion. This is the semantic that Stop used to occupy, now folded into Cue.

**Titlebar `handlePlay` does the resume-vs-fresh branch in the component, not the reducer.**
The reducer's `record` action takes its mode-transition contract verbatim from the proposal (idle+rec→resume, idle→fresh). Putting the dispatch decision in the Titlebar keeps the reducer ignorant of which button was clicked — `record()` always "starts recording" from the reducer's perspective; the Titlebar decides whether `play()` or `record()` matches the user's intent on a play-button click. Tests can drive the reducer directly without simulating the click handler.

**Default `cuePointTicks` is `0`.**
A fresh session has no cue mark, so "go to cue" defaults to "go to start." This means Rewind and Cue-from-non-idle initially do the same position thing — but Cue-from-non-idle additionally stops, so they're still distinct. Once the user marks a cue, the two diverge.

**Rewind preserves `mode`.**
Rewind-during-play continues playing from 0 (DJ / DAW convention; the listener hears the song restart). Rewind-during-record continues recording from 0 — effectively scrubbing the take back to the start while the punch-in cursor moves. The user can pause first if they want a hard stop.

## Risks / Trade-offs

- **Removing `stop()` is a public-API break.** No external consumers exist today (the action is dispatched only by the deleted Stop button), so the blast radius is the Titlebar itself and the test files. Mitigation: ship the API removal and the JSX removal in the same change.
- **Rewind during record may not be what the user expects.** Convention is split — Pro Tools wraps record at the end of the punch range; many sequencers continue recording from the new position. We pick the simpler "continue recording from 0" path. If the user reports surprise, gating Rewind on `mode === 'idle' || mode === 'play'` is a one-line change.
- **Cue-from-record clears the take with no confirmation.** The cue button is one tap. If the user mis-taps Cue instead of Play-Pause during a take, they lose `recordingStartedAt` and can't resume. Mitigation: the take's recorded MIDI is owned by the recorder, not by `recordingStartedAt`, so the recorded notes survive — only the "in-progress session" handle is cleared. Re-arming Record starts a fresh take overlay rather than truly discarding the prior content.
- **`pause()` preservation may surprise the MIDI clock layer.** The `midi-clock` external-stop handler calls `pause()` when the master sends `0xFC` during play. After this change, that call no longer clears `recordingStartedAt` — but the spec already states real-time messages are ignored in record mode, so `recordingStartedAt` is `null` whenever this path can fire. No behavior change in practice.
- **`cuePointTicks` is in-memory only.** Loading a saved session via `hydrate()` won't restore the cue point. Acceptable for this slice; if persisted cues are wanted later, add `cuePointTicks` to the `TransportAuthoringHydrateSlice`.
