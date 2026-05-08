## 1. Seed generators and lane data

- [ ] 1.1 Create `src/components/cc-lanes/ccPoints.ts` exporting `ccModWheel(totalT)`, `ccPitchBend(totalT)`, `ccVelocity(totalT)`, each returning `CCPoint[]` per the seed formulas in `cc-lanes/spec.md` § "CCLane data shape".
- [ ] 1.2 Add a CommonJS-free determinism check inline (or as a comment block referencing the spec scenarios) — no external test runner is required for this slice.
- [ ] 1.3 Create `src/hooks/useCCLanes.ts` exporting the `CCLane` and `CCPoint` types, the `useCCLanes()` hook with `useReducer`-backed mute/solo toggles, and the seeded default lane set (Mod Wheel · Pitch Bend · Velocity · with `cc3.muted = true`). Reuse the same reducer shape as `useTracks.ts` for consistency.

## 2. CCLane component

- [ ] 2.1 Create `src/components/cc-lanes/CCLane.tsx` with the prop signature from the spec (lane, viewT0?, totalT, onToggleMuted, onToggleSoloed, plus inert paint?/interp? forward-compat props).
- [ ] 2.2 Implement the `bars` resampling (nearest-sample averaging across 64 cells) inside `useMemo` keyed on `lane.points`, `viewT0`, `totalT`.
- [ ] 2.3 Render `.mr-cc-lane[data-muted][data-soloed]` with `.mr-cc-lane__hdr` (name + MSChip + CC label rows) and `.mr-cc-lane__plot`. Reuse the existing `MSChip` from `src/components/ms-chip/MSChip`.
- [ ] 2.4 Render the inline `<svg>` with 64 bar `<g>` elements, each containing the bar `<rect>` (1.5px, color, opacity 0.78) and the cap `<rect>` (2.5px wide, height 2, full opacity).
- [ ] 2.5 Use a `ref` on `.mr-cc-lane__plot` + a `ResizeObserver` (or simple bounding-rect read on mount + window resize) to capture `plotW` so SVG geometry stays correct under viewport changes. If the existing fixed-zoom approach (Slice 2) makes this redundant, derive `plotW` from `cellW * 64` after measuring once.

## 3. Hover scrubbing readout

- [ ] 3.1 Add local `hover: { idx, v } | null` state in `CCLane`.
- [ ] 3.2 Wire `onMouseMove` to `.mr-cc-lane__plot` — compute cell index from `event.nativeEvent.offsetX / plotW * 64`, clamp to `[0, 63]`, look up `bars[idx].v`, set hover state.
- [ ] 3.3 Wire `onMouseLeave` to clear hover state to `null`.
- [ ] 3.4 In the SVG, append a hover-overlay `<g>` containing the column-tint `<rect>` (10% accent) and ghost-bar `<rect>` (70% accent) when hover is non-null.
- [ ] 3.5 Render the `.mr-cc-lane__readout` as a sibling div next to the SVG inside `.mr-cc-lane__plot`, positioned absolutely at the hover cell's x-center, showing `Math.round(v * 127)`.

## 4. CCLanesBlock orchestrator

- [ ] 4.1 Create `src/components/cc-lanes/CCLanesBlock.tsx` taking `lanes`, `viewT0?`, `totalT`, `onToggleMuted`, `onToggleSoloed`. Map `lanes` into one `<CCLane>` per entry.
- [ ] 4.2 Set `data-soloing={anySoloed ? 'true' : undefined}` on the block root with `className="mr-cc-lanes"`.
- [ ] 4.3 Confirm that the Block's class replaces the AppShell's class — i.e., the Block's `<div>` is the `.mr-cc-lanes` element itself, not nested inside one.

## 5. CSS port

- [ ] 5.1 Create `src/components/cc-lanes/CCLane.css` with the rules ported from `prototype/app.css` lines 695–701 (`.mr-cc-lanes`), 863–902 (`.mr-cc-lane`, `.mr-cc-lane__hdr`, `.mr-cc-lane__name`, `.mr-cc-lane__cc`, `.mr-cc-lane__plot`).
- [ ] 5.2 Add the lane-scoped composition rules: `[data-muted="true"] .mr-cc-lane__plot { opacity: 0.32; filter: grayscale(0.7); }` and `[data-soloing="true"] [data-soloed="false"] .mr-cc-lane__plot { opacity: 0.45; }`. Scope them to within `.mr-cc-lanes` if necessary to avoid leaking to track rules.
- [ ] 5.3 Add the `.mr-cc-lane__readout` rule: 10px monospace, `var(--mr-text-2)`, `position: absolute`, no background, with a small top/right offset from the cursor position (e.g. `top: 4px`, `transform: translate(4px, 0)`).
- [ ] 5.4 Verify all token references resolve (`--mr-cc`, `--mr-pitch`, `--mr-aftertouch`, `--mr-accent`, `--mr-bg-panel-2`, `--mr-h-cc-lane`, `--mr-text-2`, `--mr-text-3`).

## 6. Wiring into AppShell

- [ ] 6.1 Extend `src/hooks/useStage.ts` to compose `useCCLanes()` and return `ccLanes`, `toggleCCLaneMuted`, `toggleCCLaneSoloed` alongside the existing fields.
- [ ] 6.2 In `src/components/shell/AppShell.tsx`, replace the three `<div className="mr-cc-slot">` placeholders with `<CCLanesBlock lanes={stage.ccLanes} totalT={stage.totalT} viewT0={0} onToggleMuted={stage.toggleCCLaneMuted} onToggleSoloed={stage.toggleCCLaneSoloed} />`. Remove the now-redundant outer `<div className="mr-cc-lanes">` so the Block's root takes its place.
- [ ] 6.3 Run `yarn typecheck`. Fix any type drift exposed by the new `CCLane`/`CCPoint` types.

## 7. Visual verification

- [ ] 7.1 Run `yarn dev` and open the app. Confirm three lanes render in the CC block with the seeded curves: Mod Wheel sine-walk, Pitch Bend abs-sine sweep, Velocity sine-jitter.
- [ ] 7.2 Confirm the Velocity (`cc3`) lane plot is dimmed and grayscaled by default (`muted: true` in seed).
- [ ] 7.3 Click the M button on the Mod Wheel lane → confirm its plot dims; click again → confirm it returns to full opacity.
- [ ] 7.4 Click the S button on the Pitch Bend lane → confirm Mod Wheel and Velocity plots dim to 0.45 opacity, Pitch Bend stays full. Click again → confirm all return to default state.
- [ ] 7.5 Mouse over each lane's plot → confirm the column tint, ghost bar, and 0–127 integer readout appear at the cursor position; mouseleave → confirm all three disappear.
- [ ] 7.6 Compare side-by-side with `design_handoff_midi_recorder/screenshots/01-piano-mode.png` (or whichever screenshot shows piano-mode CC lanes) and capture any visual deviations as new rows in `design/deviations-from-prototype.md`.

## 8. Spec sync record

- [ ] 8.1 Add a row to `design/deviations-from-prototype.md` (or extend the existing solo-composition entry) recording: "Slice 4: lane-scoped `data-soloing` instead of stage-wide. Track solos and CC-lane solos do not cross-dim. Revisit when DJ mode (Slice 7) lands."
- [ ] 8.2 Confirm `openspec validate cc-lanes --strict` passes (no spec parse errors).

## 9. Pre-archive checks

- [ ] 9.1 `yarn typecheck` clean.
- [ ] 9.2 No `console.log`, debug code, or stray comments referencing the implementation process.
- [ ] 9.3 All Slice 4 visual deliverables match the prototype's piano-mode CC block.
