## Context

Slice 0 shipped the six-region shell at correct geometry. Slice 1 filled the Titlebar with the transport cluster and the `useTransport()` placeholder. The Stage and Ruler regions are still empty stubs. Slice 2 fills them with the **piano-roll renderer** — the visual primitive that every later slice (multi-track stack, CC lanes, DJ mode) reuses.

The reference implementations are `prototype/components.jsx` `PianoRoll` (lines ~310–434), `PianoKeys` (lines ~328–346), `Ruler` (lines ~436–447), and `prototype/app.css` lines ~493–692 (`.mr-roll`, `.mr-keys`, `.mr-key`, `.mr-lane`, `.mr-note`, `.mr-marquee*`, `.mr-playhead`, `@keyframes mr-marquee-march`).

The renderer is purely declarative — it takes notes + optional marquee/selection state as props and draws them. Interactions (clicking, dragging, scrubbing, zoom) belong to later slices. This separation is what lets the renderer be reused as-is by Slice 3 (multi-track stack: many `PianoRoll`s stacked) and Slice 7 (DJ mode: a sibling `ActionRollUnit` component sharing the same lane/note primitives).

## Goals / Non-Goals

**Goals:**
- A `PianoRoll` component that renders a single piano-roll surface — keys + lanes + notes + playhead + (optional) marquee + selection — pixel-accurately against `prototype/components.jsx`'s `PianoRoll`.
- A `Ruler` component that aligns 1:1 with the PianoRoll's beat grid.
- Pure helpers: `makeNotes(count, seed)` for deterministic demo data, `notesInMarquee(notes, marquee)` for marquee → selection resolution. Both unit-testable.
- A `useStage()` placeholder hook that owns the Stage's input state (notes, range, totalT, playhead, marquee). Slice 3 replaces it with a multi-track variant.
- A demo affordance that, when enabled, reproduces screenshot 04's marquee state without requiring drag interaction. The exact mechanism (query string, debug hook, env flag) is decided in D5 below.
- All visuals resolve through `--mr-*` tokens; no new hex literals or new `oklch()` calls outside `tokens.css`.

**Non-Goals:**
- Mouse/touch interaction (click-to-select, drag-to-marquee, click-and-drag note edit, hover preview, scrubbing). All deferred to Slices 5+.
- Multi-track stack (track headers, M/S chips, collapse/expand, minimap, solo composition). Slice 3.
- Note editing (creating, deleting, moving, resizing, velocity drag). Slice 5+.
- CC lane rendering. Slice 4.
- Action-rail / DJ-mode rendering (`.mr-keys--actions`, `.mr-actkey*`). Slice 7.
- Real audio. The playhead's `t` is derived from the placeholder `useTransport()` clock. Slice 10.

## Decisions

### D1. `PianoRoll` is a pure renderer; state lives in `useStage()`

**Choice**: `PianoRoll` is a function component with no internal state. Its props are:

```ts
interface Note {
  t: number;     // start, in beats (0..totalT)
  dur: number;   // duration, in beats
  pitch: number; // MIDI pitch
  vel: number;   // 0..1 (normalised; raw 0..127 is divided by 127 at the source)
}
interface Marquee { t0: number; t1: number; p0: number; p1: number; }
interface PianoRollProps {
  width: number;
  height: number;
  notes: Note[];
  lo?: number;            // default 48
  hi?: number;            // default 76 (exclusive)
  totalT?: number;        // default 16
  playheadT?: number;     // default 0
  marquee?: Marquee | null;
  selectedIdx?: number[]; // explicit; if omitted and marquee is set, derive via notesInMarquee
  trackColor?: string;    // optional override
  accent?: 'note';        // reserved; only 'note' supported in Slice 2
}
```

The renderer derives selection lazily: `effectiveSel = selectedIdx ?? (marquee ? notesInMarquee(notes, marquee) : [])`. This mirrors the prototype's `Stage` behavior (lines ~638–653) where `marqueeSelectedIdx` falls back to auto-resolved indexes.

`useStage()` lives in `src/hooks/useStage.ts` and returns these inputs (plus the playhead from `useTransport()`). It's a plain hook, not a context — only one consumer (the Stage's PianoRoll mount) reads it in Slice 2. Slice 3 will lift it into context when there are multiple tracks.

**Rationale**: Keeping the renderer pure makes Slice 3 trivial (instantiate N copies with different `notes` and `trackColor`) and makes the helpers (`makeNotes`, `notesInMarquee`) the only real testable surfaces. State + side effects + DOM measurement = three different concerns; we want them in different files from day 1.

**Alternative considered**: A class component with internal selection state. Rejected — selection is a Stage-level concern (a marquee can span multiple tracks in Slice 3), so it can't live inside a single PianoRoll.

### D2. Geometry: per-cell math is computed inline; no DOM measurement

**Choice**: All coordinates are computed from `width`, `height`, `lo`, `hi`, `totalT`. Specifically:

```
range = hi - lo
rowH  = height / range
px    = width / totalT  // pixels per beat
```

A note at pitch `p`, time `t`, duration `dur` lands at:

```
top    = height - ((p - lo) + 1) * rowH
left   = t * px
width  = max(2, dur * px)
height = max(5, rowH - 2)
```

Marquee corners follow the same arithmetic, with `pTop = max(p0,p1)` mapped to the *lower* y (because pitch grows upward).

**Rationale**: The prototype does the same thing inline. There's no benefit to factoring this into a hook; the math is short and one-shot per render. Sub-pixel positions are accepted and rounded by the browser — the prototype does not snap to integer pixels and we won't either, to match exactly.

**Trade-off**: Resize requires a re-render with new `width`/`height` props. Acceptable — the parent is the Stage, which is already re-laying-out under viewport changes.

### D3. Note color formula matches the prototype verbatim

**Choice**: The default-blue formula is `oklch(68% {0.06 + vel·0.10} 240 / {0.5 + vel·0.5})`, written directly in JS (not a token), because it parameterises both chroma and alpha by velocity. The track-color formula is `color-mix(in oklab, {trackColor} {50 + vel·50}%, transparent)`. Both come from `prototype/components.jsx` lines ~382–386.

These are runtime-computed `oklch(...)` and `color-mix(...)` strings, generated per-note. They land in inline `style.background`, not in CSS rules.

**Rationale**: Velocity → opacity is a per-note value, not a class state — there's no clean way to express "one of N opacity bands" in CSS without inventing arbitrary CSS variables for vel. Inline style is the right tool. The "no hex literals or new oklch in CSS files" rule from Slice 1 still holds — the rule is specifically about *static* CSS, not runtime-computed inline `style` values.

**Spec note**: `spec.md` documents this as an explicit exception to the no-`oklch()`-outside-tokens rule. The rule's intent (token-driven theming) isn't violated because the *parameters* (lightness, hue) are still constants from the prototype, not theme-driven.

### D4. Selection coloring composes via data attribute, not inline style

**Choice**: When `selectedIdx.includes(i)`, the note element gets `data-sel="true"` and the inline `style.background` is set to `var(--mr-note-sel)` (overriding the velocity color). The CSS rule `.mr-note[data-sel="true"]` adds the highlight ring + box-shadow.

The reason inline `style.background` is set explicitly (rather than relying purely on the CSS rule) is that the CSS rule sets `background: var(--mr-note-sel)` but specificity on attribute selectors is lower than inline style. Without setting it inline, the velocity-derived color would win. The prototype takes the same approach (line ~390).

**Rationale**: Single source-of-truth for "which color does this note render as" is the JSX. CSS provides the ring/glow on top; the base color is JSX-driven. This avoids subtle specificity bugs.

### D5. Demo state for marquee — query-string toggle

**Choice**: `useStage()` reads `window.location.search` once (during initial state setup) and, if it contains `demo=marquee`, returns a hardcoded `marquee = { t0: 3.5, t1: 8.5, p0: 56, p1: 69 }`. The values are tuned (verified empirically against `makeNotes(38, 7)`) to land exactly 7 of the seeded notes inside the rectangle, matching screenshot 04's "7 selected" badge. Otherwise `marquee` is `null` and `selectedIdx` is `[]`.

**Rationale**: We need a way to *visually* verify the marquee renderer without building drag interaction. Query string is the simplest: it leaves no in-source toggle to forget about, and it's trivial to flip on `localhost:5173/?demo=marquee`. Documented in the spec scenario for screenshot 04 acceptance.

**Alternative considered**: A debug toggle in the UI (e.g., a hidden button). Rejected — adds visible cruft to the production-shape app. The query string is invisible by default.

**Alternative considered**: A `VITE_DEMO_MARQUEE=1` env flag. Rejected — requires re-running the dev server to toggle, more friction than the query string.

### D6. Ruler aligns with the PianoRoll's lane grid via per-tick offset

**Choice**: The Ruler region's content offset must match the PianoRoll's keys-column width (56px). The keys column is fixed-width inside `.mr-roll` and the lane area starts at `left: 56px`. The Ruler's tick positions are computed as `KEYS_COLUMN_WIDTH + i * (width / totalT)` directly in the JSX, with `KEYS_COLUMN_WIDTH = 56`. The Ruler's outer `width` is the full passed width (same as the PianoRoll), and `overflow: hidden` clips the rightmost tick (at `i = totalT`) — matching the PianoRoll's lane-area behavior, where its beat ticks also overflow the lane area by 56px.

**Why per-tick offset, not CSS padding-left**: CSS `padding-left` does not shift absolutely-positioned descendants — they're positioned relative to the parent's *padding box*, whose left edge is at the inner edge of the border (i.e., still at `x=0` from the visible left). Applying the offset in JSX is the cleanest way to make the offset actually work, and it keeps the offset value (56) co-located with the math that uses it. An alternative — wrap the ticks in a `<div className="mr-ruler__inner" style={{position:'absolute', left: 56, ...}}>` — adds a DOM node the prototype doesn't have. The per-tick approach is simpler.

**Rationale**: The prototype's `Ruler` component renders without an offset (`<div className="mr-ruler" style={{width}}>`) and is internally inconsistent — beat tick `0` lands at the Stage's left edge, NOT above the lane area's left edge. Our codebase corrects this by applying the offset, which is a small, intentional deviation from the prototype that improves visual alignment between the Ruler ticks and the PianoRoll's lane ticks. The `width` and `px` semantics remain identical to the prototype's so other math (note widths, playhead position) ports unchanged.

### D7. CSS structure

**Choice**: Two new stylesheets — `src/components/piano-roll/PianoRoll.css` and `src/components/ruler/Ruler.css`. Each contains exactly the prototype's rules for its component, ported verbatim.

`PianoRoll.css`: `.mr-roll`, `.mr-keys`, `.mr-key` (and `[data-black="true"]`), `.mr-roll__lanes`, `.mr-lane` (and `[data-black="true"]`), `.mr-note` (and `[data-sel="true"]`), `.mr-marquee` (and `__corner` + `[data-c]` variants), `.mr-marquee__badge`, `.mr-marquee__count`, `.mr-marquee__lbl`, `.mr-playhead` (and `::before`), `@keyframes mr-marquee-march`.

`Ruler.css`: `.mr-ruler`, `.mr-ruler__tick`, `.mr-ruler__tick--major`, `.mr-ruler__lbl`. Plus the `padding-left: 56px` offset rule (D6). The `56px` is a literal that mirrors `.mr-keys { width: 56px }` in `PianoRoll.css` — that single pixel literal also exists in the prototype, so this isn't a new deviation.

**Rationale**: Component-collocated CSS, same pattern as `Titlebar.css` from Slice 1. Easy to find, easy to delete with the component.

**Trade-off**: The `56px` pixel literal is present in two CSS files (the keys column width in `PianoRoll.css` and the ruler offset in `Ruler.css`). We could promote it to a token (`--mr-w-keys`) but this is the kind of upstream-only edit Slice 0 forbids. We document the duplication in the spec; if a third consumer ever needs it, that's the trigger to add a token.

### D8. `notesInMarquee` is a pure helper, not a method on `PianoRoll`

**Choice**: `notesInMarquee(notes: Note[], marquee: Marquee): number[]` lives in `src/components/piano-roll/notes.ts` alongside `makeNotes` and the `Note` type. It's pure (no React, no DOM, no closures) and takes both args explicitly.

```ts
export function notesInMarquee(notes: Note[], m: Marquee): number[] {
  const t0 = Math.min(m.t0, m.t1);
  const t1 = Math.max(m.t0, m.t1);
  const p0 = Math.min(m.p0, m.p1);
  const p1 = Math.max(m.p0, m.p1);
  const out: number[] = [];
  notes.forEach((n, i) => {
    const noteEnd = n.t + n.dur;
    if (noteEnd > t0 && n.t < t1 && n.pitch >= p0 && n.pitch <= p1) out.push(i);
  });
  return out;
}
```

**Rationale**: The selection rule is the ground truth that drag-marquee interaction (Slice 5+) must match. Putting it in a pure helper means later interaction code calls the same function, ensuring the visible selection rect always corresponds to the actually-selected notes.

### D9. AppShell wiring

**Choice**: `AppShell.tsx` replaces the `.mr-stage` placeholder with a `<PianoRoll>` driven by `useStage()`, and replaces the `.mr-ruler` placeholder with a `<Ruler>`. Both components are children of their respective region wrappers — the wrappers (`.mr-stage`, `.mr-ruler`) keep their region-allocation roles and the components own their inner content + class names.

The keys column (56px) is part of `.mr-roll` (i.e., the `PianoRoll`), which lives *inside* `.mr-stage`. There is no separate "left rail" region. This deviates slightly from the prototype's `AppShell` (which has a `.mr-app__sidebar` running the full body height), but our app *does* have that sidebar — it's the existing `.mr-sidebar`, separate from the keys column. The keys column is per-track / per-roll.

**Layout note**: The Stage has `flex: 1; min-height: 0;` (already set by Slice 0). The PianoRoll inside it must fill that space. We pass `width` and `height` as props because the PianoRoll uses absolute positioning internally (per the prototype). To get correct width/height, we use a `ResizeObserver` (or the `useResizeObserver` pattern: a small `useElementSize` hook that returns `{ width, height }` from a ref). The hook is small enough to colocate with `useStage`.

**Rationale**: ResizeObserver is the standard answer for "give me my element's size as state". Layout-effect-then-rAF would also work but adds a frame of jank; ResizeObserver fires synchronously after layout.

### D10. Playhead time mapping

**Choice**: `playheadT` is computed in `useStage()` as:

```ts
const beatsPerSec = bpm / 60;
const totalBeats = totalT;            // 16 in our seed
const beatsElapsed = (timecodeMs / 1000) * beatsPerSec;
const playheadT = beatsElapsed % totalBeats;
```

So the playhead sweeps from `0` to `totalT` over `totalT / beatsPerSec` seconds (~7.7s at 124 BPM, 16 beats), then wraps. When `mode === 'idle'` and `timecodeMs === 0`, `playheadT === 0` → playhead at the far left.

**Rationale**: Bar/beat math has to come from somewhere. The prototype hardcodes `playheadT={recording ? 8.4 : 6.2}` because it's a static mockup. Our placeholder advances proportionally to the existing fake clock; this is not musically faithful but it's consistent with itself, and it's what every slice between 2 and 10 will use until Slice 10's real audio runtime takes over.

**Alternative considered**: Stop the playhead at `totalT` instead of wrapping (so it doesn't reset visually mid-demo). Rejected — the demo's whole point is to show motion; wrapping is more useful than freezing.

## Risks / Trade-offs

- **Risk**: The note-color `oklch(...)` formula in JSX inline-style is a runtime string concatenation that doesn't get token-driven theming.
  **Mitigation**: Documented as an explicit deviation. If a future slice changes the note hue (e.g., per-track color), the `trackColor` prop is the supported escape hatch — for the default case, this is by design (the prototype does the same). Token-driven note color is a Slice-7+ concern when DJ-mode color overrides land; revisit then.

- **Risk**: ResizeObserver triggers re-renders on every resize frame, which then triggers a re-layout of every note element. For 38 notes this is fine; for 1000+ it could matter.
  **Mitigation**: Slice 2 ships at 38 notes per the prototype's seed. If the perf budget gets tight in later slices, we throttle ResizeObserver via `requestAnimationFrame` or move to canvas rendering. Don't optimize speculatively.

- **Risk**: The playhead re-renders at 60fps because `playheadT` is derived from `timecodeMs`, which ticks at 60fps. The PianoRoll re-renders entirely each frame.
  **Mitigation**: React's reconciliation is fast for ~38 elements. If profiling shows the diff is hot, memoize the static parts (lanes, ticks, notes) via `useMemo` or split the playhead into its own component reading `useTransport()` directly. Defer until measured.

- **Risk**: Selection auto-derivation runs `notesInMarquee` on every render even when neither notes nor marquee changed.
  **Mitigation**: Wrap the call in `useMemo` keyed on `[notes, marquee, selectedIdx]`. Cheap and effective.

- **Risk**: The keys-column `56px` literal in two CSS files is a token-violation hint waiting to happen.
  **Mitigation**: Documented in the spec. If a third consumer needs it (Slice 7's action-rail keys column, which could be a different width), promote `--mr-w-keys` to `tokens.css` upstream. Until then, the duplication is contained and explicit.

- **Risk**: The "demo=marquee" query-string toggle is undiscoverable for a future contributor.
  **Mitigation**: Document in the spec scenario (screenshot 04 acceptance) and mention in `README.md` (or a `DEVELOPING.md` if one exists). The toggle is removed in Slice 5 when real drag-marquee interaction lands.

## Migration Plan

Not applicable — no breaking changes. The Slice 1 spec MODIFIED requirement (`empty regions`) is text-only; relaxing it to release the Stage and Ruler is a continuation of the same wording pattern.

## Open Questions

- **Should `--mr-w-keys` be added to `tokens.css`?** Owner: design source. Slice 2 ships the literal duplicated; revisit if a third consumer needs it (Slice 7).
- **How does the playhead wrap in real audio?** Slice 10's problem. Slice 2 wraps; Slice 10 will replace `useStage().playheadT` with real audio-clock data.
- **Where does selection live in the multi-track world?** Slice 3 will lift `selectedIdx` and `marquee` out of `useStage()` into a Stage-level context, since a marquee can span tracks. The Slice-2 hook is single-track and that question doesn't arise yet.
