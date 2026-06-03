## ADDED Requirements

### Requirement: Recorder skips messages matching an active control mapping

The recorder SHALL, while recording, consult the active control mapping via the
`matchesActiveMapping` predicate exposed by `controlMap.ts` before routing or
capturing an inbound message, and SHALL skip (not capture) any message that
matches an active mapping. Messages that match no active mapping SHALL be routed
and captured exactly as before.

This ensures a control assigned to transport/settings is consumed by control
mapping and never lands in a recorded take.

#### Scenario: Mapped control is not recorded

- **WHEN** recording is active and an inbound message matches an active control mapping
- **THEN** the recorder does not capture that message into any track

#### Scenario: Unmapped message still recorded

- **WHEN** recording is active and an inbound message matches no active control mapping
- **THEN** the recorder routes and captures it as it does today
