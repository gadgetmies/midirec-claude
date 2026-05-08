### Requirement: Session is an unbounded note stream

A **session** SHALL be modelled as an unbounded sequence of notes. There SHALL NOT be a session-length field, an end-time field, or any session-scope state that caps the time range. Any `Note` carrying `t >= 0` is a valid session note; the system makes no assumption that `t + dur` is below any threshold.

The de-facto session length, when needed (e.g., by the export dialog's `Whole session` range), SHALL be computed on demand as `max(n.t + n.dur) for n in notes`, with `0` returned for an empty session. No code path SHALL store this value as state.

#### Scenario: Note with large t value is a valid session note

- **WHEN** a `Note` is constructed with `t = 384` (i.e., 96 bars at 4 beats per bar) and `dur = 1`
- **THEN** the note SHALL be valid session data
- **AND** no part of the system SHALL reject, clamp, or truncate it on the basis of session length

#### Scenario: Empty session has length 0

- **WHEN** a session has no notes
- **AND** an on-demand session-length computation is performed
- **THEN** the computation SHALL return `0`

### Requirement: Session-time uses beats, clock-time uses milliseconds

All session-scope time values — `Note.t`, `Note.dur`, `LoopRegion.start`, `LoopRegion.end`, `viewT0`, `totalT` — SHALL be in **beats**. All transport-clock state — `TransportState.timecodeMs` — SHALL be in **milliseconds**. Conversion between the two units SHALL occur in exactly one place: the transport hook's playhead-derivation logic.

A "beat" is a quarter-note in the current time signature, scaled by `bpm`. At 124 BPM, one beat = `60000 / 124 ≈ 483.87ms`. The conversion formula is `beats = (timecodeMs / 1000) * (bpm / 60)`.

#### Scenario: Session-time values are dimensionally beats

- **WHEN** any code path reads or writes `Note.t`, `Note.dur`, `LoopRegion.start`, `LoopRegion.end`, `viewT0`, or `totalT`
- **THEN** the value SHALL be interpreted as beats
- **AND** the value SHALL NOT carry unit-suffix encoding (no `_ms`, no `_s`, no `_beats` suffixes — the unit is conventional)

#### Scenario: Conversion happens at the transport boundary only

- **WHEN** the transport hook computes the playhead position from `timecodeMs`
- **THEN** it SHALL convert ms → beats once, in one place
- **AND** downstream consumers (renderer, hooks reading playhead) SHALL receive the value in beats

### Requirement: LoopRegion is `{start, end}` in beats with `end > start`

A `LoopRegion` value SHALL be an object `{ start: number; end: number }` where both endpoints are session-time beat values. The invariant `end > start` SHALL hold whenever the value is non-null. A null `LoopRegion` SHALL represent "no loop region defined" — distinct from "loop region defined but inactive" (the latter is expressed by `looping: false` with `loopRegion != null`).

#### Scenario: Valid loop region

- **WHEN** a `LoopRegion` is constructed with `start = 4, end = 12`
- **THEN** the value SHALL be valid

#### Scenario: Null is the absence of a loop region

- **WHEN** no loop region has been set on the session
- **THEN** the `loopRegion` SHALL be `null`
- **AND** the value SHALL NOT be a sentinel object like `{ start: 0, end: 0 }`

#### Scenario: end <= start is invalid

- **WHEN** code attempts to set a loop region with `start = 8, end = 8` or `start = 8, end = 4`
- **THEN** the implementation SHALL either reject the call or normalise it (e.g., swap so end > start), but SHALL NOT store a region with `end <= start`

### Requirement: Renderer view window is `[viewT0, viewT0 + totalT]`

The piano-roll renderer SHALL be parametrised by a view window expressed as `(viewT0: number, totalT: number)` in beats. The window represents the visible time range; notes with `[n.t, n.t + n.dur)` entirely outside `[viewT0, viewT0 + totalT]` SHALL not render. Notes that overlap the window edges SHALL render at their natural positions, with off-window portions clipped by the lane area's `overflow: hidden`.

`totalT` is the **window length**, NOT the session length. The two values are unrelated — a session of 100 beats may be viewed through a 16-beat window starting at any `viewT0`.

`viewT0 = 0` is the default for backward compatibility with current Slice-2 behavior, where the view window starts at session time 0.

#### Scenario: Notes outside the window are not rendered

- **WHEN** the renderer has `viewT0 = 32, totalT = 16` (showing beats 32–48)
- **AND** the notes include one at `t = 4, dur = 1`
- **THEN** that note SHALL NOT appear in the rendered output

#### Scenario: Notes overlapping the left edge render

- **WHEN** the renderer has `viewT0 = 32, totalT = 16`
- **AND** a note has `t = 30, dur = 4` (starts before the window, ends inside it)
- **THEN** the note SHALL render at left position `(30 - 32) * pxPerBeat = -2 * pxPerBeat`
- **AND** the off-window portion SHALL be clipped by the lanes' `overflow: hidden`

### Requirement: Loop markers render at session-time positions inside the view window

When a non-null `LoopRegion` is provided to the renderer, vertical loop markers SHALL be rendered for whichever endpoints fall inside `[viewT0, viewT0 + totalT]`. Each visible marker SHALL be:

- A 1px vertical line in `var(--mr-loop)` spanning the lane area's full height.
- Absolute-positioned at lane-coordinate `(endpoint - viewT0) * pxPerBeat`.
- A bracket glyph cap distinguishing the two endpoints: `[` (left-bracket) for the start endpoint, `]` (right-bracket) for the end endpoint, drawn in `var(--mr-loop)`.

A matching marker SHALL appear on the Ruler row at the same x-coordinate, so the user can locate loop boundaries from either the lane area or the ruler.

When both endpoints are visible (or one is visible and the other is in-window-direction off-screen), a faint translucent tint `color-mix(in oklab, var(--mr-loop) 6%, transparent)` SHALL fill the inter-marker region across the full lane height, communicating the loop *region* in addition to the two boundary lines.

When the loop region is entirely outside the view window, no markers and no tint SHALL render.

#### Scenario: Both loop endpoints inside the view window

- **WHEN** `viewT0 = 0, totalT = 16, loopRegion = {start: 4, end: 12}`
- **THEN** the renderer SHALL display two vertical loop markers at lane-x positions `4 * pxPerBeat` and `12 * pxPerBeat`
- **AND** a matching marker pair SHALL appear on the Ruler at the same x positions
- **AND** the inter-marker region SHALL be tinted with the loop-region color

#### Scenario: Loop region entirely outside the view window

- **WHEN** `viewT0 = 0, totalT = 16, loopRegion = {start: 32, end: 48}`
- **THEN** the renderer SHALL render no `.mr-loop-marker` elements
- **AND** SHALL render no inter-marker tint

#### Scenario: Loop start visible, loop end past the right edge

- **WHEN** `viewT0 = 0, totalT = 16, loopRegion = {start: 8, end: 24}`
- **THEN** the renderer SHALL display the start marker at lane-x `8 * pxPerBeat`
- **AND** SHALL display no end marker (the end is past the window)
- **AND** SHALL extend the inter-marker tint from the start position to the right edge of the lane area
