## Context

Slice 2 introduced fixed-zoom rendering: PianoRoll's intrinsic width is `KEYS_COLUMN_WIDTH + totalT * pxPerBeat = 56 + 16 * 88 = 1464px` at default zoom. The Ruler is the same width. Each CC lane plot fills its `.mr-cc-lane__plot` element (which spans the same intrinsic timeline width minus the 56px header).

Until this change, every timeline-bearing component clipped its overflow individually (`.mr-stage`, `.mr-track__roll`, `.mr-roll__lanes` all `overflow: hidden`; CC lanes inherit clipping from their parent stack). This made the layout robust at any viewport width, but offered no way to navigate the off-screen content. Slice 4's deviation #5 explicitly deferred scroll/zoom to a later slice.

This change is that slice — the foundational scroll architecture before any zoom UI lands. It does NOT add zoom controls; the constants `DEFAULT_PX_PER_BEAT` and `DEFAULT_ROW_HEIGHT` are still constants.

The user's stated requirement: synchronized horizontal scroll across the Ruler, all `.mr-track__roll` elements, and all `.mr-cc-lane__plot` elements **without JavaScript**. The only CSS-only mechanism that synchronizes multiple scroll views is putting them in a single shared scroll container — there is no CSS-only "sync this scroller to that scroller" feature. Therefore the design is forced toward a single timeline scroll container that holds all timeline content, with sticky-pinned non-timeline UI (labels, controls).

## Goals / Non-Goals

**Goals:**

- One horizontal scrollbar moves the Ruler ticks, every PianoRoll's lane area, and every CC lane's plot in lockstep at any timeline width and any viewport width.
- Track header labels (chevron · swatch · name · sub) stay pinned at the visible left edge regardless of scroll offset.
- Track header M/S chips and CC lane M/S chips stay pinned at the visible right edge regardless of scroll offset.
- The piano-roll keys column (`.mr-keys`) stays pinned at the visible left edge regardless of horizontal scroll offset.
- The Ruler stays pinned at the top of the timeline area regardless of vertical scroll offset.
- The CC Lanes block stays pinned at the bottom of the timeline area regardless of vertical scroll offset.
- Zero JavaScript scroll handlers — all positioning is CSS.
- Existing mute/solo composition (`[data-soloing]`, `[data-muted]`, `[data-soloed]`) keeps working without selector adjustments where possible; if changes are unavoidable they are minimal.

**Non-Goals:**

- Variable zoom (`pxPerBeat` is still a constant).
- Programmatic scrolling (e.g., scroll-to-playhead) — out of scope; would require JS.
- Horizontal scrollbar styling beyond the browser default — also out of scope.
- Per-track independent horizontal scroll — explicitly forbidden by the goal of a shared axis.
- Vertical scroll virtualization for many tracks — out of scope; native overflow handles it.
- Touch-pan customization or wheel-event handling.
- Sticky support polyfill for IE / pre-2017 browsers (not a target).

## Decisions

### 1. Single `.mr-timeline` scroll container, not three synchronized scrollers

Three separate scrollers (one per row) with `scroll-snap`, `scroll-timeline`, or `scroll()` linked-animations could in principle synchronize via CSS, but browser support for `scroll()` and `view()` timeline functions is too new (2024+) for production reliance, and `scroll-snap` is for snap-points, not for syncing. The single-scroller approach is universally supported and zero-risk.

**Alternative considered:** three scrollers with JS scroll handlers (`onScroll` setting siblings' `scrollLeft`). Rejected — user explicitly disallowed JS, and JS-synchronized scrolling produces visible lag at high scroll velocity.

**Alternative considered:** CSS `scroll-driven animations` with `animation-timeline: scroll(self inline)`. Rejected — too new (Chrome 115+, Firefox 132+, Safari 26 not yet shipped at the date this change lands), reliable cross-browser only with a fallback.

### 2. Sticky positioning, not separate fixed-pane layouts

Each row's labels and controls use `position: sticky; left: 0` (or `right: 0`) inside the scroll container. The alternative — a three-column grid with [pinned-left | scrollable-middle | pinned-right] — would require splitting every row into three pieces and synchronizing their heights, which complicates the layout for marginal benefit.

Sticky has known browser quirks (e.g., sticky elements don't escape their direct parent), so each sticky element must be a direct child of an element that spans the full scroll width. The chosen layout puts each "row" (track header, track roll, CC lane row) as a flex container that spans the timeline's intrinsic width, with sticky-left and sticky-right wrappers as flex items.

**Alternative considered:** CSS Grid with `grid-template-columns: var(--mr-w-keys) auto var(--mr-w-ms-strip)` per row. Rejected — auto-sized middle column complicates intrinsic-width plotting; sticky is simpler.

### 3. The Ruler renders inside `.mr-timeline`, not as a sibling

If the Ruler stayed as a sibling of `.mr-timeline` (a separate `.mr-center` row), it would not participate in the shared scroll axis. The Ruler must be inside the same `overflow-x` ancestor as the timelines.

To keep the Ruler visible during vertical scroll, it carries `position: sticky; top: 0; z-index: 3`. This puts it above the multi-track stack and above the keys column's sticky-left z-index of 2 — important because at the top-left corner the Ruler's keys-spacer must mask the keys column underneath.

### 4. Sticky-bottom CC Lanes block, not absolute-bottom

The prototype shows CC lanes as a fixed-height bottom region. With one shared scroll container, that requires `position: sticky; bottom: 0` on the `.mr-cc-lanes` block. The block's height is `3 * var(--mr-h-cc-lane)`, leaving the multi-track stack to occupy the remaining vertical space.

If the multi-track stack content is shorter than the available vertical space, no vertical scrolling happens — the CC lanes appear at the bottom naturally. If the content is taller, sticky-bottom keeps the CC lanes visible while the user scrolls vertically through tracks. This matches the prototype's perceived behavior.

**Alternative considered:** keep CC lanes as a separate row outside `.mr-timeline` and synchronize horizontal scroll via JS or via separate horizontal scroller. Rejected — defeats the point of CSS-only synchronization.

### 5. Keys column sticky inside the track roll, not promoted to a per-stage left rail

The simplest split would be to factor the keys column out of every track and render ONE keys column on the left rail of `.mr-multi-track-stage`. But the keys column is per-track-row in the existing PianoRoll's flex layout, and it's vertically aligned with that track's lanes. Promoting it would require sharing the row-height/lo/hi state across tracks, complicating the renderer for no scroll-architecture gain.

Decision: each track's `.mr-keys` becomes `position: sticky; left: 0; z-index: 2` within the track row's flex container. As the user scrolls right, every keys column stays pinned to the visible left edge. Visually identical to a per-stage left rail.

### 6. Track header structure: explicit `__hdr-left` and `__hdr-right` wrappers

The existing track header is a flat flex row: `chev · swatch · name · sub · spacer · MSChip`. To make labels sticky-left and chips sticky-right, we wrap them:

```
.mr-track__hdr (flex, full intrinsic width)
├─ .mr-track__hdr-left (sticky-left, contains chev + swatch + name + sub)
├─ .mr-track__hdr-spacer (flex: 1, no sticky)
└─ .mr-track__hdr-right (sticky-right, contains MSChip)
```

Both sticky wrappers carry the panel-2 background to mask the timeline content underneath them at scroll offsets. The middle spacer is transparent and reveals the timeline-row's underlying background (`var(--mr-bg-panel-2)` from the header's own bg).

### 7. CC lane M/S goes from `position: absolute` to `position: sticky; right: 0`

Deviation #9 (M/S chips on right edge of CC lane) currently uses `position: absolute; top: 6px; right: 8px` inside `.mr-cc-lane`. Under the new scroll container, absolute positioning sticks to the lane's natural-width right edge (which is at `viewT0 + totalT * pxPerBeat`, off-screen left of the visible area at high scroll offsets) — wrong direction.

The fix: switch `.mr-cc-lane__ms` to `position: sticky; right: 8px; align-self: center` (or use a flex-self trick to vertically center). The chip wrapper becomes a sibling flex item of `.mr-cc-lane__hdr` and `.mr-cc-lane__plot`; the row is a flex container.

The hover scrubbing readout's `event.nativeEvent.offsetX` is computed relative to `.mr-cc-lane__plot`, which moves under the sticky chips but doesn't change its own coordinate origin. The readout math is unchanged.

### 8. Drop per-component `overflow: hidden` rules

Currently `.mr-stage`, `.mr-track__roll`, `.mr-roll__lanes`, `.mr-ruler` all have `overflow: hidden` to clip their wide content individually. With the outer `.mr-timeline` scroller doing the clipping, these rules are redundant and would prevent sticky elements from escaping (a sticky child can't escape an `overflow: hidden` ancestor unless that ancestor is itself the scroller). Drop them.

The exception is `.mr-track__roll`'s overflow being needed to clip the Slice-2 marquee SVG when it extends past the lane bounds — but the SVG is clipped by the playhead's z-index and the lanes' own bounds. Verify during apply; if marquee bleeds past, restore `overflow: hidden` on `.mr-track__roll` ONLY (sticky descendants stay within `.mr-track__roll`'s sibling-row, not within the roll itself).

### 9. The Ruler's keys-spacer is rendered, not styled-via-pseudo-element

A `::before` pseudo-element on `.mr-ruler` could be sized 56px and sticky-left to mask the keys area. But pseudo-elements participate awkwardly in flex layouts and z-index stacking. A real `<div>` is unambiguous and matches the architecture of the keys column being a real child of `.mr-roll`.

### 10. z-index hierarchy

Inside `.mr-timeline`:

- Ruler keys-spacer: `z-index: 3` (top of stack — masks both ticks beneath and any track keys-column that scrolls under)
- Ruler itself (sticky-top): `z-index: 3`
- Keys column on each track row: `z-index: 2`
- CC lane sticky-left header: `z-index: 2`
- CC lanes block (sticky-bottom): `z-index: 1`
- Track header sticky-left/right wrappers: `z-index: 1`
- Plot/note/marquee content: `z-index: auto` (default)

This avoids the Ruler being scrolled under by the keys column, the keys column being scrolled under by note rectangles, and the CC lanes block being layered under by the track-roll content during vertical scroll.

## Risks / Trade-offs

- **Risk:** sticky elements can fail to stick when a parent has `overflow: hidden` or `transform: translate`. The new layout deliberately drops `overflow: hidden` on intermediate ancestors, but any future CSS rule that re-adds either property at an intermediate level breaks sticky.
  → **Mitigation:** add a comment near each new sticky rule explaining the constraint. Tests in a future slice can assert by checking computed `position` of `.mr-keys` after a programmatic scroll.

- **Risk:** the Ruler's sticky-top + the keys column's sticky-left create a "frozen corner" where the keys-spacer must visually beat both. With z-index 3, the keys-spacer wins. But if the Ruler's background is transparent and the keys column shows through during vertical scroll, the corner looks broken.
  → **Mitigation:** the Ruler element carries `background: var(--mr-bg-panel)` (already does); the keys-spacer carries the same. No transparency in the frozen corner.

- **Risk:** marquee selection on a track may render outside the visible area when its bounds extend past the visible scroll window. The marquee's SVG element is positioned absolutely within the lane area — it's clipped by the outer `.mr-timeline`'s `overflow: auto`, which should hide off-screen portions correctly, but the marquee's `pointer-events: none` ensures it doesn't intercept scroll gestures.
  → **Mitigation:** verify visually during apply. Marquee is decorative; if any clipping issue arises, it doesn't break functionality.

- **Risk:** vertical scroll inside `.mr-timeline` interferes with mouse-wheel scrolling for hover-readout-active CC lanes. While hovering a CC lane, the wheel might scroll vertically when the user expects the readout to follow.
  → **Mitigation:** mouse-wheel behavior over `overflow: auto` is browser-standard; the readout updates on `mousemove`, which fires after the scroll lands. The user's mental model of "wheel scrolls the page" is preserved.

- **Trade-off:** drag-to-reorder of tracks (a future feature) will be more complex inside a sticky-row layout. The flat-flex track header may need to be split for drag handles.
  → **Mitigation:** acknowledge as a known constraint; revisit when reorder is implemented.

- **Trade-off:** the prototype's design canvas may not render its tracks/lanes inside an overflow scroller — the prototype is a fixed-zoom mock at the design-canvas size. Visual parity at the snapshot resolutions is preserved (no scrollbar visible until the timeline overflows the column), but a side-by-side comparison will show the codebase's scrollbar appearing at narrower viewports.
  → **Mitigation:** record the deviation in `design/deviations-from-prototype.md`; this is the deferred Slice-2 deviation #5 partially closed (scroll architecture in place; zoom controls still deferred).

- **Trade-off:** some browsers render the native horizontal scrollbar with significant vertical thickness, which may shift the visible CC-lane sticky-bottom up by 8–14px depending on platform.
  → **Mitigation:** acceptable; the user's macOS likely renders zero-thickness floating scrollbars. If this becomes a problem, future styling can use `scrollbar-gutter: stable` to reserve space consistently.
