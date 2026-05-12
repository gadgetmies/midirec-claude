## 1. Types and stage state

- [x] 1.1 Add `TrackInputListenRow` (and export from a single module used by `useChannels` / DJ hooks).
- [x] 1.2 Extend `Channel` with `inputSources: TrackInputListenRow[]`; default `[]` on seeds and `addChannel`.
- [x] 1.3 Extend `DJActionTrack` with `inputSources`; default `[]` on seed data.
- [x] 1.4 Add `selectedTimelineTrack` + `setSelectedTimelineTrack` to `useStage`; wire header clicks on channel track and DJ track (`ChannelGroup` / `DJActionTrack`).

## 2. Channel and DJ actions

- [x] 2.1 Implement `setChannelInputSourceChannels` (and optional `removeChannelInputDevice`) on `useChannels` / `useStage`.
- [x] 2.2 Implement `setDJTrackInputSourceChannels` and `appendDJActionEvent` on DJ tracks / `useStage`.

## 3. Sidebar UI

- [x] 3.1 Create `TrackInputMappingPanel.tsx` listing `useMidiInputs().inputs` with per-device enable + CH1–CH16 toggles; bind to selection and setters.
- [x] 3.2 Mount the panel in `Sidebar.tsx` with ordering per spec; empty-state hint when no timeline track selected.
- [x] 3.3 Add minimal styles in `Sidebar.css` (reuse `.mr-row`, `.mr-chip`, or compact grid).

## 4. Recorder

- [x] 4.1 Compute union `S` of configured `inputDeviceId` values; subscribe single-input fallback when `S` empty.
- [x] 4.2 Attach handlers to each port in `S` while recording; chain `prev` handlers; restore on cleanup.
- [x] 4.3 Change active-note key to include `portId`; update finalize / note-off lookup.
- [x] 4.4 Implement `(portId, midiChannel)` → instrument `channelId` override; preserve legacy path when no row matches.
- [x] 4.5 Implement DJ path: match DJ `inputSources`, `appendDJActionEvent` on note-off; resolve conflicts per `design.md`.

## 5. Verification

- [x] 5.1 `yarn typecheck` and `yarn test` clean.
- [x] 5.2 `openspec validate per-track-input-mapping --strict --type change` clean.
