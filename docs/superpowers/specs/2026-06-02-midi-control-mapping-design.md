# MIDI Control Mapping — Design

**Date:** 2026-06-02
**Topic:** `midi-control-mapping`
**Status:** Approved (brainstorming) → handed to OpenSpec

## Summary

Add the ability to control the application's transport and settings from
incoming MIDI — play, pause, record, rewind, cue, loop, metronome, quantize
on/off, quantize grid, snap, clock source, clock send, BPM, and a new
phrase-jump action — using an **Ableton-style MIDI mapping mode**: an in-place
overlay that highlights every mappable control, plus advanced per-mapping
configuration where applicable. Mappings live in a **global, app-wide store**
independent of the session, and can be **imported/exported as JSON**. Mapped
controls can also send **MIDI feedback** out to light controller LEDs.

This change is **input-driven control of existing app actions only**. It does
not trigger DJ action lanes and does not add new transport capabilities beyond
the phrase-jump action.

## Goals

- Map any incoming note / CC / channel-pressure / pitch-bend message to a
  transport or settings action.
- An Ableton-like map mode: toggle on → controls highlight in place with their
  current mapping shown → click to arm → move a MIDI control to learn it.
- Advanced per-mapping configuration appropriate to each target type.
- Feedback output: mapped toggle/enum states drive controller LEDs.
- Global persistence (one mapping set for the whole app) plus JSON
  import/export of the mapping set.

## Non-Goals

- Triggering DJ action lanes or arbitrary in-app controls beyond transport/
  settings (possible future change).
- Per-session mapping overrides (global store only).
- Mapping the performance/note capture path — that remains the recorder's job.

## Decisions (confirmed during brainstorming)

1. **Scope:** transport + settings only. "Phrase" becomes a new phrase-jump
   action (see §7). No DJ-action triggering.
2. **Storage:** global, in its own versioned persistence key, independent of
   the session `TimelinePayload`.
3. **Consumption:** a message matching an active mapping fires its action and
   is **not** passed to the recorder/DJ capture. Non-matching messages flow to
   the recorder exactly as today.
4. **Advanced parameters (all in scope):** trigger edge + button mode;
   velocity/value threshold; continuous BPM with absolute range + relative
   encoder mode + soft-takeover; enum stepping mode.
5. **Feedback output:** in scope — mapped toggle/enum states emit MIDI to the
   source controller.
6. **UI:** Layout A — in-place overlay badges + a docked Mappings list + a
   docked advanced-config panel.
7. **Conflict:** one source → one target; learning an already-used source
   reassigns it with a toast warning.
8. **BPM target:** applies only when `clockSource === 'internal'`; a no-op with
   a hint while slaved to external clock.
9. **Map-mode entry:** a toggle in the Titlebar plus a keyboard shortcut.
10. **Dock reuse:** in map mode the Sidebar dock hosts the Mappings list and
    the Inspector dock hosts the selected mapping's config — no permanent new
    chrome.
11. **Phrase default:** 8 bars per phrase, configurable per mapping.

## Architecture

New units, following existing MIDI patterns (`src/midi/recorder.ts`,
`src/midi/midiLearn.ts`, `src/data/dj.ts`):

| Unit | Responsibility | Depends on |
|---|---|---|
| `src/midi/controlMap.ts` | Pure data model + helpers: types, **target registry**, source-matching, advanced-rule application, conflict resolution. No React. | `midiLearn` types |
| `src/midi/MidiControlProvider.tsx` + `useMidiControl()` | Always-on input listener. Outside map mode: match → apply rules → dispatch → consume. In map mode: capture learn events, suppress triggers. | `controlMap`, `useTransport`, `MidiRuntime`, `useControlMapStore` |
| `src/midi/controlFeedback.ts` + provider | Watches transport state via registry selectors; emits outgoing MIDI on change. | `controlMap`, `useTransport`, `MidiRuntime` |
| `src/hooks/useControlMapStore.tsx` | Global mapping store; own versioned persistence key; loads at app start. | persistence layer |
| `src/components/midi-map/` | `MapModeOverlay`, `MappingsPanel`, `MappingConfig`, map-mode toggle + styles. | `useControlMapStore`, `useMidiControl` |

### Target registry

A single static registry is the source of truth for every mappable target.
Each entry declares: `key`, `label`, `kind` (`trigger | toggle | continuous |
enum`), a `dispatch(transport, value?)` function, and a `stateSelector` used by
feedback. The receiver, overlay, and feedback layer all read from it, so adding
a target is a one-place change.

## Data model (`controlMap.ts`)

```ts
type TargetKind = 'trigger' | 'toggle' | 'continuous' | 'enum'

type TargetKey =
  | 'play' | 'pause' | 'record' | 'rewind' | 'cue'                  // trigger
  | 'toggleLoop' | 'toggleMetronome' | 'toggleQuantize'
  | 'toggleSnapAbsolute' | 'toggleClockSend'                        // toggle
  | 'setBpm'                                                        // continuous
  | 'cycleQuantizeGrid' | 'cycleClockSource'                        // enum
  | 'phraseForward' | 'phraseBack'                                  // trigger (new)

interface ControlSource {
  kind: 'note' | 'cc' | 'pressure' | 'pb'
  portId: string
  channel: number          // 1–16
  data: number             // note or CC number (0–127); 0 for pressure/pb
  anyPort?: boolean        // match on channel+data only, ignore portId
}

interface ControlMapping {
  target: TargetKey
  source: ControlSource
  // advanced — only fields relevant to the target's kind are honored:
  edge?: 'press' | 'release'                 // note/cc button targets
  buttonMode?: 'toggle' | 'momentary'        // toggle targets
  minValue?: number                          // velocity/CC threshold to fire
  continuous?: {
    mode: 'absolute' | 'relative'
    min: number; max: number                 // e.g. BPM range
    takeover: boolean                         // soft pickup in absolute mode
  }
  enumMode?: 'cycle' | 'select'              // button cycles vs CC selects
  barsPerPhrase?: number                     // phraseForward/Back step (default 8)
  feedback?: {
    enabled: boolean
    portId: string; channel: number
    kind: 'note' | 'cc'; data: number
    onValue: number; offValue: number
  }
}

interface ControlMapState {
  version: number
  mappings: ControlMapping[]
}
```

### Defaults per kind

- **trigger:** `edge: 'press'`, `minValue: 1`.
- **toggle:** `edge: 'press'`, `buttonMode: 'toggle'`, `minValue: 1`.
- **continuous (`setBpm`):** `continuous: { mode: 'absolute', min: 60, max: 200, takeover: true }`.
- **enum:** `enumMode: 'cycle'`.
- **phrase:** carries a `barsPerPhrase` config (default 8) — modeled as a
  trigger with an extra numeric param on the mapping.

## Runtime behavior

### Listener

A single handler attaches to all `MIDIInput`s whenever the app is open (unlike
the recorder, which only listens while recording). Parsing reuses
`midiLearn.parseMidiLearnMessage`.

### Outside map mode (live)

1. Parse the message.
2. Find the matching mapping (`source.kind` + `channel` + `data`, and `portId`
   unless `anyPort`).
3. Apply advanced rules:
   - **edge / threshold:** fire on press or release; ignore values below
     `minValue`.
   - **button mode:** `toggle` flips state on the configured edge; `momentary`
     enables on press and disables on release.
   - **continuous absolute:** scale `0–127 → [min,max]`; with `takeover`, ignore
     until the incoming value crosses the current target value.
   - **continuous relative:** decode CC increment/decrement and step the target.
   - **enum cycle:** advance to the next value on press; **enum select:** map
     the value range across the enum's options.
4. Dispatch via the registry's `dispatch`.
5. **Consume:** the recorder consults the control map and **skips any message
   that matches an active mapping**, so a mapped control never lands in a take.
   System-realtime clock bytes (`0xF8/FA/FB/FC`) are never control sources, so
   clock-master input cannot collide.

### In map mode

- Triggers and recording are suppressed (entering map mode stops/blocks an
  active recording first).
- The **armed** target captures the next qualifying message as its `source`.
- One source → one target: learning a source already bound to another target
  reassigns it and shows a toast.

### Special cases

- **`setBpm`** applies only when `clockSource === 'internal'` (updates the
  stored user BPM); a no-op with a hint while slaved to external clock.
- **Hotplug:** a mapping whose `portId` is absent is retained but inactive
  until the port returns; `anyPort` mappings match on channel+data regardless.

## UI — Layout A

- **Map-mode toggle** in the Titlebar + a keyboard shortcut.
- On enter, `MapModeOverlay` renders an in-place **badge** on every mappable
  control (current source, or "unmapped"). The **Sidebar dock** hosts
  `MappingsPanel` (all mappings, grouped by target kind); the **Inspector
  dock** hosts `MappingConfig` (advanced params for the armed/selected
  mapping). No permanent new chrome — docks restore on exit.
- Interaction: click a control or list row to **arm** → move a MIDI control to
  **learn** → adjust advanced params in the config panel. Per-mapping
  **Clear** / **Relearn**.
- Exit → overlay clears, mappings go live.

Styling follows the project's plain-CSS + `.mr-` prefix + `data-*` state
conventions and `src/styles/tokens.css`.

## Feedback output

For toggle/enum mappings with `feedback.enabled`, a state-watcher subscribes to
the target's state via the registry `stateSelector` and emits the configured
note/CC (`onValue` / `offValue`) to `feedback.portId` **on state change**, with
an initial sync on app load and on map-mode exit. Output writes are separate
from `clockSender`; output enumeration reuses `MidiRuntime`. If the feedback
port is unavailable, emission is skipped silently until it returns.

## Persistence + import/export

- Global `ControlMapState` persisted under its **own versioned key**, separate
  from `TimelinePayload`, loaded at app start. Survives session new/load.
- **Export:** serialize `ControlMapState` to JSON, wired into the existing
  `ExportDialog` alongside the current MIDI / mapping-JSON exports.
- **Import:** a file picker validates the JSON against the current `version`
  (migrating older versions if needed) and replaces the active mapping set.

## Phrase action

`phraseForward` / `phraseBack` seek the playhead by `barsPerPhrase` (default 8),
snapped to the bar, computed from current `bpm`/`sig` and applied via
`transport.seek`. Backward seeks clamp at 0.

## Testing

- `controlMap.test.ts` — source matching; every advanced-rule path (edge,
  threshold, momentary vs toggle, relative vs absolute scaling + takeover, enum
  cycle vs select); conflict reassignment; phrase-bar math.
- Receiver tests — synthetic `MIDIInput` events assert dispatched transport
  actions, learn capture in map mode, and recorder skip-on-match.
- Feedback tests — a state change produces the expected outgoing message;
  initial sync on load; silent skip when the port is missing.
- Store tests — persistence round-trip and import/export round-trip
  (fake-indexeddb), including a version-migration case.

## Edge cases

- Feedback / source port hotplug-removed → mapping retained, inactive until the
  port returns.
- Entering map mode during recording stops recording first.
- Importing a mapping set that references absent ports → mappings load and stay
  inactive until those ports appear (or are `anyPort`).
- A single physical control learned to a target already mapped elsewhere →
  reassign-with-warning, never silently double-bind.
