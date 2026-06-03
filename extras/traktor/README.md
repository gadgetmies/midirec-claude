# Traktor MIDI bridge (midirec DJ actions)

The generator produces **two** Generic MIDI mappings with the **same control addresses** (notes / CCs) as this app’s DJ action input defaults (`src/data/dj.ts` and mixer CC rows):

| File | Direction | Use case |
|------|-----------|----------|
| `MidirecDJ.MIDI-Out.App-Defaults.tsi` | Traktor → MIDI | Traktor drives the same MIDI midirec **listens** for (e.g. record Traktor gestures). |
| `MidirecDJ.MIDI-In.App-Defaults.tsi` | MIDI → Traktor | A controller (or app sending the same MIDI) **controls** Traktor with midirec-aligned notes/CCs. |

Regenerate both whenever that catalog changes.

## Prerequisites

- **Python 3.10+** (3.12 is verified in CI/local dev).
- Network access on **first run** (downloads the Generic MIDI template from [ivanz/TraktorMappingFileFormat](https://github.com/ivanz/TraktorMappingFileFormat/blob/master/Samples/blank.tsi)).

## Generate the `.tsi` files

From the repository root:

```bash
python3.12 -m venv .venv-traktor
.venv-traktor/bin/pip install py-ni-traktor-tsi
.venv-traktor/bin/python scripts/generate_midirec_traktor_tsi.py
```

Outputs:

- `extras/traktor/MidirecDJ.MIDI-Out.App-Defaults.tsi`
- `extras/traktor/MidirecDJ.MIDI-In.App-Defaults.tsi`

On first run, the script caches the blank template under `scripts/data/blank-generic-midi.tsi` (that directory is gitignored). Later runs work offline.

## Import in Traktor

1. Open **Traktor Pro** → **Preferences** → **Controller Manager**.
2. **Import** the `.tsi` you need (you can import both; use separate device setups if Traktor requires it).
3. Choose the **Generic MIDI** (or matching) device entry.
4. Select the correct **MIDI input** (for the In map) and/or **MIDI output** (for the Out map).

**MIDI-In mapping:** incoming notes/CCs trigger the listed Traktor commands (transport pads use toggle or direct/hold per command type—adjust in Controller Manager if a button feels wrong).

**MIDI-Out mapping:** when Traktor’s state changes for those commands, matching MIDI is sent on the same addresses midirec expects.

## Maintaining the generator

- Implementation: `scripts/generate_midirec_traktor_tsi.py`
- The action table in that script must stay aligned with **`DEFAULT_ACTION_MAP`** in `src/data/dj.ts` when you add or change DJ actions.
- Some Traktor command targets (hotcues, loop size, FX beats) are best-effort; verify in Controller Manager after import.
