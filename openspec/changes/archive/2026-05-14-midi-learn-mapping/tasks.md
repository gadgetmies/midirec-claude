## 1. MIDI learn core

- [x] 1.1 Add a `useMidiLearn` hook (or equivalent module) that attaches `midimessage` listeners to all `MIDIInput` instances from `useMidiInputs()` only while armed, and removes them on disarm / unmount
- [x] 1.2 Implement message parsing helpers: status kind, channel nibble → `1..16`, note-on vs note-off (velocity 0), CC number/data, consistent with existing MIDI handling in the codebase
- [x] 1.3 Implement “first qualifying message wins”: after one successful capture, detach listeners and clear armed state
- [x] 1.4 Add cancel paths (toggle off, Escape) and optional idle timeout auto-cancel (~10–15 s) with no persistence

## 2. Map Note (input mapping)

- [x] 2.1 Wire learn into `InputMappingPanel` / form: arm state, button with `aria-pressed`, placed after **MIDI in · devices** and before **MIDI in · ch** / note / CC grid
- [x] 2.2 Filter eligible `MIDIInput` ids per row (`midiInputDeviceIds` non-empty → subset; empty → match existing track-default / “all off” semantics used for recording)
- [x] 2.3 On capture, call `setActionEntry` once with merged `midiInputChannel` and note/CC fields matching current `midiInputKind` profile (`mergeMidiInputKind` / clamps)

## 3. Inspector (output mapping, row-level)

- [x] 3.1 Add Learn `.mr-kv` row after **Device** and before **Channel** in the row-level Output panel JSX
- [x] 3.2 On capture, call `setOutputMapping` once merging `channel` and `pitch` or `cc` per visible output mode (note vs CC-out); retain virtual `device` from the Device select; apply note-vs-CC clearing rule from design when switching modes
- [x] 3.3 Style learn row to match Inspector `.mr-kv` layout; ensure `data-mr-dj-selection-region` wrapper behavior unchanged

## 4. Verification

- [x] 4.1 Manually verify: arm → note-on updates input channel+note; arm in CC mode → CC updates channel+cc; output learn updates channel+pitch or channel+cc; cancel leaves state unchanged
- [x] 4.2 Run existing test suite / fix any regressions from new listeners
