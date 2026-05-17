## ADDED Requirements

### Requirement: Clicking a note invokes an optional PianoRoll selection callback

`PianoRoll` SHALL accept an optional callback prop `onNoteSelect?: (noteIndex: number) => void`. Each rendered `.mr-note` SHALL participate in pointer interaction for selection (minimum: **click**) with `cursor: pointer` when `onNoteSelect` is defined. When `onNoteSelect` is defined and the user activates a note, the handler **SHALL** call `event.stopPropagation()` **before** invoking `onNoteSelect(i)` exactly once where `i` is the note's zero-based index in the `notes` array passed into `PianoRoll`.

Orchestration code outside `PianoRoll` **SHALL** wire this callback such that activating a note on a roll whose `channelId === C` sets `selectedChannelId = C`, sets **`selectedIdx` to `[i]`**, and updates timeline focus for that channel consistently with sibling track-header focus rules.

#### Scenario: Activation delivers the canonical index

- **WHEN** `<PianoRoll notes={[...three notes…]} onNoteSelect={fn} />` is mounted and `fn` is a spy
- **AND** the user activates the `.mr-note` representing the note at index **1**
- **THEN** `fn` SHALL be called exactly once with argument **1**

#### Scenario: Non-interactive renders omit handlers

- **WHEN** `onNoteSelect` is omitted
- **THEN** `.mr-note` elements SHALL NOT require `cursor: pointer` solely for selection (implementation MAY omit click wiring)

### Requirement: Supplemental stylesheet rule matches DJ accent selection chrome for piano-roll notes

`src/components/piano-roll/PianoRoll.css` **SHALL** define **`.mr-note[data-selected="true"]`** with a **`box-shadow`** declaration that matches **verbatim** (same layering, token usage, **and lengths**) the **`box-shadow`** declaration block from **`.mr-djtrack__note[data-selected="true"]`** in `src/components/dj-action-tracks/ActionRoll.css` so **selected `.mr-note` tiles** read identically **to selected DJ-action events.**

#### Scenario: Selection attribute applies chrome

- **WHEN** `<PianoRoll selectedIdx={[0]} notes={[one in-range note]} />` is rendered **with** stylesheet rules loaded **and** the note participates in `.mr-roll__lanes`' stacking rules
- **THEN** exactly one `.mr-note` SHALL carry `data-selected="true"`
- **AND** the rule set from `src/components/dj-action-tracks/ActionRoll.css` `.mr-djtrack__note[data-selected="true"]` **SHALL** be duplicated onto `.mr-note[data-selected="true"]`

## MODIFIED Requirements

### Requirement: Note color follows the prototype's velocity formula

Each `.mr-note` element's background SHALL be set inline (via `style.background`) according to the following rules:

1. If `trackColor` is provided, the background SHALL be `color-mix(in oklab, {trackColor} {50 + vel*50}%, transparent)` where `vel` is the note's normalised velocity (0..1).
2. Otherwise, the background SHALL be `oklch(68% {0.06 + vel*0.10} 240 / {0.5 + vel*0.5})` — the prototype's default-blue velocity formula.

**Selection SHALL NOT substitute `var(--mr-note-sel)` as the sole background treatment.** Notes whose indexes appear in the renderer's effective selection list (see "Selection resolution") SHALL still satisfy rules **1–2** above using that note's `vel`; they SHALL ALSO carry **`data-sel="true"`** AND **`data-selected="true"`** so the **`PianoRoll.css`** supplemental rule renders the **`var(--mr-accent)`** bordered stack matching DJ action-note selection chrome.

This is the only place in the codebase outside `tokens.css` where `oklch(...)` may appear, because the velocity-derived chroma and alpha cannot be expressed as static CSS rules.

#### Scenario: Selected notes expose velocity fill and accent chrome markers

- **WHEN** `<PianoRoll selectedIdx={[0]} trackColor="oklch(70% 0.16 30)" notes={[{t:0,dur:1,pitch:60,vel:0.5}]} />` is rendered **with stylesheet rules loaded**
- **THEN** the `.mr-note` element SHALL carry `data-sel="true"` **AND** `data-selected="true"`
- **AND** its inline `style.background` SHALL be the **`color-mix(in oklab, oklch(70% 0.16 30) …)`** literal for **`vel === 0.5`**
- **AND** the note's **`style.background`** value MUST NOT be **`var(--mr-note-sel)`** alone **(velocity / track tint still applies)**

#### Scenario: Track color overrides the default formula without selection

- **WHEN** `<PianoRoll trackColor="oklch(70% 0.16 30)" notes={[{t:0,dur:1,pitch:60,vel:0.8}]} />` is rendered **with empty effective selection**
- **THEN** the `.mr-note` element's inline `style.background` SHALL be the literal string `color-mix(in oklab, oklch(70% 0.16 30) 90%, transparent)`

#### Scenario: Default formula at velocity 1.0 without selection

- **WHEN** `<PianoRoll notes={[{t:0,dur:1,pitch:60,vel:1.0}]} />` is rendered **with empty effective selection**
- **THEN** the `.mr-note` element's inline `style.background` SHALL be the literal string `oklch(68% 0.16 240 / 1)`

### Requirement: Stage hosts a single PianoRoll driven by useStage()

The codebase SHALL expose a `useStage()` hook at `src/hooks/useStage.ts` returning `{ notes, lo, hi, totalT, playheadT, marquee, selectedIdx, resolvedSelection }`. `AppShell.tsx` SHALL mount a single `PianoRoll` inside the `.mr-stage` region whose props are bound to `useStage()`'s return value, with `width` and `height` measured from the `.mr-stage` element's content box via a `ResizeObserver`-backed hook.

The `resolvedSelection` field SHALL have shape `{ channelId: ChannelId, indexes: number[] } | null` and SHALL be derived as follows, evaluated in this order:

- If `selectedIdx` is a non-empty array, `resolvedSelection = { channelId: selectedChannelId, indexes: selectedIdx }`.
- Else if `marquee` is non-null AND `selectedChannelId` is non-null, `resolvedSelection = { channelId: selectedChannelId, indexes: notesInMarquee(roll.notes, marquee) }` where `roll` is the roll whose `channelId === selectedChannelId`. If the resulting `indexes` array is empty, `resolvedSelection = null`.
- Else `resolvedSelection = null`.

This pre-computed shape is consumed by the `inspector` capability so the Inspector reads a single resolved value rather than re-deriving from the marquee + selectedIdx + selectedChannelId triple.

`useStage()` SHALL:

- Return Lead-roll notes derived from session state: when **any instrument-demanding token** is present (`instrument`, `marquee`, or `note`), those notes SHALL be `makeNotes(22, 7)` on first load (matching the `channels` seed); otherwise the Lead roll SHALL be empty on first load. *(Any legacy `notes` snapshot field retained for compatibility SHALL follow the same rule.)*
- Return `lo = 48`, `hi = 76`, `totalT = 16`.
- Return `playheadT` derived from the `useTransport()` clock as `((timecodeMs / 1000) * (bpm / 60)) % totalT`, so the playhead sweeps proportionally to the fake clock and wraps at the right edge.
- Evaluate marquee vs note branching **when `demo=marquee` or `demo=note` is present**. The **`demo=marquee`/`demo=note` URLs imply the instrument fixture** for Lead notes (same as passing `demo=instrument`); no explicit `instrument` parameter is required.
- Inside the marquee vs note interaction, when both marquee and note are requested, **`?demo=marquee` SHALL win**:
  - **`demo=marquee`**: return `marquee = { t0: 3.5, t1: 8.5, p0: 56, p1: 69 }`, omit `selectedIdx` (so it is auto-derived as the empty array; `resolvedSelection` derives from the marquee branch above), and set `selectedChannelId = 1`. The rectangle SHALL be tuned so `notesInMarquee(makeNotes(22, 7), marquee)` returns exactly `7` indexes. `resolvedSelection` SHALL therefore have `indexes.length === 7`.
  - **`demo=note`** (without active marquee precedence): return `marquee = null`, `selectedIdx = [<idx>]` for a fixed index `<idx>` chosen so that the selected note has a recognisable pitch in the Lead roll (the implementation MAY choose any deterministic index in `[0, makeNotes(22, 7).length)`), and `selectedChannelId = 1`. `resolvedSelection.indexes` SHALL therefore have length exactly 1.
  - **`demo=marquee` and `demo=note` together**: marquee branch wins (`demo=marquee` precedence unchanged).
  - **Neither `demo=marquee` nor `demo=note`**: return `marquee = null`. **`selectedChannelId`** and **`selectedIdx`** MAY be updated by interactive instrument-roll note activation (pointer path via `Track`/`ChannelGroup`/`AppShell` → `useStage`). When untouched by demos or gestures, **`selectedIdx = []`** and **`selectedChannelId = null`** and `resolvedSelection` SHALL be **`null`** unless other capabilities set channel focus.

Expose public setters/selectors alongside existing stage API so **`onNoteSelect`** can mutate **`selectedIdx` / `selectedChannelId`** without bypassing derivation invariants documented above.

#### Scenario: Default load shows no marquee and null resolvedSelection

- **WHEN** the app is loaded at the bare `/` URL
- **THEN** the rendered DOM SHALL NOT contain any `.mr-marquee` element
- **AND** `useStage().resolvedSelection` SHALL equal `null`

#### Scenario: demo=marquee loads marquee without separate instrument flag

- **WHEN** the app is loaded at `/?demo=marquee`
- **THEN** the rendered DOM SHALL contain exactly one `.mr-marquee` element
- **AND** exactly seven `.mr-note` elements SHALL carry `data-sel="true"`
- **AND** `useStage().resolvedSelection` SHALL be a non-null object with `channelId === 1` and `indexes.length === 7`
- **AND** the rendered DOM SHALL contain zero `.mr-marquee__badge` elements

#### Scenario: demo=note loads single-note demo without separate instrument flag

- **WHEN** the app is loaded at `/?demo=note`
- **THEN** the rendered DOM SHALL NOT contain any `.mr-marquee` element
- **AND** `useStage().resolvedSelection` SHALL be a non-null object with `channelId === 1` and `indexes.length === 1`
- **AND** exactly one `.mr-note` element SHALL carry `data-sel="true"`

#### Scenario: Marquee wins when both marquee and note are present

- **WHEN** the app is loaded at `/?demo=marquee&demo=note`
- **THEN** the rendered DOM SHALL contain exactly one `.mr-marquee` element
- **AND** `useStage().resolvedSelection.indexes.length` SHALL equal `7`

#### Scenario: Redundant demo=instrument with marquee yields same marquee behavior

- **WHEN** the app is loaded at `/?demo=instrument&demo=marquee`
- **THEN** the rendered DOM SHALL contain exactly one `.mr-marquee` element
- **AND** `useStage().resolvedSelection.indexes.length` SHALL equal `7`

#### Scenario: Playhead advances when transport is playing

- **WHEN** `useTransport()` reports `mode === 'play'` and `timecodeMs > 0`
- **THEN** the rendered `.mr-playhead`'s computed `left` SHALL be greater than `0px`

#### Scenario: Playhead resets when stop is dispatched

- **WHEN** `useTransport().stop()` has been called and `timecodeMs === 0`
- **THEN** the rendered `.mr-playhead`'s computed `left` SHALL be `0px`
