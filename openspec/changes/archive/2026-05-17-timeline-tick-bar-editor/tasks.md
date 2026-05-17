## 1. Types and migration helpers

- [x] 1.1 Introduce shared **`tTicks` / `durTicks`** on `Note`, **`tTicks` / `durTicks`** on `ActionEvent`, **`tTicks`** on `CCPoint`, **`tTicks`** on `PressurePoint` (or equivalent); remove beat **`t` / `dur`** as persisted fields after migration.
- [x] 1.2 Central **`migrateSessionBeatsToTicks(tpq)`** (or per-layer converters) used by seeds, tests, and any JSON restore paths.

## 2. Session model and transport

- [ ] 2.1 Replace loop, marquee, view window, and layout horizon state with tick semantics (`layoutHorizonTicks`, etc.).
- [x] 2.2 Transport: single **`timecodeMs` ↔ `playheadTicks`** conversion; stage consumers read ticks.

## 3. Piano roll and channels

- [x] 3.1 Update `PianoRoll` geometry, clipping, and playhead to **`viewT0Ticks`**, **`viewSpanTicks`**, **`playheadTicks`**, **`pxPerTick`**.
- [x] 3.2 Update `useChannels` note mutations, recording append paths, and selectors.

## 4. Param lanes

- [x] 4.1 Migrate `ccPoints` generators and lane renderers (`ParamLane`, minimap, editors) to **`tTicks`**.

## 5. DJ stack

- [x] 5.1 Migrate seeds, `ActionRoll`, merge thresholds (**ticks**), playback scheduling, and inspector timing patch APIs to **`tTicks` / `durTicks`**.

## 6. MIDI import/export and playback

- [x] 6.1 Align file IO and playback schedulers with tick scheduling (avoid beat-float reintroduction at boundaries).

## 7. Tests and specs

- [x] 7.1 Update Vitest suites and any archived fixtures to tick-native expectations.
- [x] 7.2 Add deltas for `ruler`, `midi-playback`, `midi-recording`, `tracks` during `/opsx:apply` if normative text still references beat-only positioning.
