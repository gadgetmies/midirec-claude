## Why

Slice 1 populated the Titlebar; the Stage region remains an empty stub with a placeholder label. The next visible deliverable in `IMPLEMENTATION_PLAN.md` (Slice 2) is the **Piano roll renderer** — a `PianoRoll` component that takes seeded notes plus optional marquee/selection state and draws the keys column, lane grid, notes (with velocity → opacity), playhead, marquee rectangle, and selection coloring. This is the visual primitive that every later slice (multi-track stack, CC lanes, DJ mode) reuses, so getting it rendering at the correct visual fidelity now is what makes Slices 3–9 cheap.

Real selection / marquee-drag interaction and the multi-track stack are not in scope here — they belong to Slices 3+. Slice 2 ships a single, configurable renderer that can be driven from props (or a placeholder hook) so screenshot 04's marquee + selection visuals can be reproduced when the renderer is given the right inputs.

Reference: `prototype/components.jsx` `PianoRoll` (lines ~310–434), `PianoKeys` (lines ~328–346), and `prototype/app.css` lines ~493–692 (`.mr-roll`, `.mr-keys`, `.mr-key`, `.mr-lane`, `.mr-note`, `.mr-marquee*`, `.mr-playhead`).

Acceptance bar: when given a marquee rectangle and a list of selected note indexes, the renderer reproduces screenshot 04's piano-roll content (notes, playhead, marquee dashed rect with corner ticks, selection-orange notes, count badge). The full screenshot — with track headers, second track, and inspector multi-select panel — is Slice 3+ work and is **not** acceptance for this slice.

## What Changes

- **New `PianoRoll` component** rendering the prototype's piano roll content area: a fixed-width keys column on the left and a lane grid on the right. Markup mirrors `prototype/components.jsx` `PianoRoll` exactly, with TypeScript prop types instead of JS defaults.
  - **Keys column** (`.mr-keys`): one `.mr-key` per pitch in `[lo, hi)`, bottom-up; black keys carry `data-black="true"`; the C of each octave is labelled (e.g. `C4`) in mono 9px.
  - **Lane grid** (`.mr-roll__lanes`): per-pitch `.mr-lane` row, with `data-black="true"` for black-key rows; vertical beat tick lines at every integer beat (major every 4).
  - **Notes** (`.mr-note`): one absolute-positioned block per note. `top`/`height` from pitch, `left`/`width` from time. Background is computed per-note from `(velocity, accent, trackColor)`:
    - When a `trackColor` is provided: `color-mix(in oklab, {trackColor} {50 + vel·50}%, transparent)`.
    - Otherwise: `oklch(68% {0.06 + vel·0.10} 240 / {0.5 + vel·0.5})` (matches prototype's default-note formula).
    - When the note's index is in `selectedIdx`: `data-sel="true"` and background `var(--mr-note-sel)`; the selected style takes precedence over the velocity-derived color.
  - **Playhead** (`.mr-playhead`): vertical 1px line at `playheadT * (width/totalT)`, with the diamond `::before` head from the prototype CSS.
  - **Marquee** (`.mr-marquee` + four `.mr-marquee__corner`s + `.mr-marquee__badge`): when a `marquee` prop is provided, draw the dashed rect with marching-ants animation, corner squares, and a `{count} selected` badge anchored at the rect's top-right (offset 6px right of the rect). Selection auto-resolution (which note indexes fall inside the rect) is delegated to a small pure helper so that the prototype's behavior (`(noteEnd > t0 && t < t1) && (pitch ∈ [pBot, pTop])`) is preserved. Callers may override by passing `selectedIdx` directly.
- **New `Ruler` component** populating the Ruler region (`.mr-ruler`) with bar/beat tick marks and labels, mirroring `prototype/components.jsx` `Ruler` (lines ~436–447). The Ruler reads `totalT` and renders one `.mr-ruler__tick` per beat, with `--major` modifier and a `.mr-ruler__lbl` (`{bar}.{beat}`) at every fourth tick. The Ruler shares the `totalT` constant with the PianoRoll so beat ticks line up vertically.
- **Stage host**: `AppShell` mounts a single `PianoRoll` inside `.mr-stage` driven by a placeholder `useStage()` hook (or local state) that returns:
  - `notes: Note[]` — seeded via the prototype's `makeNotes(38, 7)` (port verbatim as a deterministic helper). The seed produces the same demo data the prototype uses, so the rendered output matches screenshots without manually authored fixtures.
  - `lo: 48`, `hi: 76`, `totalT: 16` — pitch range C3–E5 over 4 bars at the prototype's defaults.
  - `playheadT: number` derived from `useTransport()` (`playheadT = (timecodeMs / 1000) * (bpm / 60) * 4 / 16 * totalT` — i.e., scale current ms to a 16-beat sweep). The exact mapping is fake but consistent: at the playhead it sweeps proportionally to `timecodeMs`, snapping back to `0` on `stop()`.
  - `marquee: {t0, t1, p0, p1} | null` and `selectedIdx: number[]` — both `null` / `[]` by default. A demo-only flag (e.g. `?demo=marquee` query string, or a temporary toggle in `App.tsx`) renders the prototype's screenshot-04 marquee rectangle so visual parity can be confirmed without dragging interaction (which is out of scope).
- **Track-color override is supported via prop** — `PianoRoll` accepts an optional `trackColor` string. Slice 2 itself renders without one (notes use the default blue formula), but the prop is wired so Slice 3's track stack can pass `oklch(...)` per track without further refactor.
- **CSS port** — new `src/components/piano-roll/PianoRoll.css` containing every rule from `prototype/app.css` lines ~493–692 used by piano mode: `.mr-roll`, `.mr-keys`, `.mr-key` (+ `[data-black]`), `.mr-roll__lanes`, `.mr-lane` (+ `[data-black]`), `.mr-note` (+ `[data-sel="true"]`), `.mr-marquee`, `.mr-marquee__corner` (+ all four `[data-c]`), `.mr-marquee__badge`, `.mr-marquee__count`, `.mr-marquee__lbl`, `.mr-playhead` (+ `::before`), and the `@keyframes mr-marquee-march`. Action-rail rules (`.mr-keys--actions`, `.mr-actkey*`, `.mr-lane--action`) are out of scope (Slice 7).
- **CSS port (Ruler)** — new `src/components/ruler/Ruler.css` containing the `.mr-ruler` and `.mr-ruler__tick`/`__lbl` rules from `prototype/app.css`.
- **Update `app-shell` spec**: the empty-region rule must now release **Stage** and **Ruler** (in addition to Titlebar) from the "regions ship empty" clause. The remaining empty list becomes: Sidebar, Toolstrip, CC Lanes (slots), Inspector, Statusbar.

## Capabilities

### New Capabilities
- `piano-roll`: Renders a single piano-roll surface — keys column, lane grid, notes (with velocity-derived opacity and optional track-color override), playhead, and marquee selection box. Selection is data-driven: callers pass either an explicit `selectedIdx` array or a `marquee` rectangle, in which case the renderer derives the selection. Provides the visual primitive that Slices 3 (multi-track stack), 5 (note-inspector), and 7 (DJ mode) reuse.
- `ruler`: Renders the Ruler region above the Stage with bar/beat tick marks and major/minor differentiation. Shares `totalT` with the PianoRoll so beat positions align vertically. The Ruler is purely visual in this slice — it has no time-marker editing or scrubbing.

### Modified Capabilities
- `app-shell`: Relax the *"regions ship empty"* requirement so it applies only to regions other than Titlebar, Stage, and Ruler. The Stage is now populated by the `piano-roll` capability and the Ruler by the `ruler` capability. No layout/geometry changes — the shell's grid, surface tokens, and dividers are unchanged.

## Impact

- **New files**:
  - `src/components/piano-roll/PianoRoll.tsx` — the renderer component.
  - `src/components/piano-roll/PianoRoll.css` — ported piano-roll rules + marquee keyframes.
  - `src/components/piano-roll/notes.ts` — `Note` type, `makeNotes(count, seed)` deterministic seed helper, `notesInMarquee(notes, marquee)` pure selection helper.
  - `src/components/piano-roll/PianoKeys.tsx` — keys-column subcomponent (small enough to colocate, but separate so Slice 7 can reuse).
  - `src/components/ruler/Ruler.tsx` — the Ruler component.
  - `src/components/ruler/Ruler.css` — ported ruler rules.
  - `src/hooks/useStage.ts` — placeholder hook returning `{ notes, lo, hi, totalT, playheadT, marquee, selectedIdx }`. Slice 3 will replace this with a multi-track variant.
- **Modified files**:
  - `src/components/shell/AppShell.tsx` — replace `.mr-stage` and `.mr-ruler` placeholders with `<Stage>`-equivalent: a `<Ruler>` followed by a `<PianoRoll>` driven by `useStage()`.
  - `src/components/shell/AppShell.css` — drop any inner-content styles for `.mr-stage` and `.mr-ruler` now owned by the new components; keep only region allocation.
- **No new runtime deps**. The renderer is plain React + CSS; the marquee marching-ants is a pure CSS keyframe.
- **Architectural lock-in (small)**:
  - `useStage()` becomes the contract Slice 3 will fan out into per-track stages. The shape (notes / range / playhead / marquee) is intentionally minimal so the multi-track wrapper just maps over it.
  - `notesInMarquee` is the pure helper that future drag-marquee interactions will call; baking it as a side-effect-free function now means the interaction layer (Slice 5+) can be unit-tested independently.
- **No interaction**. Clicking notes, dragging marquees, scrubbing the playhead, and zoom/pan are all out of scope. The renderer responds purely to props; later slices add the input layer.
