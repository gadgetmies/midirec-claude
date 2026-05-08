## Why

The codebase currently has no session-data spec. Slice 0 shipped the shell, Slice 1 wired the transport, Slice 2 mounted a piano-roll renderer driven by a placeholder `useStage()` hook that hardcodes `totalT: 16` and a fixed seed of 38 notes. Nothing in any current spec says how long a session is, where notes accumulate during recording, or what `totalT` means *relative to the session* — and Slice 3 (multi-track stack) is about to introduce real per-track note arrays. If we don't lock in the session-model contract before Slice 3, "the session is 16 beats long" will silently bake itself into track storage, inspector start/length fields, the export dialog's range options, and every subsequent slice that touches session data.

The design source signals the intent clearly:

- `design_handoff_midi_recorder/README.md` §Recording: *"Live notes stream into the active track from left to right; the playhead is fixed and the timeline scrolls under it."* — recording is unbounded, not capped to a fixed-length capture.
- `README.md` §Titlebar example shows `Bar 13.2.1` as the timecode-display state — sessions are intended to be many bars long.
- `README.md` §Export: the Range radio includes `Loop region` as one of three export ranges, alongside `Whole session` and `Selection` — so a loop region is part of the session model, not a transport-only concept.
- `IMPLEMENTATION_PLAN.md` Slice 6 has a Markers section in the Browser Sidebar.

This change formalises the design owner's stated intent: **sessions are unbounded; loop markers let the user define a region that playback wraps inside.** It's a spec lock-in only — no source-code changes ship in this change. Code lands incrementally in the slices that consume the contract: Slice 3 (track storage), Slice 5 (inspector start/length fields), Slice 6 (markers UI + export dialog), and the eventual horizontal-scroll/zoom slice that lets the renderer window into a long session.

## What Changes

- **New `session-model` capability** defining:
  - The session is unbounded in time. Notes carry `t: number` (in beats from session start) and `dur: number`, with no upper bound. Any `Note.t >= 0` is valid.
  - A `LoopRegion = { start: number; end: number } | null` value lives at session scope. `start` and `end` are in the same beat-time units as `Note.t`, with `end > start` when non-null.
  - The renderer (PianoRoll, Ruler) receives a *view window* — a `(viewT0, totalT)` pair — and renders only what falls in `[viewT0, viewT0 + totalT]`. `totalT` is the **window length in beats**, not the session length. `viewT0` defaults to 0 for backward compatibility with current Slice 2 behavior.
  - Loop markers (start/end) render as vertical lines inside the visible window, at session-time positions converted to view coordinates via `(t - viewT0) * pxPerBeat`. They appear on both the lane area and the Ruler row when in view; they're clipped by the renderer's `overflow: hidden` when out of view.
- **Modified `transport-titlebar` capability**:
  - `TransportState` gains a `loopRegion: LoopRegion` field (default `null`).
  - `TransportActions` gains `setLoopRegion(start: number, end: number)` and `clearLoopRegion()` — the latter sets `loopRegion` back to `null`.
  - The rAF playback loop, when `looping === true && loopRegion != null`, SHALL wrap `timecodeMs` back to the millisecond equivalent of `loopRegion.start` whenever the playhead crosses `loopRegion.end`. When `loopRegion === null` OR `looping === false`, playback advances indefinitely without wrapping.
  - The existing `looping` toggle (already in the Titlebar's Loop button) controls *whether* the loop region is active; users can leave a `loopRegion` set while temporarily unlooping.
- **Modified `piano-roll` capability**:
  - `PianoRoll` gains an optional `viewT0?: number` prop (default 0). Notes whose interval `[t, t+dur)` lies entirely outside `[viewT0, viewT0 + totalT]` SHALL not render. Notes that overlap the window render at `(n.t - viewT0) * pxPerBeat` and rely on the lanes' `overflow: hidden` to clip the off-window portions.
  - `totalT`'s description SHALL be re-stated as "the visible time window length in beats", not "the session length".
  - When `loopRegion` is provided to the renderer (via prop or context), the lane area SHALL render two vertical loop markers at the start and end positions, only where they fall within `[viewT0, viewT0 + totalT]`.

The `useStage()` hook keeps its current shape; what changes is what it can return — `notes` may be of any length, `totalT` is the view-window default, and a future revision will derive `viewT0` from a horizontal-scroll slice. No code edits in this change.

## Capabilities

### New Capabilities
- `session-model`: Defines the session as an unbounded sequence of notes plus an optional loop region. Specifies the time-unit conventions (beats), the rendering view-window contract, and the loop-region semantics. Provides the schema that Slices 3 (multi-track), 5 (inspector), 6 (markers UI + export), and the future scroll/zoom slice all build on.

### Modified Capabilities
- `transport-titlebar`: Add `loopRegion` to `TransportState`, `setLoopRegion` / `clearLoopRegion` to `TransportActions`, and the wrap-on-loop-end behavior to the rAF playback loop. Existing requirements (Titlebar layout, button rendering, timecode formatting, etc.) are unchanged.
- `piano-roll`: Add the optional `viewT0` prop and the clarification that `totalT` is the visible window length. Add the loop-marker rendering requirement. Existing requirements (note geometry, marquee, selection color, etc.) are unchanged.

## Impact

- **No source-code changes in this change.** The artifacts are spec-only; tasks.md captures verification-of-spec only, with explicit deferral notes pointing to the slices that will land code.
- **Future slices implement against this contract:**
  - Slice 3 (multi-track): per-track `notes: Note[]` arrays use the session-time convention defined here; tracks share the `loopRegion`.
  - Slice 5 (inspector — Note panel): the `Start` / `Length` fields read/write notes' session times.
  - Slice 6 (markers + export): UI for adding/clearing loop markers; the export dialog's `Loop region` range option resolves through `loopRegion`.
  - Future scroll/zoom slice (between Slice 5 and Slice 10): introduces real `viewT0` state in `useStage()` (or a sibling `useView()` hook), hooks horizontal-scroll/zoom controls to it.
  - Slice 10 (audio engine): the real audio runtime replaces the rAF tick, but the loop-wrap semantics carry over — the audio runtime is responsible for delivering on the same contract.
- **No breaking changes** to current Slice-2 behavior. `viewT0` defaults to 0; `loopRegion` defaults to `null`; the playhead with `loopRegion === null` continues advancing as it does today (currently wrapping at `totalT` because `useStage()`'s placeholder uses modular arithmetic — that wrap is now identified as placeholder behavior and will go away once the audio runtime arrives).
- **Conceptual lock-in**: `Note.t` is in beats, the loop region is in beats, the view window is in beats. Conversion to/from `timecodeMs` happens at one boundary (the transport hook's tick→playheadT computation). Future slices must respect this — beats is the session-time unit; ms is internal to the audio clock.
