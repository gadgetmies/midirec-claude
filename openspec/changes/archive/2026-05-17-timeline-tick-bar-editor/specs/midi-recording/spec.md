## ADDED Requirements

### Requirement: Recorded events snap to session ticks

Normative recording text SHALL describe captured notes and DJ `ActionEvent` rows using **`tTicks` / `durTicks`** (and lane **`tTicks`** for automation) rather than beat-float **`t` / `dur`** when specifying how events are appended to session state.

#### Scenario: Recorder append examples use ticks

- **WHEN** the `midi-recording` specification states how new notes are written into `PianoRollTrack.notes`
- **THEN** the stored shape SHALL be described with **`tTicks` / `durTicks`** aligned to session TPQ
