## Why

Slice 8 closed the loop on **action mapping** — clicking a DJ action row opens its input/output bindings in the side panels. But the Inspector's right-aside still has nothing to say about the *expression data* attached to action events. For pressure-bearing actions (e.g. Hot Cue 1), the action-track body already renders a per-event aftertouch bar graph synthesized at render time from a deterministic pitch seed — there is no stored data, no readout, and no way to edit it. Slice 9 introduces the **Pressure editor**: a bar-graph editor in the ActionPanel that materialises the synthesized curve into a real `pressure?: PressurePoint[]` array on the selected event, surfaces its summary stats, and exposes bulk transformations (Smooth / Flatten / Clear) plus a Curve/Step rendering mode. This is the last visual surface before Slice 10 begins wiring the audio engine.

## What Changes

- Introduce a new `dj-pressure-editor` capability that owns the Inspector's Pressure section — bar-graph editor + summary readout + bulk-op row + mode toggle, rendered inside `ActionPanel` when the selected DJ action's `pressure` capability is `true`.
- Extend `dj-action-tracks`: `ActionEvent` gains an optional `pressure?: PressurePoint[]` field (array of `{ t: number; v: number }`, with `t` in [0,1] note-relative and `v` in [0,1]). The `ActionRoll` renderer reads stored pressure if present, falling back to the existing synthesized curve when absent (preserves today's visual baseline for unedited events).
- Extend `dj-action-tracks` with selection at the **event** level: clicking an action event in `ActionRoll` sets a new `djEventSelection: { trackId, pitch, eventIdx } | null` on `useStage` (orthogonal to the existing row-level `djActionSelection`). The Pressure editor reads off this state. Clicking outside the action body blurs the selection.
- Add hook actions on `useDJActionTracks`: `setEventPressure(trackId, pitch, eventIdx, points)`, `clearEventPressure(trackId, pitch, eventIdx)`. Deterministic, no-op on unknown ids.
- Add a session-level `pressureRenderMode: 'curve' | 'step'` (default `'curve'`) on `useStage`, with `setPressureRenderMode(mode)`. Affects both the Pressure editor's bar-graph rendering and the inline rendering inside `ActionRoll`'s event body.
- Bulk ops (pure functions on `PressurePoint[]`, exported from `src/data/pressure.ts`):
  - `smoothPressure(points, kernel = 3)` — moving-average smoothing across the rasterized bins.
  - `flattenPressure(points)` — replaces values with the mean across bins.
  - `clearPressure()` — returns `[]`; renderer falls back to synthesized curve.
- Summary readout: `n events · peak X.XX · avg X.XX` (matches prototype `dj.jsx:927-982` format) — computed from the rasterized bins, monospace 9px text-3 color.
- Bar-graph editor: 16 bins, SVG-rendered, same primitives as `ParamLane` (1.5px bar width, action-color fill at 0.85 opacity, highlight dot). Read-only in this slice — direct paint/draw editing is out of scope; bulk ops are the only mutations.

## Capabilities

### New Capabilities

- `dj-pressure-editor`: The Inspector ActionPanel's PRESSURE section — bar-graph editor + summary readout (`n events · peak · avg`) + bulk-op row (Smooth / Flatten / Clear) + Curve/Step mode toggle. Owns the visual layout and the wiring from selected event → stored `pressure` array. Visible iff the selected action's `pressure` capability is `true`.

### Modified Capabilities

- `dj-action-tracks`: requirements added for (a) the `pressure?: PressurePoint[]` field on `ActionEvent`, (b) `djEventSelection` state on the stage and the event-click handler in `ActionRoll`, (c) `setEventPressure` / `clearEventPressure` hook actions, (d) `ActionRoll` reading stored pressure when present and falling back to the synthesized curve when absent, (e) `pressureRenderMode` affecting the per-event bar rendering (Curve vs. Step interpolation between bins).
- `inspector`: requirement added for the ActionPanel — when a DJ action event is selected and the action's `pressure` capability is true, the Output mapping form is followed by a PRESSURE section containing the editor.

## Impact

- `src/data/dj.ts`: `ActionEvent` gains optional `pressure?: PressurePoint[]`. New `PressurePoint` type. New `PressureRenderMode` type.
- `src/data/pressure.ts` (new): pure helpers — `rasterizePressure(points, bins)`, `summarizePressure(points)`, `smoothPressure`, `flattenPressure`, `clearPressure`.
- `src/data/pressure.test.ts` (new): unit tests for the helpers.
- `src/hooks/useDJActionTracks.ts`: adds `setEventPressure` / `clearEventPressure` actions and matching pure `apply*` helpers.
- `src/hooks/useStage.tsx`: adds `djEventSelection` state, `setDJEventSelection`, `pressureRenderMode` state, `setPressureRenderMode`. Extends the outside-click blur to also clear `djEventSelection`.
- `src/components/dj-action-tracks/ActionRoll.tsx` + `.css`: event hit-areas become click-targets that set `djEventSelection`, with `data-selected` styling. Pressure rendering reads stored `pressure` when present and honours `pressureRenderMode`.
- `src/components/inspector/ActionPanel.tsx`: extended to render the Pressure section beneath the Output mapping form when applicable.
- `src/components/inspector/PressureEditor.tsx` (new) + `.css`: the bar-graph editor, summary readout, bulk-op buttons, and mode toggle.
- No new dependencies. No design-token changes (reuses existing `action-color`, `text-3`, panel surfaces).
