## Why

The Browser Sidebar is the next unfilled region of the app shell — it ships as `<aside class="mr-sidebar"><span class="mr-stub">Sidebar</span></aside>`, leaving the entire left column empty. Without it, the app has no surface for MIDI device discovery, no record-filter affordance, and no routing matrix — all things visible in screenshot 01 the moment the app launches. Slice 6 of the implementation plan promises a half-day fill; per user direction we are splitting Slice 6 into two sequential changes, and this change ships the Browser Sidebar half. The Export Dialog is deferred to a follow-up change.

## What Changes

- Mount a new `<Sidebar>` React component in the `.mr-sidebar` aside, replacing the stub.
- Render four collapsible panels in fixed order, matching the prototype's `Sidebar` (`design_handoff_midi_recorder/prototype/components.jsx` lines 144–239):
  - **MIDI Inputs** — mic icon, count `2 / 3`, three device rows (Korg minilogue xd CH·1 active, Arturia KeyStep Pro CH·1–4 active, IAC Driver Bus 1 inactive).
  - **MIDI Outputs** — route icon, count `1`, two device rows (Logic Pro · Track 4 CH·1 active with a `play`-state LED, Korg minilogue xd CH·1 inactive).
  - **Record Filter** — filter icon, no count, six switch rows (Notes / Control change / Pitch bend / Aftertouch / Program change / SysEx) plus a channel chip strip (CH 1, CH 2, CH 3, CH 4, CH 10, +10).
  - **Routing** — route icon, no count, a 3×3 input/output matrix (rows: minilogue, KeyStep, IAC 1; columns: Logic Tr 4, minilogue, File) with checkbox cells.
- Each panel head (chevron + icon + title + optional count) is clickable and toggles a local `data-open` boolean; the panel body renders only when `data-open === "true"`. Panel collapse state is component-local, not persisted to `useStage`.
- Render device rows with the LED + name + channel pattern from the prototype: a small left-edge LED (8×8) with `data-state="midi" | "play" | "rec"` color variants, a truncating name, a mono-typed channel suffix. Active rows carry `data-active="true"` adding `--mr-accent-soft` background and a 2px accent stripe via `::before`.
- All controls in this slice are visual stubs (no state mutation): switches, channel chips, routing-matrix cells, device active-state — same convention as M/S chips, the `+ Add Lane` button, and the Inspector's bulk-action buttons.
- Port the Sidebar CSS primitives from `prototype/app.css` lines ~203–329 into `src/components/sidebar/Sidebar.css` (or a small set of co-located files for `Panel.tsx` and the `RoutingMatrix`). Where a primitive is already present in the codebase (e.g., `.mr-row`, `.mr-chip`, `.mr-led`), reuse it and avoid duplication; hoist to a shared CSS file if needed to keep a single source of truth.
- Hardcode the device list, filter state, channel chip set, and routing grid as fixtures inside `Sidebar.tsx`. No live Web MIDI enumeration in this slice (Slice 10 owns the audio engine).
- The Action Map panel for DJ mode (the prototype's conditional `lanesMode === "actions"` branch) is explicitly out of scope; piano mode is the only mode supported until Slice 7.
- Add three small inline SVG icons (mic, route, filter) — either as a new module under `src/components/icons/` or co-located with `Sidebar.tsx`, depending on where existing icons live in the codebase. Reuse the existing chevron icon used by track/channel/lane headers.
- Record the impl-plan-vs-prototype divergence on sidebar section names (impl plan: `Devices / Files / Markers`; prototype: `MIDI Inputs / MIDI Outputs / Record Filter / Routing`) as a new entry in `design/deviations-from-prototype.md` and the summary table in that file.

## Capabilities

### New Capabilities

- `sidebar`: The left-aside Browser Sidebar — four collapsible panels (MIDI Inputs, MIDI Outputs, Record Filter, Routing), the device-row LED-list pattern, the form-row + switch + chip primitives needed by Record Filter, and the routing matrix grid. All controls are visual stubs in this slice.

### Modified Capabilities

- `app-shell`: Drop Sidebar from the empty-regions rule (matching the Slice 5 treatment of Inspector); add a scenario noting the `.mr-sidebar` aside hosts the `<Sidebar>` component's panels and form controls.

## Impact

- **Code**: new `src/components/sidebar/Sidebar.tsx`, `Sidebar.css`, `Panel.tsx`, and a routing-matrix sub-component. Edits to `src/components/shell/AppShell.tsx` to mount `<Sidebar />` in the aside. Possibly small additions to a shared icons module and a shared form-primitive CSS file (only if `.mr-row`, `.mr-chip`, or `.mr-led` need hoisting from existing component-local stylesheets).
- **Specs**: ADDED `sidebar/spec.md`. MODIFIED `app-shell/spec.md`.
- **Design docs**: edits to `design/deviations-from-prototype.md` (new entry #12 + summary table row).
- **Out of scope** (explicitly): real Web MIDI device enumeration, click-to-toggle device active state, switch and chip state changes (visual stubs only), per-panel collapse persistence to `useStage`, the Action Map panel for DJ mode (Slice 7), the Export Dialog (separate Slice 6b proposal).
- **Dependencies**: none new. All work is internal.
- **Risk**: low. The slot is empty today; no existing behavior to preserve. The aside's geometry and panel surface are already token-driven in `app-shell`. The only potential friction is consolidating shared primitives (`.mr-row`, `.mr-chip`, `.mr-led`) without breaking the Inspector's existing usage from Slice 5.
