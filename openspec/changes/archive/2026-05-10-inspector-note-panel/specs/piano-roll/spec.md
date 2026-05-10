## MODIFIED Requirements

### Requirement: Stage hosts a single PianoRoll driven by useStage()

The codebase SHALL expose a `useStage()` hook at `src/hooks/useStage.ts` returning `{ notes, lo, hi, totalT, playheadT, marquee, selectedIdx, resolvedSelection }`. `AppShell.tsx` SHALL mount a single `PianoRoll` inside the `.mr-stage` region whose props are bound to `useStage()`'s return value, with `width` and `height` measured from the `.mr-stage` element's content box via a `ResizeObserver`-backed hook.

The `resolvedSelection` field SHALL have shape `{ channelId: ChannelId, indexes: number[] } | null` and SHALL be derived as follows, evaluated in this order:

- If `selectedIdx` is a non-empty array, `resolvedSelection = { channelId: selectedChannelId, indexes: selectedIdx }`.
- Else if `marquee` is non-null AND `selectedChannelId` is non-null, `resolvedSelection = { channelId: selectedChannelId, indexes: notesInMarquee(roll.notes, marquee) }` where `roll` is the roll whose `channelId === selectedChannelId`. If the resulting `indexes` array is empty, `resolvedSelection = null`.
- Else `resolvedSelection = null`.

This pre-computed shape is consumed by the `inspector` capability so the Inspector reads a single resolved value rather than re-deriving from the marquee + selectedIdx + selectedChannelId triple.

`useStage()` SHALL:

- Return `notes = makeNotes(38, 7)` — the prototype's deterministic seed (count 38, seed 7). The `makeNotes(count, seed)` helper SHALL be implemented in `src/components/piano-roll/notes.ts` and SHALL produce identical output to the prototype's `makeNotes` function (same LCG constants 9301, 49297, 233280; same starting `t` accumulation; same pitch offset 48; same velocity formula).
- Return `lo = 48`, `hi = 76`, `totalT = 16`.
- Return `playheadT` derived from the `useTransport()` clock as `((timecodeMs / 1000) * (bpm / 60)) % totalT`, so the playhead sweeps proportionally to the fake clock and wraps at the right edge.
- Branch on URL flags as follows. The flags are mutually exclusive; when both are present, `?demo=marquee` SHALL win:
  - **`demo=marquee`**: return `marquee = { t0: 3.5, t1: 8.5, p0: 56, p1: 69 }`, omit `selectedIdx` (so it is auto-derived as the empty array; `resolvedSelection` derives from the marquee branch above), and set `selectedChannelId = 1`. The rectangle is tuned so that `notesInMarquee(makeNotes(38, 7), marquee)` returns exactly 7 indexes — matching screenshot 04's `7 SELECTED` count. `resolvedSelection` SHALL therefore have `indexes.length === 7`.
  - **`demo=note`**: return `marquee = null`, `selectedIdx = [<idx>]` for a fixed index `<idx>` chosen so that the selected note has a recognisable pitch in the Lead channel's roll (the implementation MAY choose any deterministic index in `[0, makeNotes(38, 7).length)`), and `selectedChannelId = 1`. `resolvedSelection.indexes` SHALL therefore have length exactly 1.
  - **Neither flag**: return `marquee = null`, `selectedIdx = []`, `selectedChannelId = null`. `resolvedSelection` SHALL be `null`.

#### Scenario: Default load shows no marquee and null resolvedSelection

- **WHEN** the app is loaded at the bare `/` URL
- **THEN** the rendered DOM SHALL NOT contain any `.mr-marquee` element
- **AND** `useStage().resolvedSelection` SHALL equal `null`

#### Scenario: ?demo=marquee shows the screenshot-04 marquee

- **WHEN** the app is loaded at `/?demo=marquee`
- **THEN** the rendered DOM SHALL contain exactly one `.mr-marquee` element
- **AND** the `.mr-marquee__count` SHALL display `7` (the count of notes from `makeNotes(38, 7)` whose `[t, t+dur)` interval overlaps `[3.5, 8.5)` AND whose `pitch` is in `[56, 69]`)
- **AND** exactly seven `.mr-note` elements SHALL carry `data-sel="true"`
- **AND** `useStage().resolvedSelection` SHALL be a non-null object with `channelId === 1` and `indexes.length === 7`

#### Scenario: ?demo=note shows a single-note selection

- **WHEN** the app is loaded at `/?demo=note`
- **THEN** the rendered DOM SHALL NOT contain any `.mr-marquee` element
- **AND** `useStage().resolvedSelection` SHALL be a non-null object with `channelId === 1` and `indexes.length === 1`
- **AND** exactly one `.mr-note` element SHALL carry `data-sel="true"`

#### Scenario: ?demo=marquee wins over ?demo=note when both are present

- **WHEN** the app is loaded at `/?demo=marquee&demo=note`
  (or equivalently `/?demo=note&demo=marquee`, since URL flag order does not matter for this test)
- **THEN** the rendered DOM SHALL contain exactly one `.mr-marquee` element
- **AND** `useStage().resolvedSelection.indexes.length` SHALL equal `7`

#### Scenario: Playhead advances when transport is playing

- **WHEN** `useTransport()` reports `mode === 'play'` and `timecodeMs > 0`
- **THEN** the rendered `.mr-playhead`'s computed `left` SHALL be greater than `0px`

#### Scenario: Playhead resets when stop is dispatched

- **WHEN** `useTransport().stop()` has been called and `timecodeMs === 0`
- **THEN** the rendered `.mr-playhead`'s computed `left` SHALL be `0px`
