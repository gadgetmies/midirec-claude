# Deviations from the prototype

Every place where the codebase chose differently than `design_handoff_midi_recorder/prototype/`. Each item lists the rationale, where it lives in the codebase, and a recommendation on whether to back-port to the design source.

## 1. `--mr-note-sel` token value — warm orange-red instead of light blue

**What changed**: `src/styles/tokens.css` overrides `--mr-note-sel` to `oklch(72% 0.18 30)` (a warm orange-red). The upstream `design_handoff_midi_recorder/prototype/tokens.css` value is `oklch(82% 0.14 240)` — a light blue.

**Why**: The README §Design Tokens describes `--mr-note-sel` as *"selected note (warm orange-red)"*, and `screenshots/04-marquee-selection.png` renders selected notes in warm orange-red. The upstream token value contradicts both the README description and the screenshot. The codebase's local override aligns with the documented design intent.

**Where**: `src/styles/tokens.css` lines around the `--mr-note` block, with an explicit deviation comment.

**Recommendation**: Back-port to `design_handoff_midi_recorder/prototype/tokens.css` (change the value to `oklch(72% 0.18 30)` or another warm orange-red the design owner picks). Once back-ported, the codebase removes its deviation comment and resumes pure sync.

**Status**: deviation — awaiting design source fix.

## 2. Marquee corner markers removed

**What changed**: The four `.mr-marquee__corner` squares (positioned at `tl/tr/bl/br` of the marquee rectangle in the prototype) are no longer rendered. The marquee is just a dashed-stroke rectangle with the `7 SELECTED` badge alongside.

**Why**: Design owner request after visual review — the corner squares added clutter without adding signal beyond what the dashed border already conveys. Removing them simplifies the visual.

**Where**:
- JSX: `src/components/piano-roll/PianoRoll.tsx` — `.mr-marquee__corner` elements not rendered.
- CSS: `src/components/piano-roll/PianoRoll.css` — `.mr-marquee__corner` rules removed.

**Recommendation**: Back-port to `prototype/components.jsx` and `prototype/app.css` — remove the corner markers from the prototype's marquee component. Update screenshot 04 to match if regenerated.

**Status**: confirmed by design owner — back-port pending in next inbound bundle.

## 3. Marquee marching-ants animation — SVG `stroke-dashoffset` instead of CSS `background-position`

**What changed**: The marquee in the codebase is an `<svg>` containing a `<rect>` with `stroke-dasharray: 4 4` and an `animation` on `stroke-dashoffset` (0 → -8 over 0.8s linear infinite). The prototype is a `<div>` with `border: 1px dashed var(--mr-accent)` and an `animation: mr-marquee-march 0.8s linear infinite` that animates `background-position`.

**Why**: The prototype's animation has no visible effect — `background-position` only moves a repeating-pattern fill, but the marquee's `background` is a flat-color `color-mix()`, not a pattern. There's nothing for `background-position` to move, so the dashes never march. SVG `stroke-dashoffset` is the standard CSS-only way to actually animate dashed strokes.

**Where**:
- JSX: `src/components/piano-roll/PianoRoll.tsx` — the marquee renders as `<svg className="mr-marquee">` containing a `<rect className="mr-marquee__rect">`.
- CSS: `src/components/piano-roll/PianoRoll.css` — `.mr-marquee__rect` carries the dashed-stroke + animation.

**Recommendation**: Back-port to the prototype. The prototype's animation is broken; SVG with stroke-dashoffset is the right technique. Tradeoff: the DOM element type changes from `<div>` to `<svg>` — minor.

**Status**: deviation — fixes a latent bug in the prototype.

## 4. Ruler keys-column offset — JSX per-tick, not CSS `padding-left`

**What changed**: The Ruler's tick and label children are positioned at `left: KEYS_COLUMN_WIDTH + i * pxPerBeat` in JSX, where `KEYS_COLUMN_WIDTH = 56`. The original instinct was to put `padding-left: 56px` on the `.mr-ruler` element in CSS.

**Why**: CSS `padding-left` does not shift absolutely-positioned descendants — they're positioned relative to the parent's *padding box*, whose left edge is at the inner edge of the border. So absolute children with `left: 0` would still land at the visible left edge regardless of padding. Computing the offset in JSX is the only way to actually shift the ticks.

**Where**: `src/components/ruler/Ruler.tsx` — `KEYS_COLUMN_WIDTH = 56` constant; tick/label `left` includes the offset.

**Recommendation**: No back-port needed. The prototype's `Ruler` component doesn't apply this offset at all (it lets ticks span the full passed `width`, including over the keys column area). The codebase's offset is an intentional improvement so beat-0 in the Ruler aligns with beat-0 in the lane area below. Document as an enhancement.

**Status**: improvement — codebase is more correct than prototype.

## 5. Fixed-zoom rendering — constant `pxPerBeat` × `rowHeight`

**What changed**: The PianoRoll and Ruler render at fixed pixel sizes derived from constants `DEFAULT_PX_PER_BEAT = 88` (px per beat) and `DEFAULT_ROW_HEIGHT = 14` (px per pitch row). The piano roll is `KEYS_COLUMN_WIDTH + totalT * pxPerBeat` × `range * rowHeight` pixels. The viewport's center column may be wider or narrower than the piano roll; `.mr-center { overflow: hidden }` clips the fixed-size content at the column boundary.

The prototype's renderer takes `width` and `height` props and resizes responsively to fit them.

**Why**: Responsive resizing introduces ResizeObserver lag (renderer measures, then re-renders, then layout settles) and races during interactive resize where stale prop values force the renderer wider than its allocated column, overlapping the inspector. Fixed zoom decouples the renderer's intrinsic size from the viewport, making the layout robust at any window size. Horizontal/vertical scrolling to navigate a roll wider/taller than the viewport is a deliberately deferred concern — it's the right next step but isn't required for Slice 2 acceptance.

**Where**:
- Constants: `src/components/piano-roll/PianoRoll.tsx` exports `KEYS_COLUMN_WIDTH`, `DEFAULT_PX_PER_BEAT`, `DEFAULT_ROW_HEIGHT`.
- Renderer: PianoRoll and Ruler compute their own widths/heights from those constants. No `useElementSize` / `ResizeObserver` involved.
- Layout shell: `.mr-shell`, `.mr-body`, `.mr-center` all carry `min-width: 0` + `overflow: hidden` to contain the fixed-size renderer.

**Recommendation**: Confirmed by design owner — fixed-zoom rendering is the chosen approach. Horizontal/vertical scrolling is a deliberately deferred concern for a later slice. The prototype's measure-based mock can stay as-is (it's a design canvas, not production), but Slice 6+ design refreshes should assume fixed zoom + scroll/zoom UI.

**Status**: confirmed by design owner — fixed zoom is the model.

## 6. Ruler `5.1` label removed

**What changed**: For a 16-beat view (`totalT = 16`), the Ruler renders major labels `1.1`, `2.1`, `3.1`, `4.1` — but NOT `5.1` (the start of bar 5). The prototype's `Ruler` component would emit a `5.1` label at i=16.

**Why**: Bar 5 starts AT the very right edge of a 4-bar window. The `5.1` label, even if positioned correctly, falls outside the visible area (clipped by `.mr-ruler { overflow: hidden }`). And conceptually the labels should mark the start of each bar that has CONTENT visible — bar 5 has no content because the window only extends to beat 16. So we suppress the label at `i === totalT`.

**Where**: `src/components/ruler/Ruler.tsx` — label rendering condition is `major && i < totalT`.

**Recommendation**: Back-port to the prototype's `Ruler` component (suppress label at the trailing tick). Minor change.

**Status**: deviation — small bug fix.

## 7. AppShell layout — explicit grid `minmax(0, 1fr)` and `overflow: hidden`

**What changed**: `.mr-shell` has `grid-template-columns: minmax(0, 1fr)` plus `overflow: hidden`. `.mr-body` has `grid-template-columns: var(--mr-w-sidebar) minmax(0, 1fr) var(--mr-w-inspector)` (explicit `minmax(0, ...)` for shrinkability) plus `overflow: hidden`. `.mr-center` (a grid that defines `grid-template-rows` but no template columns) has `grid-template-columns: minmax(0, 1fr)` plus `min-width: 0` plus `overflow: hidden`. `.mr-stage` has `min-width: 0`.

The prototype's `app.css` `.mr-app` uses plain `1fr` columns and no `overflow: hidden` on these containers.

**Why**: With plain `1fr` (or no `grid-template-columns` at all, which defaults to an auto-sized implicit column), the column's `min-width: auto` resolves to its content's min-content width. For `.mr-shell` and `.mr-body` that's the titlebar's transport bar (several hundred pixels). For `.mr-center` that's the PianoRoll's intrinsic width (`KEYS_COLUMN_WIDTH + totalT * pxPerBeat ≈ 1464px` at default zoom) — making `.mr-stage` wider than its allocated body-grid cell and pushing absolute-positioned children past the inspector boundary (e.g., M/S chips on track headers via `.mr-track__hdr`'s `flex: 1` spacer + `MSChip` at the row-end). Explicit `minmax(0, 1fr)` lets the `1fr` actually shrink to 0. `overflow: hidden` on the cascade containers (shell/body/center) contains the fixed-zoom renderer at the column boundary regardless of any one-frame resize-observer lag.

**Where**: `src/components/shell/AppShell.css`.

**Recommendation**: Back-port to `prototype/app.css`. The prototype currently doesn't surface the bug because the design canvas always renders at fixed pixel sizes (no responsive resize), but the underlying CSS will misbehave once the prototype gets a real responsive viewport. Worth fixing upstream.

**Status**: improvement — codebase is more robust.

## 8. CC lane solo composition — lane-scoped, not stage-wide

**Status**: SUPERSEDED by the `channel-grouped-timeline` change. The `data-soloing` attribute now lives on the timeline root (`.mr-timeline`) and reflects a session-global predicate (any channel/roll/lane soloed). Audibility cascades: a roll/lane is audible iff its own `soloed` OR its parent channel's `soloed`. The earlier lane-block-scoped split is gone.

## 10. Timeline organized by channel groups (Channel → Roll + CC lanes)

**What changed**: The timeline is built from `.mr-channel` groups. Each channel owns one piano-roll track and zero-or-more CC lanes that render inline beneath it. M/S and collapse exist independently at three levels (channel / roll / lane). CC lanes carry a `kind: 'cc' | 'pb' | 'at' | 'vel'` discriminator instead of a free-form `cc: string`; the seeded "Velocity" lane is renamed "Note Velocity" with `kind: 'vel'` to stop pretending it's a CC. Each channel exposes a `+ Add CC` popover for adding standard MIDI CCs or a custom CC#. Channels render only when they have content (notes or non-empty CC plots).

The prototype's `Stage` keeps tracks and CC lanes as separate sibling regions — the multi-track stack at top, the CC band at the bottom. There is no notion of a channel as an organizational unit; tracks carry a free-form `channel: "CH 1"` string and CC lanes are global to the session.

**Why**: CCs in MIDI are channel-scoped (status byte `0xBn`). Treating channels as the organizational unit makes the data model honest, lets us colocate a channel's roll with its CCs, and gives a sensible home for channel-level M/S. Inlined CCs replace the prototype's sticky-bottom band — the synchronized horizontal scroll axis is preserved, but vertical scroll moves the whole stack as one continuous list.

**Where**:
- Hook: `src/hooks/useChannels.ts` (replaces the previous `useTracks` + `useCCLanes`).
- Components: `src/components/channels/ChannelGroup.tsx`, `AddParamLaneRow.tsx`, `AddParamLanePopover.tsx`.
- Updated leaves: `src/components/tracks/Track.tsx` (now takes `roll: PianoRollTrack` and `channel: Channel`), `src/components/param-lanes/ParamLane.tsx` (kind-aware label, chevron + collapsed support).
- CSS: `.mr-channel`, `.mr-channel__hdr*` in `src/components/channels/ChannelGroup.css`. Session-global solo dim selector `.mr-timeline[data-soloing="true"] [data-audible="false"] ...` lives in the same file.

**Recommendation**: This is a structural deviation that the prototype design canvas doesn't yet model. Worth back-porting to the prototype as a refresh once the design owner reviews — the prototype's flat tracks+CCs sibling structure is a less-honest-to-MIDI shape.

**Status**: deviation — codebase moves ahead of the prototype.

## 9. M/S chips on the right edge of each CC lane row (now sticky-right)

**What changed**: The MSChip wrapper (`.mr-param-lane__ms`) is rendered as a flex-sibling of `.mr-param-lane__plot`, with `position: sticky; right: 0; z-index: 1; align-self: center`. The 56px left header strip (`.mr-param-lane__hdr`) holds only the lane name and CC label and is `position: sticky; left: 0; z-index: 2`.

The prototype's `CCLane` (`prototype/components.jsx` lines 497–504) nests `<MSChip>` inside the 56px left header alongside the lane name, so the M/S controls sit at the upper-right of the small left strip rather than the upper-right of the full lane row.

**Why**: Design owner request — the M/S chips should mirror the multi-track header convention (chips at the row's far-right end), not float in a 56px corner that's visually disconnected from the lane's identity. Right-edge placement also reads as a per-row affordance of the lane plot rather than a property of the label area. Sticky-right (instead of absolute) is required by the `synchronized-timeline-scroll` capability so the chip stays at the visible right edge of the timeline scroll container at every horizontal scroll offset, not at the natural right edge of the lane row (which would be off-screen at high scroll offsets).

**Where**:
- JSX: `src/components/param-lanes/ParamLane.tsx` — `<div className="mr-param-lane__ms">` is a sibling of `.mr-param-lane__plot`, after it in DOM order.
- CSS: `src/components/param-lanes/ParamLane.css` — `.mr-param-lane__ms { position: sticky; right: 0; flex-shrink: 0; align-self: center; z-index: 1 }`.

**Recommendation**: Back-port to `prototype/components.jsx` and `prototype/app.css` — move `<MSChip>` out of `.mr-param-lane__hdr` and place it on the lane row with right-edge alignment. (Sticky positioning is a codebase-side detail tied to scroll architecture; the prototype's design canvas doesn't need sticky because it doesn't scroll.)

**Status**: deviation — design owner direction; awaiting back-port.

---

## Summary table

| # | Deviation | Recommendation | Status |
|---|---|---|---|
| 1 | `--mr-note-sel` warm orange-red | back-port | deviation |
| 2 | Marquee corner markers removed | back-port | confirmed |
| 3 | Marquee animation → SVG | back-port | deviation, fixes bug |
| 4 | Ruler keys-column offset in JSX | document | improvement |
| 5 | Fixed-zoom rendering | confirm | confirmed |
| 6 | Ruler `5.1` label removed | back-port | deviation, small fix |
| 7 | AppShell `minmax(0, 1fr)` + `overflow: hidden` | back-port | improvement |
| 8 | CC-lane solo scope is lane-only | superseded | superseded by #10 |
| 9 | M/S chips on right edge of CC lane | back-port | deviation |
| 10 | Channel-grouped timeline (Channel → Roll + CCs) | back-port pending | deviation |
