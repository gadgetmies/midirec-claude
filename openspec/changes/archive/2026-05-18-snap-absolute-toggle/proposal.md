## Why

The in-flight `timeline-drag-move-items` change defaults the drag-to-move gesture to **delta-snap** so that live-recorded or intentionally off-grid items keep their offset when nudged. That default is right for the common nudge case, but it leaves no drag-based path to re-align an off-grid item to the grid — users have to fall back to the Inspector Start editor. A transport-wide opt-in toggle gives users a discoverable, mode-clear way to perform "snap to grid" alignment via drag, without polluting the default gesture.

## What Changes

- Add a `snapAbsoluteOn: boolean` flag to the transport (default `false`), plus a `toggleSnapAbsolute()` action, mirroring `quantizeOn` / `toggleQuantize`.
- Surface `snapAbsoluteOn` from `useTransport()` and thread it as a prop into `PianoRoll` and `ActionRoll` alongside `quantizeOn` / `quantizeGrid`.
- `PianoRoll` and `ActionRoll` drag-to-move math: when `snapAbsoluteOn === true` and `quantizeOn === true`, snap the absolute final tick (`finalTick = max(0, round((tick0 + deltaTicksRaw) / snap) * snap)`); otherwise keep the delta-snap default from `timeline-drag-move-items`. When `quantizeOn === false`, `snapAbsoluteOn` has no effect.
- For DJ CC groups, absolute mode aligns the **earliest member** to the grid and shifts all members by that same delta — group spacing is still preserved; only the earliest member lands on-grid.
- Titlebar: add an `A` chip next to the existing `Q` chip with matching style + click-to-toggle interaction. The chip reads as active when `snapAbsoluteOn === true`, and renders disabled (greyed) when `quantizeOn === false` since the flag is inert in that state.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `transport-titlebar`: add the `snapAbsoluteOn` field to `useTransport()` state, the `toggleSnapAbsolute()` action, and the `A` chip in the titlebar transport bar with the disabled-when-quantize-off rule.
- `piano-roll`: drag-to-move gesture SHALL honor `snapAbsoluteOn` when `quantizeOn === true`, switching the snap math from delta-snap to absolute-snap.
- `dj-action-tracks`: drag-to-move gesture for single events and CC groups SHALL honor `snapAbsoluteOn` when `quantizeOn === true`, using earliest-member alignment for CC groups so internal spacing is preserved.

## Impact

- **Code**:
  - `src/hooks/useTransport.tsx` — new `snapAbsoluteOn` state field, `toggleSnapAbsolute` action + reducer case, exposed on `TransportValue`.
  - `src/components/piano-roll/PianoRoll.tsx` — accept `snapAbsoluteOn?: boolean`; branch the snap math inside `computeFinalTick`.
  - `src/components/dj-action-tracks/ActionRoll.tsx` — accept `snapAbsoluteOn?: boolean`; branch in `snapDelta`/the CC-group handler so absolute mode snaps the earliest member's final tick.
  - `src/components/tracks/Track.tsx`, `src/components/channels/ChannelGroup.tsx`, `src/components/dj-action-tracks/DJActionTrack.tsx` — pass-through prop plumbing.
  - `src/components/shell/AppShell.tsx` — read `transport.snapAbsoluteOn` and pass to `ChannelGroup` and `DJActionTrack`.
  - `src/components/titlebar/Titlebar.tsx` — render the new `A` chip next to the `Q` chip; bind to `toggleSnapAbsolute` and `snapAbsoluteOn` with disabled state when `quantizeOn === false`.
  - Styles: reuse the `Q` chip's classes/tokens or extend with a sibling `A` variant.
- **Specs**: modify `openspec/specs/transport-titlebar/spec.md`, `openspec/specs/piano-roll/spec.md`, `openspec/specs/dj-action-tracks/spec.md`.
- **Tests**: extend `PianoRoll.test.tsx` and `ActionRoll.test.tsx` with absolute-mode scenarios (single-event align, off-grid-item realignment, CC-group earliest-member align). Add a titlebar render/toggle test if a `Titlebar.test.tsx` exists.
- **Pre-conditions**: assumes `timeline-drag-move-items` is the baseline. `quantizeGridToTicks` (in `src/midi/quantizeGrid.ts`) and the `quantizeOn`/`quantizeGrid` prop plumbing are already in place and SHALL be reused without modification.
- **No** data migration, persistence, or MIDI-runtime changes. No keyboard or modifier-key behavior.
