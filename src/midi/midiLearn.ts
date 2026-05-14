export type MidiLearnWireMessage =
  | { kind: 'noteOn'; portId: string; channel1to16: number; note: number; velocity: number }
  | { kind: 'controlChange'; portId: string; channel1to16: number; controller: number; value: number }
  | { kind: 'channelPressure'; portId: string; channel1to16: number; pressure: number }
  | { kind: 'pitchBend'; portId: string; channel1to16: number; value14: number };

const MIDI_CH_MASK = 0x0f;
const STATUS_KIND_MASK = 0xf0;

export function nibbleToChannelId1to16(midiChNibble: number): number {
  return (midiChNibble & MIDI_CH_MASK) + 1;
}

export function parseMidiLearnMessage(portId: string, data: Uint8Array): MidiLearnWireMessage | null {
  if (!data || data.length < 1) return null;
  const status0 = data[0]!;
  const nibble = status0 & MIDI_CH_MASK;
  const kind = status0 & STATUS_KIND_MASK;
  const channel1to16 = nibbleToChannelId1to16(nibble);

  if (kind === 0x90) {
    const note = data[1] ?? 0;
    const velocity = data[2] ?? 0;
    if (velocity === 0) return null;
    return { kind: 'noteOn', portId, channel1to16, note, velocity };
  }
  if (kind === 0xb0) {
    const controller = data[1] ?? 0;
    const value = data[2] ?? 0;
    return { kind: 'controlChange', portId, channel1to16, controller, value };
  }
  if (kind === 0xd0) {
    const pressure = data[1] ?? 0;
    return { kind: 'channelPressure', portId, channel1to16, pressure };
  }
  if (kind === 0xe0) {
    const lsb = data[1] ?? 0;
    const msb = data[2] ?? 0;
    const value14 = (msb << 7) | lsb;
    return { kind: 'pitchBend', portId, channel1to16, value14 };
  }
  return null;
}
