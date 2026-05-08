## Context

Slice 0 reserved a fixed-height `.mr-cc-lanes` block at the bottom of the center column with three placeholder `.mr-cc-slot` divs sized to `var(--mr-h-cc-lane)` each. Slice 4 fills those slots with the real `CCLane` component, the second piece of the prototype's `Stage` to land in code (after Slice 3's multi-track stack).

The prototype's `CCLane` (`prototype/components.jsx` lines 461–596) is one component with a header strip and a 64-cell SVG bar plot, plus optional paint/interp/hover overlays. This slice ports the visual rendering and the hover scrubbing behavior; paint/interp interactions are out of scope.

CC lanes are the second consumer of `MSChip` after multi-track-stack. The chip's API is settled — it ships untouched. Slice 7 (DJ units) will be the third consumer.

## Goals / Non-Goals

**Goals:**

- All three default piano-mode lanes (Mod Wheel · Pitch Bend · Velocity) render their seeded discrete-bar plots inside the existing `.mr-cc-lanes` block, replacing the Slice-0 placeholder divs.
- Per-lane mute/solo composition matches the prototype's `[data-muted]` and `[data-soloing] [data-soloed=false]` CSS rules at lines 736–747 of `app.css`, scoped to the `.mr-cc-lanes` block.
- Hovering a cell displays a column-tinted ghost, a 1.5px ghost bar in the accent color, and a small text readout of the cell's 0–127 value.
- The 56px header strip layout (name · MSChip cluster on top row · CC label on bottom row) matches `prototype/components.jsx` lines 497–504.
- `CCLane` accepts `paint?: number[]` and `interp?: { a: number | null; b: number | null }` props for forward-compat, even though the orchestrator never passes them in this slice.

**Non-Goals:**

- Click-and-drag paint trails, shift-click interp endpoints, or the paint/interp cursor hints.
- DJ-mode lane variants (Crossfader · EQ · Jog) — Slice 7.
- Cross-block solo composition (lane solo dimming track rows or vice-versa). Slices 3 and 4 use independent solo groups; merging is a future refactor.
- Lifting `hover` state to a hook or selector. Hover is purely local UI state on each `CCLane` instance.
- Real-time CC capture, MIDI playback, or any audio-engine integration.
- Variable plot resolution. The 64-cell grid is a constant.
- Unit tests for paint/interp props that aren't exercised by the orchestrator.

## Decisions

### 1. SVG plot, not canvas

The prototype uses an inline `<svg>` with 64 `<rect>` pairs (bar + 2px cap). For a 64-cell plot at the prototype's plot widths (~800–1100px), SVG is fast enough and integrates cleanly with React. Canvas would force imperative drawing on every hover frame and complicate the readout layering.

**Alternative considered:** `<canvas>` with manual hit-testing. Rejected — premature optimization, harder to style, harder to test.

### 2. Lane-scoped `data-soloing`, not stage-wide

The prototype combines track-, DJ-, and CC-lane-soloing into a single `stageSoloing` flag set on the stage wrapper, so any solo dims everything else. Our shell architecturally separates `.mr-stage` (multi-track stack) from `.mr-cc-lanes` (CC block), making a shared ancestor non-trivial without a new wrapper element.

For Slice 4 we keep the two solo groups independent: lane solos dim only other lanes, track solos dim only other track rows. This is a small visual deviation from the prototype but keeps the responsibility boundaries clean.

**Alternative considered:** lift `data-soloing` to `.mr-center` and broaden the CSS ancestor selectors. Rejected for now — adds coupling between `tracks` and `cc-lanes` capabilities for a small visual gain. Switching to stage-wide later is a one-file refactor.

**Recorded deviation:** add a row to `design/deviations-from-prototype.md` noting the independent solo groups, with the rationale "keeps cc-lanes capability self-contained; revisit when DJ mode (Slice 7) lands".

### 3. Hover state is local to `CCLane`, not in `useCCLanes()`

Hover is purely UI state — it never leaves the rendered lane and doesn't affect any other component. Lifting it to `useCCLanes()` would force re-renders of every lane on every mouse move. `useState<{idx, v} | null>` inside `CCLane` keeps the hover updates scoped.

The `hover` prop on `CCLane` is preserved for forward-compat with the future paint slice (where an external state machine may want to drive hover for keyboard-shortcut affordances), but defaults to `undefined` and is overridden by the local hover state when set internally.

### 4. CC label is a string, not a number

The prototype's `cc` prop accepts `"01"`, `"PB"`, `"VEL"`, etc. — Pitch Bend and Velocity aren't CC numbers. Storing the label as a free-form string keeps the type honest about what's being displayed and avoids special-case mapping logic. The price is no compile-time check that "CC 01" isn't typo'd.

**Alternative considered:** `cc: number | "PB" | "VEL"` discriminated union. Rejected — the renderer always treats it as a string, so the union adds friction at every call site for no benefit until we have an actual CC-number-aware feature (e.g., a CC picker dropdown).

### 5. Discrete-bar painting via nearest-sample averaging

The prototype resamples the input curve onto a 64-cell grid by, for each cell, finding the `points[]` sample closest in time to the cell center and using that sample's `v`. This is fast (O(N×R)) and visually correct for the smooth seed curves we're feeding.

A more accurate alternative would be linear interpolation between bracketing samples, but the visual difference at 64 cells with smooth seeds is imperceptible — we'd be solving a problem we don't have. Port the prototype's algorithm verbatim.

### 6. Color-mix opacity → fixed `fill-opacity` + value cap

The prototype uses `fillOpacity: 0.78` for normal bars and a 2px-tall cap rectangle at full opacity at the top of each bar. The cap is what the IMPLEMENTATION_PLAN's "color-mix velocity opacity" line refers to — it's the visual marker that reads even when the bar height is small. We port this exactly.

**Alternative considered:** computing per-cell opacity from velocity (`opacity: 0.4 + v * 0.6`). Rejected — the prototype's design decision is that bar HEIGHT encodes velocity, not opacity; the cap encodes "an event happened here" independent of value. Don't second-guess it.

### 7. Seed generators in a separate module

`src/components/cc-lanes/ccPoints.ts` exports three pure functions (`ccModWheel`, `ccPitchBend`, `ccVelocity`) that take `totalT: number` and return `CCPoint[]`. Keeping them out of `useCCLanes` lets future slices (capture, import) reuse the same shape and lets us write deterministic snapshot tests without rendering.

### 8. Hover readout formatting

Display `Math.round(v * 127)` — the standard 7-bit MIDI CC range — as a 2–3 digit integer. We could show `v.toFixed(2)` (a `0.00`–`1.00` float), but MIDI conventions are 0–127 and that's what users will type when editing, so we display it that way. Position the readout at the top-right of the hovered cell, not centered on the cursor, so it doesn't occlude the ghost bar.

## Risks / Trade-offs

- **Risk:** Lane-scoped solo groups visibly differ from the prototype when both a track and a CC lane are soloed simultaneously.
  → **Mitigation:** Record as a deviation in `design/deviations-from-prototype.md`. The visual gap is small (track rows in their own block don't desaturate when a CC lane is solo'd) and easy to fix later by lifting `data-soloing` to `.mr-center`.

- **Risk:** SVG re-renders on every hover-state change can flicker for plots with hundreds of cells.
  → **Mitigation:** 64 cells is small. React reconciles the bar `<rect>`s in place; only the hover-overlay group changes on hover. If a future slice raises `resolution` to 256+, revisit with `useMemo` on the bar array (it's already memoized) and `requestAnimationFrame`-throttled hover updates.

- **Risk:** The `paint` and `interp` forward-compat props expose API surface that isn't exercised, risking type drift.
  → **Mitigation:** Keep them strictly typed in `CCLane.tsx` and document that the orchestrator never sets them. A future slice that activates them adds tests at that point. If the props turn out to be wrong-shaped when paint lands, deleting and re-adding them is cheap.

- **Trade-off:** The mute/solo seeded state (`Velocity` muted by default) is a visible "default broken" cue — readers seeing the dimmed Velocity lane on first run may think they have a bug.
  → **Mitigation:** Match the prototype's `ccMS.cc3.muted: true` faithfully and document the seeded state in `useCCLanes.ts` with a comment pointing at the prototype line.

- **Trade-off:** `cc: string` widens the type unnecessarily for true CC numbers, and a typo like `"o1"` would render verbatim.
  → **Mitigation:** Acceptable until a CC-number-aware feature lands. The seed data has the three correct labels hard-coded in `useCCLanes`; user-editable lane labels are far in the future.

- **Trade-off:** Using `var(--mr-cc)`, `var(--mr-pitch)`, `var(--mr-aftertouch)` tokens means lane colors are theme-driven. If `tokens.css` lacks any of these in the current snapshot, lanes would render transparent.
  → **Mitigation:** Verify all three tokens exist in `src/styles/tokens.css` before wiring colors. If any is missing, fall back to a sensible literal `oklch(...)` from the prototype and add a TODO row to the deviations doc.
