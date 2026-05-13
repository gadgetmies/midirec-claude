## ADDED Requirements

### Requirement: Timeline layout horizon derives from session extent

The session orchestration SHALL compute a non-negative `layoutHorizonBeats` exported to `.mr-timeline`-hosted renderers (`Ruler`, every `ChannelGroup` descendant lane surface, DJ action bodies). Its value SHALL be at least:

1. An implementation-defined baseline window (backward-compatible with seeded fixtures that short sessions).
2. The smallest integer beat ceiling spanning every session datum that carries an end-coordinate in beats (`max(n.t + n.dur)` across notes per channel roll and DJ events, `max(p.t)` across param lane `points`, analogous rules for every future streamed layer).
3. A non-negative trailing padding measured in beats so users can overdub slightly past material without immediate reflow starvation.

Implementations MAY round up to coarse bar multiples for ergonomics.

`layoutHorizonBeats` SHALL grow whenever new events push session extent beyond the prior horizon minus padding logic; shrinking is NOT required unless a dedicated trimming slice removes data.

#### Scenario: Quiet session retains minimum horizon

- **WHEN** all rolls, lanes, and DJ tracks carry no temporal data beyond seeded defaults whose extent is strictly below the baseline horizon
- **THEN** `layoutHorizonBeats` SHALL equal the baseline horizon expressed in beats (not degenerate toward zero scroll width unless UI explicitly collapses timelines)

#### Scenario: Long note lengthens horizon

- **WHEN** a roll holds a note with `t = 0`, `dur = 64`
- **THEN** `layoutHorizonBeats` SHALL be not less than the ceiling mandated by deriving from that note endpoint plus mandated padding constants
