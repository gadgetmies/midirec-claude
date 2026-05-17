## 1. Pure helper for follow math

- [x] 1.1 Add `followPlayheadScrollLeft(playheadTicks, pxPerTick, keysColumnWidth, scrollLeft, clientWidth)` to `src/session/layoutHorizon.ts`, returning the new `scrollLeft` to assign or `null` when no update is needed (per the `followPlayheadScrollLeft helper is a pure function` requirement)
- [x] 1.2 Add unit tests to `src/session/layoutHorizon.test.ts` covering: playhead in left half → `null`; playhead past half-viewport → expected target; small-viewport edge case (`clientWidth=300`); `Math.max(0, ...)` clamp; integer and fractional `pxPerTick`

## 2. Wire follow effect into AppShell

- [x] 2.1 Import `useTransport` (or the equivalent transport-mode accessor) inside `src/components/shell/AppShell.tsx` and read `mode`
- [x] 2.2 Add a `useLayoutEffect` keyed on `[mode, stage.playheadTicks]` (plus `pxPerTick`, `KEYS_COLUMN_WIDTH` which are stable) that early-returns when `mode !== 'play' && mode !== 'record'`
- [x] 2.3 Inside the effect, read `timelineRef.current.scrollLeft` and `clientWidth`, call `followPlayheadScrollLeft(...)`, and assign the result to `timelineRef.current.scrollLeft` when non-null
- [x] 2.4 Confirm the existing `onScroll={clampAndExpandHorizon}` path still fires after the programmatic write (browsers dispatch `scroll` for programmatic `scrollLeft` writes); horizon expansion should continue to work as the auto-scroll advances the viewport's right edge

## 3. Tests for the AppShell follow behavior

- [x] 3.1 Add a JSDOM-level test that mounts `<AppShell />` (or a smaller test harness around the effect), simulates `mode='play'` and a sequence of advancing `playheadTicks`, and asserts that `.mr-timeline.scrollLeft` advances exactly when `playheadPx` would otherwise cross the half-viewport mark
- [x] 3.2 Add a test that confirms `mode='idle'` does NOT trigger any `scrollLeft` write even as `playheadTicks` changes
- [x] 3.3 Add a test that confirms `mode='record'` triggers the same auto-scroll as `mode='play'`
- [x] 3.4 Add a test that confirms a playhead to the left of the visible viewport does NOT pull the viewport back (asymmetric rule from `design.md` Decision 4)

## 4. Spec sync

- [x] 4.1 Run `openspec validate playhead-auto-scroll` (or equivalent) and resolve any schema warnings
- [ ] 4.2 Manual smoke test in the running app: start playback on an empty session, watch the playhead advance, verify the viewport scrolls so the playhead never crosses the right-half mark; pause and confirm scroll is no longer auto-driven
- [ ] 4.3 Manual smoke test with recording: enter record mode, verify the same follow behavior applies
