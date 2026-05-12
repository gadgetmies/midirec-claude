## 1. Channels state and API

- [x] 1.1 Add `channel/add` reducer action and `addChannel` on `useChannels` (palette, sort, idempotent insert + empty roll)
- [x] 1.2 Expose `addChannel` on `useStage` and `StageState`

## 2. Recorder

- [x] 2.1 Remove `selectedChannelId` gating; attach listener whenever recording + input + granted access
- [x] 2.2 Route by `(status & 0x0F) + 1`; composite active-key; `flushSync` around `addChannel` when channel missing; finalize note-offs using message channel nibble

## 3. Titlebar

- [x] 3.1 Enable record when `inputs.length > 0` only (no `selectedChannelId`); `record()` on click

## 4. Verification

- [x] 4.1 `yarn typecheck` and `yarn test` clean
- [x] 4.2 `openspec validate multi-channel-record-routing --strict --type change` clean
