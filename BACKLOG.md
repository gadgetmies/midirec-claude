# Backlog

Small, scoped tasks that aren't tied to an in-flight slice or OpenSpec change. Each entry should be concrete enough to start without further discovery; if a task needs design alignment or a spec, escalate it to an OpenSpec proposal in `openspec/changes/` instead.

## Open

### Remove the `N SELECTED` count badge from the marquee

**Why**: After Slice 2 review the badge was deemed redundant — the dashed marquee rectangle plus the orange-red highlight on selected notes already communicate "these are selected", and the count will be available in the Inspector's multi-select panel from Slice 5 onwards. Today the badge sits to the upper-right of the marquee rectangle, occupies a chunk of lane space, and is the only thing in the renderer that requires a JS-side count.

**Scope**:

- `src/components/piano-roll/PianoRoll.tsx` — remove the `marqueeBadge` JSX block; the SVG marquee + selection-coloring on notes are kept.
- `src/components/piano-roll/PianoRoll.css` — remove the `.mr-marquee__badge`, `.mr-marquee__count`, and `.mr-marquee__lbl` rules.
- `openspec/specs/piano-roll/spec.md` — drop the badge requirements/scenarios from the *Marquee renders dashed rect with badge* requirement (rename it to *Marquee renders dashed rect* or similar). The marquee rectangle itself stays.
- `design/deviations-from-prototype.md` — add a new entry (or extend the existing marquee entry #2/#3) recording the badge removal as another back-port-recommended deviation from the prototype, with rationale "selection count is shown in the Inspector multi-select panel from Slice 5 onwards".
- `design/README.md` — the deviations table at the bottom gets a new row.

**Verification**:

- `?demo=marquee` URL renders the dashed marquee with selected notes in `--mr-note-sel`, but no badge element. The 7 selected notes are still visibly distinct via color.
- `yarn typecheck` clean.
- `grep -r 'mr-marquee__badge\|mr-marquee__count\|mr-marquee__lbl' src/` returns zero matches.

**Estimated effort**: 30 minutes — one focused edit pass + spec update + design-doc note.

**Status**: pending. Not blocking any other slice.

## Done

<!-- Move completed entries here with a date and the commit hash that resolved them. -->
