## Why

The MIDI Recorder design is finalized as a high-fidelity bundle in `design_handoff_midi_recorder/`, but no codebase exists yet. Slice 0 of `IMPLEMENTATION_PLAN.md` establishes the contract that every later slice depends on: the design tokens (the single source of truth shared with the design project) and an empty app shell with correct geometry. Without this, every later component will be built against ad-hoc styles and the design-↔-code sync contract will already be broken on day one.

## What Changes

- Bootstrap a Vite + React + TypeScript project at the repo root (web-first; an Electron/native shell can be wrapped later without changing the React tree).
- Copy `design_handoff_midi_recorder/prototype/tokens.css` into the codebase **verbatim** as the shared contract, imported globally.
- Wire `data-mr-theme="console"` on the app root so the scoped tokens activate.
- Set up the global font stack: `--mr-font-display` (Inter) and `--mr-font-mono` (JetBrains Mono) with `font-variant-numeric: tabular-nums` enforced for the mono family — required for timecode legibility.
- Build the empty **app shell skeleton** with correct widths, heights, borders, and backgrounds — the regions defined in `README.md` §Screens / Views:
  - Titlebar (top)
  - Browser Sidebar (left, ~232px)
  - Toolstrip + Ruler + Stage + CC lanes (center column)
  - Inspector (right, ~280px)
  - Statusbar (bottom)
- All region content is **stubbed/empty** — no transport buttons, no notes, no real lanes. This slice ships zero functionality; it ships geometry and tokens.
- Add an `npm run dev` script and verify screenshot 01 (`design_handoff_midi_recorder/screenshots/`) matches the empty shell.

## Capabilities

### New Capabilities
- `design-tokens`: Provides the shared `tokens.css` contract, theme attribute wiring, and font stack with tabular numerals. Owned by the design project; the codebase consumes it verbatim.
- `app-shell`: Defines the static layout regions of the single-window app (Titlebar, Sidebar, Toolstrip, Ruler, Stage, CC Lanes, Inspector, Statusbar) with correct widths, heights, and surfaces, but no functional content.

### Modified Capabilities
<!-- None — this is the inaugural change; no specs exist yet. -->

## Impact

- **New project scaffold**: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/` tree.
- **New dependency surface**: React 18, Vite, TypeScript. No UI/component library — the design uses raw CSS classes (`.mr-*` prefix) per `prototype/app.css`.
- **Shared contract file**: `src/styles/tokens.css` must be byte-identical to `design_handoff_midi_recorder/prototype/tokens.css`. Future token edits propagate through this file only — no hex codes in components.
- **No audio/MIDI runtime yet**. Web MIDI / CoreMIDI integration arrives in Slice 10.
- **Locks in framework choice** for all later slices. Switching frameworks after Slice 0 means redoing every later slice.
