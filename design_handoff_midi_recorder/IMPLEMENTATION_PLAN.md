# Implementation Plan — MIDI Recorder

A pragmatic order for shipping this design. Each slice is a complete, demoable cut — the app should look and feel right at every checkpoint, even if functionality is stubbed.

## Slice 0 — Tokens & shell (½ day)
- Copy `tokens.css` into the codebase. Wire `data-mr-theme="console"` on the app root.
- Set up the global font stack (`--mr-font-display`, `--mr-font-mono` with tabular numerals — this matters for timecode legibility).
- Build the app shell skeleton: Titlebar / Sidebar / Stage / CC lanes / Inspector / Statusbar — empty but with correct widths, heights, borders, and backgrounds.
- **Done when** screenshot 01 matches at zero functionality.

## Slice 1 — Titlebar + transport state (½ day)
- Transport buttons (Rec / Stop / Play / Loop) with all visual states. Wire to a placeholder `useTransport()` hook returning fake state.
- Timecode display with tabular numerals; flips to `--mr-rec` when recording.
- `mrPulse` and `mrLed` animations.
- **Done when** screenshot 02 (recording) and 03 (playing + toast) both match.

## Slice 2 — Piano roll renderer (1 day)
- `PianoRoll` component: keys column + lane grid + notes + playhead.
- Note rendering: velocity → opacity, selection → `--mr-note-sel`, track-color override.
- Marquee selection drawing.
- **Done when** screenshot 04 (marquee) matches.

## Slice 3 — Multi-track stack (½ day)
- Track header with chevron, swatch, name, M/S chip cluster.
- Collapse/expand with chevron rotation; collapsed body shows the 6px minimap.
- Mute/solo state via `[data-muted]` / `[data-soloed]`; solo composes via `[data-soloing]` on the stage.
- **Done when** the piano-mode shell matches the spec at multiple track states.

## Slice 4 — CC lanes (½ day)
- `CCLane` component: header strip (name · CC · M/S chip) + discrete-bar plot.
- 64-resolution paint with `color-mix` velocity opacity.
- Hover scrubbing readout.
- **Done when** all three CC lanes render in piano mode.

## Slice 5 — Inspector — Note panel (½ day)
- Tab strip (Note / Pressure / Channel).
- Single-select state: pitch / velocity / start / length fields.
- Multi-select state: bulk-edit summary.
- **Done when** screenshot 04 (multi-select inspector) matches.

## Slice 6 — Export dialog + Browser sidebar (½ day)
- Sidebar sections: Devices / Files / Markers, with the activity-LED list pattern.
- Export dialog overlay.
- **Done when** screenshot 05 (export dialog) matches.

## Slice 7 — DJ mode foundation (1 day)
- Lanes-mode toggle in the toolstrip.
- `DJ_DEVICES`, `DJ_CATEGORIES`, `DEFAULT_ACTION_MAP` from `dj.jsx` — port verbatim.
- `ActionRollUnit` per device, grouped into the unit stack.
- Unit header: stripe · chevron · label · count · M/S chip.
- Action label rendering in keys column with optional per-row M/S (Deck 1).
- Note rendering modes: trigger / velocity-sensitive / pressure-bearing.
- **Done when** screenshot 06 (DJ overview) and 08 (DJ recording) match.

## Slice 8 — Map editor overlay (½ day)
- Opened from action label or Inspector → Action row.
- All form fields (category, device, short, label, pad, pressure, pitch, channel).
- Save / Cancel / Delete.
- **Done when** screenshot 07 (DJ map editor) matches.

## Slice 9 — Pressure editor (1 day)
- Inspector Pressure panel — bar-graph editor with same visual language as CC lanes.
- Summary readout (`n events · peak · avg`).
- Bulk ops (Smooth / Flatten / Clear) and mode toggle (Curve / Step).
- Visible only when selected note has `pressure: true`.
- **Done when** screenshot 09 (DJ pressure editor) matches.

## Slice 10 — Statusbar + audio engine wiring (1+ day, scope-dependent)

> **SUPERSEDED** — this project is MIDI-only (no audio engine). The audio portion of this slice is dropped permanently; the Statusbar visual shipped as the `statusbar-shell` change; the picker work is now tracked in `BACKLOG.md` ("Pickers for MIDI input and clock source"). See `design/deviations-from-prototype.md` #20 for the rationale.

Original text retained for history:

- CPU / RAM meters.
- MIDI input device picker; clock source.
- Real MIDI capture + playback (Web MIDI in browser, CoreMIDI / WinMM via your shell).
- This is where the design ends and the audio implementation begins — the visual spec is settled by Slice 9.

## Total estimate

~6.5 days for a single skilled engineer to reach Slice 9 (full visual fidelity, stubbed audio). Slice 10 depends entirely on the audio runtime choice.

## Sequencing notes

- **Don't skip Slice 0.** Building components against tokens from day 1 is what makes the design-↔-code sync cheap. If you hardcode hex codes anywhere, you've broken the contract.
- **Slices 7–9 only happen after Slices 1–6.** Piano mode is the simpler subset; DJ mode reuses every primitive (CC lanes, M/S chips, marquee, selection model). Building DJ first means building the primitives badly.
- **Skip the design-tooling files** (`design-canvas.jsx`, `tweaks-panel.jsx`). They exist for the prototype only.
