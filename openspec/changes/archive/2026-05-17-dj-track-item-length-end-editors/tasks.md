## 1. Session-model mutator for DJ event duration

- [x] 1.1 In `src/hooks/useDJActionTracks.ts`, add `applySetDJEventDurTicks(tracks, id, pitch, eventIdx, nextDurTicks): DJActionTrack[]` — pure helper next to `applySetDJEventTTicks`. Reuse `buildCcMergedGroupsByMemberIndex` to detect cluster membership; branch single-event vs cluster-representative per design Decision 4.
- [x] 1.2 Single-event branch: `nextEvents[eventIdx] = { ...event, durTicks: max(1, round(nextDurTicks)) }`. Pressure samples untouched (normalized `[0,1]`).
- [x] 1.3 Cluster-representative branch: compute `t0Ticks = representative.tTicks`; compute `oldSpanTicks = max(member.tTicks + member.durTicks) - t0Ticks` and trailing member index (member with that max); compute `newSpanTicks = max(1, round(nextDurTicks))`; if equal to `oldSpanTicks` return input. Otherwise for each member: `newOffset = round((member.tTicks - t0Ticks) * (newSpanTicks/oldSpanTicks))`, `newTTicks = t0Ticks + newOffset`. Representative member keeps `tTicks === t0Ticks`. Trailing member's `durTicks` recomputed so its end equals `t0Ticks + newSpanTicks`; other members keep `durTicks`.
- [x] 1.4 No-op (return input `tracks`) for unknown trackId, out-of-range `eventIdx`, pitch mismatch, or computed value equal to current.
- [x] 1.5 Wire `setDJEventDurTicks` through `useDJActionTracks` (set-state callback that invokes `applySetDJEventDurTicks`).
- [x] 1.6 Re-export `setDJEventDurTicks` from `useStage` so the Inspector reaches it via `useStage()`.

## 2. Inspector — `SingleNoteView` Length and End editors

- [x] 2.1 Replace the readonly Length `.mr-kv` row (currently `{durBeats.toFixed(3)} beats`) with a `NoteLengthEditor` child component that mirrors the Start editor's two-field shape: a decimal **beats** input + an integer **`durTicks`** input. Reuse existing `mr-insp__start-fields` / `mr-insp__field` / `mr-insp__ticks-suffix` CSS classes (no new CSS).
- [x] 2.2 `NoteLengthEditor` holds two `useState` drafts: beats string (initialized via `sessionTicksToBeats(note.durTicks).toFixed(3)`) and ticks string (initialized via `String(note.durTicks)`). `useEffect` keyed on `(channelId, noteIndex, note.durTicks)` resyncs both drafts when the underlying note changes.
- [x] 2.3 `commitBeats`: trim, parse as float; if invalid, revert. Compute `next = max(1, Math.round(beatsToSessionTicks(parsed, TPQ)))`. If `next !== note.durTicks` call `updateNoteAt(channelId, noteIndex, { durTicks: next })`; else revert the beats draft.
- [x] 2.4 `commitTicks`: same regex/integer guard as Start; `next = max(1, n)`. If `next !== note.durTicks` call `updateNoteAt(channelId, noteIndex, { durTicks: next })`; else revert.
- [x] 2.5 Add a new `NoteEndEditor` child between Length and Velocity. Two `useState` drafts: BBT string (`canonicalPhraseBarBeatFromTicks(note.tTicks + note.durTicks, TPQ)`) and ticks string (`String(note.tTicks + note.durTicks)`). `useEffect` keyed on `(channelId, noteIndex, note.tTicks, note.durTicks)`.
- [x] 2.6 `commitEndBBT`: parse via `parsePhraseBarBeatToTicks`; revert if invalid. Compute `endTicks = parsed`. If `endTicks <= note.tTicks` revert both drafts to canonical (per design Decision 5). Else compute `nextDur = endTicks - note.tTicks` (already `≥ 1`); if `nextDur !== note.durTicks` call `updateNoteAt(channelId, noteIndex, { durTicks: nextDur })`; else revert.
- [x] 2.7 `commitEndTicks`: same integer guard; same `endTicks ≤ tTicks` revert; else same `updateNoteAt` call.
- [x] 2.8 BBT input uses `title="Phrase · bar · beat (end position; matches timeline display)"`, `aria-label="End phrase bar beat"`; ticks input uses `title="Session end ticks (integer MIDI ticks from session zero)"`, `aria-label="End ticks"`.

## 3. Inspector — `DjEventStartEditor` Length and End editors

- [x] 3.1 Rename `DjEventStartEditor` to `DjEventTimingEditor` (or keep the existing component and add Length + End rows inside it) — choose whichever keeps the gating call site in `ActionRowOutputPanel` minimal.
- [x] 3.2 Pass `durTicks` into the component along with the existing `tTicks` and the new `setDJEventDurTicks` callback from `useStage()`.
- [x] 3.3 Add a Length row mirroring task 2.1–2.4 but committing via `setDJEventDurTicks(trackId, pitch, eventIdx, next)`. Beats input ↔ `durTicks` via `sessionTicksToBeats` / `beatsToSessionTicks` with `max(1, ...)` clamp.
- [x] 3.4 Add an End row mirroring task 2.5–2.8 but using `setDJEventDurTicks` with `nextDurTicks = endTicks - tTicks`. Re-canonicalize when `endTicks ≤ tTicks`.
- [x] 3.5 Effects keyed on `(trackId, pitch, eventIdx, tTicks, durTicks)` so Length/End drafts resync whenever Start changes too.
- [x] 3.6 All three editor rows stay inside the existing `<div data-mr-dj-selection-region="true">` wrapper — no structural change.
- [x] 3.7 Visual order: Start → Length → End → (existing PressureEditor block).

## 4. CC merged cluster behavior

- [x] 4.1 Verify via manual test that selecting a cluster representative event and committing a new Length value scales offsets and trailing `durTicks` as designed (members visibly stretch/squash while keeping first start fixed). Use the dj-automation-demo URL.
- [x] 4.2 Verify that committing End on a cluster representative behaves equivalently to committing Length `endTicks − tTicks` (same scaling).
- [x] 4.3 Verify that selecting a non-representative cluster member and editing Length only changes that member's `durTicks` (no cluster scaling) — single-event semantics path.

## 5. Spec updates

- [x] 5.1 Apply MODIFIED inspector requirements (`Single-select Note panel content` and `DJ event timing editor inside Note tab Output region`) from this change's spec delta. Verify the full requirement bodies (not partial) survive archive.
- [x] 5.2 Apply ADDED `dj-action-tracks` requirement (`Stage SHALL mutate DJ action event durTicks with coordinated CC cluster scaling`) from this change's spec delta.

## 6. Manual verification

- [x] 6.1 `npm run typecheck` clean.
- [x] 6.2 `npm test` — 18 files, 235 tests pass; no new test files added.
- [x] 6.3 Dev server starts cleanly; Inspector renders three rows (Start, Length, End) for a selected note.
- [x] 6.4 Inspector renders three rows (Start, Length, End) for a selected single DJ event.
- [x] 6.5 Inspector renders three rows (Start, Length, End) for a selected DJ CC cluster representative; commits trigger cluster scaling.
- [x] 6.6 Editing each of the three values (Start, Length, End) re-canonicalizes the other two rows on commit.
- [x] 6.7 Submitting End ≤ Start reverts the field, does NOT mutate the event.
- [x] 6.8 Submitting Length = 0 clamps to 1 tick.

## 7. Wrap up

- [x] 7.1 `openspec validate dj-track-item-length-end-editors` → "Change ... is valid".
- [x] 7.2 Skipped — `simplify` left as a follow-up if a third call site (e.g. ParamLane CC selection) appears. The mirror-don't-extract decision from the previous change still applies.
- [x] 7.3 No memory update needed — all decisions are captured in design.md or in the existing spec text.
