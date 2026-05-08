## Why

Slice 2 mounted a single `PianoRoll` inside `.mr-stage`, driven by a placeholder `useStage()` hook that returns `notes: Note[]` plus range/window props. Slice 3 in `IMPLEMENTATION_PLAN.md` lifts that single-roll mount into a **multi-track stack**: N collapsible tracks stacked vertically, each with a header (chevron · swatch · name · sub · M/S chip cluster) and either an expanded body that hosts its own `PianoRoll`, or a collapsed body showing a 6px minimap of the track's notes.

Multi-track is the first slice that introduces real per-row state — mute, solo, collapse — and the first slice that needs the *solo composition* behavior the prototype calls out (when ANY row is soloed, every non-soloed row dims). Getting the data attributes right (`[data-track-open]`, `[data-muted]`, `[data-soloed]`, `[data-soloing]` on the stage root) is what makes Slices 4 (CC lanes) and 7 (DJ mode) cheap to add — they reuse the same M/S chip primitive and the same composition rule.

This change consumes the just-archived `session-model` capability:

- Tracks each carry `notes: Note[]` in beats. The session-model time conventions apply unchanged.
- Loop region is *session-scope*, not per-track — it lives in `TransportState`, not in `Track`. Tracks have no loop region of their own; if multi-track loop-per-track is ever needed it's a separate capability.
- The renderer's `(viewT0, totalT)` view window is shared across all tracks — they all show the same time range, just stacked vertically.

Acceptance: when the piano-roll-mode shell renders the seeded 3-track default state (Lead / Bass / Pads) at multiple track-open / mute / solo combinations, the structural and visual elements match what the prototype's `Stage` produces under the same state.

## What Changes

- **New `tracks` capability** defining:
  - `Track` shape: `{ id: string; name: string; channel: string; color: string; notes: Note[]; open: boolean; muted: boolean; soloed: boolean }`. `color` is a CSS color string (oklch) used as the track swatch and as the `trackColor` prop on the per-track `PianoRoll`.
  - A `MultiTrackStage` (or equivalent) component that takes `tracks: Track[]` plus the renderer's view-window props and renders each track as a `<div className="mr-track" data-track-open={open} data-muted={muted} data-soloed={soloed}>` containing a `.mr-track__hdr` and either a `.mr-track__roll` (open) wrapping `<PianoRoll>` or a `.mr-track__collapsed` (closed) wrapping a `.mr-track__minimap`.
  - Track header structure: `<span className="mr-track__chev">` (rotates -90° via `[data-track-open="false"]`), `<span className="mr-track__swatch" style={{background: tr.color}}>`, `<span className="mr-track__name">{tr.name}</span>`, `<span className="mr-track__sub">{tr.channel} · {tr.notes.length} notes</span>`, a `.mr-track__spacer`, and an `<MSChip muted={tr.muted} soloed={tr.soloed}/>`.
  - The minimap: a 6px-tall horizontal strip with one absolute-positioned `<span>` per note, scaled to the lane area's width, colored from the track's color.
  - The stage root SHALL carry `data-soloing="true"` whenever **any** track in the stack has `soloed === true`. Mute/solo composition is then driven entirely from CSS via the prototype's selectors:
    - `[data-muted="true"] .mr-track__roll { opacity: 0.32; filter: grayscale(0.7); }`
    - `[data-soloing="true"] [data-soloed="false"] .mr-track__roll { opacity: 0.45; }`
- **New `MSChip` component** (`<MSChip muted soloed onMute? onSolo?>`) — a small mute/solo button pair. Reusable across tracks (this slice), CC lanes (Slice 4), and DJ units (Slice 7). Markup mirrors `prototype/components.jsx` `MSChip`.
- **New `useTracks()` hook** (or extension of `useStage()`) returning `tracks: Track[]` plus mutation actions (`toggleTrackOpen(id)`, `toggleTrackMuted(id)`, `toggleTrackSoloed(id)`). The stage's `data-soloing` flag is derived from `tracks.some(t => t.soloed)`. Seeded default: three tracks per the prototype's `Stage` (Lead / Bass / Pads) with their colors and per-track note counts (`makeNotes(22, 7)`, `makeNotes(16, 11)`, `makeNotes(12, 19)`).
- **`useStage()` retrofitted to wrap `useTracks()`**: the existing single-track placeholder lifts into the *first* track. The marquee/selection state (`?demo=marquee`) is recorded as belonging to the first track only — the prototype shows the demo marquee only on the Lead track. `useStage()` continues to return the renderer's `(playheadT, totalT, lo, hi, marquee, selectedIdx)` and adds `tracks` and the `selectedTrackId`. Cross-track marquee is out of scope.
- **Modified `app-shell` capability**: the *Stage may contain a piano-roll renderer* scenario relaxes to *Stage may contain a multi-track stack of piano-roll renderers*. The stub-empty-region rule is unchanged; the stage region is still populated.
- **CSS port** — new `src/components/tracks/Track.css` containing the `.mr-track`, `.mr-track__hdr`, `.mr-track__chev` (with rotation), `.mr-track__swatch`, `.mr-track__name`, `.mr-track__sub`, `.mr-track__spacer`, `.mr-track__roll`, `.mr-track__collapsed`, `.mr-track__minimap` rules from `prototype/app.css` lines ~750–812, plus the `[data-muted]` / `[data-soloing] [data-soloed="false"]` composition rules from lines ~736–748. New `src/components/ms-chip/MSChip.css` containing `.mr-ms`, `.mr-ms__btn` and the `[data-on][data-kind=m|s]` variants from lines ~706–735.
- **Marquee demo behavior**: `?demo=marquee` continues to render the screenshot-04 marquee, but now scoped to the Lead track (track index 0) only. Other tracks render their seeded notes at default coloring with no marquee.

The renderer (`PianoRoll`) and Ruler are unchanged from Slice 2 — the multi-track stack just instantiates N PianoRolls with different `notes` and `trackColor` values, sharing the same `(viewT0, totalT, playheadT)` view window. The Ruler stays a singleton above the stack (one Ruler for the whole stage, not one per track).

## Capabilities

### New Capabilities
- `tracks`: Defines the `Track` data shape and the multi-track-stage component that renders a vertical stack of collapsible track rows. Owns the track header (chevron / swatch / name / sub / M/S), the collapsed-row minimap, and the mute/solo composition behavior (`[data-muted]`, `[data-soloed]`, with the stage's `[data-soloing]` flag). The `Track` shape is the per-track storage that Slice 5 (inspector) and Slice 6 (export "Tracks" checkbox list) will read from.

### Modified Capabilities
- `app-shell`: The *Stage may contain a piano-roll renderer* scenario broadens to allow the multi-track stack. No layout/geometry changes.

## Impact

- **New files**:
  - `src/components/tracks/MultiTrackStage.tsx` — the orchestrator component.
  - `src/components/tracks/Track.tsx` — the track row component (header + body switch).
  - `src/components/tracks/Minimap.tsx` — the 6px minimap subcomponent rendered when a track is collapsed.
  - `src/components/tracks/Track.css` — ported track CSS.
  - `src/components/ms-chip/MSChip.tsx` — the M/S chip primitive.
  - `src/components/ms-chip/MSChip.css` — ported M/S CSS.
  - `src/hooks/useTracks.ts` — track data + actions.
- **Modified files**:
  - `src/hooks/useStage.ts` — retrofitted to wrap `useTracks()` and route the marquee/selection to the first track. Returns the same renderer-facing fields (`playheadT`, `lo`, `hi`, `totalT`, `marquee`, `selectedIdx`) plus `tracks` and `selectedTrackId`.
  - `src/components/shell/AppShell.tsx` — replaces the single `<PianoRoll>` mount inside `.mr-stage` with `<MultiTrackStage>`, which internally maps over tracks.
- **No new runtime deps**.
- **Architectural lock-in (small)**:
  - The `MSChip` component's API is the contract Slice 4 (CC lanes) and Slice 7 (DJ units) will reuse. Get it right now.
  - The mute/solo composition is CSS-only (data attributes drive the visual), not JS-derived per-row class. This keeps the render path simple and Slice 4/7's reuse trivial.
- **No interaction implementation in this slice** — the M/S chips and chevrons are visually correct and toggle their data attributes via the actions exported from `useTracks()`, but `useTracks()` itself starts as a placeholder with hardcoded seed state that the user *can* mutate in dev for testing. Track creation, deletion, and reordering are out of scope (handled in a later session-management slice).
- **Marquee/selection model**: stays single-track for this slice. Cross-track marquee is a future-slice concern.
