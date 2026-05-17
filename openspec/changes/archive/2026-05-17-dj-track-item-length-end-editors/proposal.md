## Why

The Inspector now exposes a two-field Start editor (phrase·bar·beat + raw ticks) for both instrument notes (`SingleNoteView`) and DJ action-track events (`DjEventStartEditor`), but Length is still a readonly text and there is no End editor anywhere. Users can move an event in time numerically, yet to change its duration they must drop back to drag-only editing in the timeline (and for CC merged clusters, even drag is shape-preserving rather than length-targeted). Bringing Length up to the same two-field shape and adding a matching End editor closes the parity gap and gives precise duration / cut-out alignment to musical structure.

## What Changes

- **`SingleNoteView` (instrument notes)**: Replace the readonly "Length" KV row with a two-field editor — **beats input** + **raw ticks input**, both bound to `note.durTicks` and committing via `updateNoteAt(channelId, idx, { durTicks })`. Add a new "End" row with a **phrase·bar·beat input** + **raw ticks input** representing absolute end position (`tTicks + durTicks`); commits resolve `durTicks = max(1, end − tTicks)` via the same mutator.
- **`DjEventStartEditor` panel (single DJ events)**: Add the same "Length" (beats + ticks) and "End" (BBT + ticks) editors directly below the existing Start row. Commits go through a new stage mutator `setDJEventDurTicks(trackId, pitch, eventIdx, nextDurTicks)`.
- **CC merged clusters on DJ tracks**: When `djEventSelection` references a member of a `CcMergedGroup`, the same Length and End editors render but commit cluster-scaled durations — each member's offset-from-cluster-start and the trailing member's `durTicks` are scaled by `newSpanTicks / oldSpanTicks` so the cluster's first start and overall shape (relative timing of internal CC samples) are preserved while the total span matches the user's input.
- **ParamLane CC points**: Out of scope for this change. They have no selection state, no duration field, and no Inspector panel today — handled by a future change that first introduces CC-point selection.
- **Modify** the existing `inspector` spec requirement for the DJ event timing editor to cover Length + End in addition to Start, and add a sibling requirement for the new note-side Length/End editors in `SingleNoteView`.
- **Add** a `dj-action-tracks` requirement for the `setDJEventDurTicks` mutator, including the cluster-scaling rule for CC-merged groups.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `inspector`: Extend the Start-editor requirements so they also describe (a) a two-field beats+ticks Length editor and (b) a two-field BBT+ticks End editor, with commit-on-blur / commit-on-Enter semantics consistent with Start. Covers both `SingleNoteView` (instrument notes) and the DJ event panel.
- `dj-action-tracks`: Add a requirement for a stage-level `setDJEventDurTicks` mutator that handles both single events and CC merged clusters (proportional scaling of member offsets and trailing `durTicks`); document that pressure samples are unaffected because `PressurePoint.t` is normalized to `[0,1]` of duration.

## Impact

- **Code**: `src/components/inspector/Inspector.tsx` (extend `DjEventStartEditor`, `SingleNoteView`); `src/hooks/useDJActionTracks.ts` (add `applySetDJEventDurTicks` pure helper + `setDJEventDurTicks` mutator with CC-cluster scaling); `src/hooks/useStage.tsx` (re-export the new mutator on the stage facade). May need a small helper for `endTicks ↔ (tTicks, durTicks)` conversion if duplication becomes noisy; default to inline per the prior change's "mirror, don't extract" decision.
- **Specs**: `openspec/specs/inspector/spec.md` (modify the existing DJ-event editor requirement and the single-note start-editor requirement); `openspec/specs/dj-action-tracks/spec.md` (add `setDJEventDurTicks` requirement).
- **No** changes to MIDI runtime, recording, playback, routing, or on-disk event shape (`tTicks`, `durTicks` already exist on `Note` and `ActionEvent`).
- **No** new CSS — Length and End rows reuse the existing `mr-insp__start-*` field styles.
- **No** changes to ParamLane CCs or to the timeline drag/resize behavior.
