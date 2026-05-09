# Backlog

Small, scoped tasks that aren't tied to an in-flight slice or OpenSpec change. Each entry should be concrete enough to start without further discovery; if a task needs design alignment or a spec, escalate it to an OpenSpec proposal in `openspec/changes/` instead.

## Open

### Remove the `N SELECTED` count badge from the marquee

**Why**: After Slice 2 review the badge was deemed redundant — the dashed marquee rectangle plus the orange-red highlight on selected notes already communicate "these are selected", and the count will be available in the Inspector's multi-select panel from Slice 5 onwards. Today the badge sits to the upper-right of the marquee rectangle, occupies a chunk of lane space, and is the only thing in the renderer that requires a JS-side count.

**Scope**:

- `src/components/piano-roll/PianoRoll.tsx` — remove the `marqueeBadge` JSX block; the SVG marquee + selection-coloring on notes are kept.
- `src/components/piano-roll/PianoRoll.css` — remove the `.mr-marquee__badge`, `.mr-marquee__count`, and `.mr-marquee__lbl` rules.
- `openspec/specs/piano-roll/spec.md` — drop the badge requirements/scenarios from the *Marquee renders dashed rect with badge* requirement (rename it to *Marquee renders dashed rect* or similar). The marquee rectangle itself stays.
- `design/deviations-from-prototype.md` — add a new entry (or extend the existing marquee entry #2/#3) recording the badge removal as another back-port-recommended deviation from the prototype, with rationale "selection count is shown in the Inspector multi-select panel from Slice 5 onwards".
- `design/README.md` — the deviations table at the bottom gets a new row.

**Verification**:

- `?demo=marquee` URL renders the dashed marquee with selected notes in `--mr-note-sel`, but no badge element. The 7 selected notes are still visibly distinct via color.
- `yarn typecheck` clean.
- `grep -r 'mr-marquee__badge\|mr-marquee__count\|mr-marquee__lbl' src/` returns zero matches.

**Estimated effort**: 30 minutes — one focused edit pass + spec update + design-doc note.

**Status**: pending. Not blocking any other slice.

### M/S chip jumps 1px to the left at the end of horizontal scroll

**Why**: With the `channel-grouped-timeline` change, every level (channel header, track header, CC lane header) carries a sticky-right `__hdr-right` zone holding an `<MSChip>`. At horizontal `scrollLeft === scrollWidth - clientWidth` (the rightmost scroll position), the chip transitions from "pinned to viewport-right" to "natural position at parent's right edge" and visibly jumps 1px to the left. Reproduces in Chromium. Tracing the layout (the rightmost cap rect ends at ~1398.25px inside a 1408px plot; `hdr-right`'s natural right edge equals `inner.right` at scroll-max) suggests a sub-pixel rounding artifact at the sticky boundary rather than a layout error. Design owner confirms it's a minor visual nit, not a blocker.

**Scope**:

- Investigate whether the artifact is the sticky-right boundary or a flex layout-box edge case. Likely candidates: flex subpixel rounding inside `.mr-channel__hdr` / `.mr-track__hdr` / `.mr-cc-lane__hdr` (the spacer's computed width changes by < 1px as the sticky chip pulls/releases), or `.mr-cc-lane__keys-spacer`'s `border-right` rendering differently than the equivalent border on `.mr-keys` (both are `box-sizing: border-box; width: 56px` so total width is 56px, but pixel snapping at the right edge may differ).
- Try mitigations in order of cheap-to-expensive:
  1. Add `transform: translateZ(0)` or `will-change: transform` on `__hdr-right` zones to force a stable rasterization layer.
  2. Verify nothing else uses fractional pixel values (e.g. the SVG cap's `x - 0.5`, `y - 0.5`).
  3. Replace `position: sticky; right: 0` with a JS-driven `transform: translateX(...)` that always uses integer pixels (more invasive).
- If none of the cheap mitigations work, document as a known platform issue.

**Verification**:

- Scroll the timeline horizontally to its rightmost position; the chip's left edge SHALL stay within ±0px of its position at scroll-1px.
- Cross-browser check: Chromium (latest), Safari (latest), Firefox (latest).

**Estimated effort**: 1–2 hours to investigate, plus 30 min if the cheap mitigation works. Could expand to a half-day if it's a deep CSS rounding issue.

**Status**: pending. Surfaced during `channel-grouped-timeline` review; deferred per design owner.

## Done

<!-- Move completed entries here with a date and the commit hash that resolved them. -->
