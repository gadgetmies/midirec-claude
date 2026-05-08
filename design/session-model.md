# Session model — new conceptual addition

This is a conceptual extension of the design that does not yet exist in `design_handoff_midi_recorder/`. Drop into the design project's import flow so the design owner can review and produce visual specs (Markers sidebar, Loop region overlay, view-window scrolling/zooming) for Slice 6 and the future scroll/zoom slice.

The formal contract is at `openspec/changes/session-model/` — read [`openspec/changes/session-model/proposal.md`](../openspec/changes/session-model/proposal.md) for the executive summary, [`design.md`](../openspec/changes/session-model/design.md) for the technical decisions (D1–D6), and the per-capability specs in [`specs/`](../openspec/changes/session-model/specs/) for the requirements + scenarios.

This document paraphrases for design audiences.

## Three statements that pin the model

1. **Sessions are unbounded in time.** A session is a flat list of notes carrying `t` (start, in beats from session origin) and `dur` (duration, in beats). There is no `sessionLength` field, no per-session cap, no fixed bar count. Notes can have arbitrarily large `t`. The design source's titlebar example shows `Bar 13.2.1` — that's session beat ~50, well beyond the 4-bar mock the prototype renders.

2. **The renderer shows a window into the session, not the whole session.** The piano roll and ruler render only the time range `[viewT0, viewT0 + totalT]` — `viewT0` is the window's left edge in beats; `totalT` is the window length in beats. The session itself is logically infinite; the renderer is bounded by the window. Today (Slice 2) `viewT0 = 0` and `totalT = 16`, so the visible window is the first 4 bars of the session. The future scroll/zoom slice mutates `viewT0` to navigate, and may also adjust `totalT` for zoom.

3. **Looping is a region, not a wraparound.** When the user wants to repeat a passage, they set a **loop region** = `{ start, end }` in session beats. The Loop button in the titlebar (already present from Slice 1) gates whether the region is currently active. With looping ON and a region defined, playback wraps from `loopRegion.end` to `loopRegion.start` on every pass. With looping OFF or no region defined, the playhead advances forever — there is **no** implicit wrap at the end of the visible window.

## Implications for the design source

### Markers sidebar (Slice 6 in `IMPLEMENTATION_PLAN.md`)

The Browser Sidebar's `Markers` section is where users inspect, name, jump-to, and edit time markers. The design source describes named markers in passing; the session-model adds **loop start** and **loop end** as a special pair of markers. UI questions for the design owner:

- Are loop-start and loop-end shown as ordinary marker rows in the sidebar (with a special visual flag), or as a dedicated "Loop region" section above the named markers? Or both — the region shown as a paired entry, and the individual endpoints listed in the named-markers list?
- Do users create the loop region by Shift-dragging in the ruler, by dropping two markers and pairing them, or by some other gesture? (Design owner's call. The data model supports any of these.)

### Export dialog `Loop region` range option

The design source's Export dialog has a `Range` radio with `Whole session · Selection · Loop region` options. With the session-model, `Loop region` resolves to the bounded range `[loopRegion.start, loopRegion.end]`, exporting only what's inside. `Whole session` exports `[0, max(n.t + n.dur))` — computed on demand, no stored session-length value.

### Visible-window indicator

When the view window covers only part of a longer session, the user needs to know they're seeing a slice, not the whole thing. Possible cues for the design owner to spec:

- A horizontal scrubber/scroll bar below the CC lanes showing `viewT0`'s position in the session.
- Edge fade or "more →" affordance on the lane area when content extends off-window.
- A session-overview minimap (similar to the per-track collapsed minimap from Slice 3).

### Loop-region overlay

When the loop region is set and at least partially within the view window, the lane area renders two vertical loop markers (start and end) plus a translucent tint between them. See [`loop-markers.md`](./loop-markers.md) for the visual contract.

## What's already locked in (no design action needed)

- Time units: session-time is always in beats, transport-clock time is in milliseconds. Conversion happens once, in the transport hook. Design source can reason in beats throughout.
- Loop wrap is in beats, not ms — survives future tempo automation correctly.
- Loop region is `{start, end}`, single region only (no nested or stacked loops). If the design owner wants multi-region looping, that's a separate future capability.
- `viewT0` defaults to `0` until the scroll/zoom slice; design source can keep showing a 0-anchored window in mockups and screenshots for now.

## Status

**Confirmed by design owner:**
- Loop-marker glyph: brackets (`[` start, `]` end) — see [`loop-markers.md`](./loop-markers.md).
- Loop-marker color: dedicated `--mr-loop` token (canonical value to come from design source's next outbound bundle).

**Still open — needs design owner spec:**
- Markers sidebar layout for loop endpoints vs named markers (Slice 6 component).
- Visible-window indicator (scrubber, minimap, edge fade — pick one or compose).
- Loop-region creation gesture (drag-in-ruler vs marker-drop-and-pair).

Code-side work is deferred to the consumer slices; nothing in this document is implemented yet.
