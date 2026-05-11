export interface MidiInput {
  id: string;
  name: string;
  channel: number | 'omni' | number[];
}

export interface StatusbarValue {
  lastInput: MidiInput | null;
  active: boolean;
}

const STUB: StatusbarValue = {
  lastInput: {
    id: 'korg-minilogue-xd',
    name: 'Korg minilogue xd',
    channel: 1,
  },
  active: true,
};

export function useStatusbar(): StatusbarValue {
  return STUB;
}

export function formatChannel(channel: MidiInput['channel']): string {
  if (channel === 'omni') return 'CH·OMNI';
  if (typeof channel === 'number') return `CH·${channel}`;
  if (channel.length === 0) return 'CH·—';
  if (channel.length === 1) return `CH·${channel[0]}`;
  const sorted = [...channel].sort((a, b) => a - b);
  const isContiguous = sorted.every((n, i) => i === 0 || n === sorted[i - 1]! + 1);
  if (isContiguous) return `CH·${sorted[0]}–${sorted[sorted.length - 1]}`;
  return `CH·${sorted.join(',')}`;
}
