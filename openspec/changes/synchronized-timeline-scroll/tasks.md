## 1. Restructure AppShell into a single timeline scroller

- [ ] 1.1 In `src/components/shell/AppShell.tsx`, replace the separate `.mr-stage` and `.mr-cc-lanes` mounts with a single `<div className="mr-timeline">` containing, in document order: `<Ruler ... />`, `<MultiTrackStage ... />`, `<CCLanesBlock ... />`. Drop the old `<div className="mr-stage">` wrapper.
- [ ] 1.2 In `src/components/shell/AppShell.css`, restructure `.mr-center`'s grid to two rows: `var(--mr-h-toolbar)` for `.mr-toolstrip` and `1fr` for `.mr-timeline`. Keep the existing `grid-template-columns: minmax(0, 1fr)`.
- [ ] 1.3 In the same CSS, add `.mr-timeline { overflow-x: auto; overflow-y: auto; min-width: 0; min-height: 0; background: var(--mr-bg-timeline) }`. Remove the old `.mr-stage` and standalone `.mr-cc-lanes` block-layout rules (the cc-lanes' `display: flex; flex-direction: column; background; border-top` rules MAY remain or move into `CCLane.css` since they describe the block, not the scroller).
- [ ] 1.4 Verify in the dev server that the toolstrip stays above the timeline area, the inspector and sidebar are unaffected, and a horizontal scrollbar appears when the timeline width exceeds the column width.

## 2. Make the Ruler sticky-top with a keys-column mask

- [ ] 2.1 In `src/components/ruler/Ruler.tsx`, render `<div className="mr-ruler__keys-spacer" />` as the FIRST child of `<div className="mr-ruler">`, before the existing `els` array.
- [ ] 2.2 In `src/components/ruler/Ruler.css`, add `.mr-ruler { position: sticky; top: 0; z-index: 3 }` and remove `overflow: hidden` from `.mr-ruler`.
- [ ] 2.3 Add `.mr-ruler__keys-spacer { position: sticky; left: 0; top: 0; width: 56px; height: 100%; background: var(--mr-bg-panel); z-index: 3 }` so the keys-area mask stays in place at any horizontal AND vertical scroll offset.
- [ ] 2.4 Verify visually: scroll horizontally — the keys-spacer covers any tick that drifts under the keys area. Scroll vertically — the Ruler stays at the top.

## 3. Pin the PianoRoll keys column

- [ ] 3.1 In `src/components/piano-roll/PianoRoll.css`, add `position: sticky; left: 0; z-index: 2` to `.mr-keys` (alongside the existing width: 56px and background rules).
- [ ] 3.2 Remove `overflow: hidden` from `.mr-roll` and `.mr-roll__lanes` (both of these were redundant under the new outer scroller). Add a brief comment block explaining the keys column's sticky-left dependency on having no `overflow: hidden` ancestor.
- [ ] 3.3 Verify visually: scroll horizontally — every track's keys column stays glued to the visible left edge.

## 4. Split the track header into sticky-left + spacer + sticky-right wrappers

- [ ] 4.1 In `src/components/tracks/Track.tsx`, restructure `<div className="mr-track__hdr">` to contain three children:
  - `<div className="mr-track__hdr-left">` containing the existing `.mr-track__chev`, `.mr-track__swatch`, `.mr-track__name`, `.mr-track__sub` in order.
  - `<div className="mr-track__hdr-spacer" />`.
  - `<div className="mr-track__hdr-right">` containing `<MSChip ... />`.
  Remove the old standalone `.mr-track__spacer`.
- [ ] 4.2 In `src/components/tracks/Track.css`, add `.mr-track__hdr-left { position: sticky; left: 0; z-index: 1; background: var(--mr-bg-panel-2); display: flex; align-items: center; gap: 8px; padding-right: 8px }` and the analogous `.mr-track__hdr-right { position: sticky; right: 0; z-index: 1; background: var(--mr-bg-panel-2); display: flex; align-items: center; padding-left: 8px }`.
- [ ] 4.3 Add `.mr-track__hdr-spacer { flex: 1; min-width: 0 }`. Drop the old `.mr-track__spacer` rule.
- [ ] 4.4 Update `.mr-track__hdr` itself: keep `display: flex; align-items: center; height: 22px; background: var(--mr-bg-panel-2); border-bottom; cursor; user-select`. Drop the `gap: 8px` and `padding: 0 10px 0 8px` (now owned by the sticky wrappers' internal padding).
- [ ] 4.5 Drop `overflow: hidden` from `.mr-track__roll` (was added in earlier slices to clip the wide PianoRoll; outer `.mr-timeline` now does the clipping).
- [ ] 4.6 Verify M/S click handlers still don't bubble to the header (`event.stopPropagation()` on chip clicks, already in place).

## 5. Switch CC lane M/S from absolute to sticky and make the row a flex container

- [ ] 5.1 In `src/components/cc-lanes/CCLane.tsx`, change `<div className="mr-cc-lane" ...>` to render its three children (`.mr-cc-lane__hdr`, `.mr-cc-lane__plot`, `.mr-cc-lane__ms`) as flex siblings (no JSX restructuring needed if the order is already correct — verify).
- [ ] 5.2 In `src/components/cc-lanes/CCLane.css`, change `.mr-cc-lane` to `display: flex; align-items: stretch` (it already has `display: flex` from the prior change — verify).
- [ ] 5.3 Change `.mr-cc-lane__hdr` to `position: sticky; left: 0; z-index: 2; flex-shrink: 0` (in addition to its existing 56px width and panel background).
- [ ] 5.4 Change `.mr-cc-lane__ms` from `position: absolute; top: 6px; right: 8px` to `position: sticky; right: 0; z-index: 1; flex-shrink: 0; align-self: center; padding-right: 8px`. The `top: 6px` offset is no longer needed because flex centering replaces absolute positioning.
- [ ] 5.5 Confirm `.mr-cc-lane__plot` keeps `flex: 1` and its existing background gradient + relative positioning.
- [ ] 5.6 Verify the hover scrubbing readout still appears at the correct cell. The `event.nativeEvent.offsetX` is relative to `.mr-cc-lane__plot`, which scrolls with the timeline — no math change needed.

## 6. Stick the CC lanes block to the bottom of the timeline

- [ ] 6.1 In `src/components/cc-lanes/CCLanesBlock.tsx`, no JSX change. The block element already has `className="mr-cc-lanes"`.
- [ ] 6.2 In a stylesheet (CCLane.css already imports for the block; alternatively add to AppShell.css), add `.mr-cc-lanes { position: sticky; bottom: 0; z-index: 1 }` along with the existing `display: flex; flex-direction: column; background: var(--mr-bg-panel); border-top: ...`.
- [ ] 6.3 Verify visually: with all three default tracks open, the multi-track stack renders above and CC lanes appear at the bottom. Resize the viewport down — the CC lanes stay pinned at the bottom and the multi-track stack scrolls under them.

## 7. Coordinate z-index across the sticky elements

- [ ] 7.1 Audit z-indexes in each affected stylesheet. Target hierarchy:
  - `.mr-ruler` and `.mr-ruler__keys-spacer`: `z-index: 3`
  - `.mr-keys` and `.mr-cc-lane__hdr`: `z-index: 2`
  - `.mr-cc-lanes` (block) and `.mr-track__hdr-left`, `.mr-track__hdr-right`, `.mr-cc-lane__ms`: `z-index: 1`
- [ ] 7.2 If any sticky element fails to mask its content (e.g., a tick visible through the keys-spacer), bump that element's z-index up by one or check for an `overflow: hidden` ancestor that's breaking sticky.

## 8. Pre-archive checks

- [ ] 8.1 `yarn typecheck` clean.
- [ ] 8.2 No `console.log`, debug code, or stray comments referencing the implementation process.
- [ ] 8.3 Visual smoke test in `yarn dev`:
  - Three tracks render: Lead (open) + Bass (open) + Pads (collapsed).
  - Three CC lanes render: Mod Wheel + Pitch Bend + Velocity (muted).
  - At wide viewports (no horizontal overflow), no scrollbar appears and layout looks like Slice 4.
  - At narrow viewports (forced overflow by resizing), a horizontal scrollbar appears at the bottom of the timeline area; dragging it scrolls the Ruler ticks, every track's lanes, and every CC lane's plot together.
  - Track header chevron + name + sub stay visible on the left at all scroll offsets; M/S chips stay clickable on the right.
  - Keys columns stay visible on the left.
  - CC lane name + CC label stay on the left; M/S chips on the right.
  - Hover scrubbing readout still shows the correct 0–127 value.
- [ ] 8.4 Capture any visual deviation from the prototype (e.g., scrollbar visibility, sticky-shadow nuances) as a row in `design/deviations-from-prototype.md`. Update deviation #9 (CC lane M/S right-aligned) to mention the absolute → sticky switch.
