## Why

Today the timeline renders at a single hardcoded horizontal density (`DEFAULT_PX_PER_BEAT = 88`). DJ-action editing and piano-roll work both require zooming in to see 16th-note placement and zooming out to plan whole sets, but neither is possible — users have to scroll across a fixed-density timeline or live with subdivisions that are too coarse or too dense for the current task. Every DAW we've checked (Ableton, Logic, Reaper, Pro Tools) treats horizontal time zoom as a primary navigation gesture; midirec needs to match that baseline so the timeline scales from "the whole set fits in the viewport" to "I can grab the head of an 8th note."

## What Changes

- Introduce a dynamic `pxPerBeat` view state on `useStage` (default still `88`), threaded through the existing `pxPerTick` plumbing so every consumer (Ruler, PianoRoll, ParamLane, DJActionTrack, DJValueEditor) honors the active zoom.
- Add three input gestures, all owned by `AppShell`:
  - **Wheel + Cmd/Ctrl** (and macOS pinch, which the platform synthesises with `ctrlKey: true`) — mouse-anchored zoom; the beat under the cursor keeps its on-screen X.
  - **Keyboard `+` / `-` / `0`** — playhead-anchored zoom-in/-out (falls back to viewport center when the playhead is off-screen); `0` fits the session to the viewport.
  - **Toolstrip `−` / `Fit` / `+`** — same three actions exposed as buttons so the gesture is discoverable.
- Adaptive ruler subdivisions tied to the active `pxPerBeat`: phrases/bars when very zoomed out, beats at default density, 8ths and 16ths as the user zooms in.
- Persist `pxPerBeat` as part of the saved session via the existing `timeline-storage` payload, clamped to the supported range on hydrate.
- Zoom range is `[2, 2000]` px/beat, applied exponentially so each wheel notch scales by a constant factor.

## Capabilities

### New Capabilities

- `timeline-zoom`: Requirements for `pxPerBeat` state ownership, the gesture-to-anchor mapping, scroll preservation math, and the zoom range / persistence contract.

### Modified Capabilities

- `app-shell`: `.mr-timeline` now hosts wheel and keyboard gesture handlers; the timeline inner width derivation uses the live `stage.pxPerBeat` instead of the hardcoded constant; horizon expansion re-runs on zoom changes.
- `ruler`: subdivision density adapts to `pxPerBeat` (phrases/bars/beats/8ths/16ths/32nds chosen by px-per-beat thresholds) rather than being tied solely to ruler thinning on horizon size.
- `session-model`: the persistable session surface gains `pxPerBeat`.
- `timeline-storage`: `TimelinePayload.session` carries `pxPerBeat` and the codec round-trips it; missing / out-of-range values clamp to defaults on hydrate.

## Impact

- **Code**: `src/hooks/useStage.tsx`, `src/components/shell/AppShell.tsx`, `src/components/ruler/Ruler.tsx`, `src/components/toolstrip/Toolstrip.tsx`, `src/components/dj-value-editor/DJValueEditor.tsx` (three module-scope `DEFAULT_PX_PER_BEAT` readers switch to dynamic), new `src/session/timelineZoom.ts` with the pure helpers (`clampPxPerBeat`, `zoomAroundAnchor`, `fitPxPerBeat`, `chooseRulerSubdivision`).
- **Data**: `TimelinePayload.session` adds a single number field `pxPerBeat`. Schema version does NOT bump because the field is optional on load (missing → default `88`); writers always emit it.
- **Dependencies**: None.
- **Systems**: Browser-only; no MIDI-side behavior changes (per the MIDI-first constraint).
