export interface ParsedDemoFlags {
  /** True iff URL should seed instrument timeline (Lead/Bass rolls + lanes). Implied by instrument, marquee, or note demos. */
  instrumentSeed: boolean;
  djDemo: boolean;
  demoMarquee: boolean;
  demoNote: boolean;
}

export function parseDemoQueryFlags(locationSearch: string): ParsedDemoFlags {
  const raw = locationSearch.startsWith('?') ? locationSearch.slice(1) : locationSearch;
  const params = new URLSearchParams(raw);
  const tokens = params.getAll('demo').map((s) => s.trim());
  const has = (token: string) => tokens.includes(token);

  const demoMarquee = has('marquee');
  const demoNote = !demoMarquee && has('note');

  const instrumentSeed = has('instrument') || demoMarquee || has('note');

  const djDemo = has('dj');

  return { instrumentSeed, djDemo, demoMarquee, demoNote };
}
