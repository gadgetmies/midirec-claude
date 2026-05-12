## Context

`useMidiRecorder` previously gated capture on `selectedChannelId`, routed every note to that channel, and keyed the active-note map by pitch only. The BACKLOG item “Multi-channel record routing by incoming MIDI channel byte” extends recording after the E2E core. `useChannels` had no `addChannel`; rolls were seeded only for channels 1 and 2.

## Goals / Non-Goals

**Goals:**

- Map incoming MIDI channel nibble `(status & 0x0F)` to internal `ChannelId` `1..16` via `+ 1`.
- Key active notes by `(midiChannelNibble, pitch)` so two channels can hold the same pitch concurrently.
- When a message targets a missing internal channel, insert channel + empty roll via `addChannel`, then capture.
- Relax Titlebar record button: require MIDI input only.

**Non-Goals:**

- Per-channel or per-track record arming UI or state.
- Input-device–specific mapping rules (separate backlog entry).
- CC / pitch-bend capture.
- Changing `visibleChannels` / `channelHasContent` (auto-added empty channel may stay hidden until it has notes — acceptable for this slice; user sees new data after first capture).

## Decisions

- **`addChannel` ownership**: Implemented in `useChannels` reducer (minimal shape: channel + empty roll). Recorder calls it through `useStage` so the runner stays provider-correct.
- **Composite map key**: String `${midiCh}:${pitch}` in a `Map` for stable lookups without tuple polyfill.
- **Internal id derivation**: `ChannelId = (status0 & 0x0f) + 1`; matches backlog “chanByte + 1” with Web MIDI’s 0-based channel in the low nibble.
- **State flush for auto-add**: `flushSync` around `addChannel` inside the MIDI handler so `useReducer` state is visible before continuing the same callback.

## Risks / Trade-offs

- **[Risk]** Empty auto-created channel not in `visibleChannels` until content — **Mitigation**: acceptable; aligns with current visibility predicate until explicit-membership backlog lands.
- **[Risk]** `selectedChannelId` still used for piano-roll marquee/Inspector demos — **Mitigation**: recording no longer depends on it; no change to demo selection semantics in this slice.

## Migration Plan

Single app deploy; no data migration (in-memory session).

## Open Questions

_(none)_
