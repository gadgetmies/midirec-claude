## MODIFIED Requirements

### Requirement: Stage SHALL mutate DJ action event durTicks with coordinated CC cluster scaling

The codebase SHALL expose a `setDJEventDurTicks(trackId, pitch, eventIdx, nextDurTicks, baseline?)` mutation API reachable via `useStage()` (delegating into `useDJActionTracks`) that updates the **duration** of the DJ timeline item identified by `djEventSelection`.

The committed value SHALL be clamped to a minimum of `1` tick (`max(1, round(nextDurTicks))`).

**Single event (non-cluster, or a cluster member that is NOT the cluster representative).** The mutator SHALL set the referenced event's `durTicks` to the clamped value and leave all other events unchanged. Pressure samples on the event SHALL NOT be re-translated because `PressurePoint.t` is normalized to `[0,1]` of the event's duration (see `src/data/dj.ts`) and therefore survives `durTicks` changes by construction.

**Cluster representative (CC merged group with ≥ 2 members).** When `eventIdx` is the `representativeIdx` of a `CcMergedGroup` (per `buildCcMergedGroupsByMemberIndex`), the mutator SHALL treat `nextDurTicks` as the **new total span of the cluster** (`newSpanTicks`). The first member's start (`t0Ticks = representative.tTicks`) SHALL be unchanged.

The mutator SHALL accept an optional `baseline` argument shaped:

```
ClusterResizeBaseline = {
  memberTTicks: ReadonlyMap<number /* eventIdx */, number /* tTicks at baseline */>,
  spanTicks: number,            // max(member.tTicks + member.durTicks) - t0Ticks at baseline
  trailingIdx: number,          // event index of the trailing member at baseline time
  trailingDurTicks: number,     // trailing member's durTicks at baseline time
}
```

**Baseline-relative scaling (when `baseline` is provided).** For each member with index `idx` in the cluster, the mutator SHALL set `newTTicks = t0Ticks + round((baseline.memberTTicks.get(idx) - t0Ticks) * scale)`, where `scale = newSpanTicks / baseline.spanTicks`. The trailing member SHALL be `baseline.trailingIdx` (the trailing member SHALL NOT change identity across the edit session). The trailing member's `newDurTicks` SHALL equal `max(1, t0Ticks + newSpanTicks - newTTicks_trailing)`. Non-trailing members' `durTicks` SHALL be unchanged.

**Fallback scaling (when `baseline` is omitted or empty).** The mutator SHALL fall back to the previous behavior: `scale = newSpanTicks / oldSpanTicks` where `oldSpanTicks = max(member.tTicks + member.durTicks) − t0Ticks` from the pre-mutation cluster; member offsets are rounded from current `tTicks`; trailing member is the pre-mutation member with the largest `tTicks + durTicks`; trailing `durTicks` is recomputed so cluster end equals `t0Ticks + newSpanTicks`.

**Round-trip invariant.** When `baseline` is provided and `newSpanTicks === baseline.spanTicks`, the mutator SHALL produce member `tTicks` and `durTicks` values identical to the baseline (modulo `t0Ticks`, which remains the representative's current `tTicks`). This SHALL hold regardless of how many intermediate commits with smaller or larger `newSpanTicks` have occurred during the same edit session.

The mutator SHALL be a no-op (returns the input reference) for unknown track ids, out-of-range `eventIdx`, `pitch` mismatches, or when the clamped `nextDurTicks` equals the referenced event's current `durTicks` (single-event case) or equals the active cluster span (cluster representative case: `oldSpanTicks` when no baseline, `baseline.spanTicks` when baseline is provided AND every member's current `tTicks`/`durTicks` already match the baseline-projected values for that span).

The mutator SHALL NOT change any event's `tTicks` in the single-event case. In the cluster-representative case it MAY change non-representative members' `tTicks` (via offset rounding) but the representative member's `tTicks` SHALL remain at `t0Ticks`.

The implementation SHALL keep `djEventSelection` valid after the mutation.

**Inspector baseline lifecycle.** The Inspector SHALL capture a `ClusterResizeBaseline` for the active DJ event selection when (a) the selection points to a cluster representative AND (b) no baseline currently exists for that `(trackId, pitch, eventIdx)`. The Inspector SHALL pass that baseline as the fifth argument on every `setDJEventDurTicks` call from its length editors (`lengthBeatsDraft`, `lengthTicksDraft`, `endBbtDraft`, `endTicksDraft`). The Inspector SHALL clear the baseline when `djEventSelection` changes to a different `(trackId, pitch, eventIdx)`, when `djEventSelection` becomes null, or when the cluster's member set differs from the baseline's `memberTTicks` keys.

#### Scenario: Single event durTicks update changes only the targeted event

- **WHEN** `djEventSelection` references a single (non-clustered) event with `durTicks = 240` and the user commits `nextDurTicks = 480`
- **THEN** that event's `durTicks` SHALL equal `480`
- **AND** that event's `tTicks` SHALL be unchanged
- **AND** no other event SHALL be modified
- **AND** any `pressure` samples on the event SHALL retain their original normalized `t` values

#### Scenario: Single event durTicks clamps to minimum 1 tick

- **WHEN** the user commits `nextDurTicks = 0` (or any negative value) for a single event
- **THEN** that event's `durTicks` SHALL equal `1`

#### Scenario: Cluster representative durTicks scales member offsets and trailing member (baseline-relative)

- **WHEN** `djEventSelection.eventIdx` is the `representativeIdx` of a merged CC cluster with members at offsets `[0, 120, 240]` from `t0Ticks` and trailing-member `durTicks = 60`, giving baseline `spanTicks = 300`, and the user commits `nextDurTicks = 600` with a baseline captured from that state (so `scale = 2`)
- **THEN** members SHALL move to offsets `[0, 240, 480]` (each rounded to the nearest tick) so their new `tTicks` are `[t0Ticks, t0Ticks+240, t0Ticks+480]`
- **AND** the representative member's `tTicks` SHALL remain at `t0Ticks`
- **AND** the trailing member's `durTicks` SHALL be adjusted so its end (`tTicks + durTicks`) equals `t0Ticks + 600`
- **AND** non-trailing members' `durTicks` SHALL be unchanged

#### Scenario: Cluster representative durTicks clamps to minimum 1 tick

- **WHEN** `djEventSelection.eventIdx` is a cluster representative and the user commits `nextDurTicks = 0`
- **THEN** `newSpanTicks` SHALL equal `1`
- **AND** the trailing member's end SHALL equal `t0Ticks + 1`

#### Scenario: Non-representative cluster member durTicks update is single-event semantics

- **WHEN** `djEventSelection.eventIdx` is a member of a CC cluster but NOT the cluster representative, and the user commits a new `durTicks`
- **THEN** only that member's `durTicks` SHALL be set (no cluster-wide scaling)
- **AND** all other members SHALL be unchanged

#### Scenario: No-op when committed value equals current

- **WHEN** the user commits `nextDurTicks` equal to the current `durTicks` (single event) or equal to the active cluster span (cluster representative)
- **THEN** the mutator SHALL return the input `tracks` reference unchanged

#### Scenario: No-op for invalid selection

- **WHEN** `eventIdx` is out of range OR `track.events[eventIdx].pitch !== pitch` OR no track has the given `trackId`
- **THEN** the mutator SHALL return the input `tracks` reference unchanged

#### Scenario: Cluster span round-trip restores original member positions exactly

- **WHEN** a cluster representative is selected with members at baseline offsets `[0, 73, 211]` and baseline `spanTicks = 240`, and the user commits in sequence: `nextDurTicks = 80` (shrink, `scale = 1/3`), then `nextDurTicks = 30`, then `nextDurTicks = 240` (back to baseline) — all with the same baseline passed through
- **THEN** after the final commit, member offsets SHALL equal `[0, 73, 211]` exactly
- **AND** the trailing member's `durTicks` SHALL equal its baseline `trailingDurTicks`
- **AND** non-trailing members' `durTicks` SHALL be unchanged from baseline

#### Scenario: Baseline-relative scaling bounds per-commit rounding error to ≤ 0.5 tick

- **WHEN** a baseline cluster has a member at offset `73` and the user commits `nextDurTicks = 100` against `baseline.spanTicks = 240` (so `scale = 100/240 ≈ 0.4167`)
- **THEN** that member's new offset SHALL be `round(73 * 0.4167) = 30`
- **AND** the absolute error from the unrounded target (`30.42`) SHALL be ≤ `0.5` tick
- **AND** a subsequent commit with `nextDurTicks = 240` SHALL restore that member to offset `73`

#### Scenario: Fallback scaling (no baseline) preserves prior behavior

- **WHEN** `setDJEventDurTicks` is called with `baseline` omitted (or `undefined`) for a cluster representative with current member offsets `[0, 120, 240]` and `oldSpanTicks = 300`, committing `nextDurTicks = 600`
- **THEN** the mutator SHALL scale from the current state: new offsets `[0, 240, 480]`, trailing dur recomputed so end equals `t0Ticks + 600`
- **AND** repeated round-trip commits without a baseline MAY drift (this is the legacy behavior; callers SHOULD pass a baseline to avoid drift)

#### Scenario: Inspector captures baseline on cluster selection and clears on selection change

- **WHEN** `djEventSelection` becomes `(trackId=T, pitch=P, eventIdx=R)` where `R` is a cluster representative and the Inspector has no baseline for `(T,P,R)`
- **THEN** the Inspector SHALL capture a baseline holding the current `memberTTicks`, `spanTicks`, `trailingIdx`, and `trailingDurTicks`
- **AND** all subsequent `setDJEventDurTicks` calls from the Inspector's length editors while `(T,P,R)` remains the active selection SHALL pass that captured baseline
- **WHEN** `djEventSelection` changes to a different `(trackId, pitch, eventIdx)` OR becomes `null`
- **THEN** the Inspector SHALL clear the baseline
- **AND** re-selecting `(T,P,R)` after the cluster's `memberIndices` set has changed SHALL capture a fresh baseline (not reuse the cleared one)
