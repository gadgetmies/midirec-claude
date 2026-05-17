## Why

Instrument note rows currently show selection only through demo/query-driven `selectedIdx` and marquee data; clicking a `.mr-note` does nothing and there is no way for users to pick a note interactively. DJ action lanes already establish a clear pattern: click sets selection and paints a visible accent chrome. Bringing the same interaction and visual language to piano-roll notes improves discoverability and keeps the timeline consistent across track kinds.

## What Changes

- Add interactive selection for notes in channel piano-roll rows: clicking a note selects it for the owning channel roll (minimum: single-note selection aligned with DJ event selection).
- Render the selected note(s) with the **same accent highlight treatment** as DJ action-track events (`inset accent border` + outer accent glow via design tokens — matching `.mr-djtrack__note[data-selected="true"]` / `.mr-djtrack__cc[data-selected="true"]`), instead of relying solely on `--mr-note-sel` flat fill where that conflicts with the DJ look.
- Wire selection state through the stage (or equivalent orchestration) so the focused channel roll receives `selectedIdx` from user interaction, not only from demo fixtures; preserve sensible coexistence with marquee-driven selection where both exist.

## Capabilities

### New Capabilities

_(none — behavior extends existing timeline/piano-roll requirements.)_

### Modified Capabilities

- `piano-roll`: REQUIREMENTS updated for clickable notes, programmatic + user-driven `selectedIdx`, and primary-selection chrome that matches the DJ action-track selected-event visualization.
- `tracks`: REQUIREMENTS updated if the track row must pass selection callbacks / focus behavior from the shell into `PianoRoll` (header focus vs roll focus).

## Impact

- `src/hooks/useStage.tsx` — state and setters for note selection per channel (or unified selection model); possible interaction with `resolvedSelection`.
- `src/components/piano-roll/PianoRoll.tsx` + `PianoRoll.css` — click handlers, `data-selected` (or equivalent) styling aligned with DJ action CSS.
- `src/components/tracks/Track.tsx`, `src/components/channels/ChannelGroup.tsx`, `src/components/shell/AppShell.tsx` — plumb callbacks and focused-channel rules.
- Tests: piano-roll / track interactions; snapshot or style contract tests if present for selection tokens.
