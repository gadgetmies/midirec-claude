## Why

The session stores musical timing almost everywhere as floating **beats** (`Note.t`, `Note.dur`, param-lane `CCPoint.t`, DJ `ActionEvent.t`, loop endpoints, scroll/view windows, derived horizons). That cannot guarantee exact placement on the MIDI tick lattice or stable round-trips with export (`beatsToMidiTicks`). This change migrates **all musical positioning** to **integer MIDI ticks** at session **TPQ** (aligned with `DEFAULT_MIDI_TPQ` in `src/midi/timelineTicks.ts`), with **beats derived only** where clock tempo or display needs quarter-note units.

## What Changes

- **Data model:** Replace authoritative beat fields with **`tTicks`** (start, non-negative integer from session timeline zero) and **`durTicks`** (positive integer length in ticks) on **`Note`**, **`ActionEvent`**, **`CCPoint`** / param-lane samples, and analogous timed payloads. **`Marquee`**, **`LoopRegion`**, piano-roll **view window**, and **layout horizon** endpoints migrate to the same tick lattice (exact field names MAY stay stable where documented—**units become ticks**).
- **Transport:** Millisecond clock converts to **`playheadTicks`** (integer or fixed rational—implementation detail) in **one boundary layer**; downstream layout and editors consume ticks, not beats-as-authority.
- **Rendering:** Pixel placement derives from **`ticks / TPQ`** only as an intermediate to combine with existing **`pxPerBeat`‑style** scaling where convenient (`pxPerTick = pxPerBeat / TPQ`), but persisted state remains ticks.
- **DJ Inspector:** Bar · beat · tick-within-beat editor commits absolute **`tTicks`**; merged CC clusters and pressure/automation children move by integer **`deltaTicks`** (see design).
- **Migration:** Load paths convert legacy beat data with **`round(beats * TPQ)`** (or stricter rules documented next to `beatsToMidiTicks`) so fixtures and sessions upgrade deterministically.

## Capabilities

### New Capabilities

- _(none.)_

### Modified Capabilities

- `session-model`: Tick-native session time, loop, view window, horizon, supremum; transport ms ↔ playhead ticks.
- `piano-roll`: Notes and playhead laid out from **`tTicks` / `durTicks`**.
- `channels`: Rolls and lanes persist tick timing.
- `param-lanes`: Automation **`tTicks`** and rendering math.
- `ruler`: Horizon/view alignment to tick grid.
- `dj-action-tracks`: DJ events, merges, mutations (prior detail).
- `inspector`: DJ timing editor + channel-roll summaries from ticks.
- `tracks`, `midi-playback`, `midi-recording`: Update normative time units wherever positioning or scheduling references musical session time (add deltas during `/opsx:apply` if gaps remain).

## Impact

- `src/components/piano-roll/`, `src/components/param-lanes/`, `src/components/dj-action-tracks/`, `src/components/channels/`, ruler/shell — layout and hit-testing.
- `src/data/dj.ts`, `src/components/piano-roll/notes.ts`, `src/components/param-lanes/ccPoints.ts` — types and seeds.
- `src/hooks/useStage.tsx`, `useChannels.ts`, `useDJActionTracks.ts`, transport hooks — state shape, conversions, mutations.
- `src/midi/` — export/import mapping ticks ↔ wire format (already TPQ-aware).
- Tests and OpenSpec base specs — expectations expressed in ticks or derived beats only for assertions that compare to legacy behavior during migration.
