## ADDED Requirements

### Requirement: Track surfaces consume tick horizon geometry

`<Track>` SHALL receive timeline geometry sufficient to position **`PianoRoll`** and **`Minimap`** using **`layoutHorizonTicks`** and **`pxPerTick`** (or derived equivalents) so horizontal extents stay aligned with the ruler without accumulating floating-beat layout drift.

#### Scenario: Open collapsed minimap matches stripe ticks

- **WHEN** `ChannelGroup` forwards orchestrated **`layoutHorizonTicks`** and **`pxPerTick`** into `<Track>`
- **THEN** minimap and expanded roll widths SHALL derive from **`layoutHorizonTicks * pxPerTick`**, matching sibling ruler/param lanes for the same horizon
