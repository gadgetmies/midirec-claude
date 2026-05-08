## 1. Spec validation

- [ ] 1.1 Run `openspec validate session-model --strict`. The change SHALL validate without errors.
- [ ] 1.2 Run `openspec validate --all --strict`. The session-model change SHALL pass; pre-existing main-spec format issues (if any) are out of scope and may continue to fail strict validation as they did before this change.

## 2. Cross-spec consistency review

- [ ] 2.1 Read `proposal.md` end-to-end with the design owner / project lead. Confirm the session-is-unbounded + loop-region intent matches the design source (`design_handoff_midi_recorder/README.md`).
- [ ] 2.2 Read `design.md` D1–D6 and confirm the data-model and time-unit decisions are acceptable for the slices that will consume them (Slice 3 multi-track in particular).
- [ ] 2.3 Read `specs/session-model/spec.md` and confirm the requirements are testable as written. Each requirement has at least one scenario.
- [ ] 2.4 Read `specs/transport-titlebar/spec.md` (the MODIFIED requirement) and confirm the loopRegion shape and wrap behavior align with the existing `useTransport()` implementation surface (i.e., the changes are additive, not breaking).
- [ ] 2.5 Read `specs/piano-roll/spec.md` (the ADDED requirements) and confirm the view-window semantics and loop-marker rendering contract are compatible with the current renderer's implementation (specifically, that adding `viewT0` and `loopRegion` props with `null`/`0` defaults does not change the Slice-2 visual).

## 3. Documentation handoff

- [ ] 3.1 Save a note to project memory (or surface in CLAUDE.md if/when one is added) that "session-time uses beats; transport-clock uses ms; conversion happens in the transport hook only" — so future contributors don't accidentally introduce a third time unit.
- [ ] 3.2 Note in the same place that `viewT0` is the renderer's view-window left edge, and that the placeholder `useStage()` hook hardcodes it to 0 until horizontal-scroll is implemented.

## 4. Implementation deferral notes

> No source-code changes ship in this change. Implementation lands in the slices that consume the contract:
>
> - **Slice 3 (multi-track stack)**: introduces `tracks: Track[]` where each `Track` has `notes: Note[]`; the per-note shape and beat convention from this spec are honored. The current placeholder `useStage()` hook's single-track output lifts into a single `Track` entry.
> - **Slice 5 (inspector — note panel)**: the `Start` / `Length` inspector fields read/write `Note.t` / `Note.dur` directly, in beats.
> - **Slice 6 (markers + export)**: introduces the markers-sidebar UI (named markers + loop region) and the export dialog's `Loop region` range option. Loop-marker creation/edit/clear actions land here, calling into `setLoopRegion` / `clearLoopRegion`.
> - **Future scroll/zoom slice (between Slice 5 and Slice 10)**: introduces real `viewT0` state in `useStage()` (or a sibling `useView()` hook) and binds horizontal-scroll/zoom controls to it. This slice also removes the placeholder modular wrap from the playhead computation, replacing it with the loop-wrap behavior defined in this spec.
> - **Slice 10 (audio engine)**: replaces the rAF tick with the real audio runtime; the same loop-wrap contract applies.

- [ ] 4.1 Verify that the deferral list above matches the team's rough understanding of the upcoming slice ordering. Adjust the proposal/design if the consumer slices have shifted.
