## 1. Track list & range math

- [x] 1.1 Teach `ExportDialog` to read `djActionTracks` from `useStage`, build export row keys (`channel:*` / `dj:*`), and initialise `tracksOn` to all rendered rows on open.
- [x] 1.2 When `djActionTracks.length > 0`, omit instrument channel rows that fail `channelHasContent` (reuse helper from `useChannels` / stage `visibleChannels` predicate); when no DJ tracks exist, keep listing all channels as today.
- [x] 1.3 Extend `computeRange` / event counting so whole-session `hi` includes `max(e.t + e.dur)` over DJ events (and existing notes / lane points), and tallies include DJ events in `[t0,t1)` with pitch-in-`actionMap`, track not muted, row audibility matching `ActionRoll` / `isDJRowAudible` semantics (import shared helpers where possible).
- [x] 1.4 Update track row UI: channel rows show `n notes · m points`; DJ rows show `z actions · q events` with swatch/name from the DJ track.

## 2. JSON Lines format & download

- [x] 2.1 Rename user-visible strings and types from NDJSON / `ndjson` to JSON Lines / `jsonl`; default filename extension `.jsonl`.
- [x] 2.2 Implement a small encoder (colocated module or `ExportDialog` helper) emitting one JSON object per line for checked, eligible DJ events with `kind: 'dj.action'`, `version: 1`, and fields from `design.md`.
- [x] 2.3 On Save with `jsonl`, create `Blob`, trigger download via object URL, revoke URL, emit existing toast pattern, then `closeExportDialog`. Keep MIDI path toast-only with no blob.

## 3. Verification

- [x] 3.1 Manually verify `?demo=dj`: Export lists the DJ track (not empty Lead/Bass), non-zero bars/events when clips exist, JSONL downloads and lines parse as JSON with expected `trackId` / `pitch` / `t`.
- [x] 3.2 Smoke-test default `/` session: instruments still listed; JSONL / MIDI UX unchanged aside from renaming.
- [x] 3.3 Add or extend automated tests if the repo has Export dialog coverage; otherwise leave a terse note in PR description.
