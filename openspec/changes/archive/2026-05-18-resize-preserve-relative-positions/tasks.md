## 1. Mutator: add baseline-relative scaling

- [x] 1.1 Add `ClusterResizeBaseline` type to `src/hooks/useDJActionTracks.ts` (export alongside existing DJ types) with fields `memberTTicks: ReadonlyMap<number, number>`, `spanTicks: number`, `trailingIdx: number`, `trailingDurTicks: number`.
- [x] 1.2 Extend `applySetDJEventDurTicks` signature with optional 5th arg `baseline?: ClusterResizeBaseline`.
- [x] 1.3 In the cluster-representative branch, when `baseline` is provided: compute `scale = newSpanTicks / baseline.spanTicks`; iterate `baseline.memberTTicks` to set each member's `tTicks = t0Ticks + round((baselineTTicks - t0Ticks) * scale)`; use `baseline.trailingIdx` as the trailing member; set trailing `durTicks = max(1, t0Ticks + newSpanTicks - newTrailingTTicks)`; leave non-trailing `durTicks` unchanged.
- [x] 1.4 When `baseline` is omitted, keep the current current-state-scaling fallback path intact.
- [x] 1.5 Update no-op detection: when `baseline` is provided and `newSpanTicks === baseline.spanTicks` AND every member's current state already matches the baseline projection for that span, return the input `tracks` reference unchanged.

## 2. Mutator: thread baseline through hook + stage

- [x] 2.1 Update `setDJEventDurTicks` action signature in `useDJActionTracks` (action surface and the `useCallback` wrapper at lines ~447 of `src/hooks/useDJActionTracks.ts`) to accept the optional `baseline` argument and pass it into `applySetDJEventDurTicks`.
- [x] 2.2 Update the corresponding type on `useStage()` (`src/hooks/useStage.tsx` lines ~116, ~379) so the Inspector consumes the new signature.
- [x] 2.3 Update the `setDJEventDurTicks` prop type and inner usage in `src/components/inspector/Inspector.tsx` (declarations around lines 382, 584, 608, 617–621) to match the new signature.

## 3. Inspector: baseline lifecycle

- [x] 3.1 In `Inspector.tsx`, add `clusterResizeBaselineRef` (a `useRef<ClusterResizeBaseline | null>(null)`) plus a key ref to track `(trackId, pitch, eventIdx)` for which the baseline was captured.
- [x] 3.2 Add an effect that runs when `djEventSelection` changes: if the new selection points to a cluster representative (use `buildCcMergedGroupsByMemberIndex` results already available in selection context, or re-compute from the active track) AND the baseline key does not match the new selection key, capture a fresh baseline from current cluster state and update the key.
- [x] 3.3 When the selection clears OR changes to a non-cluster-representative event, set the baseline ref to `null` and clear the key.
- [x] 3.4 Add a guard inside the capture path: if the cluster's `memberIndices` set differs from the baseline's `memberTTicks` keys, recapture the baseline.
- [x] 3.5 In each of the four length-editor commit handlers (lines 685, 700, 713, 730 in `Inspector.tsx`), pass `clusterResizeBaselineRef.current ?? undefined` as the 5th argument to `setDJEventDurTicks`.

## 4. Tests

- [x] 4.1 Create `src/hooks/useDJActionTracks.applySetDJEventDurTicks.test.ts` (new file) covering:
  - 4.1.a Baseline-relative scale-down then scale-up to baseline span restores members exactly (offsets `[0, 73, 211]`, span `240` → `80` → `30` → `240`).
  - 4.1.b Baseline-relative single shrink-then-restore (offsets `[0, 7, 13]`, span `20` → `5` → `20`) restores exactly — the canonical failure case under integer-only scaling.
  - 4.1.c Per-commit rounding error ≤ 0.5 tick for arbitrary fractional `scale` values.
  - 4.1.d Trailing member identity is preserved across the session (uses `baseline.trailingIdx`, not recomputed each call).
  - 4.1.e Fallback path (no baseline) still produces the prior behavior — port the existing cluster scenario from `ActionRoll.test.tsx` or replicate it here.
  - 4.1.f No-op when `newSpanTicks === baseline.spanTicks` and state already matches projection.
- [ ] 4.2 Add an Inspector integration test (in the existing Inspector test file if one exists, otherwise a focused one) that verifies the baseline ref is captured on selection of a cluster representative, threaded through commit handlers, and cleared on selection change.
- [x] 4.3 Update any existing tests that asserted on the post-mutation `tTicks` of cluster members under the old current-state-scaling behavior to either pass a baseline (preferred) or remain on the fallback path with documented expectations. (No existing tests referenced `applySetDJEventDurTicks` or `setDJEventDurTicks` — verified by `grep` and by the full vitest run, all 307 prior tests still pass.)

## 5. Spec sync

- [x] 5.1 Apply the delta in `openspec/changes/resize-preserve-relative-positions/specs/dj-action-tracks/spec.md` to `openspec/specs/dj-action-tracks/spec.md` when archiving — done by `opsx:archive`, not in this implementation pass.
- [x] 5.2 Verify `openspec validate resize-preserve-relative-positions` passes after all artifacts are in place.

## 6. Manual verification

- [ ] 6.1 Run the app, select a CC cluster representative on a dj-action-track, edit the length down via the Inspector's length-ticks field, then edit it back to the original value. Confirm visually (and via the timeline tick readouts) that every member returned to its original tick.
- [ ] 6.2 Repeat 6.1 using the length-beats field and the end-BBT field to confirm all four length editors share the same baseline.
- [ ] 6.3 Change selection mid-session and re-select the same cluster: confirm a fresh baseline is captured (round-trip from the post-edit state should still work, but the *original* original is not restored — this is expected per the design).
