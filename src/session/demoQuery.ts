export interface ParsedDemoFlags {
  /** True iff URL should seed instrument timeline (Lead/Bass rolls + lanes). Implied by instrument, marquee, or note demos. */
  instrumentSeed: boolean;
  /** True iff `demo=dj` and/or `demo=dj-empty` — seeds DJ action tracks (same action maps). */
  djDemo: boolean;
  /** False when `demo=dj-empty` alone or combined with `demo=dj` (empty wins); true only for `demo=dj` without `dj-empty`. */
  djDemoMessages: boolean;
  /** True iff `demo=dj-automation` appears. Effective for DJ demo events only when `djDemo` and `djDemoMessages` are both true (see `useStage`). */
  djAutomationDemo: boolean;
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

  const djEmpty = has('dj-empty');
  const djFull = has('dj');
  const djDemo = djFull || djEmpty;
  const djDemoMessages = djFull && !djEmpty;
  const djAutomationDemo = has('dj-automation');

  return { instrumentSeed, djDemo, djDemoMessages, djAutomationDemo, demoMarquee, demoNote };
}
