## Why

The just-archived `web-midi-access` change gave the app live `MIDIAccess`, real input/output devices, and a permission UX. The app can now *see* hardware but still captures nothing — every channel's notes today are seeded fixtures, and no listener is attached to `MIDIInput.onmidimessage`. This change closes the recording half of the end-to-end loop: with a real input selected and the record button armed, notes played on the device appear in the active channel's piano roll in real time. Playback (the third E2E slice) is a separate follow-up and is **not** in scope here.

Single-channel routing only in this slice — every captured note lands in `selectedChannelId`. Multi-channel routing by the incoming MIDI channel byte is its own backlog item (slice 5) and would conflict with shipping recording today; a deliberate `selectedChannelId`-only contract here keeps the surface small and lets the user start capturing immediately.

## What Changes

- `useTransport` gains a `recordingStartedAt: number | null` field on `TransportState`, populated when the transport enters `'record'` mode (set to `performance.now()`), cleared when it leaves. The existing `recording: boolean` / `record()` / `stop()` API is preserved — no `isRecording` rename, no new `startRecording`/`stopRecording` actions. The recording-time origin is exposed so the recorder can compute event times in beats relative to the start of the take.
- `useChannels` gains an `appendNote(channelId, note)` action that appends a single `Note` to the matching `PianoRollTrack`. No-op if the channel has no roll record (this slice does not auto-create rolls; the channels-affordances backlog entry owns that).
- New module `src/midi/recorder.ts` exposes a `MidiRecorder` React hook (`useMidiRecorder()`) and supporting wiring. The hook subscribes to the **currently selected** `MIDIInput.onmidimessage` while `recording === true` and `selectedInputId` is non-null. On each note-on (`status 0x90..0x9F`, velocity > 0) it opens an active-note entry keyed by `pitch`; on the matching note-off (`0x80..0x8F` or note-on with velocity 0) it finalizes the entry and dispatches `appendNote(selectedChannelId, note)`. Listener attaches/detaches based on `(selectedInputId, recording)` transitions — no leaks across input switches or record cycles.
- Hung-note handling: when `recording` transitions to `false` (via `stop()` or `pause()` or user un-arming), every still-open active-note entry is finalized with `dur = now − noteStartedAt` clamped to the current timecode, and emitted before the listener detaches.
- Render-thrash guard: the recorder coalesces multiple `appendNote` dispatches arriving within one animation frame into a single render commit. Implementation: a `requestAnimationFrame`-scheduled flush queue inside the recorder. Reducer-level batching is intentionally NOT required (the burden lives in the recorder, keeping `useChannels` simple).
- Statusbar `MIDI IN` LED activity flag (`useStatusbar().active`) continues to pulse on any inbound message (existing behavior); this change does not alter that contract but the recorder's listener does NOT replace whatever message tap drives the LED — the LED feed and the recording feed coexist as independent subscribers to `onmidimessage` on the same `MIDIInput`.
- Record button disabled-state contract (Titlebar): disabled when `selectedInputId == null` (tooltip: `No input device selected`) or when `selectedChannelId == null` (tooltip: `Select a channel to record into`). When enabled and unarmed, click invokes `record()` as today.
- CC, pitch-bend, aftertouch capture is **out of scope** (separate backlog item: "CC and pitch-bend capture during recording"). The recorder ignores `0xB0..0xBF`, `0xE0..0xEF`, and `0xA0..0xAF`/`0xD0..0xDF` in this slice.

## Capabilities

### New Capabilities

- `midi-recording`: live MIDI input capture — recorder hook lifecycle, note-on/note-off matching, hung-note finalization, render-thrash coalescing, and the `selectedChannelId`-only routing contract. This is a new capability (no existing spec covers recorder semantics); `midi-runtime` owns *device enumeration*, `transport-titlebar` owns the *button and mode*, `channels` owns the *data shape*. `midi-recording` is the glue that turns inbound `MIDIMessageEvent`s into appended notes, and it has its own behaviors worth specifying separately (active-note map, channel-byte-ignored routing, hung-note semantics, frame-coalesced dispatch).

### Modified Capabilities

- `transport-titlebar`: extend `useTransport` to expose `recordingStartedAt: number | null` with the entry/exit semantics described above. Disabled-state requirements for the record button gain two scenarios (no input selected, no channel selected). The `data-rec` / `data-on` rendering rules and the pulsing-glow visual are unchanged.
- `channels`: add an `appendNote(channelId, note)` action requirement on `useChannels`, including the no-op-on-unknown-channel semantics and referential-identity preservation for unchanged rolls.

## Impact

- **Affected code**:
  - `src/hooks/useTransport.tsx` — add `recordingStartedAt` to state + reducer; populate on `record`, clear on `stop`/`pause`.
  - `src/hooks/useChannels.ts` — add `appendNote` action + reducer branch.
  - `src/midi/recorder.ts` (new) — `useMidiRecorder` hook with listener lifecycle, active-note map, frame-coalesced dispatch.
  - `src/App.tsx` — mount the recorder hook once at the top level (alongside the existing providers) so its lifecycle is process-wide.
  - `src/components/transport-titlebar/Titlebar.tsx` (or equivalent) — wire record-button disabled state to `selectedInputId` / `selectedChannelId`; add tooltips.
- **Dependencies**: no new npm packages. Uses the existing `MIDIAccess` exposed by `midi-runtime` and the existing `useStage().selectedChannelId`.
- **Out of scope** (each its own backlog item): playback scheduler, multi-channel record routing, CC/PB capture, per-channel record arm, auto-add of channels on unknown incoming channel byte, panic on record-stop.
- **No spec deletions**. Two existing capabilities pick up additive requirements; one new capability lands.
- **Risk**: `MIDIInput.onmidimessage` is a single-slot handler in some browser implementations. The recorder MUST chain through any previously-installed handler (or document that the recorder owns the slot for the duration of recording). Design decision lives in `design.md`.
