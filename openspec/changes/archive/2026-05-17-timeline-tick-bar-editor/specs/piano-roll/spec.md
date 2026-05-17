## ADDED Requirements

### Requirement: Notes expose tick timing and PianoRoll lays out from ticks

`Note` SHALL expose **`tTicks`** and **`durTicks`** as the authoritative start and duration. **`Note.t` / `Note.dur` in beats SHALL NOT persist** after migration completes.

`PianoRoll` geometry SHALL compute horizontal positions from ticks:

- `left = (tTicks - viewT0Ticks) * pxPerTick`
- `width = max(2, durTicks * pxPerTick)`

with **`pxPerTick = pxPerBeat / TPQ`** when retaining legacy **`pxPerBeat`** props, or an explicitly renamed equivalent.

The playhead SHALL use **`playheadTicks`** aligned to the same tick axis.

#### Scenario: Note width scales with durTicks

- **WHEN** `TPQ = 480`, `pxPerBeat = 60`, `durTicks = 480`, and `tTicks - viewT0Ticks = 0`
- **THEN** the rendered `.mr-note` width SHALL equal `max(2, 480 * (60/480))` px before other clamps

#### Scenario: Playhead uses tick timeline

- **WHEN** `playheadTicks = 240`, `viewT0Ticks = 0`, `viewSpanTicks = 7680` (16 beats × 480), and lane width matches the beat grid span
- **THEN** the `.mr-playhead` lane-x SHALL match `(240 / 7680) * laneWidth` within floating tolerance introduced only by CSS pixel rounding—not by beat-float drift
