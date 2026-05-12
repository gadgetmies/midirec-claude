## MODIFIED Requirements

### Requirement: useChannels hook is the single source of session organization

The codebase SHALL expose a `useChannels()` hook at `src/hooks/useChannels.ts` returning:

```ts
interface UseChannelsReturn {
  channels: Channel[];
  rolls: PianoRollTrack[];
  lanes: ParamLane[];
  toggleChannelCollapsed: (id: ChannelId) => void;
  toggleChannelMuted: (id: ChannelId) => void;
  toggleChannelSoloed: (id: ChannelId) => void;
  addChannel: (channelId: ChannelId, name?: string, color?: string) => void;
  toggleRollCollapsed: (channelId: ChannelId) => void;
  toggleRollMuted: (channelId: ChannelId) => void;
  toggleRollSoloed: (channelId: ChannelId) => void;
  toggleLaneCollapsed: (channelId: ChannelId, kind: ParamLaneKind, cc?: number) => void;
  toggleLaneMuted: (channelId: ChannelId, kind: ParamLaneKind, cc?: number) => void;
  toggleLaneSoloed: (channelId: ChannelId, kind: ParamLaneKind, cc?: number) => void;
  addParamLane: (channelId: ChannelId, kind: ParamLaneKind, cc?: number) => void;
  appendNote: (channelId: ChannelId, note: Note) => void;
}
```

`useChannels` SHALL replace `useTracks` and `useCCLanes`. The hooks `useTracks` and `useCCLanes` SHALL NOT be present in the codebase; no compatibility shim SHALL exist.

`addChannel(id, name?, color?)` SHALL insert a new `Channel` with `collapsed: false`, `muted: false`, `soloed: false`, `name` defaulting to `"CH " + id`, `color` defaulting to a deterministic palette value, and SHALL insert a matching `PianoRollTrack` with empty `notes`. If a channel with `id` already exists, the call SHALL be a no-op.

`addParamLane(channelId, kind, cc?)` (renamed from `addCCLane`) SHALL append a new `ParamLane` under the matching channel with `points: []`, `muted: false`, `soloed: false`, `collapsed: false`, and a `name` derived from the kind (and CC number for `kind === 'cc'`). If a lane with the same `(channelId, kind, cc)` triple already exists, the call SHALL be a no-op.

`appendNote(channelId, note)` SHALL append the `note` argument to the `notes` array of the `PianoRollTrack` whose `channelId` matches. If no roll exists for that channel, the call SHALL be a no-op (auto-creating rolls is owned by `addChannel` or the session seed). The action SHALL preserve referential identity for every unchanged roll record — only the targeted roll's reference changes. The action SHALL also preserve referential identity for unchanged channels and lanes arrays.

Toggle actions SHALL flip the corresponding boolean. Calling a toggle with an unknown `(channelId, kind, cc)` triple SHALL be a no-op. Toggle actions SHALL preserve referential identity for unchanged records (the React reconciler relies on `Object.is` equality to skip rerenders).

#### Scenario: useTracks and useCCLanes are removed

- **WHEN** the codebase is grepped for `useTracks` or `useCCLanes` exports
- **THEN** the search SHALL return zero matches in `src/hooks/`
- **AND** no source file SHALL import from `src/hooks/useTracks` or `src/hooks/useCCLanes`

#### Scenario: addCCLane identifier is fully replaced by addParamLane

- **WHEN** the codebase is grepped for `addCCLane`
- **THEN** the search SHALL return zero matches in `src/`
- **AND** the renamed function `addParamLane` SHALL be the single insertion path

#### Scenario: Toggle actions flip the targeted boolean

- **WHEN** `toggleChannelMuted(1)` is called and the prior `channels[ch1].muted === false`
- **THEN** the next render SHALL have `channels[ch1].muted === true`
- **AND** unchanged channels SHALL retain referential identity (`Object.is(prev[chN], next[chN])` for `chN ≠ 1`)

#### Scenario: addParamLane is idempotent on duplicate (channelId, kind, cc)

- **WHEN** `addParamLane(1, 'cc', 1)` is called twice in succession
- **THEN** the resulting `lanes` array SHALL contain exactly one matching lane (channel 1, kind 'cc', cc 1)
- **AND** the second call SHALL be a no-op (returned arrays referentially identical to post-first-call state)

#### Scenario: addParamLane on a channel with existing notes keeps the channel rendered

- **WHEN** the session has `channel 1` with `roll.notes.length === 22` and zero existing param lanes
- **AND** `addParamLane(1, 'cc', 1)` is called
- **THEN** the channel SHALL remain rendered (it had notes before; the new empty lane does not change visibility)
- **AND** the new lane SHALL appear in the channel's lane list with `points: []`

#### Scenario: appendNote pushes a note onto the matching roll

- **GIVEN** the session has channel 1 with `roll.notes.length === 22`
- **WHEN** `appendNote(1, { t: 5, dur: 1, pitch: 60, vel: 90 })` is called
- **THEN** the next render SHALL have `rolls.find(r => r.channelId === 1).notes.length === 23`
- **AND** the appended note SHALL be the last entry in that roll's `notes` array
- **AND** the roll for channel 2 SHALL retain referential identity (`Object.is(prev, next) === true`)

#### Scenario: appendNote on a channel with no roll is a no-op

- **GIVEN** a hypothetical channel 5 exists in `channels` but has no entry in `rolls`
- **WHEN** `appendNote(5, { t: 0, dur: 1, pitch: 60, vel: 100 })` is called
- **THEN** the `rolls` array SHALL be referentially unchanged
- **AND** no entry SHALL be added for channel 5

#### Scenario: appendNote preserves referential identity of unchanged rolls

- **GIVEN** the session has two rolls (channel 1, channel 2)
- **WHEN** `appendNote(1, note)` is called
- **THEN** `Object.is(prev.rolls[1], next.rolls[1])` SHALL be `false` (channel 1 roll changed)
- **AND** `Object.is(prev.rolls[2], next.rolls[2])` SHALL be `true` for the channel 2 roll (unchanged)
- **AND** `Object.is(prev.channels, next.channels)` SHALL be `true`
- **AND** `Object.is(prev.lanes, next.lanes)` SHALL be `true`

#### Scenario: addChannel inserts channel and empty roll

- **GIVEN** the session has channels `[1, 2]` only
- **WHEN** `addChannel(5)` is called
- **THEN** the next `channels` list SHALL include `id === 5`
- **AND** the next `rolls` list SHALL include `{ channelId: 5, notes: [] }`

#### Scenario: addChannel is idempotent

- **WHEN** `addChannel(1)` is called on the default seeded session
- **THEN** the state SHALL be unchanged (`channels` length still 2)

## ADDED Requirements

### Requirement: Stage exposes addChannel for recorder

`useStage()` SHALL expose `addChannel` by delegating to the underlying `useChannels()` instance.

#### Scenario: Recorder path uses stage addChannel

- **WHEN** `useStage().addChannel(6)` is called
- **THEN** the session `channels` and `rolls` SHALL update per `useChannels.addChannel`
