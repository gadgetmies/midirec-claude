## Context

The timeline currently renders piano-roll notes (`.mr-note`) and DJ action events (`.mr-djtrack__note`, plus CC-automation groups as `.mr-djtrack__cc`) as absolutely-positioned divs whose `left` is `tTicks * pxPerTick` (with `pxPerTick = pxPerBeat / TPQ`). The session model already exposes:

- `updateNoteAt(channelId, index, { tTicks })` — for piano-roll notes (`src/hooks/useChannels.ts` → surfaced on `useStage()` as `updateNoteAt`).
- `setDJEventTTicks(trackId, pitch, eventIdx, nextTTicks)` — for DJ events (`src/hooks/useDJActionTracks.ts` → surfaced as `setDJEventTTicks`).

The transport (`src/hooks/useTransport.tsx`) holds `quantizeOn: boolean` and `quantizeGrid: '1/4' | '1/8' | '1/16' | '1/32'`. Today nothing in the codebase converts that string into ticks; it's only displayed in the titlebar Q chip.

Items receive `onPointerDown` / `onClick` for selection. Piano-roll calls `event.stopPropagation()` then `onNoteSelect(i)`; DJ action calls `setDJEventSelection({...})`. There is no existing drag infrastructure on item bodies.

## Goals / Non-Goals

**Goals:**

- Add horizontal drag-to-move for piano-roll notes and DJ action events / CC groups in the timeline.
- Honor transport quantize: snap to grid when on, free (per-tick) move when off.
- Preserve existing click-to-select behavior — a sub-threshold drag is a click.
- Commit exactly once per gesture (on `pointerup`) so undo granularity is per-drag.
- Clamp to non-negative `tTicks`.

**Non-Goals:**

- Vertical movement (changing pitch / row) is out of scope for this slice.
- Resizing items (changing `durTicks`) is out of scope — there's already an Inspector editor.
- Multi-select group drag is out of scope — a single dragged item is the unit.
- Cross-track / cross-channel drag is out of scope.
- New undo/redo plumbing is out of scope; this slice piggybacks on whatever the existing mutators do.

## Decisions

### 1. Quantize grid → ticks helper lives in `src/midi/`

We add a pure helper `quantizeGridToTicks(grid: QuantizeGrid, tpq?: number): number` with the mapping:

| grid    | ticks (at TPQ=480) |
|---------|--------------------|
| `1/4`   | `tpq` (480)        |
| `1/8`   | `tpq / 2` (240)    |
| `1/16`  | `tpq / 4` (120)    |
| `1/32`  | `tpq / 8` (60)     |

`tpq` defaults to `DEFAULT_MIDI_TPQ`. Placing it in `src/midi/` matches `sessionTicks.ts` / `timelineTicks.ts`.

**Alternatives considered:** inlining the map at each call site (rejected — two call sites would diverge); putting it on the transport hook (rejected — transport shouldn't own conversion math, it owns state).

### 2. Drag handler is local to each roll component

Each of `PianoRoll.tsx` and `ActionRoll.tsx` owns its own pointer-down → move → up state machine using `useRef` for the in-flight gesture (start pointer X, start tick, item identity) and `useState` for the live preview tick. We do NOT extract a shared `useDragMove` hook in this slice — the two call sites differ enough (per-note callback vs CC-group batched update) that a shared hook would be premature.

**Alternatives considered:**
- A shared `useTimelineDrag(itemRef, { tTicks, pxPerTick, snapTicks, onCommit })` hook. Rejected for now; revisit if a third call site appears.
- Native HTML5 drag-and-drop API. Rejected — `dragstart` / `dragover` / `drop` is heavyweight, has cursor & image quirks, and doesn't surface continuous coordinates as cleanly as Pointer Events. Pointer Events also unify mouse / touch / pen out of the box.

### 3. Threshold for "click vs drag"

A pointer must move at least **3 px** horizontally before the gesture is treated as a drag. Below the threshold, on `pointerup` the existing selection callback fires and no `tTicks` mutation is dispatched. The 3 px threshold is the smallest value that reliably suppresses jitter on a precise mouse without making touch drags feel sluggish; tunable as a module constant.

### 4. Snapping math — delta-snap, not absolute-snap

For a gesture starting at pointer X `px0` with item start tick `tick0`:

```
deltaPx = currentPx - px0
deltaTicksRaw = round(deltaPx / pxPerTick)
if (quantizeOn) {
  snap = quantizeGridToTicks(quantizeGrid)
  deltaTicks = round(deltaTicksRaw / snap) * snap
} else {
  deltaTicks = deltaTicksRaw
}
finalTick = max(0, tick0 + deltaTicks)
```

**The delta is what snaps, not the final position.** An item placed at `tTicks=154` and dragged by one `1/16` (120 ticks) lands at `274`, not `240` — the off-grid offset is preserved. Users who intentionally placed an item off-grid (live recording, swing-style nudge, micro-timing) should not have that intent erased the moment they nudge it.

The downside is that an off-grid item stays off-grid forever under drag — there's no way to "re-align" it without the Inspector. We accept this because the Inspector start editor exists, and because a separate `snapAbsoluteOn` transport toggle is planned (see follow-up change) that flips the behavior to absolute snap when the user does want re-alignment.

**Alternatives considered:**
- Snapping the pointer X (rejected — at high zoom the item snaps "early" because the pointer is offset from the item's leading edge).
- Snapping the absolute final tick (rejected as the default — resets any prior off-grid offset on every drag; users found this punitive in practice. Will be available as an opt-in `snapAbsoluteOn` mode in a follow-up change).

### 5. Commit timing

Mutations dispatch **only on `pointerup`** — never on `pointermove`. During the move, the dragged element re-renders at the preview tick via local state. This:

- Keeps undo per-gesture (one entry, not one-per-frame).
- Avoids storms of reducer dispatches at 60+ Hz.
- Keeps the upstream `notes` / `events` array identity stable mid-gesture (no React re-mount of every sibling note).

If `pointercancel` fires (e.g. system gesture interrupt), the gesture is aborted with no mutation — the live preview state resets.

### 6. CC group drag commits as a batched per-member update

For DJ CC-automation groups (`.mr-djtrack__cc`), dragging the representative element moves **every member event by the same tick delta**. On commit, we iterate `group.memberIndices` and call `setDJEventTTicks` once per member with the same delta applied. This preserves the group's internal spacing and keeps the existing `buildCcMergedGroupsByMemberIndex` regrouping logic correct on the next render (members still cluster).

**Alternative:** introduce `setDJEventTTicksBatch` to commit atomically. Rejected for this slice — N small dispatches in a single tick are fine for our session sizes and avoid scope creep into the reducer.

### 7. Pointer capture & global listeners

On `pointerdown` we call `element.setPointerCapture(pointerId)` so subsequent `pointermove` / `pointerup` events fire on the element even when the pointer leaves its bounds. This avoids needing a `window.addEventListener` escape hatch and means the gesture cleans up automatically when the element unmounts.

### 8. The piano-roll keys column does not need a drag handler

`onNoteSelect` is already an optional prop and only items in the lane area receive pointer events. The keys column (`.mr-keys`) renders elsewhere and isn't affected. No change needed.

## Risks / Trade-offs

- **[Risk]** Drag interferes with text selection or marquee gestures on the lane background → **Mitigation**: `event.stopPropagation()` on the item's `pointerdown` (already in place for selection) stops the event from bubbling to lane-level marquee handlers.
- **[Risk]** With quantize off and tight zoom (`pxPerBeat` low), a single pixel of pointer motion can move the item by many ticks, making fine alignment hard → **Acceptable trade-off**: the user can zoom in or turn quantize on. This is consistent with other DAWs.
- **[Risk]** A sub-threshold drag that ends with `pointerup` on a different element (e.g. the user accidentally rolled off a 6 px-wide trigger event) loses the click → **Mitigation**: pointer capture (Decision 7) keeps the pointer events on the originating element regardless of where the pointer ends up.
- **[Risk]** CC group drag dispatches N reducer actions per commit; large groups (~hundreds of events) could feel laggy → **Acceptable for now**: typical groups are <50 events. Revisit with a batched mutator if profiling shows otherwise.
- **[Trade-off]** No keyboard nudge in this slice. The Inspector start editor already covers numeric input; arrow-key nudge can be added later without touching this gesture's code.

## Migration Plan

No data migration. No backwards-compat shims. The new gesture is purely additive — components that don't render `.mr-note` / `.mr-djtrack__note` are unaffected, and the existing click-to-select path remains the default outcome for any pointer interaction shorter than the 3 px threshold.

## Open Questions

- Should the drag preview show a faint "ghost" at the original position to communicate where the item came from? **Default: no** for simplicity; revisit if user testing finds the live-snap feedback insufficient.
- Should holding a modifier (e.g. Shift) temporarily invert the quantize behavior (snap when off, free when on)? **Default: no** for this slice; standard DAW convention is Shift-temporarily-disable-snap, which we can add later as a one-line condition without re-architecting.
