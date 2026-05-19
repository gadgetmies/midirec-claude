## Why

Continuous-value MIDI emitted by DJ action tracks is currently editable in three inconsistent ways: CC values are edited indirectly by dragging `cc-group` strips on the lane body; Channel-Pressure (Aftertouch) curves live behind a hidden Inspector section; and Pitch-bend cannot be authored at all. Users have no single timeline-aligned canvas for painting these values against the musical grid, which is the basic affordance every DAW gives for automation. The DJ-automation flow has matured enough (output mapping, per-row CC, drag-to-move) that the missing piece is now the editor itself.

## What Changes

- Add a new timeline-aligned **DJ value editor** mounted as a global sticky footer above the Statusbar, with a derived mode driven by selection state:
  - **CC stream** — paints `ActionEvent`s on a CC-output row across the visible timeline.
  - **PB stream** — paints `ActionEvent`s on a new pitch-bend-output row across the visible timeline.
  - **AT (windowed)** — paints `PressurePoint`s into a selected event's `event.pressure` array, clamped to the event's span.
- Gestures: left-click paints one point at the snapped tick; left-drag paints across every quantize cell crossed (latest-value wins); shift+click linearly interpolates from the previous anchor; right-click (and right-drag) deletes; vertical position is unsnapped `0..1`. Snap follows the transport's existing `quantizeOn` / `quantizeGrid` / `snapAbsoluteOn` settings.
- Bulk-op chips **Smooth**, **Flatten**, **Clear** operate on the current edit range (timeline viewport for CC/PB, event span for AT).
- Editor canvas is user-resizable via the header strip's top edge; height persists to `localStorage` under `mr.dj-value-editor.heightPx` (clamped `48..400`).
- **NEW** Pitch-bend output kind: extend `OutputMapping` with `out?: 'note' | 'cc' | 'pb'` (back-compat default: `'note'` when both `out` and `cc` are absent, `'cc'` when `cc` is present). The scheduler gains `emitPitchBend` (`0xE_ LSB MSB` from `vel * 16383`), a tick-0 center emit on every `(midiOutputDeviceId, channel)` with at least one PB-output row, and PB-center panic alongside the existing All-Notes-Off / aftertouch panic.
- **BREAKING** Remove the Inspector's Pressure section: `PressureEditor.css` is deleted, the pressure JSX block in `ActionPanel` is removed, and `dj-pressure-editor` capability requirements covering the Inspector-side UI are superseded. The type contracts and pressure-helper purity requirements migrate verbatim into the new editor's spec. `summarizePressure` and `clearPressure` are removed from `src/data/pressure.ts`.
- In-lane rendering (`ActionRoll` CC group strips, synthetic pressure curve, `rasterizePressure` lane bars) is unchanged. The editor is an additional input surface that operates on the same `track.events` data.

## Capabilities

### New Capabilities
- `dj-value-editor`: The timeline-aligned editor footer that authors CC streams, Pitch-bend streams, and per-event Aftertouch curves under a derived mode. Owns the gesture state machine, the resize/persistence behavior, the bulk-op strip, and the close-chip semantics. Also owns the pressure-helper type contracts and purity requirements migrated from `dj-pressure-editor`.

### Modified Capabilities
- `dj-action-tracks`: extend `OutputMapping` with `out?: 'note' | 'cc' | 'pb'`; clarify the resolution rule when `out === 'pb'` (the `cc` field is ignored and playback emits pitch-bend); ActionRoll lane-body rendering of CC group strips and pressure bars stays as today.
- `midi-playback`: add a **DJ Pitch-bend mode** requirement (`emitPitchBend`, tick-0 center emit, PB-center panic on stop); the existing CC-out and note-mode requirements remain unchanged. Branch dispatch on `outputMap[pitch].out` with back-compat for `cc !== undefined`.
- `inspector`: remove the Pressure section requirements; the Output mapping form and DJ event timing editor are unchanged.
- `app-shell`: add a `.mr-dj-value-editor` global sticky footer slot mounted above `.mr-statusbar` when the editor's derived mode is non-hidden; the existing six-region layout otherwise stands.
- `dj-pressure-editor`: archive. Inspector-rendering and bulk-op-DOM requirements are dropped; the pressure-helper purity / type-contract requirements move into `dj-value-editor`. After apply, `openspec/specs/dj-pressure-editor/spec.md` is moved under `openspec/specs/_archived/`.

## Impact

- **Code**:
  - `src/data/dj.ts` — extend `OutputMapping` with `out?: 'note' | 'cc' | 'pb'`.
  - `src/midi/scheduler.ts` — add `emitPitchBend`; branch dispatch on `outputMap[pitch].out` (with `cc` back-compat); add PB tick-0 emit; extend stop-panic to broadcast `0xE_ 8192` on each `(outputId, channelByte)` with at least one PB-output row.
  - `src/components/dj-value-editor/` (new) — `DJValueEditor.tsx`, `DJValueEditor.css`, `gestures.ts`, `bulkOps.ts`, plus tests.
  - `src/components/shell/AppShell.tsx` — mount the new editor between the timeline body and the existing `Statusbar` when its derived mode is non-hidden; the editor must mirror the timeline's `scrollLeft` since it lives outside the timeline's scroll container.
  - `src/components/inspector/ActionPanel.tsx` — remove the pressure section JSX.
  - `src/components/inspector/PressureEditor.css` — delete.
  - `src/data/pressure.ts` — remove `summarizePressure`, `clearPressure`; keep `synthesizePressure`, `rasterizePressure`, `smoothPressure`, `flattenPressure`.
- **Specs**:
  - New: `openspec/specs/dj-value-editor/spec.md` (created at apply time from the change's `specs/dj-value-editor/spec.md`).
  - Modify: `openspec/specs/dj-action-tracks/spec.md`, `openspec/specs/midi-playback/spec.md`, `openspec/specs/inspector/spec.md`, `openspec/specs/app-shell/spec.md`.
  - Archive: `openspec/specs/dj-pressure-editor/spec.md` → `openspec/specs/_archived/`.
- **No** changes to MIDI recording, channel-roll playback, routing matrices, transport quantize state, or the session-model data shape (beyond the additive `OutputMapping.out` field). No data migration: legacy `outputMap` entries with `cc` set continue to mean "CC out" without an `out` discriminator.
- **Follow-ups** (tracked in `BACKLOG.md`): rename `pitch` → "row key" on `ActionEvent` and in `actionMap` / `outputMap`; per-row "starting value" emit configuration for CC / PB rows.
