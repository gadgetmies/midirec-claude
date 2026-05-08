## Why

Slice 0 carved three placeholder `.mr-cc-slot` divs into the `.mr-cc-lanes` block at the bottom of the center column. Slice 4 in `IMPLEMENTATION_PLAN.md` fills those slots with the real `CCLane` component: a discrete-bar plot of one MIDI CC stream, with a 56px header strip (name · CC label · M/S chip), per-lane mute/solo composition, and a hover scrubbing readout that previews the cell value under the cursor.

CC lanes are the second consumer of the `MSChip` primitive that Slice 3 introduced — getting the header layout right with `MSChip` confirms the chip's reuse contract before Slice 7 (DJ units) becomes the third consumer.

This change consumes the `tracks` capability's `MSChip` and the existing `[data-muted]` / `[data-soloed]` / `[data-soloing]` data-attribute conventions. Per-lane solo groups SHALL be scoped to the `.mr-cc-lanes` block (independent of track solos) — a minor deviation from the prototype's stage-wide solo composition, recorded in `design/deviations-from-prototype.md`.

Acceptance: when the shell renders in piano mode, the three default lanes (Mod Wheel · Pitch Bend · Velocity) display their seeded discrete-bar plots, the M/S chip cluster matches the prototype's coloring under the seeded mute/solo state, hovering a cell ghosts the cell column with a value label, and the per-lane `[data-muted]` / `[data-soloed]` composition matches the prototype's CSS rules at lines 736–747 of `prototype/app.css`.

## What Changes

- **New `cc-lanes` capability** defining:
  - `CCLane` shape: `{ id: string; name: string; cc: string; color: string; points: CCPoint[]; muted: boolean; soloed: boolean }`. `cc` is a string label (e.g., `"01"`, `"PB"`, `"VEL"`) — not a number — to preserve the prototype's freedom to label non-CC streams (Pitch Bend, Velocity). `color` is a CSS color string used as the bar fill.
  - `CCPoint` shape: `{ t: number; v: number }` — `t` is a session-time beat, `v` is in `[0, 1]`. Points are arbitrary samples; the renderer resamples them to a 64-cell grid via nearest-sample averaging.
  - A `CCLanesBlock` orchestrator component that takes `lanes: CCLane[]` plus the renderer's view-window props (`viewT0`, `totalT`) and renders one `<CCLane>` per lane. The block root SHALL carry `data-soloing="true"` whenever any lane is soloed; the `[data-soloing="true"] [data-soloed="false"] .mr-cc-lane__plot { opacity: 0.45 }` rule then desaturates non-soloed lanes within the block. Lane solos do NOT dim track rows in the stage above (independent solo group — recorded as deviation).
  - A `CCLane` component that renders `.mr-cc-lane[data-muted][data-soloed]` containing `.mr-cc-lane__hdr` (name · MSChip cluster · CC label) and `.mr-cc-lane__plot` (the SVG bar plot).
  - Discrete-bar paint: the renderer SHALL resample `points` to a fixed 64-cell grid spanning `[viewT0, viewT0 + totalT]`, then render one centered 1.5px-wide tick-bar per cell. Bar height SHALL equal `cell.v * trackH` (where `trackH = 56`), drawn from the bottom of the plot. Bar fill SHALL be the lane's `color` with `fill-opacity: 0.78` (default) so velocity-light cells visually recede. The 1.5px width is constant regardless of cell pitch — cell width controls event spacing, not bar weight.
  - Color-mix velocity opacity: a 2px-tall "value cap" rectangle SHALL render at the top of each bar in the lane's `color` at full opacity, providing a discrete event marker that reads independently of velocity. The cap is a 1px-extended (x − 0.5, w + 1) rectangle so it overhangs the bar slightly.
  - Hover scrubbing readout: when the user mouses over the plot, the renderer SHALL track `hover: { idx: number; v: number } | null` (cell index under cursor + the cell's stored value) as local component state. While `hover != null`, the plot SHALL render (a) a full-cell-column tinted rectangle in `var(--mr-accent)` at 10% opacity, (b) a 1.5px ghost bar in `var(--mr-accent)` at 70% opacity sized to `cell.v * trackH`, and (c) a small `.mr-cc-lane__readout` text label showing the cell's value, formatted as a 0–127 integer (`Math.round(v * 127)`), positioned at the hover cell's x with a fixed offset. Mouseleave SHALL clear `hover` and remove all three elements.
  - **Out of scope for Slice 4**: paint-drag (`paint: number[]`) and interp endpoints (`interp: { a, b }`) — these are interaction modes for a later slice. The CCLane component MAY accept these props for forward-compat, but the orchestrator SHALL NOT pass them.
- **Three default lanes** seeded for piano mode:
  - Mod Wheel · CC `01` · `var(--mr-cc)` · sine-modulated drift (mirrors `ccPoints1`).
  - Pitch Bend · CC `PB` · `var(--mr-pitch)` · `|sin|`-shaped sweep (mirrors `ccPoints2`).
  - Velocity · CC `VEL` · `var(--mr-aftertouch)` · sine-jittered curve (mirrors `ccPoints3`).
- **Seeded mute/solo state**: lane 3 (Velocity) is `muted: true` by default; no lane is `soloed: true` initially. This produces a visible mute composition out of the box, mirroring the prototype's `ccMS` defaults but without the DJ-mode `xfade.soloed: true` (DJ mode is Slice 7).
- **Modified `app-shell` capability**: the *Three lane slots present* requirement stays, but the *Empty regions ship empty* rule SHALL exclude `.mr-cc-lanes` from the empty list — it's now populated by the `cc-lanes` capability. The three `.mr-cc-slot` placeholder divs are replaced by the orchestrator's three `<CCLane>` outputs.
- **CSS port** — new `src/components/cc-lanes/CCLane.css` containing `.mr-cc-lane`, `.mr-cc-lane__hdr`, `.mr-cc-lane__name`, `.mr-cc-lane__cc`, `.mr-cc-lane__plot` (with the mid-line gradient background) and the lane-scoped `[data-muted]` / `[data-soloing] [data-soloed=false]` opacity/grayscale rules, ported from `prototype/app.css` lines 695–701, 737–747, 863–902. Plus a small `.mr-cc-lane__readout` rule for the hover label (10px monospace, `var(--mr-text-2)`, no background).

## Capabilities

### New Capabilities
- `cc-lanes`: Defines the `CCLane` shape (one MIDI control stream + per-lane mute/solo + display color), the `CCLanesBlock` orchestrator that mounts N lanes inside `.mr-cc-lanes` and owns the lane-scoped `data-soloing` flag, and the `CCLane` component (header + 64-cell discrete-bar SVG plot + hover scrubbing readout). Reuses `MSChip` from the `tracks` capability without modification.

### Modified Capabilities
- `app-shell`: The *Empty regions ship empty until their slices populate them* rule SHALL exclude `.mr-cc-lanes` — it is now populated by the `cc-lanes` capability. The CC Lane slots SHALL contain `<CCLane>` components (with their own `<button>` elements for the M/S chips), not stub labels.

## Impact

- **New files**:
  - `src/components/cc-lanes/CCLane.tsx` — the per-lane component (header + SVG plot + hover handlers).
  - `src/components/cc-lanes/CCLanesBlock.tsx` — the orchestrator that maps `lanes[]` and sets `data-soloing`.
  - `src/components/cc-lanes/CCLane.css` — ported lane CSS plus the readout rule.
  - `src/components/cc-lanes/ccPoints.ts` — pure deterministic seed generators (`ccModWheel(totalT)`, `ccPitchBend(totalT)`, `ccVelocity(totalT)`) ported from the prototype's `ccPoints1/2/3` formulas.
  - `src/hooks/useCCLanes.ts` — lane data + actions (`toggleCCLaneMuted(id)`, `toggleCCLaneSoloed(id)`).
- **Modified files**:
  - `src/hooks/useStage.ts` — extended to include `ccLanes: CCLane[]` and the toggle actions in the returned shape, by composing `useCCLanes()`. The track-marquee/selection routing is unchanged.
  - `src/components/shell/AppShell.tsx` — `.mr-cc-lanes` block's three `.mr-cc-slot` divs replaced by `<CCLanesBlock>` (which re-emits the three lanes inside the same block element). The block's `className="mr-cc-lanes"` attribute moves onto the orchestrator's root.
- **No new runtime deps**.
- **Architectural lock-in (small)**:
  - `CCLane` accepts `paint?` and `interp?` props for forward-compat with the future paint/interp slice, but the orchestrator never sets them. Component tests for those props are out of scope.
  - The 64-cell resolution is a constant in this slice. If a future slice introduces variable resolution it becomes a prop.
  - The lane-scoped `data-soloing` (rather than stage-wide) is a deliberate deviation from the prototype recorded in `design/deviations-from-prototype.md`. Switching to stage-wide later is a small refactor (lift the flag, broaden the CSS selector ancestor) — no spec change beyond the `cc-lanes` capability's solo rule.
- **Renderer interactions out of scope**:
  - Paint-drag, shift-click interp endpoints, paint cursor (`PAINT` hint), interp cursor (`⇧ + CLICK B` hint).
  - DJ-mode (lanesMode === "actions") replacement of the three lanes with Crossfader / EQ / Jog. Slice 7 territory.
  - Real CC capture or playback wiring. The seed generators are stand-ins.
