## ADDED Requirements

### Requirement: Statusbar fills the bottom strip with a single live "incoming MIDI" cluster

The Statusbar SHALL render inside the `.mr-statusbar` slot owned by the AppShell. Its content SHALL be a single `<Statusbar />` component containing one cluster — there SHALL NOT be a flex spacer or a second cluster. The cluster reports the source (device + channel) of the most recent incoming MIDI message; it answers the question "where is MIDI flowing from right now?"

The Statusbar SHALL NOT render a CPU meter, RAM meter, sample rate readout, buffer size readout, audio output device, clock source, BPM, or any other audio-engine / timing surface. Clock source and BPM live in the Titlebar; audio surfaces are permanently excluded — this is a MIDI-only tool.

The `.mr-stub` placeholder previously rendered inside `.mr-statusbar` SHALL be removed, and the `.mr-stub` rule SHALL NOT remain in `AppShell.css` after this change.

#### Scenario: Statusbar mounts a single cluster

- **WHEN** the app is rendered
- **THEN** the `.mr-statusbar` element SHALL contain exactly one cluster, rooted at `.mr-statusbar__cluster`
- **AND** no `.mr-statusbar__spacer` element SHALL be present
- **AND** no `.mr-stub` element SHALL exist anywhere in the rendered DOM

#### Scenario: No timing or audio-engine surfaces are present

- **WHEN** the rendered Statusbar's DOM is inspected
- **THEN** it SHALL NOT contain any element rendering CPU usage, RAM usage, sample rate, buffer size, audio output device, clock source, or BPM

### Requirement: Cluster renders LED + device name + channel chip from useStatusbar().lastInput

The `.mr-statusbar__cluster` SHALL render, in left-to-right order:

1. An activity LED — a `.mr-led` element whose `data-state` attribute is `"midi"` when `useStatusbar().active === true` and absent (idle) otherwise. The LED SHALL reuse the existing shared `.mr-led` selector; no Statusbar-specific LED CSS SHALL be added.
2. The device name at `--mr-fs-11`, using the inherited UI font (`--mr-font-ui` is set on `body`), color `var(--mr-text-2)` when `lastInput !== null` and `var(--mr-text-3)` for the empty state.
3. A channel chip (`.mr-statusbar__ch`) showing the device's channel(s) — formats: `CH·1`, `CH·10`, `CH·OMNI`, or `CH·1–4` for contiguous ranges. The chip SHALL use `--mr-font-mono`, `--mr-fs-10`, color `var(--mr-text-3)`, matching the visual treatment of `.mr-dev__ch` in the Sidebar.

When `useStatusbar().lastInput === null` (no MIDI message has been received yet), the cluster SHALL render an idle LED followed by the text `Awaiting MIDI` in `var(--mr-text-3)` and SHALL NOT render a channel chip.

#### Scenario: Active flow renders LED, name, and channel

- **WHEN** `useStatusbar()` returns `lastInput = { name: "Korg minilogue xd", channel: 1 }` and `active = true`
- **THEN** `.mr-statusbar__cluster` SHALL contain a `.mr-led[data-state="midi"]` element
- **AND** the device name `Korg minilogue xd` SHALL render at `var(--mr-text-2)`
- **AND** a `.mr-statusbar__ch` chip SHALL render the text `CH·1`

#### Scenario: Idle flow with prior input renders dim LED but keeps device

- **WHEN** `useStatusbar()` returns `lastInput = { name: "Korg minilogue xd", channel: 1 }` and `active = false`
- **THEN** `.mr-statusbar__cluster` SHALL contain a `.mr-led` element with no `data-state` attribute
- **AND** the device name and channel chip SHALL still render — `lastInput` is sticky until a different device sends a message

#### Scenario: No input yet shows empty state

- **WHEN** `useStatusbar()` returns `lastInput = null` and `active = false`
- **THEN** `.mr-statusbar__cluster` SHALL contain an idle `.mr-led` (no `data-state`)
- **AND** the text `Awaiting MIDI` SHALL render at `var(--mr-text-3)`
- **AND** no `.mr-statusbar__ch` element SHALL be present

#### Scenario: Channel range renders with middot and en-dash

- **WHEN** `useStatusbar()` returns `lastInput.channel = [1, 2, 3, 4]`
- **THEN** the channel chip SHALL render `CH·1–4`

#### Scenario: OMNI renders as CH·OMNI

- **WHEN** `useStatusbar()` returns `lastInput.channel = "omni"`
- **THEN** the channel chip SHALL render `CH·OMNI`

### Requirement: Cluster renders as an inert button until picker UX lands

The cluster's content SHALL be wrapped in a `<button type="button" data-pickable="false" tabindex="-1">` element. In this slice the button SHALL be visually styled as a flat readout — no border, no background change on hover, no focus ring, no pointer cursor — and click events SHALL be inert (no handler attached). The `data-pickable="false"` attribute reserves the element for a future picker UX without requiring a markup change.

#### Scenario: Cluster wraps in inert button

- **WHEN** the Statusbar is rendered
- **THEN** `.mr-statusbar__cluster` SHALL contain a `<button>` element with `type="button"`, `data-pickable="false"`, and `tabindex="-1"`
- **AND** clicking the button SHALL produce no observable effect

#### Scenario: Button skips the tab order

- **WHEN** the user presses Tab repeatedly to walk the focusable elements
- **THEN** the Statusbar button SHALL NOT receive keyboard focus

#### Scenario: No hover affordance in inert state

- **WHEN** the user hovers the Statusbar button
- **THEN** the computed `background-color` SHALL NOT change relative to the un-hovered state
- **AND** the computed `cursor` SHALL be `default`, not `pointer`

### Requirement: useStatusbar hook returns lastInput and active flag

A `useStatusbar()` hook SHALL be exported from `src/hooks/useStatusbar.ts` returning `{ lastInput: MidiInput | null; active: boolean }`. The shapes SHALL be:

- `MidiInput`: `{ id: string; name: string; channel: number | 'omni' | number[] }`
- `active`: `true` when MIDI messages are currently flowing into the app; `false` otherwise.

In this slice the hook SHALL return a stubbed value: `lastInput = { id: "korg-minilogue-xd", name: "Korg minilogue xd", channel: 1 }` and `active = true` so visual review sees the populated cluster and lit LEDs.

The hook SHALL NOT call Web MIDI, CoreMIDI, WinMM, or any platform MIDI API. Real MIDI wiring is out of scope and will land in a separate change.

#### Scenario: Hook returns the stub

- **WHEN** `useStatusbar()` is called
- **THEN** it SHALL return `lastInput.name === "Korg minilogue xd"`, `lastInput.channel === 1`, and `active === true`

#### Scenario: Hook does not touch the MIDI runtime

- **WHEN** the hook is invoked in a JSDOM environment without `navigator.requestMIDIAccess` defined
- **THEN** it SHALL return successfully without throwing
- **AND** SHALL NOT reference `navigator.requestMIDIAccess` or any platform MIDI API
