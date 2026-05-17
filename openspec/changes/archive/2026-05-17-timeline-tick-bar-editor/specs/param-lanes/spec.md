## ADDED Requirements

### Requirement: Param lane automation samples use tTicks

Each automation sample in param lanes SHALL store **`tTicks`** (integer session tick) instead of **`t`** in beats. Minimap and expanded editors SHALL position spans at **`(tTicks - viewT0Ticks) * pxPerTick`**.

Seeded generators (`ccModWheel`, `ccPitchBend`, etc.) SHALL emit **`tTicks`** on the same lattice.

#### Scenario: Minimap span aligns with tick-derived px space

- **WHEN** a lane point has `tTicks = 960`, `viewT0Ticks = 0`, and `pxPerTick = 0.125`
- **THEN** its minimap marker `left` SHALL be `120px` before CSS rounding
