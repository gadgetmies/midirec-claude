# session-model Specification

## Purpose
Conceptual model of a session: an unbounded note stream with optional user-defined loop markers that wrap playback. Session length is derived on demand (`max(n.t + n.dur)`), never stored as state.
## Requirements
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

### Requirement: Session musical coordinates use integer MIDI ticks at TPQ

All persisted musical timing that denotes **horizontal timeline position or duration** SHALL use **non-negative integers** on the **session MIDI tick axis** at **`DEFAULT_MIDI_TPQ`** until a session PPQ setting exists.

This SHALL apply at minimum to: **`Note.tTicks`**, **`Note.durTicks`**, **`ActionEvent.tTicks`**, **`ActionEvent.durTicks`**, **`CCPoint.tTicks`**, **`Marquee`** horizontal bounds, **`LoopRegion`** endpoints, piano-roll **scroll/view** extents, **layout horizon**, **DJ pressure** sample times when stored, and any future timed layer documented in `session-model`.

**Beats SHALL NOT** be written as authoritative placement when saving edited clips; UI MAY still display bar/beat/tick by decoding ticks.

The supremum session extent SHALL derive from tick endpoints: e.g. `max(tTicks + durTicks)` across notes and DJ events, `max(tTicks)` for point streams, using the same layering rule as the prior beat-based supremum.

#### Scenario: Note addressing uses ticks

- **WHEN** a `Note` is persisted after migration with `tTicks = 184320` at `TPQ = 480`
- **THEN** it SHALL represent start time **exactly** on that tick lattice
- **AND** SHALL NOT rely on a parallel floating `t` in beats as source of truth

### Requirement: Transport boundary converts milliseconds to playhead ticks

Clock-driven playback SHALL convert **`TransportState.timecodeMs`** to **`playheadTicks`** (rounded or snapped per product rules) in **one module**. Components that render playheads or schedule clips SHALL read **ticks**, not floating beats, from stage/transport for timeline alignment.

#### Scenario: Single conversion site

- **WHEN** layout needs the current playhead X position on the timeline
- **THEN** it SHALL obtain tick-aligned coordinates derived from the transport boundary conversion
- **AND** SHALL NOT re-derive floating beat playheads independently in scattered modules

