## ADDED Requirements

### Requirement: MIDI map mode toggle in the Titlebar

The Titlebar SHALL provide a control to toggle MIDI map mode, plus a keyboard
shortcut. The control SHALL reflect whether map mode is active.

#### Scenario: Toggle enters and exits map mode

- **WHEN** the user activates the Titlebar map-mode control
- **THEN** map mode becomes active and the control reflects the active state
- **WHEN** the user activates it again
- **THEN** map mode exits and the control reflects the inactive state

#### Scenario: Keyboard shortcut toggles map mode

- **WHEN** the user presses the map-mode keyboard shortcut
- **THEN** map mode toggles between active and inactive

### Requirement: Transport controls expose mapping badge hosts

The Titlebar SHALL, while map mode is active, present a badge anchor on each
mappable transport and settings control (play, pause, record, rewind, cue, loop,
metronome, quantize, snap, clock source, clock send, BPM) where the map editor
renders that control's mapping badge.

#### Scenario: Each mappable Titlebar control can show a badge

- **WHEN** map mode is active
- **THEN** every mappable Titlebar control exposes its badge anchor for the overlay
