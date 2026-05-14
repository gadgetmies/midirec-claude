## Context

`<ExportDialog>` (`src/components/dialog/ExportDialog.tsx`) drives its track list and event math solely from `channels`, `rolls`, and `lanes`. DJ-only demos (`?demo=dj` without instrument seeding) still instantiate empty Lead/Bass rolls, so the dialog shows two meaningless zero-count rows while `djActionTracks` holds real `ActionEvent`s. Whole-session `[0, hi)` ignores those events, leaving `hi === 0` and Save disabled despite visible DJ clips. Labels still say NDJSON / `.ndjson`; the codebase never downloads a file except what we add for JSONL.

## Goals / Non-Goals

**Goals:**

- Tracks list reflects **both** instrument sources and **`djActionTracks`**, using stable per-row identifiers and counts that include DJ `events`.
- Omit instrument channel rows that have **no notes and no lane points** when at least **one DJ track** is present (`djActionTracks.length > 0`). Keep listing empty channels only when **no DJ tracks** exist so non-DJ sessions stay unchanged visually.
- **Whole session** resolved upper bound considers DJ `events` (`max(t + dur)`) alongside notes and lane points.
- Header **events** tally includes DJ clip starts inside `[t0, t1)` for checked rows, using the same **row audibility** rules as `<ActionRoll>` (`isDJRowAudible`-style semantics from `useDJActionTracks`; skip events on muted DJ tracks outright).
- Replace **NDJSON** / `.ndjson` with **JSON Lines** / **`jsonl`** in UI defaults and typing.
- **Save with JSONL** creates a downloadable `.jsonl` file (newline-delimited UTF-8 JSON objects), closes the dialog, and shows `Exported "<filename>" · N events`.

**Non-Goals:**

- Full Standard MIDI File encoding of DJ action strips in this change (toast-only remains for MIDI until Slice 10 unless already trivial elsewhere).
- Quantisation or synthesising denser pressure curves beyond storing `pressure` arrays as JSON arrays.

## Decisions

1. **Export row identity** — Use `ExportRowKey` strings `channel:${ChannelId}` and `dj:${DJTrackId}` (or tuples) internally; render order: DJ tracks in stage order after filtered channels sorted by ascending `Channel.id`.

2. **Initial checked rows** — All rows enumerated at dialog open (`visibleChannels`-style filtering for instruments + every DJ track).

3. **JSON Lines v1 (`kind: 'dj.action')** — Minimal fields:

   `{ "kind":"dj.action","version":1,"trackId","trackName","midiChannel","pitch","t","dur","vel","actionId?","pressure"? }`.

   Omit `pressure` when `undefined`; `[]` encodes cleared editor state.

   Optional follow-up PR can add `midi.note` lines for channel rolls once formats stabilise—this slice ships DJ fidelity first.

4. **Download path** — `Blob` over joined lines + revoked object URL; filename from input with `.jsonl` enforced if user cleared extension optional—keep input verbatim except trim.

## Risks / Trade-offs

- **[Risk]** JSONL consumers break on additive fields — **Mitigation**: `version` increments on breaking changes only.
- **[Risk]** Row-solo interplay confuses exporters — **Mitigation**: Align counts with muted/dim semantics so tallies mirror visible timeline.

## Migration Plan

Pure client change; `.ndjson` strings removed from UX.

## Open Questions

Whether to include muted DJ tracks in the enumerated list unchecked by default—the proposal keeps them checked by default but zero-count when mute excludes events; revisit if confusing.
