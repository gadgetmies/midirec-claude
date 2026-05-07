# Handoff: MIDI Recorder

## Overview

This bundle is a high-fidelity design package for a MIDI recorder / piano-roll editor that **doubles as a DJ controller-mapping editor**. The app captures MIDI from any controller (keyboards, pad controllers, DJ controllers like Pioneer DDJ / Native Instruments Traktor / Denon SC) and renders it on a multi-track piano roll with CC automation lanes. A toggle switches the left rail from **piano-keys mode** (notes by pitch, traditional piano roll) to **action-lane mode** (notes by user-mapped DJ action — Cue, Loop, Hot Cue, FX, Crossfader, etc.), grouped into collapsible **device units** (Deck 1, Deck 2, FX 1, FX 2, Mixer, Global).

It's intended for music producers, DJs building controller mappings, and anyone who wants a clean technical record of a controller performance.

## About the Design Files

The files in `prototype/` are **design references created in HTML**. They are React + JSX prototypes running through the in-browser Babel transformer — they are **not** production code to copy directly. Treat them as a pixel-accurate spec.

Your task is to **recreate these designs in the target codebase's existing environment** (React, Vue, SwiftUI, Electron, native, etc.), using the codebase's established patterns, component libraries, and state management. If no codebase exists yet, choose the framework that best fits the project's runtime needs (this is a desktop-class audio app — Electron + React or a native shell are both reasonable).

`tokens.css` is the **shared contract** between this design and your implementation. Copy it into your codebase verbatim; the same file lives on both sides and a token edit propagates without hand-translation.

## Fidelity

**High-fidelity (hifi).** Final colors, typography, spacing, line weights, motion, and component states are all settled. Recreate pixel-accurately. The only thing not specified is the underlying audio engine / MIDI runtime — that's an implementation choice.

## Direction

A single direction was finalized: **Console** — a sharp, jewel-toned, multi-pane studio/DAW aesthetic. Dense, technical, console-like (Ableton/Reaper energy). The design system is themeable via `data-mr-theme="console"` on the app root; the `tokens.css` file scopes everything under `[data-mr-theme="console"]`.

## Screens / Views

The app is a single-window layout with the following regions, top-to-bottom and left-to-right:

```
┌────────────────────────────────────────────────────────────────────┐
│  Titlebar (transport · timecode · sync · accent LEDs)              │
├────────────┬───────────────────────────────────────┬───────────────┤
│            │  Toolstrip (snap · grid · lanes mode) │               │
│            ├───────────────────────────────────────┤               │
│  Browser   │  Ruler (bars · beats · markers)       │  Inspector    │
│  Sidebar   ├───────────────────────────────────────┤  (Note,       │
│            │  Stage:                               │   Pressure,   │
│  · Devices │   · Piano-mode → multi-track stack    │   Channel)    │
│  · Files   │   · DJ-mode   → device-unit stack     │               │
│  · Markers ├───────────────────────────────────────┤               │
│            │  CC lanes (3 lanes, mode-dependent)   │               │
├────────────┴───────────────────────────────────────┴───────────────┤
│  Statusbar (CPU · sample rate · MIDI in · clock)                   │
└────────────────────────────────────────────────────────────────────┘
```

### 1. Titlebar
- **Transport cluster** — Rec, Stop, Play, Loop. Rec uses `--mr-rec` red and pulses when armed.
- **Timecode** — `MM:SS:FF` in `--mr-font-mono`, 18px, fixed-width tabular numerals. Color shifts to `--mr-rec` when recording.
- **Sync source** — text label, optional dropdown for clock source.
- **Accent LEDs** — small status pips for MIDI-in, clock, recording.

### 2. Toolstrip (above the stage)
- **Snap** (1/4, 1/8, 1/16, 1/32, off) — segmented control.
- **Grid** (bars, beats, lines) — toggle button.
- **Lanes mode** — radio: `Piano keys` ↔ `Actions`. **This is the key UX toggle.**
- **Tools** — pointer, pencil, marquee, slip — icon buttons.

### 3. Stage — Piano mode (multi-track stack)
- **N collapsible tracks**, default 3 (Lead / Bass / Pads).
- Each track has a **22px header**: chevron · color swatch · name · `CH n · count notes` · M/S chip cluster.
- Expanded: per-track `PianoRoll` with notes colored from the track's color (mix-in oklab with velocity opacity).
- Collapsed: 18px row showing a 6px **minimap** of the track's notes.
- A muted track fades its body (`opacity: 0.32 · grayscale(0.7)`).
- Solo on **any** track makes non-soloed tracks fade to `opacity: 0.45` via `[data-soloing="true"]` on the stage.

### 4. Stage — DJ mode (device-unit stack)
- Action map is grouped by **device** (Deck 1 / Deck 2 / FX 1 / FX 2 / Mixer / Global). Each becomes a collapsible **unit section**.
- Unit header: 3px colored stripe · chevron · uppercase label · `n actions` · M/S chip.
- Expanded: per-unit `ActionRollUnit` showing only that device's mapped pitches, with a 192px keys column listing the action label + per-row M/S chip (Deck 1 demonstrates per-row M/S as the spec example).
- Notes render in three styles based on the action's flags:
  1. **Trigger** (`pad: false`, default): solid 6px tick, full opacity, ignores velocity.
  2. **Velocity-sensitive** (`pad: true`): filled bar with opacity = velocity, plus a small bright tick at the left edge.
  3. **Pressure-bearing** (`pressure: true`): wider bar with **discrete pressure ticks** rendered inside the body (same bar-graph language as CC lanes), an `AT` badge in the corner, and the strike-velocity tick on the left.

### 5. CC Lanes
- 3 lanes, fixed below the stage. Each lane is 72px tall.
- Header strip: lane name · CC number · M/S chip.
- Body: discrete bars, one per grid cell — 64-resolution by default. Bars use `color-mix` of the lane color with opacity = value.
- **Piano mode lanes**: Mod Wheel (CC 01), Pitch Bend (PB), Velocity (VEL).
- **DJ mode lanes**: Crossfader (CC 31), EQ Low · A (CC 22), Jog · A (CC 48).

### 6. Browser Sidebar (left, ~232px)
- Sectioned: **Devices** (live MIDI inputs with activity LEDs), **Files** (recent recordings), **Markers** (named time positions). Sectioned list, not a tree. Section headers in `--mr-font-mono`, 9px, uppercase, letter-spacing 0.08em.

### 7. Inspector (right, ~280px)
- Tabs: **Note** · **Pressure** · **Channel**.
- **Note panel** (when a single note is selected):
  - `Pitch` (e.g. `C#4 (61)`)
  - `Velocity` (slider, 0–127)
  - `Start` / `Length` (timecode inputs)
  - `Action` (when in DJ mode — shows the mapped action; opens the map editor)
- **Pressure panel** (only visible when the selected note has `pressure: true`):
  - Bar-graph editor mirroring the CC lane visual language.
  - Summary readout: `n events · peak X.XX · avg X.XX`.
  - Bulk ops: `Smooth` · `Flatten` · `Clear`.
  - Mode toggle: `Curve` · `Step`.
- **Multi-select state**: when a marquee selects N notes, the inspector summarizes (`14 notes · 3 pitches · velocity 64–112`) and exposes bulk-edit affordances.
- **Channel panel**: MIDI channel routing, output device, instrument patch.

### 8. Statusbar (bottom)
- Left: CPU meter, RAM meter.
- Center: sample rate · buffer size · MIDI in (`Pioneer DDJ-FLX10 · CH 1`).
- Right: clock state · BPM.

### 9. Map Editor (overlay, DJ mode)
- Opened by clicking an action label in the keys column or by the Inspector's Action row.
- Fields: action category dropdown · device dropdown · short label · full label · `pad` toggle · `pressure` toggle · pitch input · MIDI channel.
- Actions: `Save mapping` (primary) · `Cancel` · `Delete mapping` (danger).

### 10. Export Dialog (overlay)
- Triggered from titlebar overflow menu.
- Format dropdown (MIDI File · MIDI Clip · Mapping JSON).
- Range radio (`Whole session` · `Selection` · `Loop region`).
- Tracks checkbox list.
- Buttons: `Export` (primary, accent-colored) · `Cancel`.

## Interactions & Behavior

### Recording
- Pressing **Rec** arms; the rec button pulses with `mrPulse` keyframes (1.4s ease-in-out, alternating 12px and 22px outer glow at `--mr-rec`).
- Live notes stream into the active track from left to right; the playhead is fixed and the timeline scrolls under it.
- A small `REC ●` LED in the titlebar pulses (`mrLed` 1.2s).

### Playback
- Playhead sweeps left-to-right at tempo. Notes light up as they hit the playhead.
- A toast confirms `Started · 124 BPM` for ~2s after pressing Play.

### Selection
- Click a note — single-select. Inspector shows the Note panel.
- Marquee-drag empty space — multi-select. Inspector switches to bulk-edit summary.
- Shift-click extends; Cmd/Ctrl-click toggles.
- Selected notes use `--mr-note-sel` (warm orange-red), fully opaque.

### Mute / Solo
- Click `M` or `S` on any header — instant toggle, no confirmation.
- Solo composes globally: `[data-soloing="true"]` on the stage dims any row not soloed (`opacity: 0.45`). Mute fades + grayscales just that row (`opacity: 0.32 · grayscale(0.7)`). Mute and solo can both be set; solo wins for the row's audibility but mute still applies its visual fade.

### Track / Unit collapse
- Click anywhere on the header (outside the M/S cluster) to collapse/expand.
- Chevron rotates `-90deg` on collapse via `[data-track-open="false"]` / `[data-unit-open="false"]`.
- Smooth 120ms transition.

### Map editor (DJ mode)
- Open with double-click on an action label or via the Inspector.
- Esc or backdrop click cancels.
- Save persists to the action map; the action label and color update inline.

### Pressure editing
- Drag inside the bar-graph plot to paint values. `Curve` mode interpolates between drag points; `Step` snaps to grid cells.
- `Smooth` runs a 3-tap box filter; `Flatten` sets all values to the average; `Clear` zeros the lane.

## State Management

- **Transport** — `recording: bool`, `playing: bool`, `loop: bool`, `playheadT: number`.
- **Stage** — `lanesMode: 'piano' | 'actions'`.
- **Piano mode** — `tracks: Track[]` where each track has `{id, name, channel, color, notes[], open, muted, soloed}`.
- **DJ mode** — `actionMap: Record<pitch, Action>` and `unitState: Record<deviceId, {open, muted, soloed}>`.
- **Selection** — `selectedNotes: noteId[]`, `marquee: {t0,t1,p0,p1} | null`, `selectedPitch: number | null` (DJ mode).
- **Inspector** — `inspectorTab: 'note' | 'pressure' | 'channel'`.
- **Overlays** — `showMapEditor`, `showDialog`, `toast: {text, kind} | null`.
- **CC lanes** — `cc: Record<laneId, {points[], muted, soloed}>`.

A solo-active flag (`stageSoloing = anyTrackSolo || anyUnitSolo || anyCCSolo`) drives the global `[data-soloing]` attribute.

## Design Tokens

All tokens live in `prototype/tokens.css`. Copy this file into your codebase as the source of truth. Highlights:

### Color
- `--mr-bg-app` — deepest background
- `--mr-bg-panel`, `--mr-bg-panel-2` — panel surfaces (two depths)
- `--mr-text-1` / `--mr-text-2` / `--mr-text-3` — text hierarchy (high → low contrast)
- `--mr-line-1` / `--mr-line-2` / `--mr-line-3` — divider lines (subtle → strong)
- `--mr-accent` — primary action / focus (oklch greenish, hue 145)
- `--mr-accent-soft` — accent with 0.15 alpha
- `--mr-rec` — record / destructive (oklch red, hue 25)
- `--mr-rec-glow` — same hue, 0.45 alpha for shadow glow
- `--mr-play` — play state (matches accent hue family)
- `--mr-cue` — amber cue / locator
- `--mr-mute` — desaturated gray-blue
- `--mr-solo` — yellow (hue 90)
- `--mr-note` — MIDI note default (blue, hue 240)
- `--mr-note-sel` — selected note (warm orange-red)
- `--mr-cc` — CC lane default
- `--mr-pitch`, `--mr-aftertouch` — variations for CC lane families

Semantic: `--mr-info`, `--mr-warn`, `--mr-error`, `--mr-ok`.

### Typography
- `--mr-font-display` — UI sans (currently Inter; swap to your codebase's UI font)
- `--mr-font-mono` — JetBrains Mono / Berkeley Mono / similar; **must be tabular-numerals**
- Sizes: 9 / 10 / 11 / 12 / 13 / 14 / 16 / 18 / 22 / 28 — tight scale.
- Weights: 400 / 500 / 600 / 700.
- Letter-spacing: `0.08em` for `font-mono` uppercase labels.

### Spacing & Borders
- `--mr-bw-1` (1px hairlines)
- `--mr-r-1` (2px), `--mr-r-2` (3px), `--mr-r-3` (5px) — tight radii throughout. Nothing rounded above 5px.

### Shadow
- `--mr-shadow-sm`, `--mr-shadow-md`, `--mr-shadow-lg` — for floating panels.
- `--mr-shadow-inset` — 1px white-alpha inset highlight, used on raised buttons.
- `--mr-glow-rec` — 1px ring + 12px glow at `--mr-rec`.
- `--mr-glow-focus` — 2px ring at accent hue with 0.4 alpha.

### Animation
- `mrPulse` — 1.4s record arm pulse.
- `mrLed` — 1.2s LED blink.
- All UI transitions: 80–120ms ease-out. Nothing over 200ms.

## Assets

No external image assets. All iconography is inline SVG (transport, tools, chevrons, etc.) drawn at 12–16px stroke-1.6 round-cap-round-join. The titlebar logo is a 3-bar SVG mark, not a raster.

The `prototype/components.jsx` file contains every icon as an inline component — extract them to your codebase's icon system or paste the SVG paths directly.

## Files

- `prototype/MIDI Recorder Redesign.html` — entry point. Loads the design canvas with all artboards.
- `prototype/tokens.css` — **the shared contract**. Copy verbatim into the target codebase.
- `prototype/app.css` — component-level CSS. The selectors are stable and named with the `mr-` prefix (e.g. `.mr-track`, `.mr-unit`, `.mr-cc-lane`, `.mr-ms`, `.mr-note`, `.mr-keys`, `.mr-roll`). Use this as the spec for component class structure.
- `prototype/components.jsx` — `AppShell`, `Titlebar`, `Sidebar`, `Stage`, `Toolstrip`, `Ruler`, `PianoRoll`, `CCLane`, `MSChip`, `Inspector`, `Statusbar`, `ExportDialog`, `Toast`. Read the prop shapes — they are accurate to the spec.
- `prototype/dj.jsx` — `DJ_DEVICES`, `DJ_CATEGORIES`, `DEFAULT_ACTION_MAP`, `ActionRoll`, `ActionRollUnit`, `MapNoteEditor`, `ActionMapPanel`. The `DEFAULT_ACTION_MAP` is a starter mapping for a Pioneer-style controller — use it as a seed.
- `prototype/ds-page.jsx` — design-system reference page (tokens · type · components).
- `prototype/design-canvas.jsx`, `prototype/tweaks-panel.jsx` — design-tooling scaffolds. **Don't port these to production.** They exist only so the prototype can present multiple artboards side-by-side and expose tweak controls.
- `screenshots/` — pixel reference for every artboard.
- `IMPLEMENTATION_PLAN.md` — sequence of slices to ship the implementation.

## Sync Workflow

This bundle is the **outbound** half of a round-trip workflow.

**Design → Code (default direction):**
1. Edits happen in the design project.
2. Regenerate this bundle.
3. Drop `tokens.css` and the screenshots into the codebase's `design/` folder.
4. Claude Code re-reads and updates components.

**Code → Design (when implementation reveals new components/states):**
1. Commit the new component spec (CSS + a one-page README) into the codebase's `design/` folder.
2. In the design project, use the **Import** menu → "Import a GitHub repo" and paste the repo URL.
3. The design will reconcile against the imported source.

**The shared contract is `tokens.css`.** Both sides import the same file. Anything visual that could drift (color, spacing, radius, shadow, type scale) lives there — no hex codes hand-typed in components.
