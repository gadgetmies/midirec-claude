## Context

The Inspector currently presents three event surfaces relevant to this change:

1. **`SingleNoteView`** (`src/components/inspector/Inspector.tsx:662–781`) — single instrument note. Has a two-field Start editor (BBT input + raw ticks input) bound to `note.tTicks` via `updateNoteAt(channelId, idx, { tTicks })`. Length is rendered as readonly text `{durBeats.toFixed(3)} beats` (line 763). No End row exists.
2. **`DjEventStartEditor`** (`Inspector.tsx:564–660`) — single DJ action event. Has the same two-field Start editor bound to `event.tTicks` via `setDJEventTTicks(trackId, pitch, eventIdx, next)`. No Length or End rows exist.
3. **CC merged clusters on DJ tracks** — when a DJ event is part of a `CcMergedGroup` (`useDJActionTracks.ts:617–624`) and is the cluster representative, `setDJEventTTicks` already propagates the start delta to every member (`applySetDJEventTTicks` lines 715–728). No equivalent exists for duration.

Per `useDJActionTracks.ts:617–624`, `CcMergedGroup` carries:

```
{ pitch, representativeIdx, memberIndices, t0 /* beats */, dur /* beats */ }
```

The cluster's span in ticks is `tEndTicks − t0Ticks` where `tEndTicks = max(member.tTicks + member.durTicks)`. The trailing member is whichever has the latest `tTicks + durTicks`.

Pressure samples are normalized: `PressurePoint.t ∈ [0,1]` of `event.durTicks` (`src/data/dj.ts:167–174`). Changing `durTicks` does **not** invalidate the curve — sample positions still resolve to the same fraction-of-duration.

The existing prior change (`2026-05-17-dj-track-item-start-editor`) established the precedent of "mirror, don't extract" for the editor UI and "shared boolean gating" for selection liveness. This change keeps both decisions.

## Goals / Non-Goals

**Goals:**
- Length editable from the Inspector for instrument notes, single DJ events, and CC merged clusters — two-field shape (beats input + raw ticks input) bound to `durTicks`.
- End editable from the Inspector for the same three surfaces — two-field shape (phrase·bar·beat input + raw ticks input) representing absolute end position; commits resolve to `durTicks = max(1, end − tTicks)`.
- Stage gains `setDJEventDurTicks(trackId, pitch, eventIdx, nextDurTicks)` mirroring `setDJEventTTicks` in lifecycle and CC-cluster awareness.
- Spec text updated to describe the full Start / Length / End editor block for both the inspector single-note and DJ-event editors, plus the new `setDJEventDurTicks` requirement on `dj-action-tracks`.

**Non-Goals:**
- ParamLane CC points (`src/data/ccPoints.ts`) are out of scope. They have no selection state, no duration field, and no Inspector panel — adding one requires a separate selection-scaffolding change.
- No changes to `MultiNoteView`'s Length text (multi-edit stays read-only, matching how `MultiNoteView` has no Start editor either).
- No timeline drag/resize changes.
- No new shared component for the Start / Length / End block — duplication is acceptable (see Decision 1).
- No coupling to undo/redo design beyond what `updateNoteAt` and `setDJEventTTicks` already use.

## Decisions

**Decision 1 — Mirror, don't extract, the Length and End editors.**
The existing Start editor is duplicated between `SingleNoteView` (~40 lines) and `DjEventStartEditor` (~40 lines) by deliberate prior decision. Length adds one more ~40-line block per surface; End adds another. Extracting now would force a prop shape that supports three commit targets (`tTicks`, `durTicks`, and a `tTicks+durTicks → durTicks` derivation) plus two parse modes (BBT and beats-as-duration), which is exactly the speculative API the previous change rejected. We keep duplicating until a fourth call site appears.
*Alternative considered:* A single `<TimingEditor mode="start"|"length"|"end" />` component. Rejected — same reasoning as the prior change.

**Decision 2 — Length parses as `beats + ticks`; End parses as `BBT + ticks`.**
This matches the user's explicit framing of the request and reflects the semantic distinction: Length is a duration (no phrase/bar coordinate makes sense — the value isn't a position), End is an absolute session-time position (same coordinate space as Start, so BBT applies).
- Length beats input: floating-point, e.g. `1.000` = 1 beat; parsed via `beatsToSessionTicks(parseFloat, SESSION_TPQ)`; same precision rules as the existing readonly display (`toFixed(3)`).
- Length ticks input: integer; raw `durTicks` directly.
- End BBT input: same parser as Start (`parsePhraseBarBeatToTicks`); the parsed ticks becomes `endTicks`.
- End ticks input: integer; raw `endTicks`.
- On End commit: `nextDur = max(1, endTicks − event.tTicks)`. If `endTicks < tTicks`, snap End to `tTicks + 1` (one tick min, matching `useDJActionTracks` `Math.max(1, ...)` convention at line 149) rather than throw, then re-canonicalize the input.

**Decision 3 — Length and End are coupled views of the same field (`durTicks`).**
Both editors commit to the same underlying value (`durTicks`); only the parse/format differs. We do **not** maintain three independent drafts that fight each other — each editor's local `useState` resyncs from the canonical `durTicks` on every mutation via the same `useEffect(... [durTicks])` pattern already used for Start. Editing End → commit → durTicks changes → Length editor re-derives from the new `durTicks` in its own effect. This is the same liveness pattern Start already uses.

**Decision 4 — Add `setDJEventDurTicks` (parallel to `setDJEventTTicks`).**
Lives in `useDJActionTracks.ts` as `applySetDJEventDurTicks(tracks, id, pitch, eventIdx, nextDurTicks)` + hook-exported `setDJEventDurTicks`. Re-exported from `useStage` like its sibling. Cluster behavior:
- **Single event (non-cluster member, or cluster representative whose group has one member):** `nextEvents[eventIdx] = { ...event, durTicks: max(1, round(nextDurTicks)) }`. Pressure samples unchanged (normalized).
- **Cluster representative with N>1 members:** Compute `oldSpanTicks = max(member.tTicks + member.durTicks) − cluster.t0Ticks` (cluster.t0Ticks is `representative.tTicks`). Compute `newSpanTicks = max(1, round(nextDurTicks))`. Compute `scale = newSpanTicks / oldSpanTicks`. For each member: new offset from cluster start = `round((member.tTicks − t0Ticks) * scale)`; new `tTicks = t0Ticks + offset`; new `durTicks` = unchanged for non-trailing members, recomputed for the **trailing member** so that `trailing.tTicks + trailing.durTicks = t0Ticks + newSpanTicks`. Trailing member is the one with the largest `tTicks + durTicks` in the original cluster.
- **Cluster non-representative member edit:** Treated the same as single-event edit on that member (only its own `durTicks` changes). Cluster scaling triggers only when the representative is selected, matching how `setDJEventTTicks` only shifts the cluster when the representative is the selection.

*Alternative considered:* Scale every member's `durTicks` proportionally (not just the trailing one). Rejected — internal CC samples inside non-trailing members would survive (their durations rarely matter for visible cluster span) but it changes more events than needed and could break neighboring per-step ramps. The minimum-change rule is: keep offsets proportional, fix span by adjusting only the trailing tail.

**Decision 5 — End editor is gated on `endTicks ≥ tTicks + 1`; otherwise re-canonicalize without commit.**
We refuse `End < Start` (would imply negative duration). The Length minimum is `1` tick (matches `useDJActionTracks.ts:149`'s `Math.max(1, ...)`). If the user types an End ≤ Start, the input snaps back to the canonical end on blur — same pattern as Start's "parse failed → re-canonicalize" branch.

**Decision 6 — Order of rows: Start → Length → End.**
Reads naturally ("when does it start → how long → when does it end"). End is the derived view, presented last. Pressure (for DJ events) and Velocity/Channel (for notes) keep their current positions below this block.

**Decision 7 — `SingleNoteView` does NOT get the `setDJEventDurTicks`-style cluster logic.**
Instrument notes have no merged-cluster concept. The note-side Length and End editors call `updateNoteAt(channelId, idx, { durTicks })` directly.

**Decision 8 — Spec deltas are MODIFIED for both inspector requirements and ADDED for the dj-action-tracks mutator requirement.**
The existing inspector DJ timing-editor requirement (recently rewritten in the start-editor change) gains Length and End scenarios. The existing inspector single-note start-editor requirement gains Length and End scenarios. `dj-action-tracks` adds one new requirement for `setDJEventDurTicks` with the cluster-scaling scenarios.

## Risks / Trade-offs

- **[Risk]** Cluster scaling can produce sub-tick rounding drift when `oldSpanTicks` doesn't divide evenly into `newSpanTicks`. → **Mitigation:** Round each member's offset independently and force the trailing member to end exactly at `t0Ticks + newSpanTicks`. The sum-of-offsets approach is fine; samples between members are normalized to per-event duration anyway.
- **[Risk]** A user shrinks End below Start, creating a UX dead-zone on blur. → **Mitigation:** Decision 5 — snap to current end value, no commit.
- **[Risk]** Length and End drafts disagree mid-typing — user has typed a partial End but Length still shows the old value. → **Mitigation:** Same as Start vs ticks today — local drafts are independent; the `useEffect` only resyncs on canonical `durTicks` change, so typing in one input does not erase a draft in another.
- **[Risk]** `setDJEventDurTicks` cluster-scaling logic drifts from `setDJEventTTicks` cluster-shift logic. → **Mitigation:** Both helpers live in the same file; comment the duality at the top of each pure helper.
- **[Risk]** Pressure samples normalized to `[0,1]` of duration survive `durTicks` changes by construction, but a future change to absolute pressure timestamps would break the assumption. → **Mitigation:** Spec text and inline comment both name `PressurePoint.t` as normalized, so a future change touching that representation will surface the dependency.
- **[Trade-off]** Three editor blocks (Start, Length, End) make the Inspector taller for both notes and DJ events. The Inspector already scrolls — no new layout concern, but more rows do reduce information density. Accepted as cost of full numeric editing parity.
- **[Trade-off]** Length's beats input uses decimal beats while Start/End use phrase·bar·beat — three formats in adjacent rows. Justified by the semantic difference (Decision 2); the alternative (BBT for duration) overloads positional notation in a way that's confusing.

## Open Questions

_None._ The CC-cluster scaling rule, length-minimum, and end-minimum all have concrete answers via the user clarifications captured in the proposal.
