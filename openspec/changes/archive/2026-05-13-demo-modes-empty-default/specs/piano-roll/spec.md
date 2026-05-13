## MODIFIED Requirements

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
  - **Neither `demo=marquee` nor `demo=note`**: return `marquee = null`, `selectedIdx = []`, `selectedChannelId = null` unless another capability sets it. `resolvedSelection` SHALL be `null` absent other selection-driving state.

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
