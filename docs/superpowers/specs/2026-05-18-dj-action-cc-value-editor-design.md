# DJ action-track value editor — design

**Date**: 2026-05-18
**Status**: Design draft, pending user approval
**Related**: `openspec/changes/dj-action-cc-value-editor/` (scaffolded), `BACKLOG.md` (pitch→row rename, per-row start-emit config)

## Goal

Add a single timeline-aligned editor for the continuous-value MIDI a DJ action track emits:

- **CC** — Control Change values (existing, currently editable only via drag-to-move on `cc-group` strips).
- **Pitch-bend** — not modelled today; add as a new output kind.
- **AT** — Channel Pressure / Aftertouch curves attached to host events (existing; today edited in the Inspector's `PressureEditor`).

One editor UI handles all three; the underlying storage differs per controller kind (see Data model).

In this document, **"row key"** refers to the `0..127` identifier used as the key in `actionMap` / `outputMap` and stored on `ActionEvent.pitch`. The codebase still calls this field `pitch`; renaming it to a more inclusive name is tracked in `BACKLOG.md`. The spec text uses "row key" for clarity.

## Non-goals

- Re-modeling AT as timeline-aligned automation. AT stays note-relative on its host event.
- Building a tool-palette UX (eraser tool / pencil tool). All interactions are gesture-based.
- Editing per-event velocity for `velocity-sensitive` rows via this editor. Velocity editing is out of scope; the editor hides for those row selections.
- Selection-and-keyboard-delete model in the editor. Deletion is via right-click only.

## Data model

### CC and Pitch-bend — timeline-aligned events

Both reuse the existing `ActionEvent` shape. Each painted value is one event:

```ts
{ pitch: rowKey, tTicks: <snapped>, durTicks: 0, vel: 0..1 }
```

`vel` carries the normalized 0..1 value. The scheduler expands it at emit time:
- **CC**: `Math.round(vel * 127)` → 7-bit data byte.
- **Pitch-bend**: `Math.round(vel * 16383)` → 14-bit value, split into MSB/LSB.

Pitch-bend center maps to `vel === 0.5`, which expands to `16383 * 0.5 = 8191.5 → 8192` after rounding — matching MIDI's `0x2000` neutral.

Pitch-bend needs a new output discriminator. `OutputMapping` gains:

```ts
out?: 'note' | 'cc' | 'pb'   // default: 'note'
```

When `out === 'pb'`, the scheduler emits `0xE_` (Pitch Bend) instead of `0xB_` (CC) or note messages, and the `cc` field is ignored. When `out === 'cc'`, current CC-emit behaviour is preserved. When unset or `'note'`, current note-emit behaviour is preserved.

### AT — note-relative on host event (unchanged)

Existing `event.pressure: PressurePoint[]` (with `t ∈ 0..1`, `v ∈ 0..1`) is the storage. The new editor writes into the same array. The Inspector's `PressureEditor` retires (see Inspector retirement).

## Selection-to-mode mapping

The editor is one component with a derived mode based on existing `useStage` selections:

| Selection state | Editor mode | Writes to |
|---|---|---|
| `djActionSelection` on a CC-output row (`outputMap[rowKey].out === 'cc'`, or `out` unset and `cc !== undefined` — back-compat with existing data); no event selected | **CC stream** | `track.events` with `event.pitch === rowKey` |
| `djActionSelection` on a PB-output row (`outputMap[rowKey].out === 'pb'`); no event selected | **PB stream** | `track.events` with `event.pitch === rowKey` |
| `djEventSelection` on a `pressure: true` row's event | **AT (windowed)** | `track.events[idx].pressure` |
| Multi-item selection (more than one row, or more than one event across rows) | hidden | — |
| `trigger`, `velocity-sensitive`, `fallback` row selected with no event | hidden | — |
| No selection | hidden | — |

Mode is derived from selection state, not stored. When the user selects a row in a different track or event, the editor swaps to the new selection on the next render. The shift-interpolate anchor (see Gesture detail) clears across selection changes.

## Placement and layout

A global sticky footer pinned to the AppShell, **mounted only when the editor mode is non-hidden**. Mounted above the existing `Statusbar` footer (so the Statusbar stays the absolute bottom of the viewport).

The editor contains:

1. **Header strip** (24px tall): row label and controller summary on the left ("DJ Track 1 · FX1 · CC #11" / "AT · Hot Cue 1 · event 2/5") and a close `✕` chip on the right that clears the relevant selection (`djEventSelection` for AT mode, `djActionSelection` for CC/PB mode). The strip's *top edge* is the editor's resize-grip: hovering it shows a `row-resize` cursor; a pointer-drag on that edge resizes the editor (see Editor canvas).
2. **Editor canvas**: shares the timeline's x-axis (same `pxPerBeat` and the same horizontal scroll offset as the timeline body — implementation note: the canvas reads the timeline's current `scrollLeft` and mirrors it via `transform: translateX(-scrollLeft)` on its inner content, since the editor is a global footer outside the timeline's own scroll container). Default height 96px, user-resizable by dragging the header strip's top edge. Resize value persisted to `localStorage` under `mr.dj-value-editor.heightPx` (number, clamped `48..400`).
3. **Bulk-op strip** (right-aligned, narrow): three chips `Smooth`, `Flatten`, `Clear` (carried over from the retired Inspector PressureEditor — see Bulk operations). Below them, a small value-scale legend (`0` / `0.5` / `1`; for PB mode the labels are `−` / `0` / `+`).

In **AT (windowed)** mode, the editor canvas dims the area outside `[event.tTicks, event.tTicks + event.durTicks]` with a "window mask" overlay; clicks outside the window are ignored. The lane bars rasterise the event's note-relative curve onto the windowed span at draw time using `rasterizePressure`.

In **CC / PB stream** modes, the editor canvas renders bars across the entire visible timeline. Each existing `ActionEvent` for the row becomes one bar at its `tTicks`, with bar height proportional to `vel`. Quantize-grid lines are drawn faintly at the active grid (matching the timeline ruler grid). The existing in-lane `cc-group` strip rendering in `ActionRoll` and its drag-to-move behaviour are unchanged — the new editor is an *additional* input method that operates on the same `track.events` data; both views update in lockstep on edit. AT-mode does not change how `ActionRoll` draws the in-lane pressure-bearing note (the 14-cell synthetic visualization still shows for events with no stored pressure; events with stored pressure render their `event.pressure` via `rasterizePressure` as today).

## Gesture detail

The editor canvas captures pointer events. Snap rules use the transport titlebar's existing `quantizeOn` / `quantizeGrid` / `snapAbsoluteOn` settings (the same settings `ActionRoll` already consumes). When `quantizeOn` is `false`, no horizontal snap is applied — writes land at the exact tick under the cursor and "every cell crossed" degenerates to "every tick crossed" (with drag-paint coalescing to one write per `pointermove` frame). Vertical mapping: canvas top = `1.0`, canvas bottom = `0.0`, linear in between. Vertical position is not snapped.

### Single click (no modifier)

- Snap `clientX` to the nearest quantize-grid tick.
- Map `clientY` to value `0..1`.
- Write one point at the snapped tick with that value. If a point already exists at the snapped tick on this row, replace its `vel` instead of creating a duplicate.
- Update the shift-anchor (see below) to `(snappedTick, value)`.

### Click + drag (paint, no modifier)

- Same snap rules as single click.
- On every `pointermove` that crosses into a *different* quantize cell (compared to the previous frame's snapped tick), write/replace the point in that cell using the cursor's *current* `clientY → value`.
- Re-crossing an already-painted cell *re-writes* it with the current cursor Y (latest write wins). Backwards motion does *not* erase cells that were written earlier in the drag — paint only writes, it never deletes.
- Commits incrementally so the lane redraws live. The whole drag is one history entry (single undo step).
- On `pointerup`, the last painted cell becomes the shift-anchor.

### Shift + click (interpolate)

- Requires a shift-anchor (set by a previous click or drag end in the editor with the current selection).
- Compute linear interpolation between the anchor `(t0, v0)` and the new click `(t1, v1)` (after snap on both axes).
- For every quantize-grid cell in the inclusive range `[min(t0, t1), max(t0, t1)]`, write a point with the interpolated value `v = v0 + (v1 - v0) * (t - t0) / (t1 - t0)` (with the obvious endpoint handling when `t0 === t1`).
- **Delete any existing points strictly within `(min(t0,t1), max(t0,t1))` that aren't on a grid cell we just wrote** — the interpolation range becomes fully owned by the interpolation.
- The new shift-click endpoint becomes the next shift-anchor.

### Right-click (delete)

- Right-click on a single cell: delete the point at the snapped tick on this row (no-op if none).
- Right-click + drag: delete points in every quantize cell the cursor crosses.
- The `contextmenu` browser event is suppressed via `preventDefault()` so no native menu appears.
- Does not move the shift-anchor.

### AT-mode gesture clamping

All gestures only fire when the snapped tick is within `[event.tTicks, event.tTicks + event.durTicks]`. The cursor shows a "no-drop" indicator outside the span. The tick → note-relative conversion happens at write time: `t = (snappedTicks - eventStart) / eventDur`, clamped to `[0, 1]`. Interpolation in AT mode operates on note-relative `t` values; the grid cells used to anchor writes are still timeline-aligned, but each write produces a `PressurePoint` with note-relative `t`.

## Bulk operations

The three chips from the Inspector PressureEditor carry over as a small affordance strip in the editor's right margin:

- **Smooth** — apply `smoothPressure` (centered moving-average kernel, default `3`) to the current edit target's points.
  - In CC/PB mode: rasterise the row's events to 16 bins across the visible timeline window (the current scroll viewport's tick range), smooth, then **replace** the events in that range with 16 evenly-spaced points carrying the smoothed values. Points outside the viewport are untouched.
  - In AT mode: directly call `smoothPressure` on `event.pressure` (existing behaviour).
- **Flatten** — `flattenPressure`: replace all points in the current range (viewport for CC/PB; the event span for AT) with the mean of the rasterised values, distributed as 16 evenly-spaced points.
- **Clear** — remove all points in the current range. For AT this writes `[]` (matching the existing semantic of "explicitly cleared"). For CC/PB this removes all events on the row whose `tTicks` fall in the viewport range.

`smoothPressure`, `flattenPressure`, `rasterizePressure`, and `synthesizePressure` in `src/data/pressure.ts` are kept and reused. `summarizePressure` and `clearPressure` are removed (no consumer remains).

## Scheduler / emit changes

- **CC rows**: unchanged. The existing `emitControlChange` path reads `event.vel` and emits `0xB_ ctrl value`. No work required here.
- **Pitch-bend rows (new)**: add `emitPitchBend(channel, vel)` in `src/midi/scheduler.ts`, mirroring `emitControlChange`. Wire value: `const v14 = Math.max(0, Math.min(16383, Math.round(vel * 16383)))`; send `0xE_, v14 & 0x7F, (v14 >> 7) & 0x7F`. The scheduler's per-event dispatch branches on `outputMap[rowKey].out`:
  - `'pb'` → `emitPitchBend(...)`
  - `'cc'` (or `cc` field set when `out` is unset) → existing `emitControlChange(...)`
  - `'note'` (or absent) → existing note-on/off path
- **PB panic / song-stop**: extend the existing all-CC-zero / channel-pressure-zero panic to also emit `0xE_ 8192` (center) on every (`midiOutputDeviceId`, `channel`) pair that has at least one PB-output row across the session. Mirrors the existing reset-on-stop pattern.
- **PB default at song start**: scheduler emits one `0xE_ 8192` at tick 0 on every (`midiOutputDeviceId`, `channel`) pair that has at least one PB-output row, regardless of whether the first painted point is at tick 0. Ensures the receiver is in a known center state. Two PB-output rows on the same channel are not a model constraint here, but they share the same wire-level PB stream — the scheduler emits in tick order; ties are broken by insertion order in `track.events`.
- **CC default at song start**: keep current behaviour — no emit until the first painted point. The per-row "start emit" configuration is deferred to a follow-up (`BACKLOG.md`).
- **AT**: unchanged — still emits Channel Pressure from `event.pressure` during the host event's lifetime.

## Inspector PressureEditor retirement

The current pressure section inside `ActionPanel` is removed entirely:

- `src/components/inspector/PressureEditor.css` — deleted.
- The pressure-related JSX block in `ActionPanel` — deleted.
- The pressure section requirements in `openspec/specs/dj-pressure-editor/spec.md` — superseded. The dj-pressure-editor spec is **archived** on apply (moved under `openspec/specs/_archived/`); the still-relevant primitives (the `PressurePoint` / `PressureRenderMode` type contracts and the `synthesizePressure` / `rasterizePressure` / `smoothPressure` / `flattenPressure` purity requirements) move into the new editor's spec verbatim. The Inspector-side rendering and bulk-op-DOM requirements are dropped.

Helpers in `src/data/pressure.ts` are kept on a per-need basis:
- `synthesizePressure` — kept (still used by `ActionRoll` to draw the synthetic curve when `event.pressure === undefined`).
- `rasterizePressure` — kept (used by both the lane body and the new editor to render bars).
- `smoothPressure`, `flattenPressure` — kept (used by the new editor's bulk-op chips).
- `summarizePressure`, `clearPressure` — removed.

The Inspector still shows the Output mapping form and the other action metadata when a DJ row is selected; the only thing that goes away is the pressure section.

## Settings, persistence, and concurrency

- **Quantize source**: the editor reads `quantizeOn`, `quantizeGrid`, `snapAbsoluteOn` from the same hook source `ActionRoll` already uses (via `useStage` / the transport titlebar). No new state.
- **Editor height**: persisted to `localStorage` key `mr.dj-value-editor.heightPx` as a JSON number. Read on mount; written on resize end (debounced ~200ms to avoid pummeling storage).
- **Shift-anchor**: in-memory only, scoped to the currently mounted editor. Cleared when the editor unmounts (selection change to hidden state, or selection swap).
- **Quantize grid changes mid-edit**: new writes use the new grid. Existing points stay at their absolute `tTicks` (or their existing note-relative `t` for AT) — they don't snap retroactively.
- **Multi-item selection**: the editor hides immediately when the selection becomes multi-item; no implicit "pick one of the selected" fallback.

## Behaviour summary table

| User action | CC / PB mode | AT mode |
|---|---|---|
| Left-click | Add/replace 1 point at snapped tick | Same; only if click is within event span |
| Left-drag | Paint points at every crossed cell | Same; only within event span |
| Shift+click | Interpolate from anchor; replace points strictly between | Same; tick-to-`t` conversion at write |
| Right-click | Delete point at snapped tick | Same; only within event span |
| Right-drag | Delete points at every crossed cell | Same; only within event span |
| Smooth chip | Smooth events in viewport | `smoothPressure` on `event.pressure` |
| Flatten chip | Flatten events in viewport | `flattenPressure` on `event.pressure` |
| Clear chip | Remove events in viewport | Write `event.pressure = []` |
| Change quantize grid | New writes use new grid; existing untouched | Same |
| Drag editor top edge | Resize editor; persist height | Same |
| Close `✕` chip | Clear `djActionSelection` for row | Clear `djEventSelection` |
| Selection becomes multi-item | Hide editor | Hide editor |

## Affected files (anticipated)

- `src/data/dj.ts` — extend `OutputMapping` with `out?: 'note' | 'cc' | 'pb'`.
- `src/midi/scheduler.ts` — add `emitPitchBend`; branch dispatch on `out`; add PB tick-0 emit and PB panic.
- `src/components/dj-value-editor/` (new) — `DJValueEditor.tsx`, `DJValueEditor.css`, `gestures.ts`, `bulkOps.ts`, plus tests.
- `src/components/shell/AppShell.tsx` — mount the new editor between the timeline body and the existing `Statusbar` footer when its selection-derived mode is non-hidden.
- `src/components/inspector/ActionPanel.tsx` — remove the pressure section.
- `src/components/inspector/PressureEditor.css` — delete.
- `src/data/pressure.ts` — remove `summarizePressure`, `clearPressure`; keep the rest.
- `openspec/specs/dj-pressure-editor/spec.md` — archive or migrate.
- New OpenSpec change capability spec at `openspec/changes/dj-action-cc-value-editor/specs/...` covering the requirements above.

## Open follow-ups (tracked in BACKLOG.md)

- **Rename `pitch` → row key in DJ-action data model** — surfaced during this design; tracked separately.
- **Per-row "starting value" emit config for CC / Pitch-bend rows** — deferred; tracked separately.
