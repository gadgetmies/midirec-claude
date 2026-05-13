## MODIFIED Requirements

### Requirement: Marquee and selection are scoped to a single roll via selectedChannelId

The orchestrator owning render state (in the `channels` capability) SHALL track a `selectedChannelId: ChannelId | null` value. The marquee rectangle and `selectedIdx` (when non-empty) SHALL be passed only to the `PianoRoll` whose roll's `channelId === selectedChannelId`. All other rolls SHALL receive `marquee={null}` and `selectedIdx={[]}`.

When `selectedChannelId === null`, no roll receives a non-null marquee.

For **`demo=marquee`**, `selectedChannelId` SHALL default to `1` (the Lead channel), matching the prototype's behavior of showing the demo marquee on the first track only. **Instrument-seeded rolls are implied by this flag** (`demo=instrument` not required).

#### Scenario: Demo marquee shows on Lead only

- **WHEN** the app is loaded at `/?demo=marquee`
- **THEN** the `.mr-track` whose `channelId` is `1` (the Lead channel's roll) SHALL contain a `.mr-marquee` element
- **AND** no other roll's `.mr-track__roll` SHALL contain a `.mr-marquee` element

#### Scenario: Optional instrument + marquee behaves like marquee-only

- **WHEN** the app is loaded at `/?demo=instrument&demo=marquee`
- **THEN** the `.mr-track` whose `channelId` is `1` SHALL contain a `.mr-marquee` element
- **AND** no other roll's `.mr-track__roll` SHALL contain a `.mr-marquee` element

#### Scenario: Default load has no marquee on any roll

- **WHEN** the app is loaded at `/`
- **THEN** the rendered DOM SHALL contain zero `.mr-marquee` elements across all rolls
