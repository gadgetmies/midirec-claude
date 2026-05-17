## Context

The app positions notes on **`tTicks`** at session TPQ (`session-model`). The Inspector’s **single-select** Note tab currently shows **Start** as read-only decoded text (`formatBBT` · tick-within-beat). Users need numeric entry in the `.mr-inspector` aside without abandoning lattice-accurate timing.

## Goals / Non-Goals

**Goals:**

- Provide **editable** controls in the right Inspector panel for moving the **single-selected note’s start** (`tTicks`).
- Support a **three-part phrase/bar/beat-style string** aligned with existing `formatBBT` numbering (e.g. `01.1.1` ↔ bar/beat subdivision).
- Support a **`tTicks`** field for absolute, tick-precise moves.
- Keep PBB string and **`tTicks`** **in sync** after each successful commit so either control can define the authoritative position last committed.

**Non-Goals:**

- Bulk editing start positions across multi-select from the Inspector (can reuse patterns later).
- Editing **duration**, **pitch**, or non-note timeline layers (DJ events, lanes) in this slice.
- Changing ruler or piano-roll gesture models beyond reflecting updated `tTicks`.

## Decisions

1. **Authority model**: On commit, **`tTicks` is authoritative**. The ticks input commits that integer directly. The phrase-bar-beat field commits by **parsing → session ticks** using the inverse of the timeline’s BB(T) lattice (reuse or mirror `summary.formatBBT` rules and `DEFAULT_SIG` unless the session exposes a conflicting time signature; document single source).

2. **Commit triggers**: Prefer **explicit commit on blur or Enter** (not every keystroke) to avoid partial invalid strings thrashing notes. Intermediate invalid states show **non-destructive** validation feedback without mutating the roll until a parsable committed value exists.

3. **Parsing UX**: Accept reasonable variants (`1.1.1`, `01.01.01`) then **normalize displayed value** after commit to the canonical **`formatBBT`-style string** derived from resulting ticks. Unknown or out-of-range input is **rejected** without mutation; optionally revert field to last good value.

4. **Rounding**: Parsing from three-part fractional grid SHALL map to the **nearest** session tick (or floor—pick one consistently in code); document chosen rule in helpers and specs. Sub-tick fractions from PBB subdivisions MAY exist only before rounding.

5. **Stage integration**: Prefer **existing** note mutation/update paths (`useStage` / roll helpers) used by piano-roll edits so playback, undo, and selection stay coherent.

## Risks / Trade-offs

**Subdivision mismatch** (`formatBBT` sixteenth-ish grid vs user expectation of finer tuplets) → **Mitigation**: document that PBB edits snap to supported grid then ticks; finer moves use **`tTicks`**.

**Time signature drift** if future multi-sig timelines land → **Mitigation**: keep parsing parameterized on the same `(num,den)` feeding `formatBBT`; default `DEFAULT_SIG` until wired.

**Stale spec vs code** (`note.t` wording in baseline) → Resolve during apply by aligning **delta spec** explicitly to **`tTicks`**.

## Migration Plan

**Deploy**: Standard app release — no persisted format change.

**Rollback**: Remove Inspector inputs and restore read-only Start row behavior.

## Open Questions

- Whether **undo** bundles each commit as one history step (recommended; defer if undo stack absent).
