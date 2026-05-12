## Why

Recording previously sent every captured note to `selectedChannelId` and ignored the MIDI channel byte on each message, so multi-timbral controllers and split keyboards could not be captured into separate internal channels. This change routes by incoming channel and can create missing channels on demand so the E2E record path matches how MIDI is addressed.

## What Changes

- Route note-on/note-off to internal channel `1 + (status0 & 0x0F)` (MIDI channel 0..15 → internal ids 1..16).
- **BREAKING**: `selectedChannelId` no longer gates or directs recording; the record button enables capture whenever MIDI input is available.
- Extend the active-note map to unique keys per `(midiChannelNibble, pitch)` so the same pitch on two channels does not collide.
- Add `addChannel(id, name?, color?)` (and empty roll) on `useChannels`; when a note arrives for an internal channel that does not exist, auto-create it before `appendNote`.
- Update `midi-recording`, `channels`, and `transport-titlebar` specs (delta files under this change).

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `channels`: `addChannel` on `useChannels`; `useStage` exposes `addChannel` for the recorder.
- `midi-recording`: Listener attach conditions drop `selectedChannelId`; routing uses MIDI channel byte; auto-create channel; composite active-note keys.
- `transport-titlebar`: Record button enablement depends only on MIDI input availability (no channel selection).

## Impact

- `src/midi/recorder.ts` — routing, keying, `addChannel` integration.
- `src/hooks/useChannels.ts` — `addChannel` reducer action and hook export.
- `src/hooks/useStage.tsx` — pass through `addChannel`.
- `src/components/titlebar/Titlebar.tsx` — record disabled logic without `selectedChannelId`.
- `openspec/specs/channels/spec.md`, `openspec/specs/midi-recording/spec.md`, `openspec/specs/transport-titlebar/spec.md` — delta files under the change.
