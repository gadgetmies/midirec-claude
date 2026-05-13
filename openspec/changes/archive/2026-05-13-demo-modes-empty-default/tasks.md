## 1. Demo query parsing & stage wiring

- [x] 1.1 Parse `demo` tokens once on mount (`URLSearchParams.getAll('demo')`) and derive **`instrumentSeed`** (true iff **any** of `instrument`, `marquee`, or `note` is present) and **`djDemo`** (true iff `dj` present); **`clean` alone** ⇒ baseline-empty channels; **`clean` together with** marquee / note / instrument ⇒ instrument fixtures still apply (precedence per design.md).
- [x] 1.2 Replace scattered `includes('demo=…')` in `useStage.tsx` with the parsed flags; drive channel seed from **`instrumentSeed`**; set `selectedChannelId` without forcing channel `1` for legacy **`demo=clean` alone**.
- [x] 1.3 Verify `demo=instrument&demo=dj` restores the combined showroom; **`/?demo=marquee`** preserves “7 notes selected” with no extra flags; **`/?demo=note`** still selects exactly one Lead note.

## 2. Channel/session seed (`useChannels`)

- [x] 2.1 Replace the `clean` boolean with **`instrumentSeed`** (= `instrument` OR `marquee` OR `note` among parsed tokens): baseline = empty rolls and no lanes; **`instrumentSeed`** true = current non-clean fixture (`makeNotes(22, 7)`, lanes, Bass notes).
- [x] 2.2 Confirm `TOTAL_T`/lane generators still receive the same `totalT` dependency for param-lane demos.

## 3. DJ store seed (`useDJActionTracks`)

- [x] 3.1 Parameterize initial state: **`djDemo`** false ⇒ `djActionTracks: []`; true ⇒ reuse existing `seedDefault()` output unchanged.
- [x] 3.2 Smoke-test toggles/UI when the list starts empty (no regressions mounting `AppShell`).

## 4. Automated tests & QA

- [x] 4.1 Update RTL/unit fixtures that assumed default-seeded notes, DJ tracks, or `djActionTracks[0]` unconditionally.
- [x] 4.2 Refresh any snapshot or spec-adjacent tests affected by **auto-instrument-with-marquee/note** or empty DJ list.
- [x] 4.3 Manually verify: `/`, `/` + each single demo flag, `/` + pairwise combinations documented in design; confirm bare URL sidebar and inspector match “blank” expectation.
