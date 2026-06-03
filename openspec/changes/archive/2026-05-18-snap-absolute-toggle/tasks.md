## 1. Transport state + action

- [x] 1.1 Add `snapAbsoluteOn: boolean` to `TransportState` and `InternalState` in `src/hooks/useTransport.tsx`, default `false` in `initialState`
- [x] 1.2 Add `toggleSnapAbsolute(): void` to `TransportActions`; add a `'toggleSnapAbsolute'` case to the reducer that flips `snapAbsoluteOn` and leaves all other fields untouched
- [x] 1.3 Wire the action into the `useCallback` block + the `useMemo` `TransportValue` (mirror the existing `toggleQuantize` pattern)
- [x] 1.4 Tests: extend the existing transport unit tests (or add a new one) with three scenarios — default-is-false, toggle flips, and toggle leaves `quantizeOn`/`quantizeGrid` untouched

## 2. PianoRoll absolute-snap branch

- [x] 2.1 Add `snapAbsoluteOn?: boolean` prop (default `false`) to `PianoRollProps`
- [x] 2.2 In `computeFinalTick`, branch on `quantizeOn && snapAbsoluteOn`: absolute branch returns `max(0, round((tick0 + deltaTicksRaw) / snap) * snap)`; otherwise keep the existing delta-snap math
- [x] 2.3 Ensure the live preview state and the `pointerup` commit value both use the branched result
- [x] 2.4 Tests: extend `PianoRoll.test.tsx` with the scenarios from `specs/piano-roll/spec.md` — absolute realigns off-grid, delta preserves off-grid (regression guard), absolute equals delta when `tick0` is on-grid, absolute has no effect when `quantizeOn: false`, absolute clamps to ≥0, commits exactly once

## 3. ActionRoll absolute-snap branch (single events)

- [x] 3.1 Add `snapAbsoluteOn?: boolean` prop (default `false`) to `ActionRollProps`
- [x] 3.2 In the single-event handler, branch on `quantizeOn && snapAbsoluteOn`: absolute branch computes `finalTick = max(0, round((tick0 + deltaTicksRaw) / snap) * snap)`; otherwise keep the delta-snap result
- [x] 3.3 Ensure preview + commit both use the branched value
- [x] 3.4 Tests: extend `ActionRoll.test.tsx` with single-event absolute scenarios — off-grid realign, on-grid equivalence with delta, no-op when quantize off, clamps to ≥0, commit-once

## 4. ActionRoll absolute-snap branch (CC groups)

- [x] 4.1 In the CC-group handler, when `quantizeOn && snapAbsoluteOn`, compute `earliestFinal = max(0, round((earliestTTicks + deltaTicksRaw) / snap) * snap)` and `groupDeltaTicks = earliestFinal - earliestTTicks` (overriding the delta-snap formula)
- [x] 4.2 Reuse the existing per-member commit loop: each member commits `max(0, originalTTicks + groupDeltaTicks)`
- [x] 4.3 Tests: extend `ActionRoll.test.tsx` with CC-group absolute scenarios — earliest-member realigns + spacing preserved + non-earliest stay off-grid; delta regression guard (off-grid preserved everywhere); clamp when earliest would go negative; commit-N-times

## 5. Wire snapAbsoluteOn through the component tree

- [x] 5.1 Add `snapAbsoluteOn?: boolean` to `Track` props in `src/components/tracks/Track.tsx` and forward to `<PianoRoll>`
- [x] 5.2 Add `snapAbsoluteOn?: boolean` to `ChannelGroup` props in `src/components/channels/ChannelGroup.tsx` and forward to `<Track>`
- [x] 5.3 Add `snapAbsoluteOn?: boolean` to `DJActionTrack` props in `src/components/dj-action-tracks/DJActionTrack.tsx` and forward to `<ActionRoll>`
- [x] 5.4 In `src/components/shell/AppShell.tsx`, read `transport.snapAbsoluteOn` and pass it to every `<ChannelGroup>` and `<DJActionTrack>` instance alongside `quantizeOn` / `quantizeGrid`

## 6. Titlebar "A" chip

- [x] 6.1 Locate the titlebar component (likely `src/components/titlebar/Titlebar.tsx`) and the current `Q` chip markup
- [x] 6.2 Add an `A` label + power-toggle button immediately to the right of the grid-value chip, sharing the `Q` chip's class/style
- [x] 6.3 Bind the button's active state to `transport.snapAbsoluteOn` (via `data-on`) and the click to `transport.toggleSnapAbsolute`
- [x] 6.4 When `transport.quantizeOn === false`, render the button with `data-disabled="true"` and short-circuit the click handler to a no-op; set a tooltip explaining the dependency
- [x] 6.5 Tests: add (or extend) titlebar tests covering — chip present in DOM order, `data-on="true"` reflects `snapAbsoluteOn`, click toggles when enabled, click no-ops when `quantizeOn` is false, `data-disabled` reflects `quantizeOn === false`

## 7. Manual verification

- [ ] 7.1 Dev-server: with quantize on (`1/16`) and `A` chip off, drag a piano-roll note from an off-grid tick — offset is preserved (delta-snap baseline)
- [ ] 7.2 Toggle the `A` chip on; drag the same note — it now realigns to the nearest 1/16 (absolute-snap)
- [ ] 7.3 Toggle quantize off — the `A` chip greys out and clicking it does nothing
- [ ] 7.4 Repeat steps 7.1–7.2 on a DJ action trigger event
- [ ] 7.5 Repeat on a DJ CC group: absolute-mode earliest member lands on-grid, rest follow by the same delta; spacing preserved
- [ ] 7.6 Confirm click-to-select still works (no drag) on items with the `A` chip in any state
