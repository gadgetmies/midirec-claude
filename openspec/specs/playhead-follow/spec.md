# playhead-follow Specification

## Purpose
TBD - created by archiving change playhead-auto-scroll. Update Purpose after archive.
## Requirements
### Requirement: Timeline auto-scrolls to keep playhead in left half during play and record

While `useTransport().mode === 'play'` OR `useTransport().mode === 'record'`, `AppShell` SHALL keep the playhead's pixel position within the left half of `.mr-timeline`'s visible viewport by writing to `.mr-timeline.scrollLeft`.

Concretely, on every change to `stage.playheadTicks` (which advances at the rAF cadence of `useTransport`'s internal clock) AppShell SHALL evaluate:

- `playheadPx = KEYS_COLUMN_WIDTH + stage.playheadTicks * pxPerTick`, where `pxPerTick = pxPerTickFromPxPerBeat(DEFAULT_PX_PER_BEAT)` (the same `pxPerTick` AppShell already uses to size `.mr-timeline__inner`).
- `viewportHalfPx = .mr-timeline.scrollLeft + .mr-timeline.clientWidth / 2`.

WHEN `playheadPx > viewportHalfPx`, AppShell SHALL assign `.mr-timeline.scrollLeft = max(0, playheadPx - .mr-timeline.clientWidth / 2)`. WHEN `playheadPx <= viewportHalfPx`, AppShell SHALL NOT modify `scrollLeft` (the playhead is already in the left half, or to the left of the visible viewport; the auto-scroll rule pulls the viewport rightward only).

The write SHALL happen in a `useLayoutEffect` synchronous with the React commit that renders the new playhead position, so the playhead's visual position and the viewport's scroll position are updated in the same paint.

The auto-scroll write is subject to the existing `app-shell` clamp (`scrollLeft >= 0`); the `max(0, ...)` in the rule above also enforces this directly.

#### Scenario: Playhead crossing right-half threshold while playing scrolls viewport

- **GIVEN** `useTransport().mode === 'play'`
- **AND** `.mr-timeline.clientWidth === 1000`, `.mr-timeline.scrollLeft === 0`, `KEYS_COLUMN_WIDTH === 56`, and `pxPerTick` such that the previous tick's playhead was at `playheadPx === 500` (exactly at the half-viewport mark)
- **WHEN** the next playhead update produces `playheadPx === 600` (past the half-viewport mark)
- **THEN** `.mr-timeline.scrollLeft` SHALL be assigned `100` (= `600 - 1000/2`)
- **AND** the playhead's viewport-relative X SHALL therefore be `500` (exactly at the half-viewport mark again)

#### Scenario: Playhead crossing right-half threshold while recording scrolls viewport

- **GIVEN** `useTransport().mode === 'record'`
- **AND** `.mr-timeline.clientWidth === 800`, `.mr-timeline.scrollLeft === 200`
- **WHEN** a playhead update produces `playheadPx === 650` (viewport-relative X `= 650 - 200 = 450`, which is past `800/2 = 400`)
- **THEN** `.mr-timeline.scrollLeft` SHALL be assigned `250` (= `650 - 800/2`)

#### Scenario: Playhead in left half does not move viewport

- **GIVEN** `useTransport().mode === 'play'`
- **AND** `.mr-timeline.clientWidth === 1000`, `.mr-timeline.scrollLeft === 400`
- **WHEN** a playhead update produces `playheadPx === 700` (viewport-relative X `= 300`, which is less than `1000/2 = 500`)
- **THEN** `.mr-timeline.scrollLeft` SHALL remain `400` (no auto-scroll write)

#### Scenario: Playhead to the left of viewport does not pull viewport back

- **GIVEN** `useTransport().mode === 'play'`
- **AND** `.mr-timeline.clientWidth === 1000`, `.mr-timeline.scrollLeft === 2000` (user scrolled forward to inspect a later region)
- **WHEN** a playhead update produces `playheadPx === 800` (well to the left of the visible viewport at `[2000, 3000]`)
- **THEN** `.mr-timeline.scrollLeft` SHALL remain `2000`
- **AND** the auto-scroll rule SHALL NOT pull the viewport leftward to follow

#### Scenario: Auto-scroll is inactive while transport is idle

- **GIVEN** `useTransport().mode === 'idle'` (after `stop()` or `pause()`)
- **WHEN** `stage.playheadTicks` changes (e.g. via `seek()` or a remount that re-derives the value from `timecodeMs`)
- **THEN** `.mr-timeline.scrollLeft` SHALL NOT be modified by the playhead-follow effect
- **AND** any prior user-authored `scrollLeft` SHALL be preserved

#### Scenario: Auto-scroll respects scrollLeft >= 0 clamp

- **GIVEN** `useTransport().mode === 'play'`, `.mr-timeline.clientWidth === 1000`, and a playhead at `playheadPx === 200`
- **WHEN** the playhead-follow rule is evaluated
- **THEN** because `playheadPx <= scrollLeft + clientWidth/2` for any `scrollLeft >= 0`, no write occurs
- **AND** even if the rule were forced to compute `playheadPx - clientWidth/2 = -300`, the `max(0, ...)` clamp SHALL bound the result to `0`

#### Scenario: Loop wrap leaves viewport unchanged at wrap moment

- **GIVEN** `useTransport().mode === 'play'` with an active loop region whose end is at `playheadPx === 2000`
- **AND** the viewport's `scrollLeft === 1700`, `clientWidth === 1000` (so half-viewport mark is at `playheadPx === 2200`)
- **WHEN** the loop wraps and `stage.playheadTicks` jumps backward so `playheadPx` resets to `1000`
- **THEN** the playhead-follow rule SHALL NOT modify `scrollLeft` on the wrap tick (`playheadPx <= viewportHalfPx` after the wrap)
- **AND** subsequent forward playback through the loop SHALL trigger auto-scroll again the next time `playheadPx` crosses `scrollLeft + clientWidth/2`

### Requirement: followPlayheadScrollLeft helper is a pure function exported from layoutHorizon

The codebase SHALL expose a pure function `followPlayheadScrollLeft(playheadTicks: number, pxPerTick: number, keysColumnWidth: number, scrollLeft: number, clientWidth: number): number | null` from `src/session/layoutHorizon.ts`. The function SHALL return:

- `null` when `keysColumnWidth + playheadTicks * pxPerTick <= scrollLeft + clientWidth / 2` (no update needed).
- `Math.max(0, keysColumnWidth + playheadTicks * pxPerTick - clientWidth / 2)` otherwise.

The function SHALL NOT touch the DOM, read React state, or import non-pure modules. `AppShell.tsx`'s playhead-follow effect SHALL be the only call site in production code (tests MAY call it directly).

#### Scenario: Helper returns null when playhead is in left half

- **WHEN** `followPlayheadScrollLeft(playheadTicks=100, pxPerTick=4, keysColumnWidth=56, scrollLeft=0, clientWidth=1000)` is called (so `playheadPx = 56 + 400 = 456`, which is `<= 0 + 500`)
- **THEN** the return value SHALL be `null`

#### Scenario: Helper returns scrollLeft target when playhead is past half-viewport

- **WHEN** `followPlayheadScrollLeft(playheadTicks=200, pxPerTick=4, keysColumnWidth=56, scrollLeft=0, clientWidth=1000)` is called (so `playheadPx = 56 + 800 = 856`, which is `> 0 + 500`)
- **THEN** the return value SHALL be `856 - 500 = 356`

#### Scenario: Helper never returns a negative scrollLeft

- **GIVEN** any inputs where `clientWidth >= 0`, `keysColumnWidth >= 0`, `pxPerTick > 0`, and `playheadTicks >= 0`
- **WHEN** `followPlayheadScrollLeft` returns a non-null value
- **THEN** the return value SHALL be `>= 0` (the `Math.max(0, ...)` clamp guarantees this even if `clientWidth / 2 > playheadPx`)

#### Scenario: Helper handles small viewport with playhead near the left

- **WHEN** `followPlayheadScrollLeft(playheadTicks=50, pxPerTick=4, keysColumnWidth=56, scrollLeft=0, clientWidth=300)` is called (so `playheadPx = 56 + 200 = 256`, half-viewport mark `= 150`, `256 > 150`)
- **THEN** the return value SHALL be `106` (= `256 - 150`)

