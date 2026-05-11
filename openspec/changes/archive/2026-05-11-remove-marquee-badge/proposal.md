## Why

The `N selected` count badge that floats to the upper-right of the marquee rectangle was added in Slice 2 alongside the marquee itself, but a follow-up review judged it redundant: the dashed marquee rectangle plus the orange-red `--mr-note-sel` highlight on selected notes already communicate "these notes are selected" without a separate count chip. The selection count is also surfaced — at higher fidelity — in the Inspector's multi-select panel that landed in Slice 5, so the badge duplicates information the user already sees elsewhere on screen. The badge also occupies lane space at the top-right of every marquee, costs a JS-side `effectiveSel.length` read on every render, and is the only element in the piano-roll that requires a JS selection-count.

## What Changes

- **Remove** the `marqueeBadge` JSX block from `PianoRoll.tsx` (the `<div className="mr-marquee__badge">` containing `.mr-marquee__count` and `.mr-marquee__lbl`).
- **Remove** the `.mr-marquee__badge`, `.mr-marquee__count`, and `.mr-marquee__lbl` CSS rules from `PianoRoll.css`.
- **Keep** the SVG marquee rectangle (`.mr-marquee` + `.mr-marquee__rect` + marching-ants animation) and the orange-red selection coloring on notes (`data-sel="true"` + `var(--mr-note-sel)`) — these still carry the "selection" signal.
- **Keep** `effectiveSel` computation in the renderer (notes still consult it for their `data-sel` attribute and background); only the badge consumer is dropped.
- **Update** the `piano-roll` capability's `Marquee renders dashed rect with badge` requirement: rename to `Marquee renders dashed rect` and drop the badge-specific paragraph and scenario; the rectangle's dimensions scenario stays.
- **Update** the `Marquee auto-derives selection when selectedIdx is omitted` and other resolved-selection scenarios that today assert on the badge count: replace the badge assertion with a `data-sel="true"` count assertion (which is the same number, observed via a different DOM element).
- **Update** `?demo=marquee` scenarios in the same spec: drop assertions on `.mr-marquee__count`; keep assertions on the seven `data-sel="true"` notes and on `useStage().resolvedSelection.indexes.length`.
- **Record** the removal in `design/deviations-from-prototype.md` as a back-port-recommended deviation (the prototype's marquee includes the badge); cross-link the existing marquee deviation entries.
- **Update** `design/README.md`'s deviations summary table with the new row.

This is a pure subtraction — no new behavior, no new capabilities, no data-model changes.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `piano-roll`: remove the badge half of the marquee rendering contract — the spec no longer requires `.mr-marquee__badge` / `.mr-marquee__count` / `.mr-marquee__lbl` elements. Marquee rectangle + selection coloring unchanged.

## Impact

- **Code**: `src/components/piano-roll/PianoRoll.tsx` (drop 6-line JSX block + the `marqueeBadge` local); `src/components/piano-roll/PianoRoll.css` (drop three rules, ~25 lines).
- **Specs**: `openspec/specs/piano-roll/spec.md` — rename one requirement, drop one paragraph + one scenario, rewrite two scenarios that reference the badge.
- **Design docs**: `design/deviations-from-prototype.md` (new entry) and `design/README.md` (table row).
- **No** data-model changes, **no** new design tokens, **no** dependency changes, **no** API surface changes.
- **Inspector** capability is unaffected — the multi-select panel already reads `resolvedSelection.indexes.length` directly from `useStage()`, not from the badge DOM.
- **Tests**: any unit/integration test asserting on `.mr-marquee__badge` text needs to switch to asserting on `data-sel="true"` count (or be deleted if the count is already covered elsewhere). `grep -rn 'mr-marquee__badge\|mr-marquee__count\|mr-marquee__lbl' src/ test/` is the catch-all.
