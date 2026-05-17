## Why

During playback and recording, the playhead can advance off the visible timeline (or sit close to the right edge), forcing the user to manually scroll to follow the music. We want the playhead to stay comfortably in view — specifically, never to enter the right half of the visible timeline — so the user always has at least half a viewport of upcoming musical time visible while the transport is running.

## What Changes

- Add a new follow behavior on `.mr-timeline`: while the transport is in `'play'` or `'record'` mode, the container's `scrollLeft` SHALL be auto-adjusted so the playhead's pixel position stays in the left half of the visible timeline viewport.
- The follow trigger SHALL be based on the playhead pixel position relative to `.mr-timeline.scrollLeft` and `.mr-timeline.clientWidth`. When the playhead's viewport-relative X would exceed `clientWidth / 2`, `scrollLeft` is advanced so the playhead lands exactly at the half-viewport mark.
- The behavior SHALL be inactive when the transport is `'idle'` (paused or stopped) so user-initiated horizontal scrolling is preserved between play sessions.
- Auto-scroll SHALL respect the existing `scrollLeft >= 0` clamp from `app-shell` and SHALL NOT extend `scrollLeft` past the layout horizon's right edge (existing layout-horizon expansion still drives the underlying width growth).
- Recording is treated the same as playing for the purposes of follow.

## Capabilities

### New Capabilities
- `playhead-follow`: auto-scrolls `.mr-timeline` horizontally while the transport is playing or recording so the playhead stays in the left half of the visible timeline viewport.

### Modified Capabilities

None. The existing `app-shell` requirement that programmatic `.mr-timeline.scrollLeft` adjustments are clamped to `>= 0` already accommodates the auto-scroll writes — no requirement-level change is needed there.

## Impact

- Code: `src/components/shell/AppShell.tsx` (the only place that owns a ref to `.mr-timeline` and already mutates `scrollLeft` via `clampTimelineScroll`) gains a new effect that watches `useTransport().mode` and `stage.playheadTicks` and writes `scrollLeft` when the right-half threshold is crossed.
- Possibly a small pure helper in `src/session/layoutHorizon.ts` (or a sibling module) for the math: given `(playheadTicks, pxPerTick, scrollLeft, clientWidth, keysColumnWidth)` → optional new `scrollLeft`. Pure, easy to unit-test.
- No changes to `useTransport`, `useStage`, `PianoRoll`, or the layout-horizon expansion logic.
- No new persisted state; the behavior is purely a side effect of `mode` + `playheadTicks` and the viewport geometry.
