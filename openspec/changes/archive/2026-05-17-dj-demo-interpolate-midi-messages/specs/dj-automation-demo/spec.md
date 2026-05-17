## MODIFIED Requirements

### Requirement: Automation demo seeds mixer CC ramps as stepped ActionEvents

When the automation preset is active, the **Mixer** track’s `events` SHALL include CC-backed rows (pitches **81** Ch 1 Volume, **82** Ch 2 Volume, **85** Ch 1 EQ Low, **88** Ch 2 EQ Low). **Contour** endpoints and proportional shapes SHALL match the nominal automation demo ramps below; **`ActionEvent.t` MAY be fractional** inside the cited beat intervals where needed so that **playback emits a distinct quantized step for every MIDI integer in the swept range.** Concretely, for each scripted row the Mixer SHALL contain `ActionEvent`s such that sorting by ascending `t` (then `pitch` as a tiebreaker) yields a monotone sequence whose `round(vel × 127)` walks through:

- **Ch 1 Volume (`pitch` 81)** with `midi(t) ≜ (t − 4) / (20 − 4) × 127` continuous on `t ∈ [4, 20]`: the set of emitted `round(vel × 127)` values over those events SHALL be exactly **every integer from 0 through 127** inclusive (`t` constrained to **`[4, 20]`**).

- **Ch 2 Volume (`pitch` 82)** with `midi(t) ≜ ((68 − t) / (68 − 34)) × 127` on **`t ∈ [34, 68]`**: emitted values SHALL cover **every integer from 127 down to 0** inclusive (`t` constrained to **`[34, 68]`**).

- **Ch 2 EQ Low (`pitch` 88)**: SHALL include one event at **`t = 4`** with `round(vel × 127) === 0`. On **`t ∈ [26, 34]`** with nominal `midi(t) ≜ (t − 26) / (34 − 26) × 63`, emitted values SHALL cover **every integer from 0 through 63** inclusive (**allow duplicate** `0` between the **`t = 4`** anchor and the **`t = 26`** sweep start).

- **Ch 1 EQ Low (`pitch` 85)** with `midi(t) ≜ ((34 − t) / (34 − 26)) × 63` on **`t ∈ [26, 34]`**: emitted values SHALL cover **every integer from 63 down to 0** inclusive.

The default **playback** CC number for the Ch 2 Volume row (`ch2_vol`) SHALL be **8** (not CC 7). Ch 1 Volume (`ch1_vol`) SHALL remain CC **7** unless overridden elsewhere.

Each generated event SHALL satisfy existing mixer demo constraints: `pitch` MUST exist in the Mixer `actionMap` with CC output mapping per seeded `outputMap`. Event `dur` SHALL be positive (implementation MAY use a small constant identical across interpolated steps).

#### Scenario: Ch 1 volume ramp covers endpoints

- **WHEN** the automation preset is active
- **THEN** among Mixer events with `pitch === 81`, there SHALL be an event at `t === 4` with `round(vel * 127) === 0`
- **AND** there SHALL be an event at `t === 20` with `round(vel * 127) === 127`

#### Scenario: Ch 2 volume ramp covers endpoints

- **WHEN** the automation preset is active
- **THEN** among Mixer events with `pitch === 82`, there SHALL be an event at `t === 34` with `round(vel * 127) === 127`
- **AND** there SHALL be an event at `t === 68` with `round(vel * 127) === 0`

#### Scenario: Ch 2 EQ low has a zero at beat 4 and rises through beat 34

- **WHEN** the automation preset is active
- **THEN** among Mixer events with `pitch === 88`, there SHALL be an event at `t === 4` with `round(vel * 127) === 0`
- **AND** there SHALL be an event within `t ∈ [26, 34]` with `round(vel * 127) === 63`

#### Scenario: Automation demo emits every quantized Ch 1 volume step

- **WHEN** the automation preset is active
- **THEN** extracting Mixer events with `pitch === 81`, sorting them by ascending `t`, and mapping each to `round(vel * 127)` SHALL produce exactly **128** samples whose distinct values are the contiguous range **{0…127}** in ascending order within `t ∈ [4, 20]`

#### Scenario: Automation demo emits every quantized Ch 2 volume step

- **WHEN** the automation preset is active
- **THEN** extracting Mixer events with `pitch === 82`, sorting them by ascending `t`, SHALL yield **128** samples whose quantized values descend **127…0** contiguously across `t ∈ [34, 68]`

#### Scenario: Automation demo emits every quantized Ch 2 EQ low step on its sweep interval

- **WHEN** the automation preset is active
- **THEN** among Mixer events with `pitch === 88` filtered to those with `t ∈ [26, 34]` and sorted by ascending `t`, that list SHALL have length **64** and `round(vel * 127)` SHALL equal **each integer from 0 through 63** inclusive in ascending order

#### Scenario: Automation demo emits every quantized Ch 1 EQ low step

- **WHEN** the automation preset is active
- **THEN** among Mixer events with `pitch === 85` filtered to those with `t ∈ [26, 34]` and sorted by ascending `t`, that list SHALL have length **64** and `round(vel * 127)` SHALL equal **each integer from 63 through 0** inclusive in strictly descending order

### Requirement: Default DJ demo remains unchanged without the automation token

When `djAutomationDemo` is false at parse time, the initial `events` arrays for all DJ demo tracks SHALL match the implementation’s pre-change defaults (existing `SEEDED_EVENTS_*` content and ordering rules). No additional mixer or deck events from this capability SHALL appear.

#### Scenario: demo=dj without automation keeps sparse mixer CC events

- **WHEN** the app loads with `?demo=dj` and no `demo=dj-automation`
- **THEN** the Mixer track’s `events` filtered to `pitch === 82` SHALL have length **2** (the historical Deck Ch 2 Volume tap pattern)
