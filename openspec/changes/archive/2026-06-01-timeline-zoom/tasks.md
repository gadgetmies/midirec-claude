## 1. Pure zoom math module

- [x] 1.1 Create `src/session/timelineZoom.ts` exporting `MIN_PX_PER_BEAT = 2`, `MAX_PX_PER_BEAT = 2000`, `DEFAULT_PX_PER_BEAT = 88` (move from `PianoRoll.tsx`; re-export from `PianoRoll.tsx` for back-compat with existing imports/tests), `WHEEL_ZOOM_FACTOR_PER_LINE`, `clampPxPerBeat`, `zoomAroundAnchor`, `fitPxPerBeat`, `chooseRulerSubdivision`.
- [x] 1.2 Unit tests `src/session/timelineZoom.test.ts`: clamp bounds + NaN + Infinity; anchor-preserving round-trip within ±0.5 px; left-edge / keys-column anchor cases; `fitPxPerBeat` on empty/tiny session; `chooseRulerSubdivision` boundary tests + monotonicity.

## 2. Stage state for zoom

- [x] 2.1 Add `pxPerBeat: number` (default `DEFAULT_PX_PER_BEAT`) and `setPxPerBeat(next: number): void` to `useStage`; clamp via `clampPxPerBeat`; no-op when equal to current.
- [x] 2.2 Extend `useStage`'s hydrate slice to include `pxPerBeat`; clamp on load; default when missing or non-finite (`console.warn` on non-finite).
- [x] 2.3 Tests in `src/hooks/useStage.zoom.test.tsx` (default value, clamp on `setPxPerBeat`, no-op when unchanged) and extend `useStage.hydrate.test.tsx` (missing → default, out-of-range → clamp, NaN → default + warn).

## 3. Thread `pxPerBeat` to consumers

- [x] 3.1 `AppShell.tsx`: replace the three `DEFAULT_PX_PER_BEAT` readers (lines 39, 59, 183) with `stage.pxPerBeat`; pass into `viewProps` (already carries `pxPerTick`); pass to `<DJActionTrack pxPerBeat={stage.pxPerBeat}>` and `<Ruler pxPerBeat={stage.pxPerBeat}>`.
- [x] 3.2 `clampAndExpandHorizon`: add `stage.pxPerBeat` to its closure and useLayoutEffect deps so zoom changes trigger horizon recomputation.
- [x] 3.3 `DJValueEditor.tsx`: replace the three `pxPerTickFromPxPerBeat(DEFAULT_PX_PER_BEAT)` reads (lines 360, 627, 714) with the live value from `useStage`.

## 4. Wheel/pinch zoom on the timeline

- [x] 4.1 In `AppShell.tsx` (or a co-located `useTimelineZoomGestures` hook), attach a `wheel` listener to the `.mr-timeline` element with `{ passive: false }`; bail when `!event.ctrlKey && !event.metaKey`.
- [x] 4.2 Compute `nextPxPerBeat = clampPxPerBeat(prev * Math.exp(-event.deltaY * WHEEL_ZOOM_FACTOR_PER_LINE))`, anchor on `max(event.clientX - timelineRect.left, KEYS_COLUMN_WIDTH)`; call `zoomAroundAnchor`; `event.preventDefault()`; `stage.setPxPerBeat(next)`; assign `timelineRef.current.scrollLeft = nextScrollLeft`.
- [x] 4.3 Tests in `AppShell.zoom.test.tsx`: wheel + ctrlKey changes zoom AND preserves beat-under-cursor X; wheel without modifier does not zoom; wheel over keys column clamps without producing negative scrollLeft.

## 5. Keyboard zoom

- [x] 5.1 Attach a `keydown` listener to `window` in `AppShell.tsx`; bail when target is editable (`INPUT`, `TEXTAREA`, `SELECT`, `[contenteditable]`) or when `event.metaKey || event.ctrlKey || event.altKey`.
- [x] 5.2 Bindings: `+` / `=` → zoom in 1.2x; `-` → zoom out 1.2x; `0` → fit-session (set `pxPerBeat = fitPxPerBeat(layoutHorizonTicks, viewportPx, KEYS_COLUMN_WIDTH, DEFAULT_MIDI_TPQ)` and `scrollLeft = 0`).
- [x] 5.3 Anchor for `+`/`-`: playhead's X if `0 <= playheadX <= viewportPx`, else viewport center.
- [x] 5.4 Tests: `+` zooms with playhead anchor when visible; `+` with playhead off-screen uses center; `0` fits; `+` in a focused input is a no-op.

## 6. Toolstrip controls

- [x] 6.1 In `Toolstrip.tsx`, add three buttons (`-`, `Fit`, `+`) with `aria-label="Zoom out"`, `"Fit timeline"`, `"Zoom in"`. ASCII glyphs only (no Greek/Unicode).
- [x] 6.2 Each button calls the same handler as the equivalent keyboard binding (delegating into the gesture hook or via a stable callback on `useStage`).
- [x] 6.3 Tests in `Toolstrip.zoom.test.tsx`: each button dispatches the expected `setPxPerBeat` value; Fit calls with the fit value.

## 7. Adaptive ruler

- [x] 7.1 `Ruler.tsx`: replace the fixed `tpq` step with `chooseRulerSubdivision(pxPerBeat).ticksPerLine`; preserve phrase/bar emphasis at `beatIdx % BEATS_PER_BAR === 0` / `beatIdx % BEATS_PER_PHRASE === 0` regardless of subdivision.
- [x] 7.2 Labels render at the cadence returned by `chooseRulerSubdivision`; phrase.bar.beat format unchanged for beat-or-coarser; sub-beat labels SHALL be omitted (visual ticks only) to keep label density legible.
- [x] 7.3 Tests in `Ruler.zoom.test.tsx`: `pxPerBeat=8` renders only phrase/bar; `pxPerBeat=88` renders beats; `pxPerBeat=400` renders 8th subdivisions; phrase ticks always present.

## 8. Persistence round-trip

- [x] 8.1 Extend `TimelinePayload.session` (and the `serializeTimeline` / `deserializeTimeline` paths in `src/storage/timelinePayload.ts`) to include `pxPerBeat`.
- [x] 8.2 Extend the JSONL codec (`src/storage/timelineJsonl.ts`) with a dedicated line kind (`view`) carrying `{ pxPerBeat }`; round-trip in unit tests.
- [x] 8.3 Hydrate: missing or non-finite `pxPerBeat` → `DEFAULT_PX_PER_BEAT`; out-of-range → `clampPxPerBeat`.
- [x] 8.4 Update `timeline-storage` codec tests; add a fixture for an older payload missing `pxPerBeat` to verify graceful default.

## 9. Spec compliance and validation

- [x] 9.1 Run `npm test` — all suites green, including existing AppShell / Ruler / PianoRoll pixel-position tests (default 88 must be preserved). _(704 passing; the 6 pre-existing failures in `DJValueEditor.height.test.ts` reproduce on `main` and are unrelated to this change.)_
- [x] 9.2 Manual smoke (Visual Companion or local dev): Cmd-wheel zooms around cursor; `0` fits; reload preserves zoom; mid-playback Cmd-wheel briefly anchors then follow re-engages; ruler subdivision changes at thresholds. _(Confirmed in local dev: "Looks and feels good now.")_
- [x] 9.3 Confirm no Web Audio APIs were touched (only `src/midi/metronome.ts` may use them per project memory).
- [x] 9.4 Confirm no zoom-related UI changes the channel routing surface (channel routing remains driven by MIDI mapping; no click-to-select).
