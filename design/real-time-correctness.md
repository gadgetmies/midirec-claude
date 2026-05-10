# Real-time correctness — primary functional constraint

This document captures a cross-cutting constraint that applies to every slice, every capability, and every component in the MIDI Recorder. It is not specific to any one capability and is not yet expressed as a formal OpenSpec requirement (the audio engine that delivers these guarantees lives in Slice 10). This doc is the source of truth until that capability is written.

## Statement

**The MIDI Recorder is a real-time system. UI rendering load SHALL NOT interfere with MIDI message timing — at capture (recording) or at emit (playback).**

Three concrete guarantees follow from that statement:

1. **No dropped messages.** Every incoming MIDI message from a connected device SHALL be captured. A heavy re-render — for example, expanding a dj-action-track that lays out 28 placeholder rows, or paint-thrashing 600 piano-roll notes — SHALL NOT cause an incoming message to be missed. If a render takes 80ms and three notes arrive during it, all three notes SHALL be in the recorded session.

2. **No late playback.** Outbound MIDI messages SHALL be emitted at their scheduled time. A React reconciliation in flight at the scheduled emit time SHALL NOT delay the message until the next commit. The audio engine's clock — not React's render cycle — owns the timeline.

3. **No timestamp offset from UI load.** Recorded message timestamps SHALL reflect the time the device produced the message, not the time the JS runtime got around to processing the event after a render.

## Capture timestamping — two sources, both authoritative

Two distinct timing sources together determine when a captured message is recorded as having occurred. Both are MIDI-native; neither involves wall-clock readings inside React.

1. **Per-message driver timestamps.** Every incoming `MIDIMessageEvent` carries a `.timeStamp` field — a high-resolution time, anchored to the message's arrival at the driver, on the same monotonic clock as `performance.now()` (Web MIDI) or the platform equivalent (CoreMIDI / WinMM bindings). This is the timestamp used for ordering, for measuring inter-message intervals, and for the recorded "this happened at relative time T" field on every captured event. It is the *fine-grained* timing source: sub-millisecond, per-message.

2. **MIDI Clock (0xF8 sync stream).** When the recorder is slaved to (or recording from) a clock-emitting device — a DAW, a sequencer, a hardware controller producing 24 PPQN clock pulses — the MIDI Clock stream carries the *musical* timeline: tempo, beats, bars. Captured events SHALL be positioned in musical time (beats from session origin, the same `t` field already used in the data model — see `design/session-model.md`) by deriving from the clock stream, not by guessing tempo from inter-event gaps.

The combination matters. The driver timestamp gives you "*exactly* when the message landed, in absolute monotonic time." The MIDI Clock stream tells you "where that monotonic moment falls in the musical timeline." Together they let a captured note be recorded with both:

- A precise driver-time timestamp (for replay accuracy, jitter analysis, debugging).
- A musically meaningful `t` in beats (for editing, quantization, display, export).

What is NOT permitted as a capture timestamp source:

- ❌ `Date.now()` called inside a React event handler that responds to a MIDI message — gives wall-clock at handler invocation, which is *after* event-loop scheduling, *after* whatever else was running. Drifts under load.
- ❌ `performance.now()` called inside a React event handler — same problem; the value is the time of the call, not the time of the message.
- ❌ Tempo derived from inter-event intervals when a clock stream is available — clock-derived tempo is authoritative; deriving from gaps is only a fallback when the source has no clock.
- ❌ The audio engine's playback clock used to timestamp captured events — capture and playback are independent clocks. Round-tripping a captured event through the playback clock loses fidelity.

If a slice ships a UI surface that violates any of these — for example, a component that processes an incoming MIDI message inside its own render path, or a playback emitter that depends on a `useEffect` cycle, or a capture handler that records `t = Date.now()` — that's a bug, regardless of whether the audio engine is wired yet.

## Why this matters now (before Slice 10 wires the audio engine)

Slice 10 — "Statusbar + audio engine wiring" — is where MIDI capture and playback are actually plumbed. Before Slice 10, every visual slice (1–9, plus their sub-slices) is shipping without a real audio engine; the timestamps in the demo session are static, the playhead is a `useTransport` hook running on `performance.now()`, and "recording" is mocked.

It is tempting, while the audio engine is not yet present, to ship patterns that look fine for a static demo but foreclose the audio engine's eventual implementation. Examples of patterns to avoid:

- **MIDI handlers inside React event flow.** Don't write code that responds to `MIDIMessageEvent` from inside a component's `onMIDI` prop callback that triggers `setState`. The capture path needs to be outside React entirely — typically a worker, an `AudioWorklet`, or a non-React event listener that writes to a ring buffer.
- **Render-gated playback.** Don't write a playback engine that emits its next event by reading some `playheadT` from `useTransport` inside a `useEffect`. The playhead in `useTransport` is a *display* of the audio engine's time, not the source of it. The audio engine has its own clock.
- **Per-message React re-renders.** A React commit per incoming MIDI message will saturate the main thread at 1k+ messages/sec (e.g., a continuous CC stream). Capture writes to a buffer; the UI batches reads of that buffer at a sensible cadence (every animation frame, or every N ms).
- **`Date.now()` / `performance.now()` for timestamping.** These give the time at the moment of the JS call — which, for a `MIDIMessageEvent`, is *after* the message landed in the JS event queue and *after* whatever else was running finished. Use the event's own `.timeStamp` field (Web MIDI provides `DOMHighResTimeStamp` from the same clock as `performance.now()` but anchored to the message arrival, not the handler invocation). For musical-time positioning (the `t` field on captured notes, in beats from session origin), derive from the MIDI Clock stream when available — not from inter-event gap arithmetic and not from the playback engine's clock.

## Implications for visual-only slices

Even slices that don't touch capture or playback still need to keep this constraint in mind:

- **Heavy CSS layout / paint surfaces** (the dj-action-tracks introduced in 7a–7b, the future ActionRollUnit body in 7b with per-note inner pressure SVGs, the channel-grouped timeline with N piano rolls + M param lanes) MUST be implemented in a way that doesn't stall the main thread for so long that even a buffered MIDI capture path falls behind. Use `transform`-based scrolling instead of layout-triggering offsets; use SVG/canvas instead of dozens of DOM nodes for high-density surfaces; virtualize when the visible row count is unbounded.
- **State-update patterns** SHOULD be designed so that the eventual audio engine can publish ring-buffer reads into stage state without forcing a full app re-render per buffer flush. Today's `useStage` Context is fine for slow-changing state (channels, tracks, dialog open); for fast-changing state (playhead position, live MIDI activity meters) the eventual audio engine will need a separate channel — refs + manual subscribe/unsubscribe, an external event emitter, or a dedicated state store. Don't paint yourself into a corner where every fast update has to flow through `setState` on the root provider.

## Cross-references

- Captured as a paragraph in every relevant change's `design.md`.
- Will become a formal `real-time-correctness` capability spec when Slice 10 lands the audio engine — at that point the design doc here points to the capability.
- Affects the architectural decisions in `useStage`, `useTransport`, `useChannels`, `useDJActionTracks`, and any future capture/playback hook.

## Status

New — needs engineering review and design owner sign-off. The three guarantees above are non-negotiable; the implementation patterns are recommendations until Slice 10's audio-engine architecture review locks them in.
