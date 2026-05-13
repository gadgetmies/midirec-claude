## Why

The timeline’s horizontal canvas is capped at `totalT × pxPerBeat` (today `TOTAL_T = 16`), so playback and arranging cannot meaningfully extend into later bars—the user hits a hard wall at the fourth bar boundary. Musical time should grow with the session: the ruler and every row should stay aligned while the viewport scrolls, with the session origin (beat `0`) fixed as the deepest left anchor and arbitrarily long continuation to the right.

## What Changes

- Introduce a **content horizon** in beats wider than any fixed demo window—derived from recorded material, programmatic extent, or a deliberately large minimum—with the shared `.mr-timeline__inner` width matching so horizontal scrolling never runs out prematurely.
- **Clamp horizontal scroll**: `.mr-timeline`’s horizontal `scrollLeft` SHALL NOT allow the user to scroll “past” the session origin to the left (no negative beats or spacer revealed before beat `0`; minimum `scrollLeft` is `0`).
- Preserve the **single shared horizontal axis** across Ruler, channel rolls, param lanes, and DJ tracks; only the nominal right edge moves as the horizon expands.
- Ruler ticking and downstream renderers MAY need to avoid rendering one tick per beat for arbitrarily large spans (optimization left to design); behavior for visible labels MUST remain coherent with existing bar.beat wording.

## Capabilities

### New Capabilities

- *(none — behavior extends existing timeline session model)*

### Modified Capabilities

- **`app-shell`**: Timeline inner width and horizontal scroll semantics (origin clamp + unbounded/right-growing content).
- **`session-model`**: Clarify distinction between visible window (`totalT`), session origin clamp, and extending content horizon to the right.
- **`ruler`**: Requirement that ruler width and ticks track the timeline content width and observed time range consistent with PianoRoll/AppShell wiring.
- **`piano-roll`**, **`tracks`**, **`param-lanes`**, **`dj-action-tracks`** ( **`channels`** as orchestrator where needed): Rows and plots use the shared content width / beat horizon so stripes, playhead, minimaps, and DJ lanes stay coherent with ruler.

## Impact

- `AppShell.tsx` (`.mr-timeline__inner` width, scroll listener or ref clamp), `AppShell.css` if structural tweaks are needed.
- `useStage.tsx` / `useChannels.ts`: replace or complement fixed `TOTAL_T` as sole width driver with horizon derived from channels, lanes, DJ data, plus padding; expose values consumed by ruler and tracks.
- `Ruler.tsx`, `PianoRoll.tsx`, `ParamLane.tsx`, minimaps, `ActionRoll.tsx`, `ChannelGroup.tsx`, `DJActionTrack.tsx` as prop consumers if width/beat-range inputs change shape.
- OpenSpec deltas under `openspec/changes/timeline-horizontal-infinite-scroll/specs/` for listed capabilities.
