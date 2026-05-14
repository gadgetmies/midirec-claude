import { describe, expect, it } from 'vitest';
import { buildDjDemoSeedTracks } from './useDJActionTracks';

describe('DJ demo seed — automation preset', () => {
  it('mixer Ch 1 volume has 17 stepped events from t=4 to t=20', () => {
    const tracks = buildDjDemoSeedTracks(true, true);
    const mixer = tracks.find((t) => t.id === 'dj-mixer');
    expect(mixer).toBeDefined();
    const ch1 = mixer!.events.filter((e) => e.pitch === 81);
    expect(ch1).toHaveLength(17);
    expect(ch1[0]?.t).toBe(4);
    expect(ch1[16]?.t).toBe(20);
  });

  it('mixer Ch 2 volume has 35 stepped events from t=34 to t=68', () => {
    const tracks = buildDjDemoSeedTracks(true, true);
    const mixer = tracks.find((t) => t.id === 'dj-mixer');
    const ch2 = mixer!.events.filter((e) => e.pitch === 82);
    expect(ch2).toHaveLength(35);
    expect(ch2[0]?.t).toBe(34);
    expect(ch2[34]?.t).toBe(68);
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
