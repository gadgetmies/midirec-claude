## Context

`.mr-timeline` is the single shared horizontal scroll container that hosts the Ruler, all channel groups, all param lanes, and all dj-action-tracks (see `app-shell` capability). Its `scrollLeft` is currently only mutated by:
- The browser, in response to user scroll/wheel/touch input, and
- The existing `clampTimelineScroll` helper in `src/session/layoutHorizon.ts` (called from `AppShell`'s `onScroll`/resize/horizon effects) which forces `scrollLeft >= 0`.

The playhead is rendered inside each `<PianoRoll>` at `left: (playheadTicks - viewT0Ticks) * pxPerTick` within `.mr-roll__lanes`. `.mr-roll__lanes` is positioned to the right of the sticky `.mr-keys` column inside `.mr-timeline__inner`, which has total intrinsic width `KEYS_COLUMN_WIDTH + layoutHorizonTicks * pxPerTick`. So the playhead's pixel offset relative to `.mr-timeline__inner`'s left edge is `KEYS_COLUMN_WIDTH + playheadTicks * pxPerTick` (with `viewT0Ticks: 0` per `AppShell.tsx:83`).

The `useTransport()` hook exposes `mode: 'idle' | 'play' | 'record'` and the rAF-driven `timecodeMs`, from which `stage.playheadTicks` is derived (see `session-model` "Clock-driven playback" requirement and `useStage`).

## Goals / Non-Goals

**Goals:**
- While `mode === 'play'` or `mode === 'record'`, keep the playhead in the **left half** of `.mr-timeline`'s visible viewport.
- Trigger and write are cheap enough to run on every playhead change (effectively every rAF tick).
- Logic is a pure function for ease of testing.
- Respect the existing `scrollLeft >= 0` clamp; do not seek past the layout horizon.

**Non-Goals:**
- No smooth-scroll animation; auto-scroll is a direct `scrollLeft` assignment to match the rAF cadence.
- No "follow toggle" UI in this slice — the behavior is always on while playing/recording.
- No vertical follow (the playhead is full-height; vertical follow is meaningless here).
- No change to how the playhead is rendered inside `<PianoRoll>`, nor to `viewT0Ticks` semantics.
- No change to user scroll handling while `mode === 'idle'`.
- No change to layout-horizon expansion logic; the existing `clampAndExpandHorizon` continues to grow the horizon as the viewport's right edge advances.

## Decisions

### Decision 1: Trigger location — `AppShell.tsx` `useLayoutEffect` keyed on `mode` and `playheadTicks`

The only component holding a ref to `.mr-timeline` is `AppShell`. It already mutates `scrollLeft` via `clampTimelineScroll`. We add a sibling `useLayoutEffect` that, when `mode` is `'play'` or `'record'`, computes the desired `scrollLeft` and assigns it. Using `useLayoutEffect` keeps the write synchronous with the paint that renders the new playhead position, avoiding a one-frame visible lag.

**Alternative considered:** Subscribe to `useTransport` inside `PianoRoll` and have it call `scrollIntoView` on the playhead element. Rejected — `PianoRoll` is rendered once per channel, so we'd have N components racing to mutate the same shared scroll container, and `scrollIntoView` doesn't express the "stay in left half" rule cleanly.

### Decision 2: Pure helper for the math

Add a pure function in `src/session/layoutHorizon.ts` (it already owns timeline-scroll math like `clampTimelineScroll` and `horizonStripeExtentTicksForViewport`):

```ts
export function followPlayheadScrollLeft(
  playheadTicks: number,
  pxPerTick: number,
  keysColumnWidth: number,
  scrollLeft: number,
  clientWidth: number,
): number | null
```

Returns the new `scrollLeft` to assign, or `null` when no update is needed. The rule:

1. Compute `playheadPx = keysColumnWidth + playheadTicks * pxPerTick`.
2. Compute `threshold = scrollLeft + clientWidth / 2`.
3. If `playheadPx <= threshold`, return `null` (already in left half or to the left of viewport — see Decision 4).
4. Otherwise, return `max(0, playheadPx - clientWidth / 2)`.

Unit-testable; no DOM dependency.

### Decision 3: Trigger only on `play` and `record`, not `idle`

`useTransport().mode === 'idle'` covers both paused and stopped states. While idle, the user is free to scroll horizontally to inspect any region of the timeline; the playhead is either at `0` (stopped) or frozen at a paused position, and we MUST NOT yank `scrollLeft` either way.

### Decision 4: Asymmetric rule — only pull viewport rightward

We auto-scroll when the playhead is in the right half (or beyond the right edge), but we do NOT auto-scroll the viewport leftward when the playhead is to the left of the visible area. This matches the literal proposal ("does not enter the right half") and avoids fighting users who scroll back to inspect earlier material while playback continues forward. The playhead leaving the left side of the viewport is acceptable; the next forward tick will eventually pull the viewport again once it re-enters and crosses the right-half threshold.

Loop wrap (where `playheadTicks` jumps backward inside the loop region) is handled correctly by this rule: after the wrap, the playhead is back in the left half so no scroll happens; the next forward advance through the loop region eventually crosses the right-half threshold and triggers a scroll again — same behavior as the first pass through the loop.

### Decision 5: No throttling beyond React's rAF-aligned effect cadence

`stage.playheadTicks` updates ~every rAF (60 Hz). A `useLayoutEffect` keyed on `playheadTicks` runs at the same cadence; the work inside it is O(1) math and at most one `scrollLeft` write. No `requestAnimationFrame` wrapping or debouncing is needed.

## Risks / Trade-offs

- **User mid-playback scroll is overridden** → Acceptable per the proposal's intent (auto-scroll is the feature). If the user scrolls right past the playhead during playback, the playhead re-entering the right half will pull the viewport back to keep the playhead at the left-half mark. Documented in design Decision 4 so it doesn't surprise reviewers. Future: a "follow toggle" could opt out; out of scope here.
- **Auto-scroll fighting layout-horizon expansion** → `clampAndExpandHorizon` is wired to `.mr-timeline.onScroll`, so each auto-scroll write triggers a horizon recompute. This is the same code path that already runs on user scroll, so behavior is consistent. Mitigation: the existing margin (`SCROLL_EXTENSION_MARGIN_BEATS`) already grows the horizon ahead of the right edge.
- **Sub-pixel jitter** → `scrollLeft` is rounded to whole pixels by the browser. The math uses fractional pixels, but a stable playhead motion produces a stable `scrollLeft` sequence (monotonically non-decreasing during forward playback). No jitter expected.
- **Recording with no playhead motion** → If `mode === 'record'` but `playheadTicks` does not advance (e.g. transport-clock paused while recording UI is staged — not currently a real state), the effect is a no-op. Safe.

## Migration Plan

No migration required. Behavior is purely additive; existing sessions and selections are unaffected.
