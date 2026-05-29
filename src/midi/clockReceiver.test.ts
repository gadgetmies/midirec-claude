import { describe, expect, test, vi } from 'vitest';
import { attachClockReceiver, BpmSmoother, type ClockReceiverCallbacks } from './clockReceiver';

interface FakeInput {
  onmidimessage: ((event: MIDIMessageEvent) => void) | null;
}

function makeInput(): FakeInput {
  return { onmidimessage: null };
}

function makeEvent(bytes: number[], timeStamp = 0): MIDIMessageEvent {
  return {
    data: new Uint8Array(bytes),
    timeStamp,
  } as unknown as MIDIMessageEvent;
}

function makeCallbacks(): ClockReceiverCallbacks & {
  pulses: number[];
  starts: number;
  continues: number;
  stops: number;
} {
  const cb = {
    pulses: [] as number[],
    starts: 0,
    continues: 0,
    stops: 0,
    onPulse: (_input: MIDIInput, ts: number) => {
      cb.pulses.push(ts);
    },
    onStart: () => {
      cb.starts += 1;
    },
    onContinue: () => {
      cb.continues += 1;
    },
    onStop: () => {
      cb.stops += 1;
    },
  };
  return cb;
}

describe('attachClockReceiver', () => {
  test('parses 0xF8 / 0xFA / 0xFB / 0xFC and invokes the corresponding callbacks', () => {
    const input = makeInput();
    const cb = makeCallbacks();
    attachClockReceiver(input as unknown as MIDIInput, cb);

    input.onmidimessage!(makeEvent([0xf8], 100));
    input.onmidimessage!(makeEvent([0xfa], 110));
    input.onmidimessage!(makeEvent([0xfb], 120));
    input.onmidimessage!(makeEvent([0xfc], 130));

    expect(cb.pulses).toEqual([100]);
    expect(cb.starts).toBe(1);
    expect(cb.continues).toBe(1);
    expect(cb.stops).toBe(1);
  });

  test('chains a previously-installed handler', () => {
    const input = makeInput();
    const prev = vi.fn();
    input.onmidimessage = prev;

    const cb = makeCallbacks();
    attachClockReceiver(input as unknown as MIDIInput, cb);

    const event = makeEvent([0xf8], 7);
    input.onmidimessage!(event);

    expect(prev).toHaveBeenCalledTimes(1);
    expect(prev).toHaveBeenCalledWith(event);
    expect(cb.pulses).toEqual([7]);
  });

  test('non-real-time messages are forwarded to prev but ignored by the receiver', () => {
    const input = makeInput();
    const prev = vi.fn();
    input.onmidimessage = prev;

    const cb = makeCallbacks();
    attachClockReceiver(input as unknown as MIDIInput, cb);

    input.onmidimessage!(makeEvent([0x90, 60, 100])); // Note On
    input.onmidimessage!(makeEvent([0x80, 60, 0])); // Note Off
    input.onmidimessage!(makeEvent([0xb0, 7, 64])); // CC
    input.onmidimessage!(makeEvent([0xe0, 0, 64])); // Pitch Bend
    input.onmidimessage!(makeEvent([0xd0, 64])); // Channel Aftertouch
    input.onmidimessage!(makeEvent([0xa0, 60, 80])); // Poly AT

    expect(prev).toHaveBeenCalledTimes(6);
    expect(cb.pulses).toEqual([]);
    expect(cb.starts).toBe(0);
    expect(cb.continues).toBe(0);
    expect(cb.stops).toBe(0);
  });

  test('detach restores the prior handler reference', () => {
    const input = makeInput();
    const prev = vi.fn();
    input.onmidimessage = prev;

    const cb = makeCallbacks();
    const detach = attachClockReceiver(input as unknown as MIDIInput, cb);

    expect(input.onmidimessage).not.toBe(prev);
    detach();
    expect(input.onmidimessage).toBe(prev);
  });

  test('detach is idempotent and does not clobber a newer handler', () => {
    const input = makeInput();
    const prev = vi.fn();
    input.onmidimessage = prev;

    const cb = makeCallbacks();
    const detach = attachClockReceiver(input as unknown as MIDIInput, cb);
    detach();
    detach();
    expect(input.onmidimessage).toBe(prev);

    // Now someone else installs a fresh handler; calling detach again must not unset it.
    const newer = vi.fn();
    input.onmidimessage = newer;
    detach();
    expect(input.onmidimessage).toBe(newer);
  });

  test('ignores empty or missing data', () => {
    const input = makeInput();
    const cb = makeCallbacks();
    attachClockReceiver(input as unknown as MIDIInput, cb);

    input.onmidimessage!(makeEvent([]));
    // null data is technically not legal but should not crash
    input.onmidimessage!({ data: null, timeStamp: 0 } as unknown as MIDIMessageEvent);

    expect(cb.pulses).toEqual([]);
    expect(cb.starts).toBe(0);
  });
});

describe('BpmSmoother', () => {
  test('returns null until 24 pulses have been observed', () => {
    const s = new BpmSmoother();
    for (let i = 0; i < 23; i++) {
      s.pulse(i * 20.833);
      expect(s.bpm()).toBeNull();
    }
    // 24th pulse → 23 intervals → ready
    s.pulse(23 * 20.833);
    expect(s.bpm()).not.toBeNull();
  });

  test('converges to 120 BPM for 20.833 ms intervals', () => {
    const s = new BpmSmoother();
    for (let i = 0; i < 30; i++) {
      s.pulse(i * 20.833);
    }
    expect(s.bpm()).toBe(120);
  });

  test('converges to 128 BPM for 19.531 ms intervals', () => {
    const s = new BpmSmoother();
    // At 128 BPM, per-pulse = 60000 / 128 / 24 ≈ 19.53125 ms
    const interval = 60000 / 128 / 24;
    for (let i = 0; i < 30; i++) {
      s.pulse(i * interval);
    }
    expect(s.bpm()).toBe(128);
  });

  test('reset clears intervals and last-pulse timestamp', () => {
    const s = new BpmSmoother();
    for (let i = 0; i < 30; i++) s.pulse(i * 20.833);
    expect(s.bpm()).toBe(120);
    s.reset();
    expect(s.bpm()).toBeNull();
    // After reset, the first pulse should NOT create an interval against the old timestamp.
    s.pulse(1000);
    s.pulse(1020.833);
    expect(s.bpm()).toBeNull(); // only 1 interval so far
  });

  test('rolling window discards old intervals as new ones arrive', () => {
    const s = new BpmSmoother();
    // Fill window with 120-BPM intervals.
    for (let i = 0; i < 25; i++) s.pulse(i * 20.833);
    expect(s.bpm()).toBe(120);
    // Now feed many 140-BPM intervals; eventually the mean should shift.
    const fast = 60000 / 140 / 24;
    let t = 25 * 20.833;
    for (let i = 0; i < 30; i++) {
      t += fast;
      s.pulse(t);
    }
    expect(s.bpm()).toBe(140);
  });

  test('non-positive intervals are ignored', () => {
    const s = new BpmSmoother();
    s.pulse(100);
    s.pulse(100); // zero delta
    s.pulse(50); // negative delta
    // We've effectively recorded zero intervals.
    expect(s.bpm()).toBeNull();
  });
});
