## Why

Opening the app with no `demo` query flag currently boots into a seeded “showroom”: instrument channels carry generated notes and lanes, and a DJ action track ships with synthetic events. That hides the real blank-slate UX and mixes two unrelated demos. Operators and developers expect the default load to behave like production (empty timeline) while keeping rich fixtures reachable via explicit opt-in demos.

## What Changes

- **Default (`?` with no `demo` flag)**: Load an **empty** timeline — equivalent to today’s seeded structure with **no** notes, **no** param lanes, and **no** DJ action tracks (matching the intuitive reading of “empty”; the existing two MIDI channels Lead/Bass with empty rolls stay as they do for `demo=clean` unless we decide differently in design — see design.md).
- **`?demo=instrument`**: Restore the **current** non-clean instrument fixtures (generated notes per channel plus the existing Mod Wheel / Pitch Bend seeded lanes).
- **`?demo=dj`**: Restore the **current** DJ demo track (`seedDefault` contents: seeded `actionMap`, synthetic `events`, etc.).
- **`demo=clean`**: Redundant if default is empty; either **removed** (**BREAKING** for bookmarks) or retained as an explicit no-op alias — prefer documenting one behavior in specs.
- **Combining demos**: Support loading **both** instrument and DJ demos when appropriate (e.g. `?demo=instrument&demo=dj`) so QA can still reproduce the legacy “everything at once” session without relying on implicit defaults.
- **Other existing flags** (`demo=marquee`, `demo=note`): Keep selection/marquee UX; **`demo=marquee` and `demo=note` each imply the instrument fixture** (same timeline seed as `demo=instrument`) so the Lead roll always has notes for those demos.

## Capabilities

### New Capabilities

- (none — behavior is routed through existing session seed hooks and documented as requirement deltas.)

### Modified Capabilities

- `channels`: Specify baseline when no **instrument-demanding** token is present (`instrument`, `marquee`, or `note`); any of those three SHALL load the full instrument fixture (`demo=instrument` equivalent).
- `dj-action-tracks`: Gate the seeded DJ fixture behind **`demo=dj`**; baseline `djActionTracks` is **`[]`**.
- `piano-roll`: Preserve marquee/note precedence rules; document that **`demo=marquee` / `demo=note` auto-enable** the instrument timeline for note data; default `/` stays resolved-selection-null without those flags.
- `tracks`: **`selectedChannelId`** for marquee follows **`demo=marquee`** (instrument seed implied — no separate `instrument` flag required).

## Impact

- `src/hooks/useChannels.ts` — generalize seeding beyond binary `clean` (e.g. `instrumentDemo` vs empty baseline).
- `src/hooks/useDJActionTracks.ts` — parameterized initial seed (empty vs full demo).
- `src/hooks/useStage.tsx` — parse `demo` query (multiple values), derive flags passed into channel and DJ hooks, retire or remap `demo=clean`, reconcile `demoMarquee` / `demoNote` / `selectedChannelId` with new defaults.
- **Tests**: Any RTL or fixture tests that asserted default seeded note counts or DJ rows.
- **`openspec/specs/*`**: Deltas above so implementation matches the documented contract.
