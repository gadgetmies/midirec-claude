## Context

DJ mixer rows in `DEFAULT_ACTION_MAP` use `pad: true` (velocity-sensitive bars) but playback and output mapping still follow the **note** pipeline (`OutputMapping.pitch`, scheduler note-on/off). Hardware mixers and DJ controllers expose faders and EQs as **MIDI Control Change**, not notes. The Map Note sidebar panel already binds **incoming note + channel** per row; there is no parallel binding for **incoming CC**, so recording from a CC-only fader is impossible. The Inspector output panel only edits **output pitch**, not CC number.

## Goals / Non-Goals

**Goals:**

- Emit **Control Change** for mixer continuous controls (EQ high/mid/low per channel, Ch1/Ch2 volume, crossfader) on playback, with value `0..127` from the action event’s normalized level (`vel`).
- Extend **`OutputMapping`** so each row can specify **output CC number** (and keep device + channel).
- Extend **`ActionMapEntry`** so each row can specify **incoming MIDI CC** (and channel) for record routing, orthogonal to the row’s timeline pitch.
- Update **Map Note** (input) and **Inspector Output** (output) UIs and the **recorder** + **scheduler** to respect these fields.
- Default or seed sensible **CC numbers** for the built-in mixer template actions so new sessions work without manual mapping.

**Non-Goals:**

- **High-resolution NRPN** or 14-bit CC; only 7-bit CC values.
- Changing **param lane** CC recording on instrument channels.
- Auto-sending CC `0` on transport stop for every mapped CC (could be a later polish).
- Remapping the **timeline row pitch** (action row key) — the row remains keyed by note pitch for editing; CC is an I/O overlay.

## Decisions

### 1. How playback chooses note vs CC

**Decision:** A DJ row uses **CC-out** when `track.outputMap[rowPitch].cc` is set to `0..127`. Absence of `cc` keeps the current note-on/off behavior (backward compatible for deck/FX rows and existing sessions).

**Alternatives considered:** Drive CC purely from `action.cat === 'mixer' && pad` without storing `cc` — rejected: users must retarget different hardware CC numbers. Inferring from `cat` only — rejected: same reason.

### 2. `OutputMapping` shape

**Decision:** Add optional `cc?: number` (clamped `0..127` at write boundaries). Keep existing `device`, `channel`, `pitch`. For CC-out rows, **`pitch` remains meaningful** as today for “default note” fallbacks where needed; the scheduler reads **`cc` for the byte stream** when present.

**Alternatives considered:** Discriminated union `mode: 'note' | 'cc'` — adds migration churn for one optional field.

### 3. Input binding for CC

**Decision:** Extend `ActionMapEntry` with optional `midiInputCc?: number` (0–127). When set, **note matching in `matchingDJActions` is bypassed for that row** in favor of CC matching on the same port/channel scope as today (`midiInputChannel`, `midiInputDeviceIds`). When unset, retain current note + `midiInputNote` behavior.

**Alternatives considered:** Separate `inputMode: 'note' | 'cc'` enum — redundant if `midiInputCc` presence implies CC mode.

### 4. Mapping CC events to `ActionEvent` duration

**Decision:** Mirror the note path: on **first CC value** after silence, open an active “gesture”; on **stable release** or **note-off-style** end, finalize `dur` from timestamps like note pairs. If the stream is purely CC (no pairs), treat **each discrete change** as a short event **or** span from previous value change to this one — implementation picks one consistent rule and tests lock it (prefer **pair last value change → this value change** window for fader moves).

**Alternatives considered:** One sample per CC message — poor for automation curves; defer to shortest useful duration.

### 5. Scheduler implementation shape

**Decision:** From the unified DJ dispatch branch, if `mapping?.cc != null`, call a small `emitControlChange(channelByte, cc, value, ts)` (optionally **two** sends at start/end of bar for “momentary” vs continuous — for faders, **single CC at event start** with `value = round(vel*127)` matches one-shot automation cells; if events have **duration** representing a sweep, emit **start and end** CC or interpolated — **MVP:** one CC at **start** with velocity-mapped value; **optional second** at end with last velocity if the UX needs sweep).

**Rationale:** Mixer clips are often short; matching note-on timing to a single CC is the minimal match to current `dur`-based blocks. Document in implementation tasks if we add end-of-bar CC.

**Alternatives considered:** Emit CC continuously across `dur` — needs sampling/resampling; out of scope for first slice.

### 6. Defaults for mixer template rows

**Decision:** In `DEFAULT_ACTION_MAP` **or** at seed time, set **recommended `cc` in `outputMap` defaults** only when we introduce the feature — or populate **documentation constants** (`MIXER_DEFAULT_CC_BY_ID`) applied when user first opens Inspector / on migration. Prefer **explicit defaults in data** for the nine mixer controls named in the proposal so `cc` is present without user action.

## Risks / Trade-offs

- **[Risk]** Users with old sessions expect **note** output from mixer rows → **Mitigation:** migration sets `cc` on load for mixer templates only, or we only default `cc` for **new** mappings; spec calls out backward compatibility when `cc` absent.
- **[Risk]** CC + note bindings both active on one row → **Mitigation:** spec: when `midiInputCc` is set, recorder ignores note match for that row (exclusive CC mode).
- **[Risk]** Panic flush does not reset CC sliders on hardware → **Mitigation:** document as known; optional follow-up sends CC 0.

## Migration Plan

1. Extend types and persistence (**no breaking JSON keys** — additive optional fields).
2. For existing projects, mixer rows without `outputMap[p].cc` continue **note** playback until user saves a mapping with CC or a one-time migration fills defaults.
3. Rollback: remove `cc` / `midiInputCc` reads and restore prior branches (feature-flag optional).

## Open Questions

- Exact **default CC numbers** per `id` (`ch1_eq_hi`, …) should align with a target surface (e.g. generic MIDI) or stay user-editable only with no universal default.
- Whether to emit **one** CC per clip or **start/end** pair for the bar graphic — confirm against auditory expectation in QA.
