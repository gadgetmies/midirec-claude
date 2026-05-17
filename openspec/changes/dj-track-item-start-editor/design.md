## Context

The Inspector's `SingleNoteView` (`src/components/inspector/Inspector.tsx` lines 552–670) exposes two synchronized inputs — a phrase·bar·beat (BBT) input and a raw integer ticks input — bound to `note.tTicks`. Edits commit via `useStage().updateNoteAt(channelId, noteIndex, { tTicks: <next> })` on blur or Enter. This UI was introduced in commit `1e2054a feat(inspector): edit note start from phrase-bar-beat or ticks` and is the canonical start-time editor for instrument-channel notes.

DJ action-track events (`ActionEvent` in `src/data/dj.ts`) carry the same tick-native `tTicks` field, but the Inspector's `ActionRowOutputPanel` only renders Output mapping fields (and a Pressure editor when applicable). The panel knows the event identity via `djEventSelection = { trackId, pitch, eventIdx }` and already gates the Pressure section on that selection. The start editor is the missing piece.

A stale requirement in `openspec/specs/inspector/spec.md` ("DJ event timing editor inside Note tab Output region") still references a **three-field** editor (bar, beat, MIDI tick within beat at TPQ) that predates the current two-field BBT-plus-ticks design and was never implemented. The spec must be re-stated to match the implementation that will land.

The session-model layer exposes `updateNoteAt(channelId, index, patch)` for instrument notes but has no equivalent for DJ events. A new mutator is required so the Inspector can commit `tTicks` changes without reaching into store internals.

## Goals / Non-Goals

**Goals:**
- DJ-event start time can be edited from the Inspector via the same two-field (BBT + ticks) control used for instrument notes.
- The DJ editor renders only when a single event is selected; the track-level DJ list panel is unaffected.
- The session model gains a documented mutator for updating a single DJ event by `(trackId, pitch, eventIdx)`.
- Inspector spec is updated so requirement text matches what ships (two fields, not three).

**Non-Goals:**
- No changes to the timeline drag/move behavior for DJ events.
- No new editing of DJ event `durTicks`, `vel`, or `pressure` from the start-editor block (Pressure already has its own editor; duration/velocity stay out of scope here).
- No multi-event edit (instrument-side `MultiNoteView` has no start editor either).
- No refactor of the existing `SingleNoteView` to share component code with the DJ panel — see Decisions for why.

## Decisions

**Decision 1 — Mirror, don't extract, the editor UI on first pass.**
The two-field editor in `SingleNoteView` is ~40 lines of JSX plus four `useState`/`useCallback` blocks. Extracting it now would force premature decisions on prop shape (does it take a `tTicks` + setter, or a full entity reference?) and risk an abstraction that fits one of the two call sites awkwardly. The DJ panel will use a parallel implementation; if a third call site appears (e.g., automation lane points) we extract then.
*Alternative considered:* Build a `<StartTicksEditor tTicks onCommit/>` helper now. Rejected — the user-supplied feedback in memory (and the project's style) favors not designing for hypothetical future requirements.

**Decision 2 — Add `updateDjEventAt(trackId, pitch, eventIdx, patch)` to the stage/session API.**
Keeps the Inspector talking to the same layer as `updateNoteAt`, preserves undo/redo wiring (assumed identical to instrument-note edits), and matches the existing `(trackId, pitch, eventIdx)` selector shape used by `djEventSelection`.
*Alternative considered:* Generic `patchEvent(selectionRef, patch)` taking a discriminated union. Rejected — adds an indirection that's only needed if we anticipate more selection kinds, which we don't.

**Decision 3 — Gating condition reuses the existing `showPressure`-style guard.**
The start editor shows only when `djEventSelection !== null` AND it points at this `(trackId, pitch)` AND `eventIdx` is in range AND the referenced event's `pitch` still equals the row's pitch — exactly the predicate `ActionRowOutputPanel` already computes (lines 381–388) for Pressure. We can either reuse that boolean or compute an analogous one; either is fine.

**Decision 4 — Place the start editor block above the Pressure editor and below the Output mapping fields.**
Output mapping is the row's primary identity; start/timing is event-scoped (like Pressure). Putting Start adjacent to Pressure keeps event-scoped controls grouped. The Output → Start → Pressure order also matches the natural read order: "what does this map to → when does it fire → how does it ramp".

**Decision 5 — Spec delta is MODIFIED, not REMOVED+ADDED.**
The existing requirement "DJ event timing editor inside Note tab Output region" stays — only the field-count and commit-binding wording changes. A MODIFIED block must contain the full updated requirement (including scenarios) per OpenSpec rules.

## Risks / Trade-offs

- **[Risk]** `commitTicks` / `commitPhraseBarBeat` logic duplicated between `SingleNoteView` and the new DJ editor drifts over time. → **Mitigation:** keep both implementations literally textually identical at landing time; if a third caller appears, extract.
- **[Risk]** `updateDjEventAt` mutator might collide with existing pressure-edit code paths that already mutate `track.events[idx]`. → **Mitigation:** read the existing pressure-edit reducer/action before implementing; reuse its event-immutability pattern (spread + replace at index).
- **[Risk]** Tick changes from the Inspector could leave a DJ event sorted out-of-order in `track.events` if the array is assumed sorted by `tTicks`. → **Mitigation:** check whether `ActionRoll` or playback assumes sorted order; if yes, re-sort on update (or leave unsorted and let downstream cope, matching `updateNoteAt`'s behavior — verify during implementation).
- **[Trade-off]** Reusing `djEventSelection.eventIdx` (a positional index) means if another event is inserted before the selected one between renders, the index could drift. This is the same trade-off `PressureEditor` already accepts, so no new exposure.
