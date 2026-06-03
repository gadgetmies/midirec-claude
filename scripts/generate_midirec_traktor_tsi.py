#!/usr/bin/env python3
"""Build Traktor Generic MIDI mappings from midirec DJ action MIDI bindings.

Writes two TSIs (same control addresses, different directions):
- MidirecDJ.MIDI-Out.App-Defaults.tsi — Traktor -> MIDI (mapping_type Out)
- MidirecDJ.MIDI-In.App-Defaults.tsi — MIDI -> Traktor (mapping_type In)

Requires Python >= 3.10 and: pip install py-ni-traktor-tsi

Template: MIT-licensed blank Generic MIDI from ivanz/TraktorMappingFileFormat
(samples/blank.tsi). Cached under scripts/data/ (gitignored).

Usage: extras/traktor/README.md

Mixer rows use CC numbers from defaultMixerOutputCc in src/data/dj.ts; other
rows use notes on row pitch. Command targets are best-effort; tune in
Controller Manager after import.
"""

from __future__ import annotations

import urllib.request
from pathlib import Path

from traktor_tsi import (
    build_cmad_button,
    build_cmad_knob,
    build_cmad_output,
    build_cmai,
    build_ddcb,
    get_device_info,
    parse_tsi,
    rebuild_tsi,
    write_tsi,
)
from traktor_tsi.constants import (
    CMD_MASTER_BEAT_TAP,
    CMD_BEATJUMP,
    CMD_MOVE_SIZE_SEL,
    CMD_CUE,
    CMD_EQ_HIGH,
    CMD_EQ_LOW,
    CMD_EQ_MID,
    CMD_FX_DRY_WET,
    CMD_FX_KNOB_1,
    CMD_FX_UNIT_ON,
    CMD_HOTCUE_SELECT_SET_STORE,
    CMD_LOAD_SELECTED,
    CMD_LOOP_BACKWARD_SIZE_SET,
    CMD_LOOP_IN,
    CMD_LOOP_OUT,
    CMD_LOOP_SIZE_SELECT_SET,
    CMD_PLAY,
    CMD_REVERSE,
    CMD_SYNC,
    CMD_VOLUME,
    CMD_XFADER_POSITION,
    deck_target,
    fx_target,
)

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR / "data"
TEMPLATE_URL = (
    "https://raw.githubusercontent.com/ivanz/TraktorMappingFileFormat/"
    "master/Samples/blank.tsi"
)

NOTE_NAMES = ("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")

MIXER_CC = {
    "xfade_pos": 16,
    "ch1_vol": 7,
    "ch2_vol": 7,
    "ch1_eq_hi": 17,
    "ch1_eq_mid": 18,
    "ch1_eq_lo": 19,
    "ch2_eq_hi": 20,
    "ch2_eq_mid": 21,
    "ch2_eq_lo": 22,
}

DEFAULT_ACTION_MAP: dict[int, dict] = {
    48: {"id": "play", "cat": "deck", "device": "deck1"},
    49: {"id": "cue", "cat": "deck", "device": "deck1"},
    50: {"id": "sync", "cat": "deck", "device": "deck1"},
    51: {"id": "rev", "cat": "deck", "device": "deck1"},
    52: {"id": "loop_in", "cat": "deck", "device": "deck1"},
    53: {"id": "loop_out", "cat": "deck", "device": "deck1"},
    54: {"id": "loop_x2", "cat": "deck", "device": "deck1"},
    55: {"id": "loop_half", "cat": "deck", "device": "deck1"},
    56: {"id": "hc1", "cat": "deck", "device": "deck1"},
    57: {"id": "hc2", "cat": "deck", "device": "deck1"},
    58: {"id": "hc3", "cat": "deck", "device": "deck1"},
    59: {"id": "hc4", "cat": "deck", "device": "deck1"},
    60: {"id": "fx1_on", "cat": "fx", "device": "fx1"},
    61: {"id": "fx1_beat", "cat": "fx", "device": "fx1"},
    62: {"id": "fx1_dry", "cat": "fx", "device": "fx1"},
    63: {"id": "fx2_on", "cat": "fx", "device": "fx2"},
    64: {"id": "fx2_beat", "cat": "fx", "device": "fx2"},
    65: {"id": "play_b", "cat": "deck", "device": "deck2"},
    66: {"id": "cue_b", "cat": "deck", "device": "deck2"},
    67: {"id": "sync_b", "cat": "deck", "device": "deck2"},
    68: {"id": "loop_in_b", "cat": "deck", "device": "deck2"},
    69: {"id": "hc1_b", "cat": "deck", "device": "deck2"},
    70: {"id": "hc2_b", "cat": "deck", "device": "deck2"},
    73: {"id": "load_a", "cat": "browser", "device": "mixer"},
    74: {"id": "load_b", "cat": "browser", "device": "mixer"},
    75: {"id": "tap", "cat": "global", "device": "global"},
    76: {"id": "beat_jump", "cat": "deck", "device": "deck1"},
    77: {"id": "beat_jump_b", "cat": "deck", "device": "deck2"},
    78: {"id": "hc3_b", "cat": "deck", "device": "deck2"},
    79: {"id": "hc4_b", "cat": "deck", "device": "deck2"},
    80: {"id": "xfade_pos", "cat": "mixer", "device": "mixer"},
    81: {"id": "ch1_vol", "cat": "mixer", "device": "mixer"},
    82: {"id": "ch2_vol", "cat": "mixer", "device": "mixer"},
    83: {"id": "ch1_eq_hi", "cat": "mixer", "device": "mixer"},
    84: {"id": "ch1_eq_mid", "cat": "mixer", "device": "mixer"},
    85: {"id": "ch1_eq_lo", "cat": "mixer", "device": "mixer"},
    86: {"id": "ch2_eq_hi", "cat": "mixer", "device": "mixer"},
    87: {"id": "ch2_eq_mid", "cat": "mixer", "device": "mixer"},
    88: {"id": "ch2_eq_lo", "cat": "mixer", "device": "mixer"},
    89: {"id": "beat_jump_size", "cat": "deck", "device": "deck1"},
    90: {"id": "beat_jump_size_b", "cat": "deck", "device": "deck2"},
}


def device_deck_letter(device: str) -> str:
    return {"deck1": "A", "deck2": "B", "deck3": "C", "deck4": "D"}.get(device, "A")


def midi_note_name(note: int, channel: int = 1) -> str:
    octave = note // 12 - 1
    name = NOTE_NAMES[note % 12]
    return f"Ch{channel:02d}.Note.{name}{octave}"


def midi_cc_name(cc: int, channel: int = 1) -> str:
    return f"Ch{channel:02d}.CC.{cc:03d}"


def traktor_ctrl_name(pitch: int, entry: dict) -> str:
    ch = int(entry.get("midiInputChannel") or 1)
    aid = entry["id"]
    cat = entry["cat"]
    if cat == "mixer" and aid in MIXER_CC:
        return midi_cc_name(MIXER_CC[aid], ch)
    if entry.get("midiInputKind") == "cc" and entry.get("midiInputCc") is not None:
        return midi_cc_name(int(entry["midiInputCc"]), ch)
    note = int(entry["midiInputNote"]) if entry.get("midiInputNote") is not None else pitch
    return midi_note_name(note, ch)


def hotcue_cue_index(action_id: str) -> int:
    s = action_id.removesuffix("_b")
    if s.startswith("hc") and len(s) >= 3 and s[2].isdigit():
        return int(s[2]) - 1
    return 0


def hotcue_cmd_target(device: str, action_id: str) -> int:
    d = device_deck_letter(device)
    return deck_target(d) * 4 + hotcue_cue_index(action_id)


def cmd_for_action(action_id: str, device: str) -> tuple[int, int]:
    d = device_deck_letter(device)
    dt = deck_target(d)
    if action_id in ("play", "play_b"):
        return CMD_PLAY, dt
    if action_id in ("cue", "cue_b"):
        return CMD_CUE, dt
    if action_id in ("sync", "sync_b"):
        return CMD_SYNC, dt
    if action_id in ("rev",):
        return CMD_REVERSE, dt
    if action_id in ("loop_in", "loop_in_b"):
        return CMD_LOOP_IN, dt
    if action_id in ("loop_out",):
        return CMD_LOOP_OUT, dt
    if action_id == "loop_x2":
        return CMD_LOOP_SIZE_SELECT_SET, dt
    if action_id == "loop_half":
        return CMD_LOOP_BACKWARD_SIZE_SET, dt
    if action_id in ("hc1", "hc2", "hc3", "hc4", "hc1_b", "hc2_b", "hc3_b", "hc4_b"):
        return CMD_HOTCUE_SELECT_SET_STORE, hotcue_cmd_target(device, action_id)
    if action_id in ("beat_jump", "beat_jump_b"):
        return CMD_BEATJUMP, dt
    if action_id in ("beat_jump_size", "beat_jump_size_b"):
        return CMD_MOVE_SIZE_SEL, dt
    if action_id == "load_a":
        return CMD_LOAD_SELECTED, deck_target("A")
    if action_id == "load_b":
        return CMD_LOAD_SELECTED, deck_target("B")
    if action_id == "tap":
        return CMD_MASTER_BEAT_TAP, 0
    if action_id == "fx1_on":
        return CMD_FX_UNIT_ON, fx_target(1)
    if action_id == "fx2_on":
        return CMD_FX_UNIT_ON, fx_target(2)
    if action_id == "fx1_dry":
        return CMD_FX_DRY_WET, fx_target(1)
    if action_id == "fx1_beat":
        return CMD_FX_KNOB_1, fx_target(1)
    if action_id == "fx2_beat":
        return CMD_FX_KNOB_1, fx_target(2)
    if action_id == "xfade_pos":
        return CMD_XFADER_POSITION, 0
    if action_id == "ch1_vol":
        return CMD_VOLUME, deck_target("A")
    if action_id == "ch2_vol":
        return CMD_VOLUME, deck_target("B")
    if action_id == "ch1_eq_hi":
        return CMD_EQ_HIGH, deck_target("A")
    if action_id == "ch1_eq_mid":
        return CMD_EQ_MID, deck_target("A")
    if action_id == "ch1_eq_lo":
        return CMD_EQ_LOW, deck_target("A")
    if action_id == "ch2_eq_hi":
        return CMD_EQ_HIGH, deck_target("B")
    if action_id == "ch2_eq_mid":
        return CMD_EQ_MID, deck_target("B")
    if action_id == "ch2_eq_lo":
        return CMD_EQ_LOW, deck_target("B")
    return CMD_PLAY, 0


def is_continuous_action(action_id: str) -> bool:
    return action_id in MIXER_CC or action_id in (
        "fx1_dry",
        "fx1_beat",
        "fx2_beat",
        "xfade_pos",
    )


TOGGLE_BUTTON_IDS = frozenset(
    {
        "play",
        "play_b",
        "sync",
        "sync_b",
        "rev",
        "fx1_on",
        "fx2_on",
        "hc1",
        "hc2",
        "hc3",
        "hc4",
        "hc1_b",
        "hc2_b",
        "hc3_b",
        "hc4_b",
    }
)


def build_cmad_for_output(action_id: str, tgt: int) -> bytes:
    if is_continuous_action(action_id):
        return build_cmad_knob(target=tgt, interaction_mode=3)
    return build_cmad_output(target=tgt, invert=0)


def build_cmad_for_input(action_id: str, tgt: int) -> bytes:
    if is_continuous_action(action_id):
        return build_cmad_knob(target=tgt, interaction_mode=3)
    mode = 1 if action_id in TOGGLE_BUTTON_IDS else 2
    return build_cmad_button(target=tgt, interaction_mode=mode)


def build_mapping(mapping_type: int) -> tuple[list[bytes], list[str]]:
    cmais: list[bytes] = []
    names: list[str] = []
    idx = 0
    for pitch in sorted(DEFAULT_ACTION_MAP.keys()):
        entry = DEFAULT_ACTION_MAP[pitch]
        ctrl = traktor_ctrl_name(pitch, entry)
        cmd_id, tgt = cmd_for_action(entry["id"], entry["device"])
        if mapping_type == 1:
            cmad = build_cmad_for_output(entry["id"], tgt)
        else:
            cmad = build_cmad_for_input(entry["id"], tgt)
        cmais.append(build_cmai(idx, mapping_type, cmd_id, cmad))
        names.append(ctrl)
        idx += 1
    return cmais, names


def ensure_template() -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    dest = DATA_DIR / "blank-generic-midi.tsi"
    if not dest.exists():
        print(f"Downloading template -> {dest}")
        urllib.request.urlretrieve(TEMPLATE_URL, dest)
    return dest


def main() -> None:
    repo_root = SCRIPT_DIR.parent
    trak_dir = repo_root / "extras" / "traktor"
    trak_dir.mkdir(parents=True, exist_ok=True)
    template = ensure_template()

    original = parse_tsi(str(template))
    info = get_device_info(original)
    print("Template:", info.get("name"), "base mappings:", info.get("mapping_count"))

    jobs: list[tuple[str, int, str]] = [
        (
            "MidirecDJ.MIDI-Out.App-Defaults.tsi",
            1,
            "midirec-claude DJ: Traktor -> MIDI (Out); scripts/generate_midirec_traktor_tsi.py",
        ),
        (
            "MidirecDJ.MIDI-In.App-Defaults.tsi",
            0,
            "midirec-claude DJ: MIDI -> Traktor (In); scripts/generate_midirec_traktor_tsi.py",
        ),
    ]

    for filename, mtype, comment in jobs:
        cmais, names = build_mapping(mtype)
        ddcb = build_ddcb(cmais, names)
        new_binary = rebuild_tsi(original, ddcb, comment)
        out_path = trak_dir / filename
        write_tsi(new_binary, str(out_path), str(template))
        vinfo = get_device_info(parse_tsi(str(out_path)))
        print("Wrote:", out_path, "mappings:", vinfo.get("mapping_count"), "type:", mtype)


if __name__ == "__main__":
    main()
