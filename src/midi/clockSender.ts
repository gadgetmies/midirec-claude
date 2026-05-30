/* Raw MIDI byte emission helpers for midi-clock-send.

   Each helper iterates the given outputs and calls `send([...bytes], timestamp)`
   on each. Errors from `send()` are silently swallowed: a stale `MIDIOutput`
   reference can throw `InvalidStateError` immediately after a port disconnect,
   and we don't want one bad port to abort the batch for the others.

   The functions accept a `ClockOutput` shape rather than the full Web MIDI
   `MIDIOutput` so tests can pass plain mocks. */

export interface ClockOutput {
  id: string;
  send(data: number[] | Uint8Array, timestamp?: number): void;
}

/* ── Single-byte System Real-Time emits ─────────────────────────────────── */

function emitByte(outs: ClockOutput[], byte: number, timestamp = 0): void {
  for (const out of outs) {
    try {
      out.send([byte], timestamp);
    } catch {
      /* stale port reference / closed device — ignore */
    }
  }
}

export function emitClock(outs: ClockOutput[], timestamp = 0): void {
  emitByte(outs, 0xf8, timestamp);
}

export function emitStart(outs: ClockOutput[], timestamp = 0): void {
  emitByte(outs, 0xfa, timestamp);
}

export function emitContinue(outs: ClockOutput[], timestamp = 0): void {
  emitByte(outs, 0xfb, timestamp);
}

export function emitStop(outs: ClockOutput[], timestamp = 0): void {
  emitByte(outs, 0xfc, timestamp);
}

/* ── Song Position Pointer ──────────────────────────────────────────────── */

const SPP_MAX = 0x3fff; // 14-bit max = 16383

export function emitSongPositionPointer(outs: ClockOutput[], sppBeats: number, timestamp = 0): void {
  const clamped = Math.max(0, Math.min(SPP_MAX, Math.floor(sppBeats)));
  const lsb = clamped & 0x7f;
  const msb = (clamped >>> 7) & 0x7f;
  for (const out of outs) {
    try {
      out.send([0xf2, lsb, msb], timestamp);
    } catch {
      /* ignore */
    }
  }
}

/* ── Grid-Alignment trigger helpers (Note On/Off + CC) ──────────────────── */

function clampByte(v: number): number {
  return Math.max(0, Math.min(127, Math.floor(v)));
}

function clampChannel(ch: number): number {
  return Math.max(1, Math.min(16, Math.floor(ch)));
}

export function emitNoteOn(
  outs: ClockOutput[],
  channel: number,
  note: number,
  velocity: number,
  timestamp = 0,
): void {
  const status = 0x90 | (clampChannel(channel) - 1);
  const n = clampByte(note);
  const v = clampByte(velocity);
  for (const out of outs) {
    try {
      out.send([status, n, v], timestamp);
    } catch {
      /* ignore */
    }
  }
}

export function emitNoteOff(
  outs: ClockOutput[],
  channel: number,
  note: number,
  timestamp = 0,
): void {
  const status = 0x80 | (clampChannel(channel) - 1);
  const n = clampByte(note);
  for (const out of outs) {
    try {
      out.send([status, n, 0], timestamp);
    } catch {
      /* ignore */
    }
  }
}

export function emitCC(
  outs: ClockOutput[],
  channel: number,
  cc: number,
  value: number,
  timestamp = 0,
): void {
  const status = 0xb0 | (clampChannel(channel) - 1);
  const c = clampByte(cc);
  const v = clampByte(value);
  for (const out of outs) {
    try {
      out.send([status, c, v], timestamp);
    } catch {
      /* ignore */
    }
  }
}

/* ── Sync bundle: Stop → SPP → Start|Continue ───────────────────────────── */

/* Compute the 14-bit SPP value (sixteenth-note count) from a playhead in
   integer MIDI ticks at the given TPQ. SPP unit = 1/16 note = TPQ/4 ticks. */
export function ticksToSppBeats(playheadTicks: number, tpq: number): number {
  if (tpq <= 0) return 0;
  return Math.floor(playheadTicks / (tpq / 4));
}

/* Emit Stop, SPP, then Start (when at position 0) or Continue (mid-song) to
   every selected output in a tight synchronous loop. No `await`, no
   microtask boundary — Web MIDI preserves order per-output. */
export function emitSyncBundle(
  outs: ClockOutput[],
  playheadTicks: number,
  tpq: number,
  timestamp = 0,
): void {
  if (outs.length === 0) return;
  const sppBeats = ticksToSppBeats(playheadTicks, tpq);
  emitStop(outs, timestamp);
  emitSongPositionPointer(outs, sppBeats, timestamp);
  if (playheadTicks === 0) {
    emitStart(outs, timestamp);
  } else {
    emitContinue(outs, timestamp);
  }
}

/* ── Internal 24-PPQ scheduler ──────────────────────────────────────────── */

export interface InternalSchedulerDeps {
  /** Returns current BPM (may change between batches). */
  getBpm: () => number;
  /** Returns current set of outputs to emit to (may change between batches). */
  getOutputs: () => ClockOutput[];
  /** Called once per committed pulse so the provider can advance txPulse. */
  onPulse: () => void;
  /** Look-ahead window in ms; defaults to 25. */
  lookaheadMs?: number;
  /** Polling interval in ms; defaults to 12 (lookahead minus headroom). */
  intervalMs?: number;
}

export interface InternalScheduler {
  start(): void;
  stop(): void;
  reset(): void;
  /** True iff the scheduler is currently running. */
  readonly running: boolean;
}

const DEFAULT_LOOKAHEAD_MS = 25;
const DEFAULT_INTERVAL_MS = 12;
const MIN_BPM = 1;
const MAX_BPM = 500;

export function createInternalScheduler(deps: InternalSchedulerDeps): InternalScheduler {
  const lookaheadMs = deps.lookaheadMs ?? DEFAULT_LOOKAHEAD_MS;
  const intervalMs = deps.intervalMs ?? DEFAULT_INTERVAL_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let nextPulseTimeMs = 0;
  let running = false;

  function pulseIntervalMsForBpm(bpm: number): number {
    const safeBpm = Math.max(MIN_BPM, Math.min(MAX_BPM, bpm));
    return 60000 / (safeBpm * 24);
  }

  function tick(): void {
    if (!running) return;
    const now = performance.now();
    const lookaheadEnd = now + lookaheadMs;
    while (nextPulseTimeMs <= lookaheadEnd) {
      const outs = deps.getOutputs();
      if (outs.length > 0) {
        emitClock(outs, nextPulseTimeMs);
      }
      deps.onPulse();
      const bpm = deps.getBpm();
      nextPulseTimeMs += pulseIntervalMsForBpm(bpm);
      /* Safety: if bpm is degenerate (returning ≤0 or NaN), the interval
         could be Infinity or NaN; the Math.max above prevents the worst,
         but guard against runaway loops if a future refactor breaks that. */
      if (!Number.isFinite(nextPulseTimeMs)) {
        nextPulseTimeMs = now + 1;
        break;
      }
    }
    timer = setTimeout(tick, intervalMs);
  }

  return {
    start(): void {
      if (running) return;
      running = true;
      nextPulseTimeMs = performance.now();
      tick();
    },
    stop(): void {
      if (!running) return;
      running = false;
      if (timer != null) {
        clearTimeout(timer);
        timer = null;
      }
    },
    reset(): void {
      nextPulseTimeMs = performance.now();
    },
    get running() {
      return running;
    },
  };
}
