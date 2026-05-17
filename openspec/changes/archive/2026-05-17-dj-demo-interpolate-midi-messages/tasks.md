## 1. Mixer seed — interpolated CC steps

- [x] 1.1 Refactor `buildAutomationMixerEvents()` in `src/hooks/useDJActionTracks.ts` to emit Ch 1 and Ch 2 volume rows by inverse-mapping each MIDI integer in `0…127` to a `t` within `[4, 20]` / `[34, 68]` per `design.md` (unique `round(vel×127)` per step, monotone timestamps).
- [x] 1.2 Emit pitch **88** with the existing `t === 4` anchor plus **64** events on **`t ∈ [26, 34]`** with strictly ascending quantized **0…63**.
- [x] 1.3 Emit pitch **85** with **64** events on **`t ∈ [26, 34]`** with strictly descending quantized **63…0**.
- [x] 1.4 Preserve existing event merge/sort semantics (`pitch` ordering at equal `t` if relied upon) so deck automation events remain unaffected.

## 2. Verification

- [x] 2.1 Add or extend tests (preferably colocated helpers or Vitest assertions on `buildDjDemoSeedTracks(true, true)`) to assert event counts **128 ×** volume lanes, **64 ×** EQ sweeps, quantized monotonic sequences, boundary `t`s at **4**, **20**, **34**, **68**, plus pitch **88** `t === 4` anchor.
- [x] 2.2 Confirm `demo=dj` without `dj-automation` mixer seed cardinality unchanged (**pitch 82 length 2**, etc.).
- [x] 2.3 Manual smoke: load `?demo=dj&demo=dj-automation` and skim MIDI logger / inspector for contiguous CC motion on scripted ramps.

## 3. Spec archive hygiene (post-implementation)

- [x] 3.1 After merging behavior, propagate the delta from `openspec/changes/dj-demo-interpolate-midi-messages/specs/dj-automation-demo/spec.md` into `openspec/specs/dj-automation-demo/spec.md` following the archive workflow (`/opsx:archive` or project convention).
