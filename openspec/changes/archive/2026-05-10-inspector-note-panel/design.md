## Context

The Inspector aside has shipped as a stub since the original `tokens-and-shell` slice. Every other shell region has been filled by subsequent slices (Titlebar by `transport-titlebar`, Timeline by `ruler` + `channels` + `tracks` + `piano-roll` + `param-lanes`). The Inspector is the last empty slot, scheduled by the implementation plan as Slice 5 — a half-day fill targeting screenshot 04's multi-select state plus the prototype's single-select state.

Selection state today is purely demo-driven (`?demo=marquee` → fixed `marquee` rect on Lead channel; otherwise nothing selected). There is no click-to-select, no drag-to-marquee gesture wired to pointer events. The `notesInMarquee` helper, the `Marquee` shape, and the per-channel `selectedIdx` plumbing all already exist (added in earlier slices); they're just unused outside the demo flag. Real selection interaction lands in a later slice and is explicitly out of scope here.

The constraint, then: ship the Inspector as a real component reading real (resolved) selection state, but driven by demo fixtures rather than pointer events. The architecture has to be the one we want long-term — fixed wiring now would just need rework when interaction lands.

## Goals / Non-Goals

**Goals:**

- Fill the `.mr-inspector` slot with a `<Inspector>` component that renders the Note panel correctly across all three selection states (none / single / multi).
- Establish the `resolvedSelection` contract on `useStage()` so the Inspector consumes a single, pre-computed value rather than re-deriving from `marquee` + `selectedIdx` + `selectedChannelId`.
- Add the `?demo=note` URL fixture so the single-select panel state is reachable without real selection interaction.
- Derive multi-select summary values from the resolved selection via pure helpers — no hardcoded screenshot-matching strings.
- Port the prototype's Inspector CSS primitives (`.mr-insp-tabs`, `.mr-insp-tab`, `.mr-kv*`, `.mr-slider*`) verbatim.

**Non-Goals:**

- Real click-to-select / drag-to-marquee pointer interaction. The marquee is still demo-driven.
- Pressure tab content (Slice 9) — the tab label exists, the body is empty.
- Channel tab content — same.
- Bulk-action handlers — the buttons render but click is a no-op.
- DJ-mode (actions) inspector variant — out of scope until Slice 7+.
- Cross-channel marquee selection — separate backlog item.
- Fixing pre-existing inconsistency between the `piano-roll` spec's "single PianoRoll" legacy wording and the current multi-track reality (out of scope; that's a `tracks`/`channels` spec issue).

## Decisions

### 1. Inspector owns the resolved-selection consumer; `useStage` owns the producer

**Decision**: Add `resolvedSelection: { channelId: ChannelId, indexes: number[] } | null` to `useStage()`'s return value. The hook runs `notesInMarquee` against the selected channel's roll when needed and produces a single resolved value. The Inspector consumes that value directly.

**Rationale**: The Inspector needs the *resolved* selection (actual indexes) for both rendering decisions (none/single/multi switch) and summary computation. Re-running `notesInMarquee` inside the Inspector would couple it to `marquee` and `selectedIdx` shape details that are stage-internal. Centralising the resolution in `useStage` also means future selection sources (real pointer events, ruler shift-drag, programmatic selection) all funnel through one branch.

**Alternative considered**: pass `marquee`, `selectedIdx`, `selectedChannelId` to the Inspector and let it resolve. Rejected — duplicates the resolution logic that already exists in `PianoRoll.tsx:42-45`, and creates two places where the rules can diverge.

### 2. Multi-select summary derived, not hardcoded

**Decision**: Compute count, range (BBT pair), pitch-set, mean velocity + mixed flag, length single-or-mixed-range, and channel from the selected `Note` records via pure helpers in a new `src/components/inspector/summary.ts`. Helpers exported and unit-tested independently.

**Rationale**: Hardcoding "02.1.1 → 04.4.4" etc. to match screenshot 04 makes the panel inert — change a note in `makeNotes` and the summary lies. Derived values stay correct under any selection state, including future real-selection scenarios. The helpers are ~80 LOC of pure functions, trivially testable.

**Alternative considered**: hardcode for screenshot fidelity. Rejected — the screenshot is a fixture, not a contract; what matters is that the summary correctly reflects whatever `notesInMarquee(makeNotes(38, 7), {t0:3.5,t1:8.5,p0:56,p1:69})` produces.

### 3. Tab labels: `Note / Pressure / Channel`

**Decision**: Use the implementation plan's labels (`Note / Pressure / Channel`), not the prototype/screenshot labels (`Note / Track / File`). Record the deviation in `design/deviations-from-prototype.md`.

**Rationale**: The Pressure label maps directly to Slice 9's deferred content — keeping it visible (even with an empty body) is honest signposting. `Track` and `File` are not flagged as needed for any subsequent slice. The implementation plan is the authoritative source for slice scope; the prototype is illustrative.

**Alternative considered**: prototype labels. Rejected; would force a second renaming pass when Slice 9 lands.

### 4. Inactive tabs render labels but no body content

**Decision**: Pressure and Channel tab labels render (visible, dimmed via the prototype's default `.mr-insp-tab` style). Clicking them sets the active tab via `data-on="true"`, but the panel body for the non-Note tabs is empty (zero children inside the body container). No placeholder text.

**Rationale**: Visible tabs document the future content surface and keep visual fidelity with the screenshot's tab strip. Empty bodies are explicit signposting that the tab is reserved.

### 5. `?demo=note` is mutually exclusive with `?demo=marquee`; marquee wins

**Decision**: When both flags are present, `?demo=marquee` wins. Documented in the spec scenario.

**Rationale**: The two demos are conceptually exclusive (single-select vs multi-select). Defining a winner makes the behaviour deterministic; picking marquee preserves the existing screenshot-04 demo as the canonical multi-select fixture.

### 6. Bulk-action buttons render as visual-only

**Decision**: All six bulk-action buttons (Quantize, Nudge ←→, Transpose, Velocity ±, Duplicate, Delete N) render with the prototype's geometry but `onClick` is a no-op. The Delete N button's count IS derived from the resolved selection length.

**Rationale**: Same convention as M/S chips and `+ Add Lane` — visual-fidelity slices ship the surface, behaviour comes later. Avoids inventing edit semantics that don't yet have a selection model to operate on.

### 7. CSS ports verbatim from `prototype/app.css` lines ~905–1001

**Decision**: New file `src/components/inspector/Inspector.css` contains `.mr-insp-tabs`, `.mr-insp-tab`, `.mr-insp-tab[data-on="true"]`, `.mr-kv`, `.mr-kv__k`, `.mr-kv__v`, `.mr-slider`, `.mr-slider__fill`, `.mr-slider__thumb`, `.mr-slider[data-mixed="true"] .mr-slider__fill`. Plus a small block for the multi-select hatched swatch (currently inline-styled in the prototype — extract to a `.mr-insp-swatch--multi` class for cleanness).

**Rationale**: Same convention as PianoRoll.css and ParamLane.css — verbatim port of prototype CSS, all values resolve through `--mr-*` tokens. The hatched swatch is the one place where extracting beats keeping inline styles (the `repeating-linear-gradient` is too long to inline cleanly in JSX).

## Risks / Trade-offs

- **Risk**: `formatBBT` and `formatPitch` need to handle edge cases (negative beats, pitches outside `lo/hi`). → **Mitigation**: unit tests covering the boundary cases; for now, `lo/hi` come from `useStage` (`48`/`76`) and notes are guaranteed within range by `makeNotes`. Out-of-range inputs are unreachable in practice; helpers can `clamp` or return `--` for safety.
- **Risk**: The `resolvedSelection` field changes `useStage()`'s public shape. Any code (tests, future callers) that destructures the return value sees a new field. → **Mitigation**: it's a new field, not a removal or rename, so destructuring is unaffected. The spec MODIFICATION captures the additive nature.
- **Risk**: The legacy "single PianoRoll" wording in `piano-roll/spec.md:191-200` is stale relative to the multi-track reality. Touching the requirement here without fixing the stale wording leaves the inconsistency in place. → **Mitigation**: explicitly out of scope; the slice modifies only the demo-flag branch (which is the part directly affected by adding `?demo=note`). A separate cleanup pass is appropriate, not this one.
- **Trade-off**: Keeping bulk-action buttons inert means a user clicking Delete-N expecting a delete sees no feedback. → **Mitigation**: visual-only convention is established in the codebase (M/S chips, `+ Add Lane`). A short comment in `Inspector.tsx` notes that handlers land with the selection-interaction slice.
- **Trade-off**: `?demo=note` as a URL flag clutters the URL-flag namespace. → **Mitigation**: the namespace is currently `demo=*` only (one entry, `marquee`); two flags is fine. Long-term, real selection replaces both flags entirely.
