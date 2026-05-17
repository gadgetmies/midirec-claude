## ADDED Requirements

### Requirement: Playback scheduling uses integer note ticks

Normative scheduling text SHALL refer to `Note.tTicks`, `Note.durTicks`, and TPQ-aligned millisecond conversion instead of fractional beat fields (`note.t`, `note.dur`) when describing lookahead ranges and `output.send` timestamps derived from the piano roll.

#### Scenario: Scheduler examples cite tick timing

- **WHEN** the `midi-playback` specification describes scanning `PianoRollTrack.notes` for upcoming MIDI output
- **THEN** examples SHALL use **`tTicks` / `durTicks`** (and TPQ) rather than beat-float **`t` / `dur`** as the authoritative stored positions
