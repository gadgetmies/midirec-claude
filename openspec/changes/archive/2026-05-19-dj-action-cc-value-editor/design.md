## Context

DJ action tracks already emit three families of continuous MIDI data, but the input surfaces are scattered:

- **CC** is authored only as a side-effect of drag-to-move on `.mr-djtrack__cc` group strips and of the per-event timing controls in the Inspector. The actual *value* on a CC event is `event.vel` (`0..1`), and there is no canvas where the user can directly paint that value.
- **Aftertouch (AT)** is authored in the Inspector's `PressureEditor` — a 16-bin bar-graph hidden inside the Note tab when a `pressure: true` row's event is selected. The graph isn't timeline-aligned, the bulk-op chips are visible but the discoverable canvas isn't.
- **Pitch-bend (PB)** isn't modelled — `OutputMapping` today branches on the *presence* of `cc`, and the scheduler has no `0xE_` emit path.

The supporting plumbing already exists: the transport titlebar owns `quantizeOn` / `quantizeGrid` / `snapAbsoluteOn` and is read by `ActionRoll` for the existing drag-to-move; `useStage` already exposes `djActionSelection`, `djEventSelection`, and the `setEventPressure` mutator; `src/data/pressure.ts` exposes pure rasterise/smooth/flatten helpers re-usable across modes. The session model uses ticks (`tTicks`, `durTicks`) consistently; `ActionEvent.vel: number` carries the normalized `0..1` value the scheduler converts at emit time.

The constraint that scopes the design: the editor cannot be inside `ActionRoll`'s scroll container. It must be a *global* footer the entire AppShell sees, because it spans the timeline's full visible horizon and persists across selection changes within the timeline. That places it next to `Statusbar` and forces it to mirror the timeline's `scrollLeft` from outside.

## Goals / Non-Goals

**Goals:**

- One editor UI for CC, PB, and AT, with mode derived from selection state — no tool palette, no eraser tool.
- Timeline-aligned canvas that shares the timeline's `pxPerBeat` and follows its scroll offset.
- Snap rules match `ActionRoll` exactly so users don't learn a second mental model.
- Pitch-bend modelled as an additive output discriminator (`OutputMapping.out`) — back-compat for existing `cc !== undefined` data.
- Scheduler emits a known center value (`0xE_ 8192`) at song start and on stop, so receivers are deterministic.
- Per-helper unit tests for snap math and the bulk-op behaviors; component tests for selection-to-mode mapping and gesture commits.

**Non-Goals:**

- Re-modeling AT as timeline-aligned automation. AT stays note-relative on its host event.
- A tool-palette UX (pencil / eraser tools, selection rectangle in the editor, keyboard-delete model).
- Editing per-event velocity on `velocity-sensitive` rows via the editor. Velocity-sensitive editing keeps its existing path.
- Multi-event marquee selection in the editor canvas — the editor is gesture-driven only.
- Per-row "starting value" emit configuration for CC — deferred (BACKLOG).
- Renaming `pitch` → row key on `ActionEvent` — deferred (BACKLOG); the editor uses the existing `pitch` field internally and the spec text uses "row key" for clarity.

## Decisions

### 1. Pitch-bend modelled as an additive `out` discriminator on `OutputMapping`

`OutputMapping` gains `out?: 'note' | 'cc' | 'pb'`. The scheduler dispatch branch on a DJ event is:

| `out` value | Behavior |
|---|---|
| `'pb'` | Emit `0xE_ LSB MSB` from `Math.round(vel * 16383)` |
| `'cc'` *(or unset with `cc !== undefined`, for back-compat)* | Existing CC-out path |
| `'note'` *(or unset with `cc === undefined`)* | Existing note-mode path |

Two-way back-compat: pre-existing `outputMap` entries with `cc !== undefined` and no `out` field continue to mean CC; the editor materialises `out: 'cc'` on the next save through the Inspector form. Pre-existing entries with neither `cc` nor `out` continue to mean note-mode.

**Alternatives considered:** a separate `outputMap` keyed by a different shape per output kind (rejected — duplicates the per-pitch storage, complicates `deleteActionEntry`); reusing `cc` as a sentinel where `cc === -1` means pitch-bend (rejected — gross overload of a 0..127 byte). The discriminator is the smallest schema change that makes the three kinds first-class.

### 2. Editor is one component with a derived mode, not three components

`DJValueEditor.tsx` derives its mode from `useStage()` selections in a pure function `deriveMode(stage) → { kind: 'cc' | 'pb' | 'at' | 'hidden', target?: ... }`. The component mounts only when `mode.kind !== 'hidden'`. Selection changes swap the mode on the next render. The shift-anchor (for shift+click interpolation) is module-local state inside `DJValueEditor` and clears whenever the derived mode `target` identity changes.

**Alternatives considered:** three separate editor components with a parent switch (rejected — gesture handling, resize behavior, and bulk-op chips are identical across modes; three components would mean three copies). A `useEditorMode()` hook (rejected — single consumer, no reuse).

### 3. Canvas mirrors the timeline's `scrollLeft` from outside the scroll container

The editor is mounted as `.mr-dj-value-editor` directly under `.mr-shell`, *not* inside `.mr-timeline__scroll`. To stay aligned with the timeline body, the inner content reads the timeline's current `scrollLeft` (via a `ref` exposed by the timeline scroll container, surfaced through context or a shared ref store) and applies `transform: translateX(-scrollLeft)` to its inner content. The outer container clips overflow. Resize observers on the timeline's `pxPerBeat` and the editor's own width trigger a re-render of the bar positions.

**Alternatives considered:** putting the editor inside the timeline's scroll container as a sticky-bottom row (rejected — the editor needs to stay visible while users scroll vertically through tracks; sticky-bottom only works for single-scroll-axis layouts; also the editor's resize would fight with the timeline's row heights). Cloning the timeline's horizontal scrollbar (rejected — two scrollbars would diverge under JS-driven scroll, e.g. playhead follow).

### 4. Snap is delta-based for paint, absolute for the *single* writing tick

This editor *writes* values at specific ticks rather than translating items. Consequently:

- **Single click / paint**: the *write tick* is `snap(clientXToTick(clientX), quantize)` — pure absolute snap. The user is choosing a grid cell; we don't want to preserve any off-grid offset because there's no prior position to offset from.
- **Shift+click interpolation**: both endpoints are absolute-snapped to the grid; intermediate cells are written at *every grid cell* in the inclusive range with linearly-interpolated values.
- **Quantize OFF**: writes happen at the exact tick under the cursor (no snap). "Every cell crossed" degenerates to "every tick crossed" with one write per `pointermove` frame.

This deliberately differs from `ActionRoll` drag-to-move (which uses *delta snap* to preserve off-grid offsets) because the user intent differs: drag-to-move shifts an existing item; the editor paints fresh values. Mixing the two snap models would be confusing — but they sit at different operations, so the inconsistency is contained.

`snapAbsoluteOn` from the transport is honored: when the chip is on (and `quantizeOn` is on), the absolute write tick is snapped to the *nearest* grid cell; when off, the write tick is snapped *down* (floor) to the grid cell the pointer is currently inside. This matches what users already expect from the transport chip and avoids re-litigating its semantics.

### 5. Drag sweeps the inclusive range between consecutive samples

On every `pointermove`, the editor recomputes the snapped tick `curTick` and current value `curVel`, then defines the swept range as `[min(prevTick, curTick), max(prevTick, curTick)]` inclusive — where `(prevTick, prevVel)` is the previous frame's snapped sample (initialised at `pointerdown`).

The drag mutates the row by replacing **every** event in that swept range with exactly two endpoint events: one at `prevTick` with `prevVel`, one at `curTick` with `curVel`. This wipes pre-existing events at intermediate snapped grid cells (e.g. the cell at `240` when the cursor jumps `120 → 360`) and off-grid events in the same interval. When `prevTick === curTick` the range degenerates and the cell is rewritten with `curVel` (latest-wins).

Why range-replace rather than per-cell upsert: a per-sample `upsertDJEvent` leaves stale events in the gaps when the pointer jumps cells faster than the `pointermove` rate or moves through pre-existing data. Users perceive that as the drag "missing" cells. The range-replace makes the drag own the interval it sweeps — what the user sees is what they painted: two endpoint values per frame, no leftovers.

Backward motion follows the same rule and is **not** exempt — if the user drags forward through `120, 240, 360, 480` (one sample per cell) and then back to `120` in one fast move, the backward sweep from `480` to `120` clears the in-drag cells at `240` and `360`. That's intentional: the user is painting a new shape across the same range.

Mechanically, each `pointermove` for paint-drag calls `stage.replaceDJEventsInRange(trackId, pitch, lo, hi, [{tTicks: prevTick, vel: prevVel}, {tTicks: curTick, vel: curVel}])`. The helper already exists for shift+click interpolation; we re-use it. After dispatch, the previous sample advances to `(curTick, curVel)`. Right-drag uses the same primitive with empty replacements: `replaceDJEventsInRange(trackId, pitch, lo, hi, [])`. AT mode applies the same rule to `event.pressure` via the existing `setEventPressure(trackId, pitch, eventIdx, points)` mutator, computing the next `points` array by filtering out points whose `t` is in the swept range and re-inserting the two endpoints (paint) or just filtering (right-drag).

**Trade-off:** undo granularity is one history entry per `replaceDJEventsInRange` dispatch (i.e. per `pointermove` that moves the sample) — same posture as the rest of the app, which records per-mutation. "One drag = one undo entry" would need a session-level history-grouping API we don't have yet; out of scope.

**Alternatives considered:**
- *Per-cell upsert during drag (today's behavior).* Rejected — leaves stale events in skipped cells, which users perceive as "the drag missed cells".
- *Linearly interpolated fill across in-between cells.* Rejected — turns drag into shift+drag and inflates the event count. Users wanted a sweep, not interpolation; if they want a smooth line they shift+click.
- *Step-fill in-between cells with the current `vel`.* Rejected — produces stair-stepped trails that visually contradict the user's continuous gesture and inflate the event count.

### 6. Bulk-op range is the timeline viewport (CC/PB) or event span (AT)

`Smooth` / `Flatten` / `Clear` always need a finite range. We choose:

- **CC/PB**: the timeline's currently-visible tick range (`scrollLeft → scrollLeft + clientWidth` converted via `pxPerTick`). Points outside that range are untouched. The 16-bin rasterise/smooth/flatten primitives operate on that range and replace the events inside it with 16 evenly-spaced points at the smoothed/flattened values.
- **AT**: the event's full span (`[event.tTicks, event.tTicks + event.durTicks]`). Same 16-bin primitives, written into `event.pressure` as note-relative `t`.

**Alternatives considered:** a session-wide range (rejected — Clear would surprise users by wiping the whole row); a free user-selected range via marquee (rejected — adds a selection model we explicitly excluded). The viewport is the user's intuitive "what I see" and is easy to communicate.

### 7. Pitch-bend tick-0 center emit and panic

To put receivers in a deterministic state:

- At play start, the scheduler emits `0xE_ 0x00 0x40` (LSB=0, MSB=64 → 14-bit value 8192, MIDI neutral) on every distinct `(outputId, channelByte)` pair that has at least one row with `out === 'pb'`. This happens once, before the first scheduled event of the play session. No tick-0 emit happens for CC rows — preserves current behavior; per-row "starting value" config is a separate, deferred follow-up.
- On stop / pause / mode-leave-play, the existing panic flush is extended: for every `(outputId, channelByte)` pair that produced *any* dispatch during the session AND has at least one PB-output row, emit one `0xE_ 0x00 0x40` after the All-Notes-Off / CC-#123 broadcast.

Two PB-output rows on the same channel produce one shared wire-level PB stream (the MIDI spec only allows one PB value per channel). The scheduler emits each row's painted points in tick order; ties between rows on the same channel are broken by `track.events` insertion order. This is documented behavior, not a UI constraint — users authoring two PB rows on the same channel should expect the cumulative interleave.

### 8. PressureEditor retirement is concurrent, not deferred

The Inspector's pressure section is removed in the same change. Helpers in `src/data/pressure.ts` are kept on a per-need basis: `synthesizePressure` / `rasterizePressure` / `smoothPressure` / `flattenPressure` survive (lane body and the new editor both depend on them); `summarizePressure` / `clearPressure` are removed (the editor doesn't need a count/peak/avg readout, and `setEventPressure(..., [])` replaces the `clearPressure` indirection).

The `dj-pressure-editor` capability spec is **archived** on apply (moved under `openspec/specs/_archived/`). The still-relevant type-contract and helper-purity requirements migrate verbatim into `dj-value-editor`'s spec so test surface is preserved; the Inspector-rendering and DOM-shape requirements are dropped because the editor moved.

**Alternatives considered:** keep the Inspector section as a fallback (rejected — two editors writing to the same data would diverge in subtle ways, and the design's selection-to-mode mapping already covers the case the Inspector handled). Deferring the deletion to a follow-up (rejected — the new editor is the more discoverable surface and Inspector pressure section requires the user to know to select an event; we'd be shipping two compete UIs in the meantime).

### 9. Editor resize is via the header strip's top edge, persisted

The 24px header strip's top edge is the resize-grip. `cursor: row-resize` on hover; pointer-drag on that edge sets the editor's `height` (clamped `48..400`). Value is written to `localStorage` under `mr.dj-value-editor.heightPx` (JSON number, debounced ~200ms). Initial height: read the persisted value on mount, fallback to 96px.

**Alternatives considered:** putting the grip on the editor's outer-top border with a 4px hit-zone (rejected — collides with `Statusbar` hover; the 24px header strip already has comfortable hit-zone for `cursor: row-resize`). Resize via a chip in the header (rejected — discoverability of a drag-grip is higher).

### 10. Multi-item selection hides the editor

If `djActionSelection` *and* `djEventSelection` are both set, the editor mounts (this is the AT case). If either selection points to multiple items (e.g. a marquee selection through a future change), the editor hides — no implicit "first of selection" fallback.

For the current session model, "multi-item selection" doesn't exist at the data layer; this rule is forward-defensive against the marquee-selection follow-up. Practical effect today: every selection state either resolves to a single mode or to hidden.

## Risks / Trade-offs

- **[Risk]** Mirroring `scrollLeft` from outside the timeline's scroll container introduces a per-frame DOM read → **Mitigation**: subscribe to the timeline's `scroll` event with a `passive` listener and only update the editor's transform; rAF-batch the read.
- **[Risk]** Pitch-bend interleave on shared channels surprises users → **Mitigation**: document in the editor header ("PB · CH 16 — shared with row N" when two rows target the same channel); also surface as a future warning chip if friction shows up.
- **[Risk]** Incremental drag writes blow up history with one entry per cell → **Acceptable for now**: matches existing per-mutation undo behavior; a session-level history-grouping API is out of scope.
- **[Risk]** Editor footer competes with screen real estate when many DJ tracks are stacked → **Mitigation**: editor mounts only when a value-bearing selection is active; users without a selection see no footer.
- **[Risk]** Deleting `summarizePressure` removes a public-ish helper consumers might import → **Verified**: only the Inspector's pressure section uses it today, and that section is being removed in the same change. `clearPressure` is also confined to the Inspector. Safe to remove without a deprecation shim.
- **[Risk]** AT-mode gesture clamping (snapped tick must lie inside event span) interacts oddly when the event is shorter than the active grid → **Mitigation**: when `durTicks < quantizeGridTicks`, the window mask still allows clicks at the exact pointer tick (no snap) — degrades gracefully to "free" mode inside the event.
- **[Trade-off]** No "drag-snap-to-existing-point" affordance (i.e. snapping vertical position to an existing value to make a flat segment easy). Acceptable: Smooth / Flatten chips cover the common case; users can also paint two equal values via shift+click.
- **[Trade-off]** Snap model differs between drag-to-move (delta-snap) and value-editor paint (absolute-snap). Documented decision (Decision 4) — the two gestures have different intents and operate on different surfaces.

## Migration Plan

- **Data**: no migration needed. Legacy `outputMap` entries with `cc !== undefined` and no `out` field are interpreted as `'cc'` by the dispatcher; the editor materialises `out: 'cc'` on the next Inspector save (low-risk, no breaking moment).
- **Specs**: `openspec/specs/dj-pressure-editor/spec.md` moves under `openspec/specs/_archived/` during apply. The new `openspec/specs/dj-value-editor/spec.md` is created from the change's capability spec at apply time.
- **Code**: deletion of `PressureEditor.css` and the Inspector pressure section is the only non-additive code change. Tests covering the Inspector pressure DOM are removed in the same change.
- **Rollback**: revert the change commit; legacy `outputMap` entries are untouched, so a rollback restores the previous behavior cleanly. The only one-way step is the Inspector pressure section deletion — re-introducing it would mean re-importing the previous component, which is recoverable from git history.

## Open Questions

- **Editor opacity / dim while playing**: should the editor's gesture surface dim or disable during playback so users don't accidentally paint over data while the playhead crosses the canvas? **Default**: leave gestures live during playback (matches `ActionRoll` drag-to-move). Revisit if user testing shows misclick frequency is non-trivial.
- **Visual representation of PB negative values**: `vel === 0.5` is the MIDI center. The current spec maps `vel === 0` to canvas bottom and `vel === 1` to canvas top, with the value-scale legend showing `−` / `0` / `+` for PB mode. **Open**: do we additionally draw a horizontal "center line" through the canvas in PB mode to make the bipolar shape easier to read? **Default**: yes, a 1px dashed line at `y = canvas_height / 2` in PB mode only. Cheap to add; high readability win.
- **Per-row "starting value" emit at song start (CC + PB)**: deferred to a separate change (`BACKLOG.md`). Today: PB rows emit center at tick 0 (this change); CC rows emit nothing until the first painted point (unchanged from current behavior).
