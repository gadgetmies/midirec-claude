# Loop markers — new component

A new visual element that does not exist in `design_handoff_midi_recorder/prototype/`. Introduced by the [session-model concept](./session-model.md). Consumed by the lane area (PianoRoll) and the Ruler row.

The formal contract is in `openspec/changes/session-model/specs/piano-roll/spec.md` (the *PianoRoll renders loop markers* requirement) and `openspec/specs/session-model/spec.md` (the *Loop markers render at session-time positions inside the view window* requirement, after archive).

## What it is

A way to visually indicate the **loop region** — the bounded range `[loopRegion.start, loopRegion.end]` (in beats) within which playback wraps when looping is active. Three sub-elements:

1. **Loop start marker** — a vertical line at `loopRegion.start`, full lane height. Distinguishable from the loop end via a glyph cap.
2. **Loop end marker** — a vertical line at `loopRegion.end`, full lane height. Distinguishable from the loop start.
3. **Loop region tint** — a translucent fill spanning `[loopRegion.start, loopRegion.end]` across the lane area's full height. Communicates the *region* in addition to the two endpoint lines.

## Visual contract

| Property | Value | Notes |
|---|---|---|
| Marker line color | `var(--mr-loop)` | New dedicated token, separate from `--mr-cue`. Initial value provided by the design source on its next outbound bundle; until then the codebase will use `--mr-cue` as a placeholder. |
| Marker line width | `1px` | Matches playhead. |
| Marker height | Full lane area (and full Ruler row, where applicable) | Spans the entire visible vertical extent. |
| Tint color | `color-mix(in oklab, var(--mr-loop) 6%, transparent)` | Faint enough to not compete with notes; visible enough to read as a continuous region across the lane area. |
| Tint extent | `loopRegion.start` to `loopRegion.end`, clamped to view window | If start is before window, tint extends from window's left edge. If end is after window, tint extends to window's right edge. |
| Marker glyph cap | Brackets — `[` for the start endpoint, `]` for the end endpoint | Renders as a square-bracket glyph attached to the top/bottom of the marker line. Drawn in `var(--mr-loop)` matching the line. |

All visual specs are firm. Brackets at the endpoints make the start vs end distinction immediately readable and echo conventional DAW notation for loop regions.

## Where they appear

**On the lane area** (`.mr-roll__lanes` in PianoRoll):
- Both endpoints' vertical lines.
- Both endpoints' glyph caps.
- The tint, between the endpoints (or extending past view-window edges, clamped).

**On the Ruler row** (`.mr-ruler`):
- Both endpoints' vertical lines (or just glyphs, if a full vertical line on the Ruler row is too noisy).
- The tint may or may not extend onto the Ruler row — design owner's call.

The Ruler-row markers exist primarily so the user has something to click for marker-related interactions (jump to marker, edit endpoints, clear loop). Click behavior itself is deferred to Slice 6.

## When they appear

When `loopRegion !== null` AND at least one endpoint falls within `[viewT0, viewT0 + totalT]`. Specifically:

| Condition | Visible elements |
|---|---|
| Both endpoints inside the window | Both markers, full tint between them |
| Only start inside the window | Start marker; tint extends from start to right edge |
| Only end inside the window | End marker; tint extends from left edge to end |
| Both endpoints outside the window, region spans the window | No markers; full-width tint across the visible window |
| Region entirely outside the window | Nothing rendered |

The renderer's `overflow: hidden` handles the clipping — the marker DOM is positioned at the natural session-time coordinates, and off-window portions are clipped naturally. No JS clamping logic is required for the line elements; the tint *does* compute its width with explicit clamping so it doesn't draw past the lane area.

## Interaction (deferred to Slice 6)

Out of scope for this component spec, but listed so the design owner has the consumer slice in mind:

- **Create**: drag from ruler to define a region; or drop a start marker, then a paired end marker.
- **Drag**: grab a marker line and drag along the timeline to adjust either endpoint.
- **Clear**: a "Clear loop" affordance somewhere (titlebar overflow menu, sidebar markers section, right-click on a marker).

Until Slice 6, the loop region can be set programmatically (via the transport hook's `setLoopRegion()` action) for testing.

## Status

**Specced — open items for the design source's next bundle:**
- Provide the canonical value for `--mr-loop` in `tokens.css` (codebase will use `var(--mr-cue)` as a placeholder until the token lands).
- Confirm whether the Ruler row gets full vertical bracket lines or just the bracket glyph (defaults to full lines for parity with the lane area unless the design source says otherwise).
- Confirm whether the region tint extends onto the Ruler row (defaults to no — Ruler stays clean).
