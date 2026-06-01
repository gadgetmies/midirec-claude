## Context

Today `DEFAULT_PX_PER_BEAT = 88` is the single source of horizontal density. It is read at module scope from `PianoRoll.tsx` by `AppShell.tsx`, `DJValueEditor.tsx`, and `Ruler.tsx`, then fed through `pxPerTickFromPxPerBeat(pxPerBeat, tpq) = pxPerBeat / tpq` into every renderer that maps integer-tick datums to pixels. The existing `viewProps` already carries `pxPerTick`, so the rendering pipeline is already parameterised — the missing piece is a stateful, gesture-driven source for `pxPerBeat`.

The DAW reference we're matching is the Ableton/Logic/Reaper family: mouse-anchored zoom on Cmd/Ctrl-wheel, keyboard zoom anchored to the playhead, and `0` as fit-session. Pro Tools' playhead-anchored default loses too much locality when wheel-zooming over a specific note, which is the most common case for piano-roll work, so we don't follow it for the mouse gesture.

Constraints from this codebase:

- MIDI-first; no audio side-effects from zoom (already a no-op concern, but recorded so future incarnations don't accidentally play scrub sounds).
- Channel routing is governed by MIDI mapping (not click); zoom must never claim a click handler that interferes with the channel routing UX.
- ASCII-only labels in any user-facing strings we introduce (no Greek letters in mode labels, etc.).

## Goals / Non-Goals

**Goals:**

- Dynamic horizontal zoom (`pxPerBeat`) with a default that exactly matches today's behaviour (88).
- Three gestures: wheel + Cmd/Ctrl (incl. macOS pinch), keyboard `+`/`-`/`0`, toolstrip `−`/`Fit`/`+`.
- Gesture-aware anchor: wheel anchors on the cursor, keyboard/toolstrip on the playhead (or viewport center when playhead is off-screen).
- Persistence: `pxPerBeat` survives save/load via `timeline-storage`.
- Adaptive ruler subdivisions so phrase/bar/beat/8th/16th density tracks the active zoom.
- Exponential range `[2, 2000]` px/beat — about 5.6 decades, more than any single DAW exposes via direct gesture.

**Non-Goals:**

- Vertical / pitch zoom on the piano roll. Covered separately by the BACKLOG item "Piano-roll 2-octave visible viewport"; do not conflate.
- Per-track or per-region zoom (Ableton's clip view). One global timeline zoom.
- Time signature changes via zoom (subdivisions are purely visual; `BEATS_PER_BAR = 4` stays).
- Smooth animation of `scrollLeft` on zoom. We assign `scrollLeft` synchronously — matches `prefers-reduced-motion` for free, and DAWs that animate it (Logic) introduce visible lag we don't want.
- Snap-to-musical-zoom-stops (e.g., "this zoom is exactly 1 bar = 200px"). Free-continuous matches Ableton; we can layer snap stops later if users ask.

## Decisions

1. **Zoom state lives on `useStage`.**
   - **Choice**: Add `pxPerBeat: number` and `setPxPerBeat(next: number): void` to `useStage`. Default `88`. Threaded into existing `viewProps` so renderers see it via the path they already use.
   - **Rationale**: `useStage` already owns view state that `AppShell` reads and that participates in `useTimelineStorage` hydration via the loop-region slice. Adding `pxPerBeat` there matches existing patterns. Putting it on `useTransport` would conflate view geometry with transport; on a new `useZoom` provider would create unjustified plumbing for a single number.
   - **Alternative considered**: a dedicated `useZoom` hook — rejected as over-engineered for one scalar with the same lifecycle as `loopRegion`.

2. **Gesture-aware anchor (hybrid).**
   - **Choice**: Wheel/pinch anchors to `event.clientX`. Keyboard `+`/`-` anchors to the playhead if visible, otherwise viewport center. Keyboard `0` is fit-session (sets `scrollLeft = 0` and `pxPerBeat = fitPxPerBeat(...)`). Toolstrip `−`/`+` use the same anchor as keyboard `+`/`-`; toolstrip `Fit` uses the same logic as keyboard `0`.
   - **Rationale**: Matches Ableton/Logic/Reaper. Mouse-anchored is the most intuitive when you're pointing at something; playhead-anchored is most useful during playback or when navigating via keyboard with no cursor over the timeline.
   - **Alternative**: Always mouse-anchor — rejected because keyboard zoom has no meaningful cursor position. Always playhead-anchor — rejected because wheel zoom over a note would slide the note out from under the pointer.

3. **Range `[2, 2000]` px/beat, exponential.**
   - **Choice**: `clampPxPerBeat` floors at 2 (a 16-beat phrase = 32px, useful for "fit a 20-minute set into 800px") and caps at 2000 (a beat at 2000px shows 32nd-note resolution). Wheel notch scales by `exp(-deltaY * WHEEL_ZOOM_FACTOR_PER_LINE)`; tuned so a typical trackpad pinch lands ~1.15x per tick and a hardware wheel notch lands ~1.2x.
   - **Rationale**: Linear stepping feels useless at the extremes (going from 800→801 px/beat is invisible). Exponential mapping gives the same perceived rate of change across the whole range.
   - **Alternative**: Discrete snap stops (Reaper-style preset list). Rejected — too rigid for piano-roll micro-edits. We may layer snap stops later as `Shift+wheel` if users ask.

4. **Anchor-preserving scroll math is pure.**
   - **Choice**: `zoomAroundAnchor(prev, next, anchorPx, scrollLeft, keysColW) → { nextScrollLeft }` lives in `src/session/timelineZoom.ts`. `AppShell` reads `scrollLeft` from the timeline ref, computes `nextScrollLeft`, calls `stage.setPxPerBeat(next)`, then assigns `scrollLeft` synchronously in the same event-handler tick.
   - **Rationale**: React doesn't touch `scrollLeft` between renders; setting it in the same tick before the commit lands on the new geometry without flicker.
   - **Alternative**: `useLayoutEffect` to set `scrollLeft` after the render — rejected because it creates a visible one-frame jump when zoom-out crosses the previous scrollLeft.

5. **Horizon expansion participates in zoom.**
   - **Choice**: `clampAndExpandHorizon`'s `useCallback` adds `stage.pxPerBeat` to its closure and `useLayoutEffect`'s dependency list. Zooming out grows the layout horizon to cover the now-wider viewport.
   - **Rationale**: Today `clampAndExpandHorizon` only fires on `onScroll`, which doesn't fire from a zoom alone. Without this, zooming out from a session that exactly fits would leave a black sliver to the right of the rightmost note.

6. **Adaptive ruler subdivisions.**
   - **Choice**: `chooseRulerSubdivision(pxPerBeat)` returns the tick interval and label cadence: `< 12` → phrases only; `[12, 176)` → beats; `[176, 352)` → 8ths; `[352, 800)` → 16ths; `>= 800` → 32nds. Bars/phrases continue to render at every 4/16 beats regardless (they survive thinning today; that invariant carries over).
   - **Rationale**: Each threshold is the px-per-beat at which the *next* subdivision is at least ~22px apart — readable label / tick spacing.
   - **Alternative**: Tie subdivisions to time signature instead of pxPerBeat — out of scope (we don't have variable time signatures yet) and would conflate visual density with musical meaning.

7. **Persistence: include `pxPerBeat`, do NOT bump `STORAGE_SCHEMA_VERSION`.**
   - **Choice**: `serializeTimeline` writes `pxPerBeat`; `deserializeTimeline` reads it; missing or non-finite values fall back to `DEFAULT_PX_PER_BEAT` on hydrate. The codec line carrying it lives on the `transport` JSONL line or a new dedicated `view` line; preference is `view` to keep the transport slice unchanged.
   - **Rationale**: Schema bump would break older saves' compatibility check needlessly — the field is backward-compatible since absence is well-defined. Treating it as a `view` slice keeps it semantically separate from transport-authoring fields.
   - **Alternative**: Bump version to 2 — rejected as gratuitous.

8. **Anchor on keys column is safe.**
   - **Choice**: `zoomAroundAnchor` clamps `anchorPx` to `>= KEYS_COLUMN_WIDTH`. When the user wheels over the fixed left column there's no beat under them; clamp anchors to "beat 0 stays put."
   - **Rationale**: Avoids negative scrollLeft and the awkward "the column floats away" effect.

9. **Focus guard for keyboard zoom.**
   - **Choice**: The `keydown` listener bails when `event.target` is `INPUT`, `TEXTAREA`, `SELECT`, or `[contenteditable]`, and when `event.metaKey || event.ctrlKey || event.altKey` is true.
   - **Rationale**: `+`/`-` are extremely common in text input; we must not intercept them there. Modifier-laden combinations belong to other shortcuts.

## Risks / Trade-offs

- **[Risk]** Existing pixel-position tests that assume `pxPerBeat === 88` could fail if they pick up a non-default zoom from a loaded fixture. **Mitigation**: Default stays 88; hydrate clamps; no test fixture today persists `pxPerBeat`.
- **[Risk]** Wheel handler intercepting `ctrlKey` could block accidental Ctrl-scroll users were relying on. **Mitigation**: We `preventDefault` only when the wheel target is `.mr-timeline`; vertical scroll without Cmd/Ctrl falls through.
- **[Risk]** Zoom-during-playback fights the follow-playhead effect. **Mitigation**: Documented behavior — manual zoom takes one frame, follow re-engages on the next tick. Matches Ableton.
- **Trade-off**: Free-continuous zoom over snap stops — better for micro-edits, worse for "I want exactly N bars on screen." Acceptable for v1.
- **Trade-off**: One global zoom (no per-track). Simpler state, matches Ableton arrangement view. If users ask for per-track piano-roll zoom (Logic-style), it's an additive feature.

## Migration Plan

1. Land `src/session/timelineZoom.ts` with pure helpers and unit tests (no consumers yet).
2. Add `pxPerBeat` + `setPxPerBeat` to `useStage`, default 88, with hydrate slice.
3. Switch every module-scope `DEFAULT_PX_PER_BEAT` read to `stage.pxPerBeat`: `AppShell.tsx` (3 sites), `DJValueEditor.tsx` (3 sites). `Ruler.tsx` already takes a prop default — pass `stage.pxPerBeat` from `AppShell`.
4. Add gesture handlers in `AppShell.tsx` (wheel + keyboard) and toolstrip buttons in `Toolstrip.tsx`.
5. Extend `timeline-storage` codec to round-trip `pxPerBeat`; add hydrate clamp.
6. Update ruler to call `chooseRulerSubdivision(pxPerBeat)`; preserve phrase/bar emphasis.
7. Rollback path: feature is gated by `stage.setPxPerBeat` existing; if disabled, the constant default keeps current behavior.

## Open Questions

- Should `Shift+wheel` be reserved for a future "snap to musical zoom stops" mode, or claimed now by horizontal scroll (it's currently unbound on this platform)? **Default**: leave unbound — revisit if users complain.
- Should the Toolstrip surface the current zoom as a numeric readout ("88 px/beat" or "1 bar = 352px")? **Default**: no — buttons only. Numeric readouts invite drag-to-edit which complicates the contract.
- Should `0` (fit-session) be `Cmd+0` instead, to free `0` for a future "go to beat 0" shortcut? **Default**: keep `0` — matches Ableton; "go to start" can use Home.
