## MODIFIED Requirements

### Requirement: Channel data shape

The codebase SHALL define a `Channel` interface with the following shape, exported from `src/hooks/useChannels.ts`:

```ts
type ChannelId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;

type TrackInputListenRow = { inputDeviceId: string; channels: ChannelId[] };

interface Channel {
  id: ChannelId;       // 1..16, immutable
  name: string;        // display name (e.g. "Lead")
  color: string;       // CSS color string (used as channel swatch)
  collapsed: boolean;  // when true, hides roll + param lanes; only channel header renders
  muted: boolean;      // channel-level mute (independent of roll/lane M/S)
  soloed: boolean;     // channel-level solo (independent of roll/lane M/S)
  inputSources: TrackInputListenRow[]; // Web MIDI input devices + MIDI channels 1–16 to listen to when recording into this channel
}
```

`Channel.id` SHALL be a numeric MIDI channel index in the range 1–16. The system SHALL NOT permit duplicate ids in a single session.

Newly created channels SHALL default `inputSources` to `[]` (legacy recorder single-input + wire-channel routing applies until the user configures rows).

#### Scenario: Channel id is numeric 1..16

- **WHEN** code constructs a `Channel` value
- **THEN** the `id` field SHALL be a number in the inclusive range `[1, 16]`
- **AND** the value SHALL NOT be a string like `"CH 1"`

#### Scenario: Channel carries M/S and collapse independently

- **WHEN** a `Channel` is constructed
- **THEN** the value SHALL have all fields (`id`, `name`, `color`, `collapsed`, `muted`, `soloed`, `inputSources`) populated
- **AND** the `muted` and `soloed` fields SHALL NOT be derived from any `PianoRollTrack` or `ParamLane` state

## ADDED Requirements

### Requirement: useChannels exposes channel input source setters

`useChannels()` SHALL expose actions to mutate `inputSources` for a channel: `setChannelInputSourceChannels(channelId: ChannelId, inputDeviceId: string, channels: ChannelId[])`, which SHALL upsert a row for `inputDeviceId` (replacing its `channels` set) and SHALL remove the row when `channels` is empty. Implementations MAY provide `removeChannelInputDevice(channelId, inputDeviceId)` as a convenience.

#### Scenario: Upsert replaces prior channels for the same device

- **GIVEN** channel `1` had `{ inputDeviceId: 'a', channels: [1] }`
- **WHEN** `setChannelInputSourceChannels(1, 'a', [2, 3])` is called
- **THEN** the row for `'a'` SHALL read `[2, 3]`
