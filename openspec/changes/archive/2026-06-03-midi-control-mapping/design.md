## Context

The app receives MIDI today only through `src/midi/recorder.ts`, and only while
recording, to capture performance onto the timeline. Transport and settings
live in `useTransport` (play/pause/record/rewind/cue, toggleLoop,
toggleMetronome, toggleQuantize, toggleSnapAbsolute, setQuantizeGrid, clock
source, and — via `useMidiClockSend` — clock send). MIDI access/enumeration is
provided by `MidiRuntime`; message parsing helpers exist in
`src/midi/midiLearn.ts`; the DJ feature (`src/data/dj.ts` + `dj-map-editor`)
already demonstrates a learn-driven mapping editor and an action/output mapping
data model.

This change adds a parallel, always-on path that maps incoming MIDI to those
existing actions, an Ableton-style mapping UI, a global persisted mapping store,
and optional MIDI feedback output. The full approved design is in
`docs/superpowers/specs/2026-06-02-midi-control-mapping-design.md`.

## Goals / Non-Goals

**Goals:**
- Map note/CC/pressure/pitch-bend to existing transport & settings actions.
- Ableton-style map mode: in-place overlay badges + dock-hosted Mappings list
  and advanced-config panel; arm → learn → configure.
- Advanced per-mapping config: edge, button mode, threshold, continuous BPM
  (absolute range + relative encoder + soft-takeover), enum stepping.
- Global, versioned mapping store with JSON import/export.
- MIDI feedback output for toggle/enum states.

**Non-Goals:**
- Triggering DJ action lanes or non-transport controls.
- Per-session mapping overrides (global store only).
- Replacing the recorder's note-capture path.

## Decisions

**1. A pure `controlMap.ts` model + a single target registry.**
All mappable targets are declared once in a static registry: `{ key, label,
kind, dispatch(transport, value?), stateSelector }`. The receiver, overlay, and
feedback layer all read from it, so adding a target is a one-place change and
matching/rule logic stays React-free and unit-testable (mirrors `data/dj.ts`).
*Alternative:* scattering target knowledge across the receiver and UI — rejected
as duplicative and drift-prone.

**2. Always-on listener separate from the recorder.**
A dedicated `useMidiControl` listener attaches to all inputs whenever the app is
open (the recorder only listens while recording). Keeps concerns separate and
lets control work outside recording. *Alternative:* extending the recorder to
also do control — rejected; conflates two lifecycles.

**3. Consumption via recorder consult, not an input-router rewrite.**
Web MIDI delivers an event to every handler, so messages can't be "un-delivered."
Instead the recorder consults the active control map and **skips any message
that matches a mapping**. Low-coupling, low-risk. *Alternative:* a central input
router that gives the control layer first refusal — cleaner in theory but a
larger, riskier refactor of the existing recorder path; deferred.

**4. Global versioned store, separate key.**
`ControlMapState { version, mappings[] }` persists under its own key, loaded at
app start, independent of `TimelinePayload` hydration. Matches how a hardware
rig's mapping should behave across sessions. *Alternative:* per-session in
`TimelinePayload` — rejected per brainstorming (re-mapping per session).

**5. Dock reuse for the editor UI (Layout A).**
In map mode the Sidebar dock hosts the Mappings list and the Inspector dock
hosts the advanced-config panel; on exit, docks restore. Avoids permanent new
chrome and reuses established panel patterns. *Alternative:* a dedicated modal
(Layout C) or per-control popover (Layout B) — rejected during brainstorming.

**6. One source → many targets.**
A source may be bound to multiple targets so a single incoming event can drive
several actions; the receiver fires every matching mapping. Each target still
has at most one source, and learning replaces only the armed target's source.
Learning a source already used elsewhere keeps the other bindings and shows an
informational toast naming them. (Supersedes the earlier one-source-to-one-target
reassign-on-conflict decision.)

**7. `setBpm` only when `clockSource === 'internal'`.**
While slaved to external clock the tempo is owned by the incoming clock, so the
BPM target is a no-op with a hint. Avoids fighting the clock receiver.

**8. Feedback as a state-watcher off registry selectors.**
For `feedback.enabled` toggle/enum mappings, a watcher subscribes to the
target's state via the registry `stateSelector` and emits note/CC on change,
plus an initial sync at load and on map-mode exit. Output writes are independent
of `clockSender`. *Alternative:* emitting inside each dispatch — rejected; misses
state changes driven by the UI/keyboard.

## Risks / Trade-offs

- **Recorder/control coupling** → the recorder must import a matching predicate
  from the control store. Mitigation: expose a single pure
  `matchesActiveMapping(msg, state)` from `controlMap.ts`; keep the recorder's
  dependency to that one function.
- **Soft-takeover feel on absolute encoders** → values can feel "stuck" until
  crossed. Mitigation: takeover is per-mapping and defaults on for BPM only;
  document the behavior in the config panel.
- **Relative-encoder encodings vary by vendor** (two's-complement vs
  sign-magnitude vs offset-64) → wrong direction/step. Mitigation: support the
  common encodings and expose the encoding choice in continuous-relative config;
  cover each in unit tests.
- **Port identity across hotplug/reload** → `portId` may change. Mitigation:
  retain mappings while a port is absent; offer `anyPort` (match channel+data)
  for portability; match feedback the same way.
- **Feedback loops** (feedback out re-triggering an input) → unlikely since
  feedback targets LEDs, but possible on devices that echo. Mitigation: feedback
  emits only on state change, and inputs are consumed, not looped.
- **Dock takeover disorients** → hiding the normal Sidebar/Inspector during map
  mode. Mitigation: clear map-mode affordance and instant restore on exit.

## Migration Plan

Additive feature, no data migration for existing sessions. New persistence key
starts empty (no mappings) so existing users see no behavior change until they
map something. The store is versioned; `version` enables future import
migrations. Rollback: remove the providers and the store key; nothing in
`TimelinePayload` changes.

## Open Questions

- Exact keyboard shortcut for the map-mode toggle (pick one that doesn't
  collide with existing shortcuts during implementation).
- Default BPM range bounds (`60–200` proposed) — confirm against the app's
  allowed tempo range during implementation.
