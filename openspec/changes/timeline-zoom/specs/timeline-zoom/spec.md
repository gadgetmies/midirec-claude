# timeline-zoom Specification

## Purpose

Normative requirements for horizontal timeline zoom: state ownership, supported range, gesture-to-anchor mapping, scroll-preservation math, fit-to-session, and the contract between zoom state and the persistence layer. Vertical / pitch zoom is out of scope.

## ADDED Requirements

### Requirement: `useStage` owns `pxPerBeat` view state

`useStage` SHALL expose a numeric field `pxPerBeat` representing the current horizontal timeline density in pixels per beat, and a setter `setPxPerBeat(next: number): void`. The initial value SHALL equal `DEFAULT_PX_PER_BEAT` (the exported constant whose value is `88`). The setter SHALL apply `clampPxPerBeat(next)` (see range requirement) before storing; if the clamped value equals the current `pxPerBeat`, the setter SHALL be a no-op (no re-render).

The exported geometry constants `DEFAULT_PX_PER_BEAT`, `MIN_PX_PER_BEAT`, `MAX_PX_PER_BEAT`, the helper `clampPxPerBeat`, the helper `zoomAroundAnchor`, the helper `fitPxPerBeat`, and the helper `chooseRulerSubdivision` SHALL live in a single module `src/session/timelineZoom.ts`. Existing imports of `DEFAULT_PX_PER_BEAT` from `src/components/piano-roll/PianoRoll` SHALL continue to resolve (re-export) for backward compatibility with tests and consumers that already import from there.

#### Scenario: Stage exposes pxPerBeat and setPxPerBeat

- **WHEN** a component calls `useStage()`
- **THEN** the returned value SHALL include a numeric `pxPerBeat`
- **AND** SHALL include a function `setPxPerBeat`
- **AND** at construction `pxPerBeat` SHALL equal `DEFAULT_PX_PER_BEAT` (`88`)

#### Scenario: setPxPerBeat clamps and dedupes

- **WHEN** `setPxPerBeat(0.5)` is invoked
- **THEN** `pxPerBeat` SHALL be set to `MIN_PX_PER_BEAT` (`2`) on the next render
- **WHEN** `setPxPerBeat(99999)` is invoked
- **THEN** `pxPerBeat` SHALL be set to `MAX_PX_PER_BEAT` (`2000`)
- **WHEN** `setPxPerBeat(stage.pxPerBeat)` is invoked with the current value
- **THEN** no re-render SHALL be triggered

### Requirement: Zoom range is `[2, 2000]` px/beat applied exponentially

`MIN_PX_PER_BEAT` SHALL equal `2` and `MAX_PX_PER_BEAT` SHALL equal `2000`. `clampPxPerBeat(value)` SHALL return:

- `DEFAULT_PX_PER_BEAT` when `value` is not finite (`NaN`, `Infinity`, `-Infinity`).
- `MIN_PX_PER_BEAT` when `value < MIN_PX_PER_BEAT`.
- `MAX_PX_PER_BEAT` when `value > MAX_PX_PER_BEAT`.
- `value` otherwise.

Wheel and pinch gestures SHALL apply zoom multiplicatively as `next = clampPxPerBeat(prev * Math.exp(-event.deltaY * WHEEL_ZOOM_FACTOR_PER_LINE))`. The exported `WHEEL_ZOOM_FACTOR_PER_LINE` constant SHALL be tuned so a single hardware wheel notch (typical `deltaY ≈ ±125` in `WheelEvent.DOM_DELTA_PIXEL` mode, or `±1` in `DOM_DELTA_LINE` mode after normalisation) scales `pxPerBeat` by a factor in the range `[1.15, 1.25]`.

Keyboard `+` and `-` and toolstrip `+`/`−` buttons SHALL apply a discrete multiplicative step in the same `[1.15, 1.25]` range so step magnitude is comparable across gestures.

#### Scenario: clampPxPerBeat saturates and defaults non-finite

- **WHEN** `clampPxPerBeat(-5)` is called
- **THEN** it SHALL return `2`
- **WHEN** `clampPxPerBeat(NaN)` is called
- **THEN** it SHALL return `88`
- **WHEN** `clampPxPerBeat(Infinity)` is called
- **THEN** it SHALL return `88`

#### Scenario: Wheel step magnitude is in target range

- **WHEN** a wheel event with normalised line delta `1.0` is processed
- **THEN** the ratio `next / prev` SHALL fall in `[0.83, 0.88]` (zoom out) or its reciprocal (zoom in for negative delta)

### Requirement: Zoom is gesture-aware and anchor-preserving

The implementation SHALL select the zoom anchor based on the gesture that drove the change:

- **Wheel + Cmd/Ctrl modifier, or macOS pinch (a `wheel` event with synthetic `event.ctrlKey === true`)** SHALL anchor on `event.clientX` relative to the `.mr-timeline` element's bounding rect, clamped to `>= KEYS_COLUMN_WIDTH` so the anchor never falls on the fixed left column.
- **Keyboard `+`, `=`, `-`** SHALL anchor on the playhead's X coordinate when `0 <= playheadX <= viewportInnerPx`, otherwise on the viewport's horizontal center.
- **Toolstrip `−` / `+` buttons** SHALL use the same anchor logic as keyboard `+`/`-`.
- **Keyboard `0` and Toolstrip `Fit`** SHALL invoke fit-session (see fit requirement) and SHALL reset `scrollLeft` to `0` regardless of prior anchor.

The pure helper `zoomAroundAnchor(prev, next, anchorPx, scrollLeft, keysColW)` SHALL return `{ nextScrollLeft }` such that the beat located at screen position `anchorPx` before the zoom remains at the same screen position after the zoom, computed as `beatAtAnchor = (scrollLeft + anchorPx - keysColW) / prev; nextScrollLeft = max(0, beatAtAnchor * next - anchorPx + keysColW)`.

The gesture handler SHALL apply the new scroll position in the same synchronous event-handler tick as `setPxPerBeat`, by reading `timelineRef.scrollLeft` before the state update and writing `timelineRef.scrollLeft = nextScrollLeft` after.

#### Scenario: Wheel zoom preserves beat under cursor

- **GIVEN** the timeline has `pxPerBeat = 88`, `scrollLeft = 100`, and the user's cursor is at `clientX` corresponding to beat `5.0`
- **WHEN** a wheel event with `ctrlKey: true` is processed and the resulting `nextPxPerBeat` is `176`
- **THEN** after the update, the beat at the same `clientX` SHALL still be `5.0` (within ±0.5 px tolerance)

#### Scenario: Wheel over keys column anchors at beat 0

- **GIVEN** the cursor's `clientX` falls inside `KEYS_COLUMN_WIDTH`
- **WHEN** a Cmd-wheel zoom fires
- **THEN** `zoomAroundAnchor` SHALL be called with `anchorPx = KEYS_COLUMN_WIDTH`
- **AND** the resulting `nextScrollLeft` SHALL be `>= 0`

#### Scenario: Keyboard `+` anchors on playhead when visible

- **GIVEN** the playhead is at screen X `300` within a viewport of inner width `1000`
- **WHEN** the user presses `+` with no editable element focused and no modifier keys
- **THEN** `pxPerBeat` SHALL be multiplied by a factor in `[1.15, 1.25]`
- **AND** the playhead's resulting screen X SHALL be `300` (within ±0.5 px)

#### Scenario: Keyboard `+` anchors on center when playhead off-screen

- **GIVEN** the playhead is at a screen X outside `[0, viewportInnerPx]`
- **WHEN** the user presses `+`
- **THEN** the anchor SHALL be the viewport's horizontal center
- **AND** the beat at the center SHALL keep its screen X after the zoom

#### Scenario: Wheel without modifier does not zoom

- **WHEN** a wheel event arrives with `ctrlKey === false` and `metaKey === false`
- **THEN** `setPxPerBeat` SHALL NOT be called
- **AND** the native scroll behavior SHALL proceed (the handler MAY remain attached but does not `preventDefault` in this case)

### Requirement: Keyboard zoom respects focus context

The keyboard zoom handler SHALL be a no-op whenever any of the following holds at event dispatch time:

- The event target's `tagName` is one of `INPUT`, `TEXTAREA`, or `SELECT`.
- The event target (or any ancestor) carries `contenteditable="true"` or the `isContentEditable` property is true.
- Any of `event.metaKey`, `event.ctrlKey`, or `event.altKey` is true (the modifier-laden combinations are reserved for other shortcuts).

#### Scenario: `+` keypress inside an input is ignored

- **GIVEN** the focus is inside a `<input type="text">` element
- **WHEN** the user presses `+`
- **THEN** `stage.pxPerBeat` SHALL be unchanged on the next render

#### Scenario: `Cmd+0` is not consumed as fit

- **GIVEN** focus is on the document body
- **WHEN** the user presses `0` with `metaKey: true`
- **THEN** the zoom handler SHALL NOT call `setPxPerBeat`
- **AND** SHALL NOT call fit-session

### Requirement: Fit-session computes pxPerBeat from current horizon

`fitPxPerBeat(horizonTicks, viewportInnerPx, keysColW, tpq)` SHALL return `clampPxPerBeat((viewportInnerPx - keysColW) * tpq / horizonTicks)` when both `horizonTicks > 0` and `viewportInnerPx - keysColW > 0`. Otherwise it SHALL return `DEFAULT_PX_PER_BEAT`.

The fit action (keyboard `0`, toolstrip `Fit`) SHALL call `stage.setPxPerBeat(fitPxPerBeat(layoutHorizonTicks, viewportInnerPx, KEYS_COLUMN_WIDTH, DEFAULT_MIDI_TPQ))` and SHALL assign `timelineRef.scrollLeft = 0` in the same event-handler tick.

#### Scenario: Empty session fit returns default

- **WHEN** `fitPxPerBeat(0, 1000, 56, 480)` is called
- **THEN** it SHALL return `88`

#### Scenario: Fit selects a value that fills viewport

- **GIVEN** `horizonTicks = 7680` (16 beats at TPQ 480), `viewportInnerPx = 856`, `keysColW = 56`
- **WHEN** `fitPxPerBeat(7680, 856, 56, 480)` is called
- **THEN** it SHALL return `50` (`(856 - 56) * 480 / 7680`)

#### Scenario: Fit resets horizontal scroll

- **WHEN** the user invokes fit via keyboard `0` or toolstrip Fit
- **THEN** `timelineRef.scrollLeft` SHALL equal `0` on the next render

### Requirement: Layout horizon recomputes on zoom

The horizon expansion routine (`clampAndExpandHorizon` in `app-shell`) SHALL include `stage.pxPerBeat` in the inputs that trigger its recomputation. Zooming out to a `pxPerBeat` that makes the viewport demand a larger horizon than the existing `layoutHorizonTicks` SHALL grow the horizon to satisfy the demand without requiring a scroll event.

#### Scenario: Zoom-out grows horizon

- **GIVEN** `layoutHorizonTicks` exactly matches the rightmost note position at `pxPerBeat = 88`
- **WHEN** `setPxPerBeat(44)` is invoked (halving density, doubling the visible beat range)
- **THEN** on the next render `layoutHorizonTicks` SHALL be at least large enough that `KEYS_COLUMN_WIDTH + layoutHorizonTicks * (pxPerBeat / TPQ)` covers the viewport's inner width plus the existing margin

### Requirement: pxPerBeat is part of the persistable session surface

`pxPerBeat` SHALL be persisted as part of the session payload by `timeline-storage`. The persisted value SHALL be a non-negative finite number. On hydrate, missing values SHALL fall back to `DEFAULT_PX_PER_BEAT`, non-finite values SHALL fall back to `DEFAULT_PX_PER_BEAT` with a console warning, and out-of-range values SHALL be passed through `clampPxPerBeat`.

#### Scenario: Saved zoom level survives reload

- **GIVEN** the user has zoomed to `pxPerBeat = 250` and saved the session under name `"X"`
- **WHEN** the page is reloaded and the user loads `"X"`
- **THEN** `useStage().pxPerBeat` SHALL equal `250` on the next render

#### Scenario: Legacy payload without pxPerBeat hydrates to default

- **GIVEN** a payload that omits `pxPerBeat` (older save before this change)
- **WHEN** it is loaded
- **THEN** `useStage().pxPerBeat` SHALL equal `DEFAULT_PX_PER_BEAT`
- **AND** no console warning SHALL be emitted (absence is not an error)

#### Scenario: Corrupted pxPerBeat hydrates to default with warning

- **GIVEN** a payload whose `pxPerBeat` is `NaN` or otherwise non-finite
- **WHEN** it is loaded
- **THEN** `useStage().pxPerBeat` SHALL equal `DEFAULT_PX_PER_BEAT`
- **AND** a console warning SHALL identify the field

### Requirement: Manual zoom does not trigger audio

Zoom gestures SHALL NOT instantiate audio nodes, emit MIDI clock messages, or change transport state. The only Web Audio surface allowed in the codebase remains the metronome click (`src/midi/metronome.ts`); zoom code SHALL NOT touch `AudioContext` or related APIs.

#### Scenario: Wheel zoom is audio-silent

- **WHEN** the user performs a Cmd-wheel zoom
- **THEN** no `AudioContext` constructor SHALL be invoked by zoom-handling code
- **AND** no message SHALL be sent through `clockSender` or any MIDI output as a side-effect of the gesture
