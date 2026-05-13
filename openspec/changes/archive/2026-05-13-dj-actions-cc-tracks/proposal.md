## Why

DJ action rows that represent **continuous Control Change** output (mixer faders, EQs, crossfader, and any row whose playback emits CC) are still classified for rendering as **velocity-sensitive pads** because they set `pad: true`. That paints them as short **note-style blocks** in `ActionRoll`, which reads like discrete note hits instead of a CC automation strip. The timeline should match how those actions behave on the wire and how users read channel **param/CC** lanes elsewhere.

## What Changes

- Treat DJ action rows whose **effective output** is CC (per-row `outputMap[pitch].cc`, or the default mixer CC from `defaultMixerOutputCc` where applicable) as **CC lanes** in the dj-action-track body: continuous value-over-time visualization aligned with beat time, not trigger/velocity note glyphs.
- Keep **note-style** rendering for momentary deck controls, pressure pads, and other rows that emit notes (no resolved CC output).
- Update tests and any snapshot/selector expectations that assume mixer rows always render `.mr-djtrack__note--velocity` (or equivalent note classes).
- Document the visual/interaction contract in the `dj-action-tracks` spec (selection, playhead, audibility rules should remain consistent; CC rows may use different hit targets or reuse param-lane-like affordances as decided in design).

## Capabilities

### New Capabilities

- _(none — behavior is an adjustment to existing DJ timeline rendering.)_

### Modified Capabilities

- `dj-action-tracks`: Extend requirements for `<ActionRoll>` (and related CSS) so CC-output rows render as CC tracks, not note tracks; clarify how `event.vel` / duration maps to the CC visualization for demo and recorded events.

## Impact

- **Primary**: `src/components/dj-action-tracks/ActionRoll.tsx`, `ActionRoll.css`, possibly shared helpers with `param-lanes` or a thin internal “CC strip” primitive reusing discrete-bar patterns.
- **Data**: `src/data/dj.ts` — `defaultMixerOutputCc`, `resolvedMidiInputKind` / output resolution helpers may be referenced to compute **effective CC number** for a row.
- **Tests**: Component tests under `src/components/dj-action-tracks/` and hooks tests if fixtures assert note-only rendering for mixer rows.
- **Specs**: `openspec/specs/dj-action-tracks/spec.md` — new or updated scenarios for CC vs note rendering.
