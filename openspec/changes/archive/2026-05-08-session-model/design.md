## Context

Slice 0 shipped the shell, Slice 1 the transport, Slice 2 a piano-roll renderer with a placeholder `useStage()` hook returning a fixed 16-beat seed. The seed is fine for a renderer demo but it is *not* the session model. Without a written session contract, the next slice (multi-track stack) will introduce per-track note arrays, and ad-hoc choices made there (is the session 16 beats? does each track have its own length? what does "loop" mean?) will leak across every later slice.

The design source establishes intent in passing — recording is described as a streaming timeline that scrolls under a fixed playhead, the titlebar example shows `Bar 13.2.1`, the export dialog has a `Loop region` range — but there is no single artifact that says *"sessions are unbounded; loop markers wrap playback within a region"*. This change is that artifact.

This is a **spec-only** change. No source-code edits ship. The slices that consume the contract land code incrementally.

## Goals / Non-Goals

**Goals:**
- Define the session as a plain unbounded list of notes carrying beat-relative `t` and `dur`. No upper bound, no required length, no per-session length state.
- Define `LoopRegion = { start: number; end: number } | null` with both endpoints in beats. Loop wrap-around is a *playback* behavior controlled jointly by `looping: boolean` (active toggle) and `loopRegion` (the region itself).
- Define a *view window* `(viewT0, totalT)` for the renderer, distinct from the session itself. `totalT` is the visible window length in beats; `viewT0` is the window's left edge. Slice 2 keeps `viewT0 = 0` and `totalT = 16` as defaults — same visual as today.
- Establish the time-unit boundary: session times (`Note.t`, `Note.dur`, `loopRegion.start`/`.end`, `viewT0`, `totalT`) are in **beats**. Internal clock state (`timecodeMs`) is in **milliseconds**. Conversion between the two happens inside the transport hook only.

**Non-Goals:**
- Implementing horizontal scrolling. The view-window state lives somewhere (probably `useStage()` or a new `useView()`), but where, when, and how `viewT0` is mutated by user input is a later slice's problem.
- Implementing multi-track session storage. Slice 3 introduces tracks; this change just commits to the per-note shape and the time convention.
- Implementing the markers sidebar UI. Slice 6 adds it; named non-loop markers are out of scope here.
- Real audio. Slice 10. The placeholder rAF clock continues until then; the loop-wrap behavior is described as if the rAF clock is real, and the audio runtime later honors the same contract.
- A persistent session-length value. There is none. `Note.t + Note.dur` for the latest note is the de facto session length but the system never has to know it explicitly.

## Decisions

### D1. Session is a plain `Note[]` — no length field, no segment structure

**Choice**: A session is `{ notes: Note[] }` (eventually `{ tracks: Track[] }` after Slice 3, where `Track` has `notes: Note[]`). There is no `sessionLength` or `endTime` field. Notes' `t` values can be anywhere in `[0, ∞)`. The longest `t + dur` is the implicit length, but the system never reads it that way — UI ranges that need bounds (the export dialog's "Whole session", the future scroll/zoom slice's "fit to content") compute it on demand.

**Rationale**: Length-derived state is a denormalisation invitation. A `sessionLength` field is either redundant (it's max(t+dur)) or wrong (it can drift from the actual notes). The only real consumer of "session length" is the export dialog's `Whole session` range, and that's a one-time read at export time — fine to compute it then.

**Alternative considered**: A `sessionLength` field that the recording loop appends to. Rejected — duplicates information, requires sync with notes on every edit/delete.

### D2. Loop region is `{ start, end } | null`, in beats

**Choice**: `LoopRegion = { start: number; end: number } | null`. Beats. `end > start` invariant when non-null. Stored at session scope (not per-track) because the loop region is a *playback* control — it loops the whole session, not individual tracks.

**Rationale**: A nullable region object is the simplest shape that supports "no loop set" / "loop set but inactive" / "loop active". `looping: boolean` (already in TransportState) toggles whether it's active during playback; the region itself persists across loop-toggles. Beats over ms because every other session-time value uses beats; converting is the transport's job.

**Alternative considered**: A pair of standalone marker IDs (looking ahead to Slice 6's named markers). Rejected — premature. When Slice 6 lands, named markers can become a richer `Marker[]` and `loopRegion` can become `{ startMarkerId, endMarkerId }`. For now, two raw beat values is the minimum viable.

**Alternative considered**: Multiple loop regions stacked (loop A→B, then C→D). Rejected — the design source describes a single loop range, the export dialog has one "Loop region" option, and stacking adds complexity for no demand.

### D3. Renderer gets a view window via `(viewT0, totalT)` props

**Choice**: `PianoRoll` (and `Ruler`) accept `viewT0?: number` (default 0) and `totalT?: number` (default 16). The renderer draws only the window `[viewT0, viewT0 + totalT]`. Notes are positioned at `(n.t - viewT0) * pxPerBeat`; notes entirely outside the window are skipped; notes that overlap the window edges are positioned correctly and clipped by the lanes' `overflow: hidden`.

**Rationale**: The renderer needs to be reusable across (a) Slice 2's "show the only thing we have" mode, (b) future scroll/zoom mode, and (c) Slice 3's multi-track stack where each track shares the same view window. A `(viewT0, totalT)` pair is the minimum that supports all three.

**Trade-off**: We could make the renderer fully session-agnostic by passing it only the window-relative slice of notes (filtered + offset by the caller). Rejected — the renderer needs to handle notes that overlap the window's left edge (start before `viewT0`, end inside the window), which means it can't trust pre-filtered input and must look at original `t` and `dur` anyway.

### D4. Time units: beats for session-state, ms for clock-state

**Choice**:
- Session-state uses **beats**: `Note.t`, `Note.dur`, `loopRegion.start`/`.end`, `viewT0`, `totalT`.
- Clock-state uses **milliseconds**: `TransportState.timecodeMs`.
- Conversion between the two happens in exactly one place: the transport hook's `playheadT` derivation (currently `((timecodeMs / 1000) * (bpm / 60)) % totalT` — the modular wrap will be removed; see D5).

**Rationale**: Beats are musically meaningful and survive tempo changes; ms is what `requestAnimationFrame` and the future audio clock deliver. Mixing units in a single state object is a bug magnet; one boundary, well-defined, is cleaner than two units floating around.

**Trade-off**: Tempo changes mid-session will require care — `Note.t` in beats is tempo-independent, but `timecodeMs` at any given beat depends on the bpm history. We don't support tempo changes today (`bpm` is constant in `TransportState`) so this concern is deferred.

### D5. Loop-wrap behavior: `timecodeMs` jumps back to loopRegion.start's ms equivalent

**Choice**: When `state.mode !== 'idle'` AND `state.looping === true` AND `state.loopRegion != null`, on each rAF tick the reducer SHALL check whether `(timecodeMs/1000) * (bpm/60) >= loopRegion.end` (i.e., whether the playhead crossed the loop end in beat terms) and, if so, set `timecodeMs = loopRegion.start * 1000 / (bpm/60)` (the ms equivalent of the loop-start beat).

When `looping === false` OR `loopRegion === null`, the rAF tick increments `timecodeMs` indefinitely. **The current Slice-2 placeholder modular wrap (`playheadT % totalT`) is removed** — the playhead now advances forever in the no-loop case. This is the behavior the design source describes ("the timeline scrolls under" the playhead during recording).

**Rationale**: Beat-based wrap math (not ms-based) is correct under future tempo changes. Doing the wrap in the reducer keeps the rAF loop dumb (just dispatch a tick) and the loop logic colocated with the rest of transport semantics.

**Trade-off**: The placeholder demo behavior changes — the playhead in the dev demo will advance off-screen instead of wrapping. This is intentional (it matches the real session model) and is what motivates the future scroll/zoom slice (so the user can navigate to where the playhead is). For the demo, the user can use `stop()` to bring it back to 0.

### D6. Loop markers render in the lane area AND on the Ruler

**Choice**: When the renderer has a non-null `loopRegion` AND either endpoint falls within `[viewT0, viewT0 + totalT]`, render:

- A `.mr-loop-marker` element on each visible endpoint, absolute-positioned at `(t - viewT0) * pxPerBeat`. Rendered as a 1px vertical line in `var(--mr-loop)` with a bracket glyph cap — `[` for the start endpoint, `]` for the end endpoint.
- A matching marker on the Ruler row, also at the same x-coordinate.
- A faint full-height tint between the two endpoints (only when both are visible) — `color-mix(in oklab, var(--mr-loop) 6%, transparent)` — to show the loop *region*, not just two lines.

When neither endpoint is visible, no markers render. When only one endpoint is visible, only that marker renders, plus the tint extending off-screen.

**Rationale**: Two visual cues (lines + region tint) are robust under different zoom levels: at a wide zoom the tint is the dominant cue, at a tight zoom the brackets are. Brackets at the endpoints echo conventional DAW notation for loop regions and make the start/end distinction immediately readable. A dedicated `--mr-loop` token (separate from `--mr-cue`) keeps loop-marker theming distinct from cue/locator theming. The Ruler-row markers give the user something to click to scrub between markers, when scrubbing is implemented.

**Trade-off**: `--mr-loop`'s canonical value isn't yet in `tokens.css`; the design source supplies it on its next outbound bundle. Until then, the codebase MAY fall back to `var(--mr-cue)` to keep rendering valid.

## Risks / Trade-offs

- **Risk**: Locking `Note.t` to beats commits us to "no tempo changes within a session" without flagging it. A future tempo-automation feature could break the assumption.
  **Mitigation**: Documented in D4. Tempo changes will need a tempo-map model that sits between session-time-in-beats and clock-time-in-ms; that's a future capability, not a session-model concern.

- **Risk**: Removing the placeholder modular-wrap means the demo's playhead will advance off-screen forever, leaving the user with a dead-looking app after a few seconds.
  **Mitigation**: This is honest behavior — the session IS unbounded. The dev demo can `stop()` to reset, or the future scroll/zoom slice will follow the playhead. Adding a loop region to the demo's placeholder state (e.g., `useStage()` returns `loopRegion: { start: 0, end: 16 }` when no real session is loaded) is a one-line workaround Slice 3 can choose to ship.

- **Risk**: The view-window contract (`viewT0`, `totalT`) doesn't yet say where the state lives. If Slice 3 puts it in `useStage()` and Slice 5 puts it in `useView()`, callers thrash.
  **Mitigation**: Spec leaves it open — both options satisfy the renderer contract. Whoever lands the scroll/zoom slice picks; until then, the placeholder hardcodes them in `useStage()`.

- **Risk**: Loop region UI doesn't ship until Slice 6, so users can't *create* loops between now and then.
  **Mitigation**: This change adds the contract, not the UI. Slice 6 builds the marker-creation flow. Until then, the spec exists, and `setLoopRegion` is callable from code (e.g., from a debug shortcut) for testing.

## Migration Plan

Not applicable — no code changes. Spec-only commit.

The downstream slices that consume this spec each handle their own migrations:

- Slice 3: multi-track adds `tracks: Track[]` where each `Track` has its own `notes: Note[]`; existing single-track placeholder data lifts into a single track.
- Slice 5: inspector reads/writes `Note.t` / `Note.dur` already in beats, no migration needed.
- Slice 6: marker UI is net-new code; no existing state to migrate.
- Future scroll/zoom slice: introduces real `viewT0` state; until then `viewT0` is hardcoded to 0 by `useStage()`.

## Open Questions

- **Where does `viewT0` live?** `useStage()` (current placeholder) vs `useView()` (new, dedicated to scroll/zoom). Defer to the slice that introduces user-facing scrolling.
- **Loop-marker glyph specifics**: confirmed — brackets (`[` start, `]` end) drawn in a dedicated `--mr-loop` token. Canonical token value pending the design source's next outbound bundle.
- **Multiple loop regions / nested loops**: not in scope. Possible future capability if real demand surfaces.
- **Loop-region edit during playback**: should `setLoopRegion()` while the playhead is past the new `end` snap immediately, or wait for the next pass? Defer to Slice 6 — the simplest answer ("snap immediately if `playheadT > end`") is fine but isn't worth pinning here.
- **Persistence of `loopRegion` across sessions / project saves**: not part of this capability. Belongs to a future "session save/load" slice.
