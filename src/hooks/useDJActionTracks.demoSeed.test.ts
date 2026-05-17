import { describe, expect, it } from 'vitest';
import { buildDjDemoSeedTracks } from './useDJActionTracks';

function q127(e: { vel?: number }) {
  return Math.round((e.vel as number) * 127);
}

describe('DJ demo seed — automation preset', () => {
  it('mixer Ch 1 volume has 128 interpolated events at bounds t=4 and t=20', () => {
    const tracks = buildDjDemoSeedTracks(true, true);
    const mixer = tracks.find((t) => t.id === 'dj-mixer');
    expect(mixer).toBeDefined();
    const ch1 = mixer!.events
      .filter((e) => e.pitch === 81)
      .slice()
      .sort((a, b) => a.t - b.t);
    expect(ch1).toHaveLength(128);
    expect(ch1[0]?.t).toBeCloseTo(4, 12);
    expect(ch1[127]?.t).toBeCloseTo(20, 12);
    const quantized = ch1.map(q127);
    expect(quantized[0]).toBe(0);
    expect(quantized[127]).toBe(127);
    expect(quantized).toEqual([...quantized].sort((u, v) => u - v));
    expect(new Set(quantized).size).toBe(128);
  });

  it('mixer Ch 2 volume has 128 interpolated events descending 127..0 across t≈34..68', () => {
    const tracks = buildDjDemoSeedTracks(true, true);
    const mixer = tracks.find((t) => t.id === 'dj-mixer');
    const ch2 = mixer!.events
      .filter((e) => e.pitch === 82)
      .slice()
      .sort((a, b) => a.t - b.t);
    expect(ch2).toHaveLength(128);
    expect(ch2[0]?.t).toBeCloseTo(34, 12);
    expect(ch2[127]?.t).toBeCloseTo(68, 12);
    const quantized = ch2.map(q127);
    expect(quantized[0]).toBe(127);
    expect(quantized[127]).toBe(0);
    expect(quantized).toEqual(quantized.map((_, i) => 127 - i));
    expect(new Set(quantized).size).toBe(128);
  });

  it('mixer Ch 2 EQ low anchors at beat 4 and sweeps 0..63 on [26,34]', () => {
    const tracks = buildDjDemoSeedTracks(true, true);
    const mixer = tracks.find((t) => t.id === 'dj-mixer');
    const anchors = mixer!.events.filter((e) => e.pitch === 88 && e.t === 4);
    expect(anchors).toHaveLength(1);
    expect(q127(anchors[0]!)).toBe(0);
    const sweep = mixer!.events
      .filter((e) => e.pitch === 88 && e.t !== 4)
      .slice()
      .sort((a, b) => a.t - b.t);
    expect(sweep).toHaveLength(64);
    expect(sweep[0]?.t).toBeCloseTo(26, 12);
    expect(sweep[63]?.t).toBeCloseTo(34, 12);
    const sq = sweep.map(q127);
    expect(sq).toEqual(Array.from({ length: 64 }, (_, i) => i));
    expect(new Set(sq).size).toBe(64);
  });

  it('mixer Ch 1 EQ low sweeps 63..0 on [26,34]', () => {
    const tracks = buildDjDemoSeedTracks(true, true);
    const mixer = tracks.find((t) => t.id === 'dj-mixer');
    const sweep = mixer!.events
      .filter((e) => e.pitch === 85)
      .slice()
      .sort((a, b) => a.t - b.t);
    expect(sweep).toHaveLength(64);
    expect(sweep[0]?.t).toBeCloseTo(26, 12);
    expect(sweep[63]?.t).toBeCloseTo(34, 12);
    const sq = sweep.map(q127);
    expect(sq).toEqual(Array.from({ length: 64 }, (_, i) => 63 - i));
  });

  it('Deck 1 beat jump at t=1 encodes MIDI value 127', () => {
    const tracks = buildDjDemoSeedTracks(true, true);
    const deck1 = tracks.find((t) => t.id === 'dj-deck1');
    const bj = deck1!.events.find((e) => e.pitch === 76 && e.t === 1);
    expect(bj).toBeDefined();
    expect(Math.round((bj!.vel as number) * 127)).toBe(127);
  });

  it('default demo without automation keeps legacy Ch1/Ch2 volume tap counts', () => {
    const tracks = buildDjDemoSeedTracks(true, false);
    const mixer = tracks.find((t) => t.id === 'dj-mixer');
    expect(mixer!.events.filter((e) => e.pitch === 81)).toHaveLength(2);
    expect(mixer!.events.filter((e) => e.pitch === 82)).toHaveLength(2);
  });
});
