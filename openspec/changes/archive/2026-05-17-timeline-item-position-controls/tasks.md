## 1. Parsing and ticks ↔ BBT helpers

- [x] 1.1 Add pure helpers for **phrase-bar-beat string ↔ fractional beats/session ticks** (inverse of `formatBBT` lattice, same defaults as Inspector display), plus unit tests (valid parse, rejects, normalization, rounding to `tTicks`).
- [x] 1.2 Document chosen **rounding/at-boundary rule** (e.g. nearest tick to decoded beat time) beside the helpers for future tuplets/time-signature work.

## 2. Inspector UI and commit path

- [x] 2.1 Replace read-only Start value in single-select Note panel with **two inputs**: phrase-bar-beat-style string and integer **`tTicks`**, using existing `.mr-kv` / inspector styling patterns.
- [x] 2.2 Wire **controlled local state** + **commit on blur/Enter**; invalid committed input does not mutate the roll; valid commit updates **`tTicks`** via existing stage/roll mutation APIs.
- [x] 2.3 After successful commit, **sync both fields** from `note.tTicks` (or equivalent single source) and ensure piano roll / selection reflect the move.

## 3. Verification

- [x] 3.1 Extend `Inspector` tests (or add focused tests) for Start row: render inputs, commit ticks, commit BBT string, rejection path without mutation.
- [x] 3.2 Run existing inspector + summary test suites; fix regressions from Start row shape or expectations.
