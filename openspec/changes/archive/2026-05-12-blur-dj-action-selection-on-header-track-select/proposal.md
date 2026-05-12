## Why

Selecting a DJ action track by clicking its timeline header sets `selectedTimelineTrack` for Track input routing, but `djActionSelection` / `djEventSelection` could still reference a pad row or clip from an earlier gesture. That leaves Map Note, the Inspector DJ panel, and in-track highlights active as if the user were still editing a row—even though the last intentional gesture was track-level selection.

## What Changes

- When the user selects a DJ track via its timeline header, `djActionSelection` and `djEventSelection` SHALL clear atomically while `selectedTimelineTrack` remains `{ kind: 'dj', trackId }`.
- DJ header selection SHALL continue to use a dedicated stage helper (`selectDJTimelineTrack`) wired from `AppShell`; channel timeline headers SHALL keep using `setSelectedTimelineTrack` only.

## Capabilities

### New Capabilities

- _(none)_

### Modified Capabilities

- `dj-action-tracks`: Stage exposes `selectDJTimelineTrack` and defines clearing of DJ row/event selections when the DJ timeline header path runs.

## Impact

- `src/hooks/useStage.tsx` — `selectDJTimelineTrack`; clears `djActionSelection` + `djEventSelection`.
- `src/components/shell/AppShell.tsx` — DJ track header uses `selectDJTimelineTrack(track.id)`.
