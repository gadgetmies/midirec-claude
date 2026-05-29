export interface ClockReceiverCallbacks {
  onPulse: (input: MIDIInput, timestampMs: number) => void;
  onStart: (input: MIDIInput) => void;
  onContinue: (input: MIDIInput) => void;
  onStop: (input: MIDIInput) => void;
}

const CLOCK_PULSE = 0xf8;
const CLOCK_START = 0xfa;
const CLOCK_CONTINUE = 0xfb;
const CLOCK_STOP = 0xfc;

export function attachClockReceiver(
  input: MIDIInput,
  callbacks: ClockReceiverCallbacks,
): () => void {
  const prev = input.onmidimessage;

  const handler = (event: MIDIMessageEvent) => {
    prev?.call(input, event);
    const data = event.data;
    if (!data || data.length < 1) return;
    const status = data[0]!;
    if (status === CLOCK_PULSE) {
      callbacks.onPulse(input, event.timeStamp);
      return;
    }
    if (status === CLOCK_START) {
      callbacks.onStart(input);
      return;
    }
    if (status === CLOCK_CONTINUE) {
      callbacks.onContinue(input);
      return;
    }
    if (status === CLOCK_STOP) {
      callbacks.onStop(input);
      return;
    }
  };

  input.onmidimessage = handler;

  let detached = false;
  return () => {
    if (detached) return;
    detached = true;
    if (input.onmidimessage === handler) {
      input.onmidimessage = prev;
    }
  };
}

/* Rolling smoother over the last 23 pulse intervals (= intervals between 24 pulses).
   Matches the spec scenario: bpm becomes a positive integer at the 24th pulse. */
export class BpmSmoother {
  private readonly intervals: number[] = [];
  private lastPulseAt: number | null = null;
  private static readonly THRESHOLD = 23;
  private static readonly MAX = 23;

  pulse(timestampMs: number): void {
    if (this.lastPulseAt != null) {
      const delta = timestampMs - this.lastPulseAt;
      if (delta > 0) {
        this.intervals.push(delta);
        if (this.intervals.length > BpmSmoother.MAX) {
          this.intervals.shift();
        }
      }
    }
    this.lastPulseAt = timestampMs;
  }

  reset(): void {
    this.intervals.length = 0;
    this.lastPulseAt = null;
  }

  meanIntervalMs(): number | null {
    if (this.intervals.length < BpmSmoother.THRESHOLD) return null;
    let sum = 0;
    for (const v of this.intervals) sum += v;
    return sum / this.intervals.length;
  }

  bpm(): number | null {
    const mean = this.meanIntervalMs();
    if (mean == null || mean <= 0) return null;
    return Math.round(60000 / (mean * 24));
  }
}
