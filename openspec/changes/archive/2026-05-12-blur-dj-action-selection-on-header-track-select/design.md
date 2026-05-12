## Context

DJ timelines combine `selectedTimelineTrack` (Track input sidebar for routing) with `djActionSelection` / `djEventSelection` (Map Note, Inspector, roll highlights). Header click previously only updated timeline selection; row-level selections could linger.

## Goals / Non-Goals

**Goals:**

- Header-led DJ timeline selection clears row + event mapping selections without clearing `selectedTimelineTrack`.
- Single stage API for that gesture so `AppShell` does not duplicate setter ordering.

**Non-Goals:**

- Changing outside-click clearing, `[data-mr-dj-selection-region]` semantics, or MIDI/recording behavior.

## Decisions

1. **`selectDJTimelineTrack(trackId)`** — Calls `setSelectedTimelineTrack({ kind: 'dj', trackId })`, then `setDJActionSelection(null)` and `setDJEventSelection(null)` in the same callback. Channel headers keep calling `setSelectedTimelineTrack` directly.

2. **Chevron** — Unchanged: collapse toggle stops propagation and does not select the timeline track.

## Risks / Trade-offs

- **[Risk]** User expected header click to keep Map Note open — **Mitigation:** Row/event click re-opens mapping as before.

## Migration Plan

None.

## Open Questions

None.
