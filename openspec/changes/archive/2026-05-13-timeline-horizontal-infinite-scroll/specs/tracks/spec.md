## ADDED Requirements

### Requirement: Tracks pass layout horizon to PianoRoll shells

`<Track>` (open + collapsed modes) SHALL forward `layoutHorizonBeats` from `ChannelGroup`/App orchestration into `<PianoRoll>` / `<Minimap>` widths so stripe vs minimap extents stay contiguous with ruler math.

#### Scenario: PianoRoll subtree receives propagated horizon prop

- **WHEN** `ChannelGroup` supplies `layoutHorizonBeats` larger than inherited `totalT`
- **THEN** `PianoRoll` mounted inside that channel SHALL consume the wider stripe width derived from horizon while respecting view-window clipping rules
