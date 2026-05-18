## Why

When the user resizes a CC merged group (cluster) via the Inspector length fields and then returns the span to its original value, the cluster's internal member positions no longer match where they started. The current implementation in `applySetDJEventDurTicks` scales each member's tick offset by `newSpan/oldSpan` and rounds to the nearest integer tick on every edit. Successive edits compound rounding error: shrinking and re-expanding is not a no-op, so members visibly drift even though the user expects a round-trip to be exact.

## What Changes

- **BREAKING** for `applySetDJEventDurTicks` callers: the cluster-representative branch SHALL scale member offsets from a **baseline snapshot** of the original cluster (taken once when the edit session begins), not from the current (already-mutated) member positions. Returning the span to its baseline value SHALL restore every member's `tTicks` and `durTicks` exactly.
- The Inspector length controls (`lengthBeatsDraft`, `lengthTicksDraft`, `endBbtDraft`, `endTicksDraft`) SHALL capture the cluster baseline when the user opens an edit session on a cluster representative and clear it when the selection changes or the field is committed by blur/Enter.
- The cluster baseline SHALL store original integer tick offsets per member (still integers — the data model is unchanged); fractional positions live only inside the scaling computation. The trailing member's `durTicks` SHALL be recomputed each edit so that `cluster end = t0Ticks + newSpanTicks`.
- No changes to single-event resize (non-cluster, non-representative): those branches are already round-trip stable.

## Capabilities

### New Capabilities
<!-- None — this change refines an existing requirement. -->

### Modified Capabilities
- `dj-action-tracks`: the "Cluster representative" requirement under DJ event duration mutation SHALL specify baseline-relative scaling so that span round-trips preserve member positions exactly.

## Impact

- Code: `src/hooks/useDJActionTracks.ts` (`applySetDJEventDurTicks` signature gains an optional baseline parameter, or a sibling mutator is introduced); `src/components/inspector/Inspector.tsx` (captures and threads the baseline through length editors).
- Specs: `openspec/specs/dj-action-tracks/spec.md` cluster-representative requirement and its scenarios.
- Tests: new round-trip scenarios in `src/components/dj-action-tracks/ActionRoll.test.tsx` (or a dedicated unit test next to `useDJActionTracks.ts`) verifying that `applySetDJEventDurTicks(applySetDJEventDurTicks(tracks, ..., smallerSpan), ..., originalSpan)` equals the input for representative clusters with non-uniform offsets.
- No data migration. No effect on playback engine, MIDI runtime, or persistence (events remain integer-tick).
