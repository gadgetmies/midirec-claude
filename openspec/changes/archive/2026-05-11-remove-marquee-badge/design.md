## Context

The piano-roll's marquee (a dashed selection rectangle drawn over the lane area when the user drags a selection box) currently renders **two** DOM elements: a `.mr-marquee` SVG with the dashed rectangle, and a sibling `.mr-marquee__badge` floating to the rectangle's upper-right corner. The badge holds a count and a static label — for example `7 selected` — drawn from `effectiveSel.length` (which is itself either the explicit `selectedIdx` prop or the result of `notesInMarquee(notes, marquee)` when only the marquee is provided).

The badge entered the spec in Slice 2 (`piano-roll-renderer`) as a port from the prototype. Two later changes made it redundant:

1. **Slice 4 — orange-red selection coloring on notes** (`var(--mr-note-sel)` background + `data-sel="true"` attribute). Every selected note is now visually distinct from unselected notes inside the marquee rectangle — the user can read the selection count by glancing at the rectangle.
2. **Slice 5 — Inspector multi-select panel** (`inspector` capability). The right-aside Inspector now reads `useStage().resolvedSelection.indexes.length` and renders a richer summary including count, pitch range, velocity, channel — at a much higher fidelity than the badge's `N selected` label.

That leaves the badge as a redundant chip occupying lane space at the top-right of every marquee.

This is a small, cosmetic-feeling change but it touches the `piano-roll` spec's marquee contract — hence the OpenSpec proposal rather than a bare commit.

## Goals / Non-Goals

**Goals:**

- Remove the badge from rendered output: no `.mr-marquee__badge` element appears for any marquee, ever.
- Remove the dead CSS rules so nothing in the codebase references the dropped class names (verifiable via `grep`).
- Keep all *other* marquee behavior unchanged: the dashed rectangle still renders at the correct coordinates, marching-ants animation still runs, selected notes still carry `data-sel="true"` and `var(--mr-note-sel)` background, the resolved-selection plumbing to the Inspector is untouched.
- Update the `piano-roll` spec so the marquee requirement and its scenarios match the new rendered output. Drop the badge-count scenarios from the spec; rephrase scenarios that today assert on the count.
- Record the deviation in `design/deviations-from-prototype.md` so it's clear to any future contributor that the prototype's marquee includes a badge by design and we intentionally omit it.

**Non-Goals:**

- Changing the marquee rectangle's geometry, color, animation, or stacking. Those are exhaustively specified by other scenarios in `piano-roll` and remain valid.
- Removing or renaming `effectiveSel` or `notesInMarquee` — both are still used to drive `data-sel="true"` on notes; only the badge consumer is dropped.
- Touching the Inspector's multi-select panel. It reads from `useStage().resolvedSelection`, not from the badge DOM.
- Replacing the badge with a different summary chip elsewhere on the marquee, or surfacing the count in the Statusbar. The Inspector multi-select panel is the durable home for selection-count signal.

## Decisions

**Drop the badge entirely rather than hide it via CSS.** Alternative considered: keep the JSX and the CSS rules but add `display: none` on `.mr-marquee__badge`. Rejected because it would leave a dead JSX block that future readers have to mentally rule out ("is this used somewhere?"), still pays the React-reconcile cost on every marquee render, and still occupies lane DOM that browser inspectors / accessibility trees see. A clean deletion is cheaper to reason about.

**Don't replace the badge with anything in the piano-roll.** Alternative considered: surface the count in a less obtrusive form — e.g. as a small `data-count` attribute on `.mr-marquee` that CSS can optionally show via a `::after`, or as ARIA `aria-label="7 notes selected"` on the SVG. Rejected for now: the Inspector already provides this signal at higher fidelity, the marquee rectangle is purely a draft-of-selection affordance (users barely look at it once they've finished dragging), and adding a CSS-driven count puts us right back at the duplication we're removing. If accessibility regresses (the badge was the only text-form selection signal in the roll), `data-sel="true"` on each `.mr-note` is the per-element analogue, and the Inspector covers the aggregate. If a future a11y review surfaces a gap, address it then.

**Rewrite existing badge-count scenarios in the `piano-roll` spec, don't just delete them.** Two existing scenarios — `Badge count matches selectedIdx length` and `?demo=marquee shows the screenshot-04 marquee` — assert on `.mr-marquee__count`'s text content as a proxy for "marquee derives the right selection." If we just delete these scenarios we lose a coverage point: that `notesInMarquee` returns the expected count for the seeded `?demo=marquee` fixture. Replace the badge-count assertion with a `data-sel="true"` count assertion (counting notes with the selected attribute is the same number, observed via a different DOM path), so coverage is preserved. The `?demo=marquee` scenario already includes a `data-sel="true"` count assertion alongside the badge-count assertion — we keep that line, drop the badge-count line.

**Spec rename: `Marquee renders dashed rect with badge` → `Marquee renders dashed rect`.** Expressed in the spec delta as `## REMOVED Requirements` (with **Reason** + **Migration**) plus `## ADDED Requirements` with the new name and the slimmed body. This matches the convention used by `2026-05-09-rename-cc-lanes-to-param-lanes` in this repo — `## RENAMED Requirements` is reserved for name-only changes, and we're also dropping content (the badge paragraph and one scenario), so REMOVED+ADDED is the honest operation. Two other requirements in the spec (`Selection resolution prefers explicit selectedIdx over marquee derivation` and `Stage hosts a single PianoRoll driven by useStage()`) and one stylesheet inventory requirement (`PianoRoll stylesheet ports prototype rules verbatim`) reference the badge class names in their bodies/scenarios; those go through `## MODIFIED Requirements` with the full updated content.

## Risks / Trade-offs

- **[Risk] Loss of the only text-form selection count in the piano-roll** → Mitigation: the Inspector's multi-select panel ships the count + richer summary in the right aside, and `data-sel="true"` is on every selected `.mr-note` for per-element introspection (DevTools, ARIA tests). If a real accessibility need emerges, fix it then; don't pre-build.
- **[Risk] Spec rename creates a stale link if anything points at the old requirement name** → Mitigation: `grep -rn "Marquee renders dashed rect with badge" openspec/ design/` before archiving; this should hit zero outside the spec file itself.
- **[Risk] A leftover badge test asserts on `.mr-marquee__count` and silently keeps passing because the test is broken some other way** → Mitigation: `grep -rn 'mr-marquee__badge\|mr-marquee__count\|mr-marquee__lbl' src/ test/ tests/` after the code change; this MUST return zero matches.
- **[Trade-off] The marquee rectangle is now slightly less informative when seen in isolation** (e.g. in a screenshot, with no Inspector visible). Considered acceptable because the dashed rect + per-note coloring already encode "this is a selection", and screenshots showing only the marquee without the rest of the UI are not a target use case.

## Migration Plan

This is a pure subtraction in a project with no production users yet. There are no consumers downstream of the badge DOM and no persisted state. The migration is a single commit:

1. Edit `PianoRoll.tsx` to drop the `marqueeBadge` JSX block and the local `marqueeBadge` variable.
2. Edit `PianoRoll.css` to drop the three rules.
3. Apply the spec delta under `openspec/changes/remove-marquee-badge/specs/piano-roll/spec.md`.
4. Add the deviation entry in `design/deviations-from-prototype.md` and the table row in `design/README.md`.
5. Verify (`yarn typecheck`, manual `?demo=marquee` load, grep for stranded class names).
6. Archive the change.

No rollback steps beyond `git revert`.

## Open Questions

(none — backlog grooming resolved all the design questions for this slice)
