## Why

The Slice-2 deferred concern was scroll/zoom navigation: the PianoRoll and Ruler render at a fixed pixel zoom and may be wider than the viewport, but the surrounding shell currently clips the overflow with `overflow: hidden` and provides no way for the user to navigate the off-screen content. Slice 4 then added CC lanes whose plots also extend across the full timeline width.

Today, every timeline-bearing component (Ruler, each track's PianoRoll, each CC lane's plot) computes its own intrinsic width independently and clips it independently. There is no shared horizontal viewport: if the user could scroll one track right, the Ruler and the CC lanes wouldn't follow, breaking time alignment.

This change introduces the architecture for synchronized horizontal scrolling **without JavaScript**: the Ruler, all `.mr-track__roll` elements, and all `.mr-cc-lane__plot` elements are placed inside a single `overflow-x: auto` container, so one shared horizontal scrollbar moves every timeline together. Off-axis labels and controls — track headers' chevron/name/sub block, track headers' M/S chips, the piano-roll keys column, CC lane headers, CC lane M/S chips — stay pinned via `position: sticky` on `left: 0` or `right: 0`, mirroring the "frozen pane" pattern used in spreadsheet UIs.

This is a foundational change Slice 5+ will lean on: future scroll/zoom controls, marquee selection that crosses the visible boundary, and the per-track horizontal scroll bar in the prototype's design canvas all depend on a single shared scroll axis.

Acceptance: when the timeline is wider than the visible center column, the user SHALL see one horizontal scrollbar at the bottom of the timeline area. Dragging it scrolls the Ruler ticks, every PianoRoll's lane area, and every CC lane's plot in lockstep. Track names, M/S chips, keys columns, and CC lane labels stay visible at all scroll offsets. No JS scroll handlers are wired.

## What Changes

- **New `.mr-timeline` scroll container** owned by the `app-shell` capability. It replaces the third (`1fr`) and fourth (`auto`) rows of the current `.mr-center` grid: instead of separate `.mr-stage` and `.mr-cc-lanes` rows, a single `.mr-timeline` row owns both vertically (still as siblings of the Ruler).
- **Modified `app-shell` capability**:
  - The "Stage region fills remaining vertical space" requirement REWORDS to "Timeline region fills remaining vertical space and scrolls horizontally". The Stage and CC Lanes block become CHILDREN of the timeline, not sibling grid rows.
  - `.mr-timeline` SHALL have `overflow-x: auto; overflow-y: auto`, providing one shared horizontal (and vertical) scrollbar across Ruler + Stage + CC lanes.
  - The Ruler renders inside `.mr-timeline` at sticky-top (`position: sticky; top: 0`) so it stays visible during vertical scroll.
  - The CC Lanes block renders inside `.mr-timeline` at sticky-bottom (`position: sticky; bottom: 0`) so the three lanes stay visible at the bottom of the timeline area while the multi-track stack scrolls vertically. (Vertical-bottom-pinning matches the prototype's perceived layout.)
- **Modified `tracks` capability**:
  - Track header (`.mr-track__hdr`) layout SHALL split into three sticky-zoned sections: a sticky-left "label" zone (chevron · swatch · name · sub) pinned at `left: 0`, a stretchy middle spacer that takes the wide content width, and a sticky-right "controls" zone (M/S chips) pinned at `right: 0`. The header itself spans the full intrinsic timeline width.
  - The `.mr-multi-track-stage` SHALL no longer set `overflow: hidden` on `.mr-track__roll`; the track roll's content extends to the timeline's intrinsic width and is clipped by the outer `.mr-timeline` scroller.
  - Mute/solo `[data-soloing]` composition is unchanged: still scoped to `.mr-multi-track-stage`.
- **Modified `piano-roll` capability**:
  - The `.mr-keys` keys column SHALL render with `position: sticky; left: 0; z-index: 2` so it stays visible at any horizontal scroll offset of `.mr-timeline`. The 56px column overlays the lanes content beneath when sticky.
  - The `.mr-roll` no longer needs `overflow: hidden` on its inner `.mr-roll__lanes` — the outer `.mr-timeline` clips. The internal flex layout (keys + lanes) is preserved, with `.mr-keys` sticky-left.
  - The Ruler's keys-column offset (`KEYS_COLUMN_WIDTH = 56` applied per-tick in JSX) is unchanged. The Ruler renders a 56px-wide sticky-left "keys spacer" element that visually masks the keys column area at all scroll offsets so ticks appear to start at the keys column's right edge.
- **Modified `cc-lanes` capability**:
  - The `.mr-cc-lane` row SHALL split into three sticky-zoned sections: `.mr-cc-lane__hdr` at `position: sticky; left: 0` (the existing 56px name/CC strip), `.mr-cc-lane__plot` flowing freely at intrinsic width, and `.mr-cc-lane__ms` at `position: sticky; right: 0` (already absolute-positioned per deviation #9, now sticky instead so it follows horizontal scroll).
  - The plot's hover scrubbing readout coordinate math is unchanged — `event.nativeEvent.offsetX` is relative to the plot element, which is unchanged from the user's perspective. No fix needed for hover under scroll.
- **Modified `ruler` capability**:
  - The Ruler renders inside `.mr-timeline` at the same intrinsic width as the underlying timelines. A sticky-left 56px keys-spacer element (`.mr-ruler__keys-spacer`) SHALL be rendered as the first child of `.mr-ruler`, positioned at `position: sticky; left: 0; z-index: 2; background: var(--mr-bg-panel)`, masking the area above the keys column at all scroll offsets so ticks visually begin at the keys column's right edge.
  - The `KEYS_COLUMN_WIDTH = 56` per-tick offset in the Ruler's JSX is unchanged.
- **No JavaScript scroll handlers**. Everything is CSS positioning + sticky.

The Slice 0 requirement that the **CC Lanes block** SHALL appear at the bottom of the center column is preserved by the sticky-bottom rule on `.mr-cc-lanes` inside `.mr-timeline`.

## Capabilities

### Modified Capabilities
- `app-shell`: Restructures `.mr-center`'s grid to `toolstrip / ruler / timeline` (three rows), where `.mr-timeline` is the new scroll container holding the multi-track stack and the CC lanes block. The Stage region's responsibility for "fills remaining vertical space" transfers to `.mr-timeline`. The Ruler moves out of `.mr-center`'s third row and INTO `.mr-timeline` as its sticky-top first child.
- `tracks`: Track header restructures into sticky-left label zone + stretchy middle + sticky-right M/S zone. `.mr-track__roll` no longer needs `overflow: hidden`.
- `piano-roll`: Keys column becomes `position: sticky; left: 0` so it's visible at any horizontal scroll offset.
- `cc-lanes`: Header `position: sticky; left: 0`, plot natural-width, M/S wrapper `position: sticky; right: 0`. The hover scrubbing readout math is unchanged.
- `ruler`: Ruler renders a sticky-left 56px keys-spacer element so ticks visually start at the keys column's right edge at any scroll offset. Ruler itself is sticky-top inside `.mr-timeline`.

### New Capabilities
None. No new capability is introduced; the change is a coordinated layout refactor across five existing capabilities.

## Impact

- **No new files**.
- **Modified files**:
  - `src/components/shell/AppShell.tsx` — replace the separate `.mr-stage` and `.mr-cc-lanes` regions with a single `.mr-timeline` wrapper that contains the Ruler, the MultiTrackStage, and the CCLanesBlock in document order.
  - `src/components/shell/AppShell.css` — restructure `.mr-center` grid (3 rows: toolstrip / 1fr scrollable timeline). Remove old `.mr-stage` / `.mr-cc-lanes` rules where they relate to layout (the `background` rule on `.mr-stage` may move onto `.mr-timeline` or be inlined per-block).
  - `src/components/tracks/Track.tsx` — split the header into label/spacer/M/S sections with explicit `mr-track__hdr-left` and `mr-track__hdr-right` wrappers so each can be sticky.
  - `src/components/tracks/Track.css` — add `position: sticky; left: 0` and `position: sticky; right: 0` rules on the new wrappers; drop `.mr-track__roll { overflow: hidden }`.
  - `src/components/tracks/MultiTrackStage.tsx` — no functional change beyond rendering inside the new timeline parent.
  - `src/components/piano-roll/PianoRoll.css` — `.mr-keys { position: sticky; left: 0; z-index: 2 }`. Drop `.mr-roll__lanes { overflow: hidden }` (clipping moves to the outer `.mr-timeline`).
  - `src/components/piano-roll/PianoRoll.tsx` — no functional change; the keys column gains sticky positioning via CSS only.
  - `src/components/ruler/Ruler.tsx` — render a sticky-left `.mr-ruler__keys-spacer` element as the first child of `.mr-ruler` so the keys area is masked at all scroll offsets.
  - `src/components/ruler/Ruler.css` — add `.mr-ruler__keys-spacer` rule (sticky-left, 56px wide, panel background, z-index above ticks).
  - `src/components/cc-lanes/CCLane.tsx` — no JSX change; the existing `.mr-cc-lane__hdr`, `.mr-cc-lane__plot`, `.mr-cc-lane__ms` siblings just gain sticky positioning via CSS.
  - `src/components/cc-lanes/CCLane.css` — switch `.mr-cc-lane__hdr` to `position: sticky; left: 0`, switch `.mr-cc-lane__ms` from `position: absolute` to `position: sticky; right: 0` (with a self-aligning wrapper so the chip stays in the row's vertical center).
- **No new runtime deps**.
- **Architectural lock-in**:
  - All timeline-bearing components must render inside `.mr-timeline` to participate in the shared scrollbar. Any future content that wants to scroll horizontally with the rest of the timeline (e.g., automation lanes, marker rows) must also live there.
  - `position: sticky` requires the element to have an offset in the scroll axis (left/right/top/bottom) and a non-static `position` ancestor. The whole layout assumes `.mr-timeline` is the only horizontally-scrolling ancestor.
  - z-index conventions matter: keys column (sticky-left) is `z-index: 2`; M/S chip wrappers (sticky-right) are `z-index: 1`; track header sticky-left/right wrappers are at the row's natural stacking; sticky-bottom CC lanes block is `z-index: 1` to layer above the track minimaps if any vertical overlap occurs.
- **Out of scope**:
  - Adding zoom controls (changing `pxPerBeat`) — this is the next logical slice but kept separate.
  - Snap-to-bar scroll alignment, scroll-into-view on selection — future slice.
  - Two-finger trackpad horizontal scroll on macOS works automatically with `overflow-x: auto`; no extra wiring.
  - Per-track or per-lane independent scrolling — explicitly disallowed; this change establishes one shared scroll axis.
  - Touch-screen pan gestures — handled by the browser's default touch-action on `overflow: auto`.
- **Visual deviations recorded** in `design/deviations-from-prototype.md`: deviation #9 (M/S chips sticky-right rather than absolute) gets updated; a new deviation entry is added if any sticky-pinning behavior diverges from the prototype's measure-based layout.
- **Browser support**: `position: sticky` is broadly supported (Chrome, Firefox, Safari, Edge) since 2017. No fallback needed.
- **Accessibility**: keyboard scrolling (arrow keys, Page Up/Down on the focused scroll container) works automatically with `overflow: auto`. A future slice may add explicit roving tabindex; out of scope here.
