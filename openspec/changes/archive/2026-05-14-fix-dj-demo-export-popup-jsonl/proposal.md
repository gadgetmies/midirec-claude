## Why

Opening Export in the DJ-only demo (`?demo=dj`) still lists two empty instrument channels (Lead and Bass) while the real timed content lives on the DJ action track; the DJ track never appears as an export source. Whole-session span and event counts also ignore DJ `events`, so the dialog can show zero bars or block Save even though the timeline has DJ clips. Separately, the UI labels the line-delimited JSON format “NDJSON” and `.ndjson`, but we want the conventional **JSON Lines** naming and `.jsonl` extension, with JSONL export that actually emits DJ track events when that track is selected.

## What Changes

- Extend the Export dialog track list so **DJ action tracks** appear as first-class rows (swatch, name, event counts) alongside instrument channels where applicable.
- When instrument channels have **no exportable timeline content** (no notes and no lane points), omit them from the default track list—or otherwise avoid presenting empty Lead/Bass rows as the primary export targets in DJ-only sessions—while still allowing explicit multi-kind sessions (instrument + DJ) to show both kinds.
- Drive **whole-session / selection / loop** resolved range and **event totals** using the **union** of channel rolls or lanes **and** selected DJ tracks’ `events` (beats-aligned with existing session time).
- Rename the format affordance from **NDJSON** to **JSON Lines (JSONL)**, default filenames to `.jsonl`, and implement **downloadable JSONL** on Save when that format is selected: one JSON object per line, covering checked sources; DJ lines SHALL include stable fields needed to reconstruct action events (`trackId`, `trackKind: 'dj'`, event payload, resolved action metadata as needed — exact schema in design).
- Standard MIDI File export remains as today unless design explicitly extends it for DJ rows (defer MIDI packing of DJ events unless trivial and already planned—default is JSONL-first for DJ content).

## Capabilities

### New Capabilities

- _(none)_ — behavior extends existing export and DJ surfaces rather than introducing a new top-level capability name.

### Modified Capabilities

- `export-dialog`: Track list composition (include DJ tracks; hide or de-emphasize empty instrument stubs in DJ-only context); rename NDJSON UI and file extension to JSONL; widen range and counting logic to DJ `events`; add real JSONL file generation on Save for that format while keeping prior “toast only” behavior for MIDI until Slice 10 fully lands (or clarify parallel paths in design).
- `session-model` (incremental clarification only if export’s “whole session” span remains specified there): Explicitly tie on-demand span used by Export’s “Whole session” to the same datum set as layout horizon—including DJ action `events`.

## Impact

- `src/components/dialog/ExportDialog.tsx` — track list state, labels, counting, range, Save handler / download trigger.
- `src/hooks/useStage.tsx` / types — Export may need `djActionTracks` plus existing `rolls`/`lanes`; no API break expected.
- Potential small helper module for JSONL serialisation (e.g. under `src/session/` or `src/export/`).
- Tests touching Export dialog scenarios or demos with `demo=dj`.
- User-facing docs or strings referencing NDJSON `.ndjson` anywhere in UI or tests.
