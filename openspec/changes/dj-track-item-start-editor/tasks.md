## 1. Verify session-model mutator availability

- [x] 1.1 Locate the existing DJ-event timing mutator (per `dj-action-tracks` spec line 880 — "Stage SHALL mutate DJ action event timing with coordinated automation translation") in the stage/session layer and confirm it is reachable from `useStage()`. **Finding:** the mutator did not exist; `useDJActionTracks` exposes only `setEventPressure` / `clearEventPressure`. Existing spec at line 880 was aspirational. Will be added in 1.2. Also noted: `PressurePoint.t` is normalized [0,1] (note-relative), so the spec's "add deltaTicks to each pressure sample" clause is wrong for the current data shape and must be corrected.
- [x] 1.2 Added `applySetDJEventTTicks` pure helper and `setDJEventTTicks` mutator in `src/hooks/useDJActionTracks.ts`; wired through `useStage`. **No pressure-tick translation** is needed because `PressurePoint.t` is normalized to [0,1] of note duration (not ticks) — curves already survive shifts. **CC merged clusters** are handled: when the referenced eventIdx is the representative of a cluster, every member is shifted by the same `deltaTicks`. The CC-merge utility (`buildCcMergedGroupsByMemberIndex` + constants + `CcMergedGroup` type) was moved out of `ActionRoll.tsx` into `useDJActionTracks.ts` and is now re-used by both sides.
- [x] 1.3 No re-sort applied — matches `updateNoteAt`'s convention. `ActionRoll`'s `buildCcMergedGroupsByMemberIndex` sorts within itself; `appendDJActionEvent` also does not enforce sort order; nothing downstream assumes sorted order on `track.events`.

## 2. Inspector — DJ row start editor

- [x] 2.1 Refactored `ActionRowOutputPanel` to compute a shared `eventMatches` predicate; `showStart = eventMatches`, and `showPressure = eventMatches && entry.pressure === true`. (Saves a 5-line duplicate and keeps both gated on the same liveness check.)
- [x] 2.2 `selectedEvent = eventMatches ? track.events[djEventSelection!.eventIdx] : null` captures the referenced event for passing to the new editor.
- [x] 2.3 Drafts live inside a new `DjEventStartEditor` child component, initialized via the same `canonicalPhraseBarBeatFromTicks(tTicks, TPQ)` + `String(tTicks)` helpers used by `SingleNoteView`.
- [x] 2.4 `useEffect` keyed on `(trackId, pitch, eventIdx, tTicks)` resyncs both drafts when the underlying event changes.
- [x] 2.5 `commitPhraseBarBeat` / `commitTicks` mirror `SingleNoteView`'s lines 572–597 exactly, swapping `updateNoteAt` for `setDJEventTTicks(trackId, pitch, eventIdx, next)`.
- [x] 2.6 The editor block is rendered between the existing delete-output button and the `<PressureEditor />`, gated on `showStart && selectedEvent && djEventSelection`.
- [x] 2.7 The new block lives inside the existing `<div data-mr-dj-selection-region="true">` container — no structural change to that wrapper.

## 3. Visual / structural parity

- [x] 3.1 All five `mr-insp__start-*` classes are reused verbatim from `SingleNoteView`; no new CSS needed.
- [x] 3.2 `title` / `aria-label` strings copied verbatim from `SingleNoteView`.

## 4. Spec updates

- [x] 4.1 Applied. Inspector spec now describes two-field BBT + ticks, commit-on-blur / commit-on-Enter, with the four scenarios (success, no-row-selection omission, stale-selection hide, no-op re-canonicalize).
- [x] 4.2 Applied. `dj-action-tracks` Inspector requirement now describes two-field shape, sync rule, focus-does-not-clear-selection rule. **NOTE:** the unrelated "Stage SHALL mutate DJ action event timing with coordinated automation translation" requirement (line ~880) still contains a stale clause about "add deltaTicks to each embedded automation timestamp stored as ticks (pressure samples)". `PressurePoint.t` is normalized to [0,1] of duration, so pressure shifts are unnecessary and my mutator deliberately omits them. Fixing that clause is outside this change's scope — left as a follow-up.

## 5. Manual verification

- [x] 5.1 Dev server starts cleanly on :5174 (HTTP 200; `main.tsx` resolves). Visual confirmation of the three blocks in order needs human eyes — could not be automated.
- [x] 5.2 Verified by user.
- [x] 5.3 Verified by user.
- [x] 5.4 Verified by user.
- [x] 5.5 Verified by user.
- [ ] 5.6 **Behavior change vs. existing spec**: pressure samples are normalized [0,1] of duration, so they survive `tTicks` shifts without translation. No deltaTicks-on-pressure verification is meaningful — the existing spec clause at line ~886 is stale.

## 6. Wrap up

- [x] 6.1 `npm run typecheck` clean. `npm test` — 18 files, 235 tests pass.
- [x] 6.2 No memory update needed — the one non-obvious finding (pressure stored normalized, not in ticks) is already documented in code at `src/data/dj.ts:167–174`, so a memory pointer would duplicate the comment.
- [x] 6.3 `openspec validate dj-track-item-start-editor` → "Change ... is valid".
