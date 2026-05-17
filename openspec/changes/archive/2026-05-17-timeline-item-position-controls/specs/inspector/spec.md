## MODIFIED Requirements

### Requirement: Single-select Note panel content

When in the `single` state, the Inspector body SHALL render in DOM order:

1. A header row with a 28×28px swatch element styled with `background: var(--mr-note-sel)` (a solid-color flat fill, no hatching), and a two-line label group containing the pitch name (e.g. `D♯4`) on top and a mono-font subtitle reading `note <midi-number>` (e.g. `note 63`) below.
2. Four `.mr-kv` rows, in this order:
   - **Start**: key text `Start`, value consisting of editable controls (**not** a single static `<span>` only): **(a)** an input accepting a three-part numerical timeline position string canonically formatted like `formatBBT`/`01.1.1` (`bar.beat.subdivision`, 1-based, zero-padded bar as enforced by helpers), encoding the note’s **`tTicks` start on commit**, and **(b)** an input for the **integer `tTicks`** start (session tick axis). Both controls SHALL reflect the selected note’s current `tTicks` when focus is not committing a dirty edit; after a successful commit from either control, **`tTicks` SHALL update** on the targeted note **and** the other control’s displayed value SHALL stay **consistent** with the new **`tTicks`**. Parsed BB(T) commits SHALL coerce to **`tTicks`** using the session TPQ lattice and documented rounding policy; malformed or incomplete committed input SHALL **not** mutate the note **and SHALL** preserve or revert the field UX per product rules documented in implementation.
   - **Length**: key text `Length`, value text reflecting note duration derived from authoritative tick timing (`durTicks`), presented in the same convention as the live implementation (human-readable secondary unit if applicable).
   - **Velocity**: key text `Velocity`, value is a flex-row containing a `.mr-slider` with `.mr-slider__fill` width set to `note.vel * 100%` and a `.mr-slider__thumb` at `left: note.vel * 100%`, plus a mono `<span>` to the right with the integer MIDI velocity (e.g. `92` for `vel ≈ 0.72`).
   - **Channel**: key text `Channel`, value text equal to `CH ` + the channel id from `resolvedSelection.channelId`.

Header swatch and label generation SHALL use `formatPitch(note.pitch)` for the pitch name. The MIDI velocity SHALL be `Math.round(note.vel * 127)`.

#### Scenario: Single-select header shows derived pitch and note number

- **WHEN** the Inspector renders with a single-note selection where `note.pitch = 63`
- **THEN** the header pitch label SHALL contain the text `D♯4`
- **AND** the header subtitle SHALL contain the text `note 63`

#### Scenario: Single-select velocity slider reflects the note's velocity

- **WHEN** the Inspector renders with a single-note selection where `note.vel = 0.72`
- **THEN** the `.mr-slider__fill` element's computed width SHALL equal `72%` of the slider's width (within ±1px)
- **AND** the mono velocity readout SHALL display `91` (i.e., `Math.round(0.72 * 127)`)

#### Scenario: Start row exposes phrase-bar-beat and ticks editors

- **WHEN** the Inspector renders with a valid single-note selection
- **THEN** the **Start** row SHALL contain editable inputs for phrase-bar-beat-style position **and** for integer **`tTicks`**
- **AND** neither input SHALL mutate the note solely from partial typing prior to commit

#### Scenario: Commit ticks input updates note position

- **WHEN** the user commits a new valid **`tTicks`** integer for the Start row
- **THEN** the persisted note **`tTicks`** SHALL equal that committed value **before** fractional beat display helpers run
- **AND** the phrase-bar-beat field SHALL thereafter reflect the decoding of **`tTicks`**

#### Scenario: Commit phrase-bar-beat updates note ticks

- **WHEN** the user commits a valid three-part timeline string aligned with the display lattice
- **THEN** the note **`tTicks`** SHALL be updated per the lattice mapping and rounding policy
- **AND** the ticks input SHALL thereafter display the resulting **`tTicks`**
