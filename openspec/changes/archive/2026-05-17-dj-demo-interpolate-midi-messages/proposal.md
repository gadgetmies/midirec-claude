## Why

Mixer automation in the `demo=dj-automation` preset is expressed as one `ActionEvent` per beat, but quantized CC values repeat across consecutive beats whenever `round(vel × 127)` lands on the same integer. Playback therefore emits fewer physical MIDI/CC changes than the ramp implies, which weakens the demo’s ability to validate smooth hardware or logging behavior across every discrete controller step.

## What Changes

- Update the automation demo mixer seed so **every unit change** in the target MIDI/CC range produces **at least one outbound message** along each scripted ramp (interpolation in time within the prescribed beat intervals), without changing nominal endpoint values or the URL/deck choreography from `dj-automation-demo`.
- Tighten the **dj-automation-demo** spec so mixer ramp requirements are framed in terms of covering **each integer value** in the applicable range (including **Ch 2 EQ Low** 0→63 and **Ch 1 EQ Low** 63→0), not merely one event per anchor beat where rounding might collapse steps.
- Adjust or add targeted tests/assertions tied to seeded event timelines or MIDI-out expectations for the preset.

## Capabilities

### New Capabilities

- _(none)_

### Modified Capabilities

- `dj-automation-demo`: Mixer CC ramp requirement — ensure interpolated scheduling so quantized controller values advance by one (within each ramp segment) wherever the linear contour crosses that threshold, yielding MIDI messages for each value change.

## Impact

- **`src/hooks/useDJActionTracks.ts`** — `buildAutomationMixerEvents()` (and any helpers): generate denser stepping or time-interpolated events while preserving existing beat windows and formulas for endpoints.
- **`openspec/specs/dj-automation-demo/spec.md`** — clarify ramp coverage (per-value MIDI), expected event cardinality bounds, scenarios for EQ ramps not just Ch 1/Ch 2 volume.
- **Tests** — extend or replace length-only checks where they assumed “one event per beat” as sufficient for MIDI coverage.
