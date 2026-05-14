## Context

The app configures DJ actions in the sidebar **Map Note** panel (`InputMappingPanel`) with Web MIDI port toggles, channel, and note or CC. Output targets for each row are edited in the Inspector **Output** panel with a virtual `DJ_DEVICES` selector, then channel, pitch, and optional CC. Both surfaces already auto-save via `setActionEntry` and `setOutputMapping`. Incoming MIDI is already surfaced through `MidiRuntimeProvider` / `useMidiInputs` for other features (recording, monitoring).

## Goals / Non-Goals

**Goals:**

- One-shot **MIDI learn** for **input** mapping (Map Note) and **output** mapping (Inspector row-level Output panel), with controls placed **after device selection** and **before** channel and note/CC fields.
- Shared listener logic where practical: arm → listen → map first eligible message → disarm, with visible armed state and cancel.
- Persisted updates MUST use existing stage setters so undo/session semantics stay consistent.

**Non-Goals:**

- Learning **virtual** output device keys (`DJ_DEVICES`); learn applies to **channel / pitch / CC#** only on the Output panel (device remains the user-chosen deck/surface key).
- Learning **track-level** bulk output list in the Inspector when no row is selected (the change targets row-level input + output mapping only unless product explicitly extends later).
- SysEx, NRPN/RPN, or machine-wide MIDI routing outside Web MIDI inputs already granted to the app.

## Decisions

1. **Subscription model** — Implement a small hook (e.g. `useMidiLearn`) or module that registers `midimessage` on `MIDIInput` only while armed, and removes listeners on disarm/unmount. **Rationale**: avoids permanent per-frame work and keeps behavior local to the panel that owns the control. **Alternative**: global singleton dispatcher — rejected to limit coupling and simplify cleanup.

2. **First message wins** — While armed, the **first** message that matches the learn **profile** for the active panel updates fields once, then disarms. **Rationale**: matches common DAW behavior and avoids fighting continuous CC streams.

3. **Input panel message profile** — Derive updates from the current **MIDI in · type** (`midiInputKind`): note-on (ignore velocity 0 as note-off), CC, channel pressure, pitch bend (channel only or as defined by existing `ActionMapEntry` fields). **Rationale**: aligns learn with visible form mode.

4. **Output panel message profile** — Map **note-on** (non-zero velocity) to **channel** + **pitch** and clear or leave `cc` per product rule (prefer: **drop `cc`** when learning a note so playback stays note mode; if CC row is visible for mixer rows, **CC messages** set **channel** + **cc**). **Rationale**: output hardware is addressed by wire protocol; virtual `Device` select stays as the routing key to `midi-playback`.

5. **Port filtering (Map Note)** — Only consider messages from inputs that are **enabled for the row** (`midiInputDeviceIds` non-empty → must be in set; empty → same “track default / first input” behavior as today’s listening semantics — codify as “eligible inputs” reuse from recording hook if one exists). **Rationale**: respects the device toggles the user just set.

6. **Timeout & cancel** — Optional but recommended: auto-cancel after ~10–15 s idle or on Escape / second button click. **Rationale**: prevents stuck armed state.

7. **UI control** — A single secondary button (e.g. `Learn` / `Stop learning`) placed in a compact row consistent with `.mr-btn` / sidebar patterns; armed state uses `aria-pressed` and visible accent. **Placement**: Map Note — immediately **after** the **MIDI in · devices** block, **before** the **MIDI in · ch** / note / CC group. Inspector — **`.mr-kv` row** after **Device**, **before** **Channel**.

## Risks / Trade-offs

- **Concurrent MIDI consumers** — Recording or other listeners may see the same message. **Mitigation**: learn runs read-only on the event; do not block other handlers unless a conflict is found during implementation (prefer order: learn handler runs early in the chain or shares the same fused hook as recording).

- **Control-change streams** — First CC may be 0 while moving a fader. **Mitigation**: still acceptable for “first message wins”; user can arm again.

- **Output learn vs virtual device** — User might expect learn to pick the deck. **Mitigation**: copy in UI that learn targets channel/note/CC only; device remains manual.

## Migration Plan

No data migration. Feature is additive. Roll back by hiding the buttons or deleting the hook registration.

## Open Questions

- Exact duplicate handling when `cc` and note coexist in UI for mixer rows (confirm whether learn-from-note clears `cc`).
