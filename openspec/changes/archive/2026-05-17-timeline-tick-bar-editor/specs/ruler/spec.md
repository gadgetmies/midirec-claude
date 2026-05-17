## ADDED Requirements

### Requirement: Ruler and timeline ticks align to tick grid

The `Ruler` (and shared timeline strip backgrounds) SHALL subdivide and label using **`layoutHorizonTicks`**, **`viewT0Ticks`**, and **`pxPerTick`** (or derived equivalents) so vertical guides correspond to **integer tick** columns. Major/minor line emphasis MAY remain bar-aligned by decoding ticks through time signature.

#### Scenario: Horizontal zoom respects tick spacing

- **WHEN** the user scrolls or zooms the timeline
- **THEN** guide placement SHALL remain coherent with **`viewT0Ticks`** without accumulating beat-float error across scroll offsets
