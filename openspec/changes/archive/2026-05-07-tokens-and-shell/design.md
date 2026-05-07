## Context

The repo currently contains only `design_handoff_midi_recorder/` (a hi-fi design bundle) and an empty `openspec/` workspace. There is no application code, no build tooling, no framework choice. Slice 0 of `IMPLEMENTATION_PLAN.md` requires bootstrapping the project AND establishing the shared design-token contract before any visual component is built. Every later slice (transport, piano roll, CC lanes, DJ mode, inspector, pressure editor) depends on this scaffold and on tokens being the *only* source of color/spacing/typography.

The handoff README is explicit: **`tokens.css` is the shared contract**. Hardcoding hex codes anywhere "breaks the contract" — meaning the design-↔-code round-trip workflow stops working.

## Goals / Non-Goals

**Goals:**
- A working `npm run dev` that opens the empty shell at the right geometry, matching screenshot 01.
- `tokens.css` imported byte-identical from the handoff bundle, available globally, scoped under `[data-mr-theme="console"]`.
- Region geometry locked: titlebar, left sidebar, center column (toolstrip + ruler + stage + CC lanes), right inspector, bottom statusbar — using the size tokens (`--mr-w-sidebar`, `--mr-w-inspector`, `--mr-h-toolbar`, `--mr-h-ruler`, `--mr-h-cc-lane`).
- Font stack wired with `font-variant-numeric: tabular-nums` enforced on `--mr-font-mono` consumers.
- Component file structure that mirrors the prototype's `mr-*` class taxonomy, so later slices fill in components without reorganizing the tree.
- A clean separation between `tokens.css` (the contract, do not edit by hand) and `app.css` (component-level styles, owned by this codebase).

**Non-Goals:**
- No transport behavior, no MIDI capture, no playback, no real notes — Slice 0 is geometry only.
- No Electron shell. We pick web-first; an Electron wrapper can come later without touching the React tree.
- No state management library. Slice 0 has no state to manage.
- No icon system. Inline SVG arrives with the components that use them (Slice 1+).
- No design-canvas / tweaks-panel — README explicitly says don't port those.

## Decisions

### D1. Framework: Vite + React + TypeScript

**Choice**: Vite + React 18 + TypeScript, web-first.

**Rationale**: The prototype is React + JSX. Mapping it 1:1 to a real React tree is the lowest-risk path. Vite gives an instant dev server and HMR with no config to fight. TypeScript is the default for any non-trivial app and lets us type the prop shapes that `prototype/components.jsx` already documents.

**Alternatives considered**:
- *Electron + React*: README mentions this is reasonable. Deferred — we can wrap the Vite output in Electron later (Slice 10 territory, where MIDI runtime lives). Adding Electron now would slow every slice's dev loop without paying off until MIDI work begins.
- *SwiftUI / native shell*: only viable on macOS, blocks cross-platform, and discards the JSX prototype as a translation target. Rejected.
- *Vue / Svelte*: would force a full translation of the prototype. No upside.

### D2. Tokens are imported, not authored, here

**Choice**: `src/styles/tokens.css` is a copy of `design_handoff_midi_recorder/prototype/tokens.css`. A short header comment in the codebase copy says "Do not edit — sync from design_handoff_midi_recorder/prototype/tokens.css". A future task may add a sync script; for Slice 0, manual copy is fine.

**Rationale**: The README is unambiguous: edits happen in the design project, then propagate. If the codebase modifies tokens, the round-trip is broken.

### D3. CSS approach: plain CSS with `mr-*` class names

**Choice**: One global `tokens.css` (the contract) + per-component CSS files (or one `app.css`) using the same `.mr-*` class names the prototype already uses.

**Rationale**: The prototype's `app.css` is the spec for component class structure (`.mr-track`, `.mr-unit`, `.mr-cc-lane`, `.mr-ms`, `.mr-note`, `.mr-keys`, `.mr-roll`). Reusing those names keeps the codebase searchable from screenshots and design discussions. CSS Modules or CSS-in-JS would invent new names and obscure the contract. Tailwind would replace the token system with a parallel one. None of those wins outweigh "the prototype already speaks this dialect".

**Trade-off**: No scoping — global CSS can collide. Mitigation: every class is `mr-*` prefixed.

### D4. Layout: CSS Grid for the shell, fixed sizes from tokens

**Choice**: The app shell is a CSS Grid:
- Rows: `var(--mr-h-toolbar) 1fr auto` → titlebar / center body / statusbar.
- Inner body: a 3-column grid: `var(--mr-w-sidebar) 1fr var(--mr-w-inspector)`.
- Center column is a flex column: toolstrip (`--mr-h-toolbar`), ruler (`--mr-h-ruler`), stage (`1fr`), CC lanes block (3× `--mr-h-cc-lane`).

**Rationale**: Grid handles the cross-shaped layout cleanly. Fixed track sizes come straight from the tokens — no magic numbers in the CSS.

**Note on widths**: README says "~232px sidebar" and "~280px inspector", but `tokens.css` defines `--mr-w-sidebar: 280px` and `--mr-w-inspector: 320px`. The tokens are authoritative (D2) — we use the token values. If screenshot 01 disagrees, that's a design-side bug to fix in the source bundle, not here.

### D5. Font loading

**Choice**: Use `@fontsource/inter` and `@fontsource/jetbrains-mono` packages, imported once in `main.tsx`. Apply `font-variant-numeric: tabular-nums` to `:root` for `--mr-font-mono` users via a utility class `.mr-mono` (matches prototype convention).

**Rationale**: Self-hosted via npm avoids external CDN dependence and works offline (relevant for an audio app aimed at producers). Tabular numerals are non-negotiable for timecode legibility — README §Typography calls this out explicitly.

**Alternative**: Google Fonts CDN — rejected for the offline/desktop posture.

### D6. Stub regions, not empty `<div>`s

**Choice**: Each region renders a small placeholder string (e.g. "Titlebar", "Sidebar") in `--mr-text-3` so the layout is visible during dev. These will be replaced wholesale in later slices and should NOT be styled to look polished.

**Rationale**: Empty divs make it impossible to verify geometry in the browser. A faint label per region is a debugging aid, not a feature.

## Risks / Trade-offs

- **Risk**: Hand-copied `tokens.css` drifts from the design source over time → screenshots stop matching.
  **Mitigation**: Header comment in the copy points back to the source path. A later change can add a `npm run sync-tokens` script that copies and diffs. Out of scope for Slice 0.

- **Risk**: We pick Vite + React now and Slice 10 needs Electron, requiring a refactor.
  **Mitigation**: Electron-vite (and similar) can wrap a Vite + React app without changing the React tree. The risk is real but small, and the cost of adding Electron now (slower dev loop, more deps) is not worth paying until MIDI work begins.

- **Risk**: `--mr-w-sidebar` (280px) doesn't match screenshot 01's apparent 232px sidebar.
  **Mitigation**: The tokens are the contract. We follow the tokens. If screenshot 01 visually deviates, log it and ask the design owner — do not fork the value into the codebase.

- **Risk**: Tabular numerals look correct in dev but not in production builds (font-loading race).
  **Mitigation**: `@fontsource` ships with `font-display: swap` — verify timecode area in dev with throttled network. Slice 1 (timecode display) will exercise this; if it breaks, we add `font-display: block` for the mono family.

## Migration Plan

Not applicable — no prior implementation to migrate from. This is the inaugural commit of application code.

## Open Questions

- Should we add a `data-mr-density` toggle (compact/comfortable) in the shell now? **Decision: no.** It's a token-level affordance that costs nothing to leave for a later slice and isn't visible in screenshot 01.
- Where does the Electron wrapper live when it arrives? **Decision: defer.** Likely `electron/` sibling to `src/`, but not Slice 0's call.
