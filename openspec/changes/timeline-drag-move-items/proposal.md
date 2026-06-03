## Why

Timeline items (piano-roll notes and DJ action events) currently have no direct-manipulation gesture for moving them in time. Users can only nudge via the Inspector's Start editor (BBT + ticks) or by re-recording. Drag-and-drop is the conventional, expected interaction for any DAW-style timeline and gives users a fast, precise way to align items against the musical grid.

## What Changes

- Add a horizontal drag-to-move gesture on `.mr-note` (piano-roll) and `.mr-djtrack__note` (DJ action) items in the timeline, including the CC-automation group element (`.mr-djtrack__cc`).
- A drag begins on `pointerdown` on an item and ends on `pointerup`/`pointercancel`; the item's `tTicks` is the only value mutated (pitch / row are not changed in this slice — purely horizontal).
- Movement snapping derives from transport quantize state:
  - **Quantize ON**: the dragged item's start tick SHALL snap to the nearest multiple of the grid size derived from `quantizeGrid` (`1/4` → TPQ, `1/8` → TPQ/2, `1/16` → TPQ/4, `1/32` → TPQ/8).
  - **Quantize OFF**: movement is free — the dragged item's start tick SHALL be the pointer-delta converted via `pxToTick = 1 / pxPerTick` (no grid snapping, just sub-beat positioning rounded to integer ticks).
- Items SHALL NOT move to negative `tTicks` (clamped at 0).
- A click without movement (drag distance below a small threshold) preserves the existing selection behavior — drag MUST NOT swallow click-to-select.
- The mutation commits to session state on `pointerup` (not on every move) so the existing reducer remains the single source of truth and undo granularity stays per-gesture.
- A visual "ghost" position SHALL track the pointer during the gesture: the item itself re-renders at the snapped position each frame so the user sees alignment feedback live.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `piano-roll`: Add a requirement covering the horizontal drag-to-move gesture on `.mr-note`, snapping behavior under both quantize states, and commit-on-pointerup semantics.
- `dj-action-tracks`: Add a requirement covering the equivalent gesture on `.mr-djtrack__note` and `.mr-djtrack__cc`, including the CC-group case where dragging the representative element moves every member event by the same tick delta.

## Impact

- **Code**:
  - `src/components/piano-roll/PianoRoll.tsx` — add `onPointerDown` drag handling on note elements, dispatching `updateNoteAt` on commit.
  - `src/components/dj-action-tracks/ActionRoll.tsx` — same pattern for `.mr-djtrack__note` and CC group, dispatching `setDJEventTTicks` (one call for single events, batched per group member for CC groups).
  - `src/hooks/useTransport.tsx` — expose a small helper for grid-tick size (or compute inline at the call site from existing `quantizeGrid` / `quantizeOn`).
  - `src/hooks/useStage.tsx` — surface `quantizeOn` + `quantizeGrid` (already in transport) to the roll components if not already wired through props.
  - Possibly extract `quantizeGridToTicks(grid: QuantizeGrid, tpq: number): number` into `src/midi/`.
- **Specs**: modify `openspec/specs/piano-roll/spec.md` and `openspec/specs/dj-action-tracks/spec.md`.
- **No** changes to MIDI runtime, recording, playback, routing, or data shapes (`tTicks` already exists on both `Note` and `ActionEvent`). Inspector editors are unaffected — they continue committing through the same mutators the drag gesture uses.
