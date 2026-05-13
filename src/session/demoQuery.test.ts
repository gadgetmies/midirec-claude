import { describe, expect, it } from 'vitest';
import { parseDemoQueryFlags } from './demoQuery';

describe('parseDemoQueryFlags', () => {
  it('returns all false for empty search', () => {
    expect(parseDemoQueryFlags('')).toEqual({
      instrumentSeed: false,
      djDemo: false,
      djDemoMessages: false,
      demoMarquee: false,
      demoNote: false,
    });
  });

  it('parses marquee (implies instrumentSeed)', () => {
    expect(parseDemoQueryFlags('?demo=marquee')).toEqual({
      instrumentSeed: true,
      djDemo: false,
      djDemoMessages: false,
      demoMarquee: true,
      demoNote: false,
    });
  });

  it('parses note (implies instrumentSeed)', () => {
    expect(parseDemoQueryFlags('?demo=note')).toEqual({
      instrumentSeed: true,
      djDemo: false,
      djDemoMessages: false,
      demoMarquee: false,
      demoNote: true,
    });
  });

  it('parses dj without instruments', () => {
    expect(parseDemoQueryFlags('?demo=dj')).toEqual({
      instrumentSeed: false,
      djDemo: true,
      djDemoMessages: true,
      demoMarquee: false,
      demoNote: false,
    });
  });

  it('parses repeated demo keys', () => {
    expect(parseDemoQueryFlags('?demo=instrument&demo=dj')).toEqual({
      instrumentSeed: true,
      djDemo: true,
      djDemoMessages: true,
      demoMarquee: false,
      demoNote: false,
    });
  });

  it('demo=marquee wins over demo=note for note flag semantics', () => {
    expect(parseDemoQueryFlags('?demo=marquee&demo=note')).toEqual({
      instrumentSeed: true,
      djDemo: false,
      djDemoMessages: false,
      demoMarquee: true,
      demoNote: false,
    });
  });

  it('clean alone does not set instrumentSeed', () => {
    expect(parseDemoQueryFlags('?demo=clean')).toEqual({
      instrumentSeed: false,
      djDemo: false,
      djDemoMessages: false,
      demoMarquee: false,
      demoNote: false,
    });
  });

  it('clean with marquee keeps instrumentSeed for marquee', () => {
    expect(parseDemoQueryFlags('?demo=clean&demo=marquee')).toEqual({
      instrumentSeed: true,
      djDemo: false,
      djDemoMessages: false,
      demoMarquee: true,
      demoNote: false,
    });
  });

  it('parses dj-empty: same DJ seed, no synthetic events flag', () => {
    expect(parseDemoQueryFlags('?demo=dj-empty')).toEqual({
      instrumentSeed: false,
      djDemo: true,
      djDemoMessages: false,
      demoMarquee: false,
      demoNote: false,
    });
  });

  it('dj-empty wins over dj for synthetic events', () => {
    expect(parseDemoQueryFlags('?demo=dj&demo=dj-empty')).toEqual({
      instrumentSeed: false,
      djDemo: true,
      djDemoMessages: false,
      demoMarquee: false,
      demoNote: false,
    });
  });

  it('accepts leading ? or raw query fragment', () => {
    expect(parseDemoQueryFlags('demo=dj')).toEqual(parseDemoQueryFlags('?demo=dj'));
  });
});
