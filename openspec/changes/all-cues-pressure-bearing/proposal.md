## Why

Cue (49 / 66) is classified as `fallback` in `DEFAULT_ACTION_MAP` because it carries no `pad` or `pressure` flag, so `DJValueEditor` hides for it (`mode.ts:59`) — there is no way to give a cue press a velocity or pressure curve. Hot Cues 2-4 (both decks) are `velocity-sensitive` only, even though physical DJ pads behave the same way HC1 does. Treating the whole cue family as pressure-bearing aligns the data model with the controller hardware and makes the value editor reachable for every cue row.

## What Changes

- In `src/data/dj.ts`, set `pad: true, pressure: true` on every cue / hot-cue entry in `DEFAULT_ACTION_MAP`:
  - `cue` (49), `cue_b` (66) — gain both flags (currently bare entries → `fallback`).
  - `hc2` (57), `hc3` (58), `hc4` (59), `hc2_b` (70), `hc3_b` (78), `hc4_b` (79) — gain `pressure: true` (already have `pad: true`).
  - `hc1` (56), `hc1_b` (69) — unchanged; already pad + pressure.
- All ten entries resolve to `actionMode === 'pressure-bearing'` after the change (precedence: pressure > pad > trigger > fallback).
- Selecting any cue row now mounts `DJValueEditor` (AT editor for an event selection; PB/CC editor for a row selection where output mapping resolves to CC/PB).
- `ActionRoll` renders cue / hot-cue notes with the pressure-curve renderer instead of the velocity-tick renderer.
- Tests that currently pin to HC2 (57) as the *velocity-only* example are repointed to a synthetic `make({ pad: true })` entry, so the fixture stays meaningful after HC2 becomes pressure-bearing.
- The `mode.test.ts` `fallback` fixture is repointed from cue (49) to `load_a` (73), which remains the canonical `fallback` example.

No storage-shape change: `pressure` is an existing field on `ActionMapEntry`. No MIDI-output or routing change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dj-action-tracks`: add a requirement that every cue and hot-cue entry in `DEFAULT_ACTION_MAP` carries both `pad: true` and `pressure: true`, and therefore renders in pressure-bearing mode.
- `dj-map-editor`: update the "picking Hot Cue 2 from the Action select" scenario — the committed entry now has `pressure: true` (was: "pressure field SHALL be unset").

## Impact

- Code: `src/data/dj.ts` (data only).
- Tests:
  - `src/data/dj.test.ts` — "fallback for cue id" and "velocity-sensitive when pad: true and no pressure" both reference pitches whose modes change; switch to synthetic entries.
  - `src/components/dj-value-editor/mode.test.ts` — `fallback` constant moves from pitch 49 → 73 (`load_a`).
  - `src/components/dj-action-tracks/ActionRoll.test.tsx` — two tests asserting HC2 (57) renders `--velocity` move to a synthetic pad-only fixture (or to `xfade_pos` 80).
  - `src/hooks/useDJActionTracks.test.ts` — `baseTrack.actionMap` includes HC2 (57); verify downstream assertions don't depend on HC2 being velocity-only.
- Behavior at runtime: selecting any cue row reaches the value editor (intended). DJ Action-Roll rendering of cue / HC2-4 notes switches to the pressure renderer (intended).
- No migrations: `actionMode` is derived per render; existing sessions storing the older flag set will re-derive correctly once the seeded map updates. User-customised action-map entries persisted in storage are not retroactively rewritten — that's intentionally out of scope (users who hand-edited a cue keep their settings).
