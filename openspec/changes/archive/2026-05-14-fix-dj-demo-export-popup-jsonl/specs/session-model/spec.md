## MODIFIED Requirements

### Requirement: Session is an unbounded note stream

A **session** SHALL be modelled as an unbounded sequence of notes. There SHALL NOT be a session-length field, an end-time field, or any session-scope state that caps the time range. Any `Note` carrying `t >= 0` is a valid session note; the system makes no assumption that `t + dur` is below any threshold.

The de-facto session-length span endpoints, when needed (e.g., by the export dialog's `Whole session` range or other on-demand computations), SHALL be derived as the supremum `max(t_end)` across every timed layer in the orchestration baseline: `(n.t + n.dur)` for rolls, `(p.t)` for param lane samples, `(e.t + e.dur)` for DJ action events, analogous rules for future layers. When none of those datums exist along the temporal axis relevant to feature `F`, computations SHALL behave as-if the upper bound equals `0` for an empty spine. No code path SHALL store this supremum exclusively as authoritative session state—it remains derived.

#### Scenario: Note with large t value is a valid session note

- **WHEN** a `Note` is constructed with `t = 384` (i.e., 96 bars at 4 beats per bar) and `dur = 1`
- **THEN** the note SHALL be valid session data
- **AND** no part of the system SHALL reject, clamp, or truncate it on the basis of session length

#### Scenario: Empty session has length 0

- **WHEN** a session has neither notes nor lane points nor DJ action events spanning time
- **AND** an on-demand extent computation is performed matching the instrumentation layer under test
- **THEN** it SHALL behave as-if the supremum lacks positive extent (baseline `hi = 0` where applicable such as `[0,0)` export bounds)
