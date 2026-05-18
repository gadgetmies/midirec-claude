## Context

`applySetDJEventDurTicks` in `src/hooks/useDJActionTracks.ts` (lines 765–824) handles the cluster-representative resize for CC merged groups. On every commit it reads each member's *current* `tTicks`, computes `scale = newSpan / oldSpan` (from the current span), and rounds `t0Ticks + round((m.tTicks - t0Ticks) * scale)` to set the new `tTicks`. The trailing member's `durTicks` is recomputed to pin the cluster end.

Because the function reads current (already-mutated) positions and rounds to integer ticks each call, repeated commits compound rounding error. The Inspector's length editors (`Inspector.tsx` lines 685–732) fire `setDJEventDurTicks` per commit (typed value blur, BBT change, etc.), so a user who types a smaller span and then types back the original span gets shifted members.

The data model keeps `tTicks` and `durTicks` as integer ticks (per the wider spec base — TPQ-anchored ticks are the storage unit for every timeline event). Floats only need to live during the scaling computation.

## Goals / Non-Goals

**Goals:**
- Round-tripping the cluster span (shrink → original) SHALL restore every member's `tTicks` and `durTicks` exactly.
- Keep `tTicks`/`durTicks` as integer ticks in storage — no data-model changes.
- Keep the public mutator pure and idempotent; no hidden global state.
- Preserve current behavior for callers that do not provide a baseline (no regression for the non-Inspector path, even though there are no other callers today).

**Non-Goals:**
- Changing single-event (non-cluster, non-representative) resize semantics — already round-trip stable.
- Changing the drag-to-move (`tTicks`) gesture, which already snapshots originals at gesture start.
- Introducing sub-tick storage anywhere in the data model.
- Refactoring the Inspector's other length fields beyond what's required to thread the baseline.

## Decisions

### Decision 1: Baseline is captured by the caller and passed into the mutator

The mutator gains an optional `baseline` parameter:

```ts
interface ClusterResizeBaseline {
  /** Per-member-index baseline tTicks at edit-session start. Keys are
      event indices in `track.events`. */
  memberTTicks: ReadonlyMap<number, number>;
  /** Span at edit-session start: max(member.tTicks + member.durTicks) - t0Ticks. */
  spanTicks: number;
  /** Trailing member's baseline durTicks (used to recompute trailing dur from
      baseline rather than from the current, possibly-mutated value). */
  trailingDurTicks: number;
  /** Index of the trailing member at baseline time. Used to keep the same
      member as trailing across the whole edit session. */
  trailingIdx: number;
}
```

When `baseline` is provided and `eventIdx === group.representativeIdx`, the mutator computes:
- `scale = newSpanTicks / baseline.spanTicks`
- For each member: `newTTicks = t0Ticks + round((baseline.memberTTicks.get(idx) - t0Ticks) * scale)`
- Trailing member: `newDurTicks = max(1, t0Ticks + newSpanTicks - newTTicks_trailing)`. Non-trailing members keep their *current* `durTicks` (which equals baseline `durTicks` unless they were independently edited — see Decision 4).

When `baseline` is omitted, the mutator falls back to the current behavior (scale from current state). This keeps the function backward-compatible.

**Alternative considered:** Store baseline state inside `useDJActionTracks`'s reducer (a per-cluster anchor that persists until the cluster changes structurally). Rejected — adds hidden, non-obvious state to a pure mutator and complicates testing.

**Alternative considered:** Change `tTicks`/`durTicks` to floats and round only on read/serialize. Rejected — invasive across the codebase (every consumer of `tTicks` would need to be audited), and the rest of the spec base explicitly defines tick fields as integers.

### Decision 2: Inspector owns the baseline lifecycle

The Inspector maintains a `clusterResizeBaselineRef` keyed by `(trackId, pitch, eventIdx)`. The baseline is **captured** when:
- A new cluster-representative selection becomes active in the length-editing UI (selection change), AND
- A baseline does not already exist for that selection key.

The baseline is **cleared** when:
- The DJ event selection changes to a different `(trackId, pitch, eventIdx)`, or
- The cluster membership changes (member added/removed/structurally re-grouped — detected by comparing `memberIndices` to baseline keys), or
- The selection clears (`djEventSelection === null`).

Holding the baseline across multiple commits within the same edit session is what makes round-trips exact. Once the user moves on (selects a different event), the baseline is discarded and the next session captures a fresh one.

**Why selection-scoped rather than focus-scoped:** A user may switch between length-beats and length-ticks inputs within a single editing session and still expect round-trip stability. Selection scope covers that without requiring blur/focus coordination across multiple inputs.

### Decision 3: Drift inside a session is bounded by single-step rounding

Because every commit in the session scales from the *same* baseline (not the previous commit's result), the max error per member at any commit is `0.5` tick (single rounding), independent of how many commits have happened. Round-tripping span back to baseline yields scale `= 1`, so `round(offset * 1) = offset` — exact restoration.

### Decision 4: Independent edits inside the cluster invalidate the baseline

If the user resizes the cluster, then drags a member, then resizes the cluster again, scaling from the original baseline would clobber the manual drag. The Inspector SHALL clear the baseline whenever any mutation other than `setDJEventDurTicks` on the representative is observed for an event in the cluster — simplest detection: clear the baseline whenever `djEventSelection` changes OR the cluster's `memberIndices`/non-trailing `durTicks`/non-representative `tTicks` change vs. baseline.

For the first delivery we accept a coarser invalidation: clear on **any selection change** and on **any cluster membership change**. Manual member drags within the cluster while the cluster is selected are not expected during a length-editing session and can be addressed in a follow-up if it becomes a real workflow.

## Risks / Trade-offs

- **[Risk] Baseline becomes stale due to async updates** → Mitigation: store baseline in a ref captured synchronously alongside the selection state; recompute on the same render that detects the structural mismatch.
- **[Risk] Non-Inspector callers get the old (drifting) behavior** → Acceptable: there are no other callers today (verified by grep on `setDJEventDurTicks`). New callers SHOULD pass a baseline; the optional parameter keeps the API safe.
- **[Trade-off] Slightly larger Inspector state surface** → One ref plus a small effect; the additional code is local to the Inspector's cluster-resize wiring.

## Migration Plan

1. Add the optional `baseline` parameter to `applySetDJEventDurTicks` and to the `setDJEventDurTicks` action surface (`useDJActionTracks`, `useStage`, Inspector prop). Existing call sites without a baseline keep working.
2. Wire the Inspector to capture/clear the baseline and pass it on every commit while a cluster representative is selected.
3. Update `openspec/specs/dj-action-tracks/spec.md` (delta in this change) and add round-trip scenarios.
4. Add unit tests covering: shrink-then-restore exactness; multi-step shrink (3 commits) still round-trips on the final restore; baseline invalidation on selection change; non-representative member edits unaffected.
5. No data migration; no runtime feature flag.
