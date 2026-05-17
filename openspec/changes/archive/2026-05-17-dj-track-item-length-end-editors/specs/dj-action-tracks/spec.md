## ADDED Requirements

### Requirement: Stage SHALL mutate DJ action event durTicks with coordinated CC cluster scaling

The codebase SHALL expose a `setDJEventDurTicks(trackId, pitch, eventIdx, nextDurTicks)` mutation API reachable via `useStage()` (delegating into `useDJActionTracks`) that updates the **duration** of the DJ timeline item identified by `djEventSelection`.

The committed value SHALL be clamped to a minimum of `1` tick (`max(1, round(nextDurTicks))`).

**Single event (non-cluster, or a cluster member that is NOT the cluster representative).** The mutator SHALL set the referenced event's `durTicks` to the clamped value and leave all other events unchanged. Pressure samples on the event SHALL NOT be re-translated because `PressurePoint.t` is normalized to `[0,1]` of the event's duration (see `src/data/dj.ts`) and therefore survives `durTicks` changes by construction.

**Cluster representative (CC merged group with ≥ 2 members).** When `eventIdx` is the `representativeIdx` of a `CcMergedGroup` (per `buildCcMergedGroupsByMemberIndex`), the mutator SHALL treat `nextDurTicks` as the **new total span of the cluster** (`newSpanTicks`) and scale member offsets and the trailing member's `durTicks` so that the cluster's first start (`t0Ticks = representative.tTicks`) is unchanged, every member's offset from `t0Ticks` is rounded to `t0Ticks + round((member.tTicks − t0Ticks) * scale)` where `scale = newSpanTicks / oldSpanTicks`, the trailing member's `durTicks` is adjusted so that `trailing.tTicks + trailing.durTicks = t0Ticks + newSpanTicks`, and all other members' `durTicks` values are unchanged. The trailing member is the cluster member with the largest pre-mutation `tTicks + durTicks`. `oldSpanTicks` is `max(member.tTicks + member.durTicks) − t0Ticks` from the pre-mutation cluster.

The mutator SHALL be a no-op (returns the input reference) for unknown track ids, out-of-range `eventIdx`, `pitch` mismatches, or when the clamped `nextDurTicks` equals the referenced event's current `durTicks` (single-event case) or `oldSpanTicks` (cluster representative case).

The mutator SHALL NOT change any event's `tTicks` in the single-event case. In the cluster-representative case it MAY change non-representative members' `tTicks` (via offset rounding) but the representative member's `tTicks` SHALL remain at `t0Ticks`.

The implementation SHALL keep `djEventSelection` valid after the mutation.

#### Scenario: Single event durTicks update changes only the targeted event

- **WHEN** `djEventSelection` references a single (non-clustered) event with `durTicks = 240` and the user commits `nextDurTicks = 480`
- **THEN** that event's `durTicks` SHALL equal `480`
- **AND** that event's `tTicks` SHALL be unchanged
- **AND** no other event SHALL be modified
- **AND** any `pressure` samples on the event SHALL retain their original normalized `t` values

#### Scenario: Single event durTicks clamps to minimum 1 tick

- **WHEN** the user commits `nextDurTicks = 0` (or any negative value) for a single event
- **THEN** that event's `durTicks` SHALL equal `1`

#### Scenario: Cluster representative durTicks scales member offsets and trailing member

- **WHEN** `djEventSelection.eventIdx` is the `representativeIdx` of a merged CC cluster with members at offsets `[0, 120, 240]` from `t0Ticks` and trailing-member `durTicks = 60`, giving `oldSpanTicks = 300`, and the user commits `nextDurTicks = 600` (so `scale = 2`)
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

- **WHEN** the user commits `nextDurTicks` equal to the current `durTicks` (single event) or equal to `oldSpanTicks` (cluster representative)
- **THEN** the mutator SHALL return the input `tracks` reference unchanged

#### Scenario: No-op for invalid selection

- **WHEN** `eventIdx` is out of range OR `track.events[eventIdx].pitch !== pitch` OR no track has the given `trackId`
- **THEN** the mutator SHALL return the input `tracks` reference unchanged
