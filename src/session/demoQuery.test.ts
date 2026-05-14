import { describe, expect, it } from 'vitest';
import { parseDemoQueryFlags } from './demoQuery';

const base = {
  instrumentSeed: false,
  djDemo: false,
  djDemoMessages: false,
  djAutomationDemo: false,
  demoMarquee: false,
  demoNote: false,
};

describe('parseDemoQueryFlags', () => {
  it('returns all false for empty search', () => {
    expect(parseDemoQueryFlags('')).toEqual(base);
  });

  it('parses marquee (implies instrumentSeed)', () => {
    expect(parseDemoQueryFlags('?demo=marquee')).toEqual({
      ...base,
      instrumentSeed: true,
      demoMarquee: true,
    });
  });

  it('parses note (implies instrumentSeed)', () => {
    expect(parseDemoQueryFlags('?demo=note')).toEqual({
      ...base,
      instrumentSeed: true,
      demoNote: true,
    });
  });

  it('parses dj without instruments', () => {
    expect(parseDemoQueryFlags('?demo=dj')).toEqual({
      ...base,
      djDemo: true,
      djDemoMessages: true,
    });
  });

  it('parses repeated demo keys', () => {
    expect(parseDemoQueryFlags('?demo=instrument&demo=dj')).toEqual({
      ...base,
      instrumentSeed: true,
      djDemo: true,
      djDemoMessages: true,
    });
  });

  it('demo=marquee wins over demo=note for note flag semantics', () => {
    expect(parseDemoQueryFlags('?demo=marquee&demo=note')).toEqual({
      ...base,
      instrumentSeed: true,
      demoMarquee: true,
    });
  });

  it('clean alone does not set instrumentSeed', () => {
    expect(parseDemoQueryFlags('?demo=clean')).toEqual(base);
  });

  it('clean with marquee keeps instrumentSeed for marquee', () => {
    expect(parseDemoQueryFlags('?demo=clean&demo=marquee')).toEqual({
      ...base,
      instrumentSeed: true,
      demoMarquee: true,
    });
  });

  it('parses dj-empty: same DJ seed, no synthetic events flag', () => {
    expect(parseDemoQueryFlags('?demo=dj-empty')).toEqual({
      ...base,
      djDemo: true,
      djDemoMessages: false,
    });
  });

  it('dj-empty wins over dj for synthetic messages', () => {
    expect(parseDemoQueryFlags('?demo=dj&demo=dj-empty')).toEqual({
      ...base,
      djDemo: true,
      djDemoMessages: false,
    });
  });

  it('parses dj-automation alongside dj', () => {
    expect(parseDemoQueryFlags('?demo=dj&demo=dj-automation')).toEqual({
      ...base,
      djDemo: true,
      djDemoMessages: true,
      djAutomationDemo: true,
    });
  });

  it('parses dj-automation token even when dj-empty wins messages', () => {
    expect(parseDemoQueryFlags('?demo=dj&demo=dj-empty&demo=dj-automation')).toEqual({
      ...base,
      djDemo: true,
      djDemoMessages: false,
      djAutomationDemo: true,
    });
  });

  it('dj-automation alone does not enable djDemo', () => {
    expect(parseDemoQueryFlags('?demo=dj-automation')).toEqual({
      ...base,
      djAutomationDemo: true,
    });
  });

  it('accepts leading ? or raw query fragment', () => {
    expect(parseDemoQueryFlags('demo=dj')).toEqual(parseDemoQueryFlags('?demo=dj'));
  });
});
