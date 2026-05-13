## ADDED Requirements

### Requirement: ChannelGroup propagates orchestrated horizon

`<ChannelGroup>` SHALL accept `layoutHorizonBeats` from `AppShell` and propagate it verbatim to `<Track>` and `<ParamLane>` children so intra-channel vertical stacks stay coherent.

#### Scenario: Multi-lane stacks share horizon

- **WHEN** `layoutHorizonBeats` increases beyond previous render
- **THEN** subsequent paint frames SHALL widen every lane row uniformly without desynchronizing horizontally nested sticky headers
