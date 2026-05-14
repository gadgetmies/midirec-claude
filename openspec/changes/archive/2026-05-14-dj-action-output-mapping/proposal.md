## Why

DJ action playback already honors per-row `outputMap` (channel, output pitch, optional CC) in the scheduler, and the Inspector exposes a per-action **Output** form when a single action row is selected. There is no consolidated place to review or edit **all** actions on a DJ timeline track at once, and outbound MIDI today uses a single global output port (the first enumerated Web MIDI device) rather than a per-track or per-action hardware destination. Users selecting a DJ track in the timeline need a right-side mapping surface that matches mental model: pick the physical output, then channel and note vs. CC per action, with defaults that do not require configuring every row from scratch.

## What Changes

- Show an **output mapping panel** in the right inspector region when the **timeline selection** is a DJ action track (`selectedTimelineTrack.kind === 'dj'`), listing every configured action row on that track in a stable order (e.g. ascending action pitch).
- For each row, expose controls for: **MIDI output port** (Web MIDI output id), **MIDI channel**, and **output pitch / note number** or **CC number** according to whether the row’s effective playback mode is note-out or CC-out (same resolution rules as today: explicit `outputMap[pitch].cc`, else mixer template defaults via `defaultMixerOutputCc`, with pressure-bearing rows staying note+AT).
- **Default output port** for a row: use the DJ track’s track-level default MIDI output when the row does not specify an override; if the track default is empty, preserve current behavior (e.g. first available / session default output used for channel rolls).
- **Persist** new fields in the same places as existing DJ track state (`useDJActionTracks` / stage) so reload and demo seeds behave predictably; extend normalization helpers as needed.
- **Playback**: the MIDI scheduler resolves the concrete `MIDIOutput` per emit using the track default and per-row override (falling back when a port id is missing or disconnected), instead of assuming one global output for all DJ events.

## Capabilities

### New Capabilities

- _(none)_

### Modified Capabilities

- `dj-action-tracks`: Extend `DJActionTrack` / `OutputMapping` (or adjacent routing fields) to carry optional Web MIDI **output port id** at track and/or per-row level; document the track-selected inspector panel and defaulting rules for port, channel, note vs. CC.
- `inspector`: When a DJ timeline track is selected, the Note-tab body (or a dedicated sub-panel within it) SHALL render the track-level output mapping list; interaction SHALL opt into `data-mr-dj-selection-region` so row-level selection clearing behavior stays consistent.
- `midi-playback`: DJ dispatch SHALL resolve `output.send` to the output port implied by the track default and per-row mapping, with explicit fallback rules when the port is absent or stale; channel-roll path unchanged unless shared helpers are factored.

## Impact

- **Data**: `src/data/dj.ts` (`OutputMapping`, normalization), `src/hooks/useDJActionTracks.ts` (track default output id, setters), `src/hooks/useStage.tsx` (exports for UI).
- **UI**: `src/components/inspector/Inspector.tsx` (and CSS) — new branch keyed on `selectedTimelineTrack` + DJ track; possible small shared control fragments with existing `ActionPanel` output rows.
- **Engine**: `src/midi/scheduler.ts` — multi-output resolution, panic/active-note accounting if outputs differ per event; tests in `scheduler.test.ts`.
- **Specs**: Delta files under `openspec/changes/dj-action-output-mapping/specs/*/spec.md` for the three capabilities above.
