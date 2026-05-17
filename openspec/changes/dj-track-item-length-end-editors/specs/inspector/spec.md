## MODIFIED Requirements

### Requirement: Single-select Note panel content

When in the `single` state, the Inspector body SHALL render in DOM order:

1. A header row with a 28×28px swatch element styled with `background: var(--mr-note-sel)` (a solid-color flat fill, no hatching), and a two-line label group containing the pitch name (e.g. `D♯4`) on top and a mono-font subtitle reading `note <midi-number>` (e.g. `note 63`) below.
2. Six `.mr-kv` rows, in this order:
   - **Start**: key text `Start`, value consisting of editable controls (**not** a single static `<span>` only): **(a)** an input accepting a three-part numerical timeline position string canonically formatted like `formatBBT`/`01.1.1` (`bar.beat.subdivision`, 1-based, zero-padded bar as enforced by helpers), encoding the note's **`tTicks` start on commit**, and **(b)** an input for the **integer `tTicks`** start (session tick axis). Both controls SHALL reflect the selected note's current `tTicks` when focus is not committing a dirty edit; after a successful commit from either control, **`tTicks` SHALL update** on the targeted note **and** the other control's displayed value SHALL stay **consistent** with the new **`tTicks`**. Parsed BB(T) commits SHALL coerce to **`tTicks`** using the session TPQ lattice and documented rounding policy; malformed or incomplete committed input SHALL **not** mutate the note **and SHALL** preserve or revert the field UX per product rules documented in implementation.
   - **End**: key text `End`, value consisting of editable controls — **(a)** a phrase·bar·beat input encoding **`endTicks = tTicks + durTicks`** and **(b)** an integer **`endTicks`** input. Both controls SHALL reflect the selected note's current `tTicks + durTicks` when focus is not committing a dirty edit; after a successful commit, **`durTicks` SHALL be set to `max(1, committedEndTicks − tTicks)`** on the targeted note (i.e., the note's `tTicks` SHALL NOT change; only `durTicks` adjusts) **and** the other End control SHALL stay consistent with the resulting `endTicks`. A committed `endTicks` less than or equal to `tTicks` SHALL revert the field UX to canonical without mutating the note. The Length controls SHALL re-canonicalize from the new `durTicks` after any End commit.
   - **Length**: key text `Length`, value consisting of editable controls — **(a)** a numeric input accepting a decimal **beats** value (e.g. `1.000`) bound to the note's **`durTicks`** via `beatsToSessionTicks` at the session TPQ, and **(b)** an input for the **integer `durTicks`** raw value. Both controls SHALL reflect the selected note's current `durTicks` when focus is not committing a dirty edit; after a successful commit from either control, **`durTicks` SHALL update** on the targeted note (clamped to a minimum of `1`) **and** the other control's displayed value SHALL stay **consistent** with the new **`durTicks`**. Malformed or non-numeric committed input SHALL **not** mutate the note and SHALL revert the field UX.
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

#### Scenario: Length row exposes beats and ticks editors

- **WHEN** the Inspector renders with a valid single-note selection
- **THEN** the **Length** row SHALL contain editable inputs for a decimal beats value **and** for integer **`durTicks`**
- **AND** neither input SHALL mutate the note solely from partial typing prior to commit

#### Scenario: Commit beats input updates note duration

- **WHEN** the user commits a new valid decimal beats value in the Length row that resolves to a different integer `durTicks`
- **THEN** the persisted note **`durTicks`** SHALL equal `max(1, beatsToSessionTicks(beats, TPQ))`
- **AND** the Length ticks input SHALL thereafter reflect the resulting **`durTicks`**
- **AND** the End controls SHALL re-canonicalize from the new `tTicks + durTicks`

#### Scenario: End row exposes phrase-bar-beat and ticks editors

- **WHEN** the Inspector renders with a valid single-note selection
- **THEN** the **End** row SHALL contain editable inputs for a phrase·bar·beat absolute end position **and** for integer **`endTicks`**, both reflecting `tTicks + durTicks`

#### Scenario: Commit End updates durTicks only

- **WHEN** the user commits a new valid `endTicks` greater than the note's current `tTicks`
- **THEN** the persisted note **`durTicks`** SHALL equal `endTicks − tTicks`
- **AND** the note's **`tTicks`** SHALL be unchanged
- **AND** the Length controls SHALL thereafter reflect the resulting **`durTicks`**

#### Scenario: Commit End less than or equal to Start reverts field UX

- **WHEN** the user commits an `endTicks` ≤ the note's current `tTicks`
- **THEN** the note's `durTicks` SHALL NOT be mutated
- **AND** the End input(s) SHALL re-canonicalize from the stored `tTicks + durTicks`

### Requirement: DJ event timing editor inside Note tab Output region

When `djActionSelection` and `djEventSelection` refer to the same `(trackId, pitch)` and the Note tab renders the DJ **row-level** Output mapping panel, the panel SHALL include the following editor block, in DOM order:

1. A **Start** editor — two-field tick-native start-time editor used by the instrument-channel `SingleNoteView`: a **phrase·bar·beat (BBT) input** plus an **integer ticks input**, both bound to the event's **`tTicks`**.
2. An **End** editor — a **phrase·bar·beat (BBT) input** plus an **integer ticks input**, both bound to the derived **`endTicks = tTicks + effectiveDurTicks`**.
3. A **Length** editor — a **decimal beats input** plus an **integer ticks input**, both bound to the event's **`effectiveDurTicks`**. The beats input parses via `beatsToSessionTicks(parseFloat, SESSION_TPQ)` and renders the inverse for display.

`effectiveDurTicks` SHALL equal the event's own `durTicks` for single events (non-clustered, or non-representative cluster members) and SHALL equal the cluster's total span (`max(member.tTicks + member.durTicks) − representative.tTicks`) when the selected event is the representative of a `CcMergedGroup`. The same value is what the stage DJ-event duration mutator interprets as the cluster span on commit, ensuring read/write symmetry.

When the row's action has render mode `trigger` (per `actionMode(entry)` in `src/data/dj.ts` — momentary deck buttons such as Play, Cue, Sync, Reverse), the **End** and **Length** editors SHALL NOT render. The **Start** editor SHALL still render. Trigger-style events are momentary glyphs without a meaningful duration; exposing duration editors for them would invite edits that have no observable effect on playback or timeline rendering.

The editors SHALL commit on input `blur` and on `Enter` keydown.

- A Start commit SHALL update the referenced event's `tTicks` via the stage DJ-event start-time mutator (see `dj-action-tracks` spec).
- A Length commit SHALL update the referenced event's `durTicks` via the stage DJ-event duration mutator (see `dj-action-tracks` spec), clamped to a minimum of `1` tick.
- An End commit SHALL update the referenced event's `durTicks` to `max(1, committedEndTicks − tTicks)` via the same DJ-event duration mutator. The event's `tTicks` SHALL NOT change. A committed `endTicks` ≤ the event's `tTicks` SHALL re-canonicalize the End fields without mutating the event.
- A commit whose parsed value equals the current stored value SHALL be a no-op that re-canonicalizes the corresponding draft fields.

After any commit, the other two editor blocks SHALL stay consistent: changing `tTicks` re-canonicalizes Start and End; changing `durTicks` re-canonicalizes Length and End.

When only the **track-level** DJ panel is visible (`djActionSelection === null` with timeline DJ track focused), none of the Start, Length, or End editors SHALL render.

When `djEventSelection` is null, refers to a different `(trackId, pitch)`, or its `eventIdx` is out of range or its event's `pitch` no longer matches the row pitch, none of the Start, Length, or End editors SHALL render.

#### Scenario: Row Output panel includes Start, Length, and End fields when an event is selected

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 56 }` AND `djEventSelection === { trackId: 'dj1', pitch: 56, eventIdx: 2 }` and `track.events[2].pitch === 56`
- **THEN** the Inspector Note body SHALL contain the Output mapping rows AND a two-field Start editor reflecting `track.events[2].tTicks` AND a two-field End editor reflecting `track.events[2].tTicks + effectiveDurTicks` AND a two-field Length editor reflecting `effectiveDurTicks` (where `effectiveDurTicks` equals `track.events[2].durTicks` for single events and equals the cluster span when the event is the representative of a `CcMergedGroup`)

#### Scenario: Trigger-style action hides End and Length editors

- **WHEN** `djEventSelection` references an event whose row's action returns `'trigger'` from `actionMode(entry)` (e.g. Play, Cue, Sync, Reverse on a deck row)
- **THEN** the Inspector SHALL render the Start editor for that event
- **AND** the Inspector SHALL NOT render the End or Length editors for that event

#### Scenario: Track-level panel omits the editor block without row selection

- **WHEN** `selectedTimelineTrack.kind === 'dj'` AND `djActionSelection === null`
- **THEN** the Inspector SHALL NOT render the per-event Start, Length, or End editors

#### Scenario: Stale event selection hides the editor block

- **WHEN** `djActionSelection === { trackId: 'dj1', pitch: 56 }` AND `djEventSelection.eventIdx` is past the end of `track.events` OR the event at that index has a `pitch` other than 56
- **THEN** the Inspector SHALL NOT render the Start, Length, or End editors

#### Scenario: Commit Start on Enter writes tTicks via the stage mutator

- **WHEN** the user edits the Start BBT field to a value that canonicalizes to a different `tTicks` and presses `Enter`
- **THEN** the Inspector SHALL invoke the DJ-event start-time mutator with the new `tTicks`
- **AND** the input SHALL blur
- **AND** the End fields SHALL re-canonicalize from the updated `tTicks + durTicks`

#### Scenario: Commit Length writes durTicks via the stage mutator

- **WHEN** the user edits the Length beats field to a value that resolves to a different `durTicks` and blurs
- **THEN** the Inspector SHALL invoke the DJ-event duration mutator with the new `durTicks`
- **AND** the End fields SHALL re-canonicalize from the updated `tTicks + durTicks`

#### Scenario: Commit End updates durTicks only

- **WHEN** the user edits the End ticks field to a value greater than the event's current `tTicks` and blurs
- **THEN** the Inspector SHALL invoke the DJ-event duration mutator with `durTicks = endTicks − tTicks`
- **AND** the event's `tTicks` SHALL be unchanged
- **AND** the Length fields SHALL re-canonicalize from the updated `durTicks`

#### Scenario: Commit End less than or equal to Start reverts field UX

- **WHEN** the user commits an `endTicks` ≤ the event's current `tTicks`
- **THEN** the Inspector SHALL NOT invoke the DJ-event duration mutator
- **AND** the End BBT and ticks drafts SHALL re-canonicalize from the stored `tTicks + durTicks`

#### Scenario: Commit equal to current value re-canonicalizes draft

- **WHEN** the user edits any of the Start, Length, or End fields to a string that parses back to the currently stored value and blurs
- **THEN** the Inspector SHALL NOT invoke any mutator
- **AND** all drafts in the edited row SHALL be reset from the stored canonical values
