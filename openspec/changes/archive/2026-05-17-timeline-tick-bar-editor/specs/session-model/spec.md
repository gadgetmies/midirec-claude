## REMOVED Requirements

### Requirement: Session-time uses beats, clock-time uses milliseconds

**Reason:** Musical session coordinates migrate to integer MIDI ticks at session TPQ.

**Migration:** Replace authoritative beat fields with `tTicks` / `durTicks`; convert legacy with `round(beats * TPQ)`. Transport converts `timecodeMs` ↔ playhead ticks in a single hook boundary.

### Requirement: LoopRegion is `{start, end}` in beats with `end > start`

**Reason:** Loop endpoints are stored as tick integers.

**Migration:** Use `{ startTicks, endTicks }` with `endTicks > startTicks`; migrate from beat pairs via rounding.

### Requirement: Renderer view window is `[viewT0, viewT0 + totalT]`

**Reason:** View edges are tick addresses.

**Migration:** Express visible span as tick origin + tick width (`viewT0Ticks`, `viewSpanTicks` or equivalent); derive legacy beat window only for transitional tests.

### Requirement: Loop markers render at session-time positions inside the view window

**Reason:** Marker placement formulas SHALL use tick-derived lane coordinates.

**Migration:** Reimplement `(endpointTicks - viewT0Ticks) * pxPerTick`.

### Requirement: Timeline layout horizon derives from session extent

**Reason:** Horizon SHALL cover supremum of tick endpoints.

**Migration:** Replace `layoutHorizonBeats` with `layoutHorizonTicks` (or same name with tick semantics); compute ceiling in ticks from `max(tTicks + durTicks)` across layers.

## ADDED Requirements

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
