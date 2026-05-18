import { DEFAULT_MIDI_TPQ } from './timelineTicks';

export type QuantizeGrid = '1/4' | '1/8' | '1/16' | '1/32';

export const QUANTIZE_GRIDS: readonly QuantizeGrid[] = ['1/4', '1/8', '1/16', '1/32'];

const DIVISORS: Record<QuantizeGrid, number> = {
  '1/4': 1,
  '1/8': 2,
  '1/16': 4,
  '1/32': 8,
};

export function quantizeGridToTicks(
  grid: QuantizeGrid,
  tpq: number = DEFAULT_MIDI_TPQ,
): number {
  return tpq / DIVISORS[grid];
}
