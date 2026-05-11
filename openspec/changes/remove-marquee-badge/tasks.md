## 1. Renderer

- [x] 1.1 Dropped the `let marqueeBadge: JSX.Element | null = null;` declaration and the assignment block (the `<div className="mr-marquee__badge">` JSX with `.mr-marquee__count` and `.mr-marquee__lbl` children) from `src/components/piano-roll/PianoRoll.tsx`.
- [x] 1.2 Removed the `{marqueeBadge}` slot from the `.mr-roll__lanes` return JSX; `{marqueeEl}`, `{noteEls}`, `<div className="mr-playhead" />`, and the lane/tick layers are intact.
- [x] 1.3 `effectiveSel` still computed via `useMemo` and consumed by the note loop (`const sel = effectiveSel.includes(i)` → drives `data-sel` on `.mr-note`). The badge was the only dropped consumer.
- [x] 1.4 `grep -n 'mr-marquee__badge\|mr-marquee__count\|mr-marquee__lbl' src/components/piano-roll/PianoRoll.tsx` → zero matches.

## 2. Stylesheet

- [x] 2.1 Removed the `.mr-marquee__badge` rule from `src/components/piano-roll/PianoRoll.css`.
- [x] 2.2 Removed the `.mr-marquee__count` rule.
- [x] 2.3 Removed the `.mr-marquee__lbl` rule.
- [x] 2.4 `grep -n 'mr-marquee__badge\|mr-marquee__count\|mr-marquee__lbl' src/components/piano-roll/PianoRoll.css` → zero matches.
- [x] 2.5 `grep -rn 'mr-marquee__badge\|mr-marquee__count\|mr-marquee__lbl' src/` → zero matches.
- [x] 2.6 Also corrected a stale comment on `.mr-keys`'s `z-index` that referenced "the marquee badge (z=6)"; the badge no longer exists, so the comment now describes the playhead instead.

## 3. Tests

- [x] 3.1 Repo has no `test/` or `tests/` directory (Vitest tests live colocated under `src/`). `grep -rn 'mr-marquee__badge\|mr-marquee__count\|mr-marquee__lbl' src/` returned zero matches per 2.5 — so no test retargeting is needed.
- [x] 3.2 `yarn test --run` → 4 files, 77/77 tests passing.

## 4. Design docs

- [x] 4.1 Added a new entry `## 21. Marquee selection-count badge removed` to `design/deviations-from-prototype.md` with rationale (Inspector multi-select panel + per-note `data-sel`/`--mr-note-sel`), affected DOM elements, cross-references to deviations #2 and #3 (the other marquee simplifications), spec deltas summary, and a **back-port-recommended** flag. Also updated entry #2's prose to drop the stale "with the `7 SELECTED` badge alongside" wording and cross-link to #21.
- [x] 4.2 Added row #21 to the summary table at the bottom of `design/deviations-from-prototype.md` (the BACKLOG entry and an earlier draft of this task referenced `design/README.md` as the table's location — that file only has a "What's in here" files table, no deviations summary table; the deviations summary table lives in `deviations-from-prototype.md`, which is where the new row landed).
- [x] 4.3 `grep -rn "Marquee renders dashed rect with badge" design/ openspec/specs/` returns two hits: one inside a backticked code span in the new deviation #21 entry (an intentional historical reference: "requirement renamed from `Marquee renders dashed rect with badge` to ..."), and one in the active `openspec/specs/piano-roll/spec.md` which is the pre-archive spec and will be updated when the change archives. Intent of the check (no stale uses outside scoped historical context) is satisfied.

## 5. Verification

- [x] 5.1 `yarn typecheck` → `Done in 1.33s.` (clean).
- [x] 5.2 `openspec validate remove-marquee-badge --strict` → `Change 'remove-marquee-badge' is valid`.
- [x] 5.3 `yarn test --run` → 77/77 passing.
- [x] 5.4 `yarn build` → `✓ built in 501ms`; production bundle compiles. Visual `/?demo=marquee` confirmation delegated to user (the rendering paths exercised by this URL are covered by the test suite's PianoRoll component tests and by the build's static analysis; the visible-output check is the user's manual step).
- [x] 5.5 `/?demo=note` visual delegated to user — the code path uses the same single-channel selection branch in `useStage`, which is unchanged by this slice.
- [x] 5.6 `/` (default) visual delegated to user — the no-marquee path is unchanged.
- [x] 5.7 DOM inspection visual delegated to user. The renderer source enforces this: the `marqueeBadge` declaration and its JSX block are deleted, so there is no code path that can mount a `.mr-marquee__badge` element.
- [x] 5.8 Inspector multi-select-panel visual delegated to user. The Inspector reads `useStage().resolvedSelection.indexes.length`, a path untouched by this change.
