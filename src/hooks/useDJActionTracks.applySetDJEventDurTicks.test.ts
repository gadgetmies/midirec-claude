import { describe, expect, test } from 'vitest';
import {
  applySetDJEventDurTicks,
  buildCcMergedGroupsByMemberIndex,
  type ClusterResizeBaseline,
  type DJActionTrack,
} from './useDJActionTracks';
import { DEFAULT_ACTION_MAP, type ActionEvent } from '../data/dj';

/* All test clusters use a mixer-CC pitch so `resolvedDjRowOutputCc` returns a
   CC number and the events qualify for CC merge grouping. */
const CC_PITCH = 81; // ch1_vol → CC 18 by default mixer mapping

function makeTracks(events: ActionEvent[]): DJActionTrack[] {
  return [
    {
      id: 'dj1',
      name: 'DJ',
      color: 'oklch(70% 0.04 80)',
      midiChannel: 1,
      actionMap: { [CC_PITCH]: DEFAULT_ACTION_MAP[CC_PITCH] },
      outputMap: {},
      events,
      inputRouting: { channels: [] },
      outputRouting: { channels: [] },
      collapsed: false,
      muted: false,
      soloed: false,
      mutedRows: [],
      soloedRows: [],
      defaultMidiInputDeviceId: '',
      defaultMidiOutputDeviceId: '',
    },
  ];
}

function captureBaseline(tracks: DJActionTrack[], repIdx: number): ClusterResizeBaseline {
  const track = tracks[0];
  const group = buildCcMergedGroupsByMemberIndex(track).get(repIdx);
  if (!group) throw new Error('expected cluster at repIdx');
  const rep = track.events[repIdx];
  const memberTTicks = new Map<number, number>();
  let trailingIdx = group.memberIndices[0];
  let trailingEnd = track.events[trailingIdx].tTicks + track.events[trailingIdx].durTicks;
  for (const idx of group.memberIndices) {
    const ev = track.events[idx];
    memberTTicks.set(idx, ev.tTicks);
    const end = ev.tTicks + ev.durTicks;
    if (end > trailingEnd) {
      trailingEnd = end;
      trailingIdx = idx;
    }
  }
  return {
    memberTTicks,
    spanTicks: Math.max(1, trailingEnd - rep.tTicks),
    trailingIdx,
    trailingDurTicks: track.events[trailingIdx].durTicks,
  };
}

function ev(tTicks: number, durTicks: number): ActionEvent {
  return { pitch: CC_PITCH, tTicks, durTicks, vel: 100 };
}

describe('applySetDJEventDurTicks — cluster representative, baseline-relative', () => {
  test('round-trip shrink-then-restore restores members exactly (canonical drift case)', () => {
    // Offsets [0, 7, 13], span 20. With integer-only scaling, 20 → 5 → 20 drifts.
    const initial = makeTracks([ev(1000, 2), ev(1007, 2), ev(1013, 7)]);
    const baseline = captureBaseline(initial, 0);
    const shrunk = applySetDJEventDurTicks(initial, 'dj1', CC_PITCH, 0, 5, baseline);
    const restored = applySetDJEventDurTicks(shrunk, 'dj1', CC_PITCH, 0, 20, baseline);
    expect(restored[0].events[0].tTicks).toBe(1000);
    expect(restored[0].events[1].tTicks).toBe(1007);
    expect(restored[0].events[2].tTicks).toBe(1013);
    expect(restored[0].events[2].durTicks).toBe(baseline.trailingDurTicks);
  });

  test('three-step round-trip (span 240 → 80 → 30 → 240) restores members exactly', () => {
    // Offsets [0, 73, 211], trailing dur 29 → trailing end at t0+240.
    const initial = makeTracks([ev(0, 10), ev(73, 10), ev(211, 29)]);
    const baseline = captureBaseline(initial, 0);
    let tracks = applySetDJEventDurTicks(initial, 'dj1', CC_PITCH, 0, 80, baseline);
    tracks = applySetDJEventDurTicks(tracks, 'dj1', CC_PITCH, 0, 30, baseline);
    tracks = applySetDJEventDurTicks(tracks, 'dj1', CC_PITCH, 0, 240, baseline);
    expect(tracks[0].events[0].tTicks).toBe(0);
    expect(tracks[0].events[1].tTicks).toBe(73);
    expect(tracks[0].events[2].tTicks).toBe(211);
    expect(tracks[0].events[2].durTicks).toBe(29);
  });

  test('per-commit rounding error is bounded to <= 0.5 tick from the unrounded projection', () => {
    const initial = makeTracks([ev(0, 10), ev(73, 10), ev(240, 10)]);
    const baseline = captureBaseline(initial, 0);
    // scale = 100/250 = 0.4. Member at offset 73 → 29.2 → rounds to 29.
    const next = applySetDJEventDurTicks(initial, 'dj1', CC_PITCH, 0, 100, baseline);
    const projected = 73 * (100 / baseline.spanTicks);
    const actualOffset = next[0].events[1].tTicks - next[0].events[0].tTicks;
    expect(Math.abs(actualOffset - projected)).toBeLessThanOrEqual(0.5);
  });

  test('trailing member identity is preserved across the session', () => {
    // Member at idx 1 is the trailing member at baseline. After shrinking, the
    // function should still treat idx 1 as trailing.
    const initial = makeTracks([ev(0, 10), ev(50, 200), ev(80, 10)]);
    const baseline = captureBaseline(initial, 0);
    expect(baseline.trailingIdx).toBe(1);
    const next = applySetDJEventDurTicks(initial, 'dj1', CC_PITCH, 0, 100, baseline);
    // scale=100/250=0.4: idx1 newT = round(50*0.4)=20, newDur = max(1, 0+100-20)=80.
    expect(next[0].events[1].tTicks).toBe(20);
    expect(next[0].events[1].durTicks).toBe(80);
    expect(next[0].events[2].durTicks).toBe(10); // non-trailing keeps baseline dur
  });

  test('no-op when newSpanTicks equals baseline.spanTicks and state already matches projection', () => {
    const initial = makeTracks([ev(0, 10), ev(73, 10), ev(211, 29)]);
    const baseline = captureBaseline(initial, 0);
    const next = applySetDJEventDurTicks(initial, 'dj1', CC_PITCH, 0, 240, baseline);
    expect(next).toBe(initial); // same reference — no-op
  });

  test('clamps newSpanTicks to >= 1 and trailing durTicks to >= 1', () => {
    const initial = makeTracks([ev(0, 10), ev(100, 10)]);
    const baseline = captureBaseline(initial, 0);
    const next = applySetDJEventDurTicks(initial, 'dj1', CC_PITCH, 0, 0, baseline);
    const trailing = next[0].events[baseline.trailingIdx];
    expect(trailing.durTicks).toBeGreaterThanOrEqual(1);
    // Round-tripping back to baseline span still restores exactly.
    const restored = applySetDJEventDurTicks(next, 'dj1', CC_PITCH, 0, baseline.spanTicks, baseline);
    expect(restored[0].events[0].tTicks).toBe(0);
    expect(restored[0].events[1].tTicks).toBe(100);
    expect(restored[0].events[1].durTicks).toBe(baseline.trailingDurTicks);
  });
});

describe('applySetDJEventDurTicks — fallback (no baseline) preserves legacy behavior', () => {
  test('cluster representative scales from current state without baseline', () => {
    // offsets [0, 120, 240], oldSpan 300 → 600 (scale 2)
    const initial = makeTracks([ev(0, 10), ev(120, 10), ev(240, 60)]);
    const next = applySetDJEventDurTicks(initial, 'dj1', CC_PITCH, 0, 600);
    expect(next[0].events[0].tTicks).toBe(0);
    expect(next[0].events[1].tTicks).toBe(240);
    expect(next[0].events[2].tTicks).toBe(480);
    expect(next[0].events[2].tTicks + next[0].events[2].durTicks).toBe(600);
  });

  test('fallback no-op when newSpan equals oldSpan', () => {
    const initial = makeTracks([ev(0, 10), ev(120, 10), ev(240, 60)]);
    const next = applySetDJEventDurTicks(initial, 'dj1', CC_PITCH, 0, 300);
    expect(next).toBe(initial);
  });

  test('fallback path completes for round-trip (no exact equality guaranteed)', () => {
    const initial = makeTracks([ev(0, 1), ev(7, 1), ev(13, 7)]);
    const shrunk = applySetDJEventDurTicks(initial, 'dj1', CC_PITCH, 0, 5);
    const restored = applySetDJEventDurTicks(shrunk, 'dj1', CC_PITCH, 0, 20);
    expect(restored[0].events.length).toBe(3);
  });
});

describe('applySetDJEventDurTicks — non-representative and invalid selections', () => {
  test('non-representative cluster member edit is single-event semantics', () => {
    const initial = makeTracks([ev(0, 10), ev(50, 10), ev(100, 10)]);
    const baseline = captureBaseline(initial, 0);
    const next = applySetDJEventDurTicks(initial, 'dj1', CC_PITCH, 1, 25, baseline);
    expect(next[0].events[1].durTicks).toBe(25);
    expect(next[0].events[0].tTicks).toBe(0);
    expect(next[0].events[2].tTicks).toBe(100);
  });

  test('no-op for unknown trackId', () => {
    const initial = makeTracks([ev(0, 10)]);
    expect(applySetDJEventDurTicks(initial, 'nope', CC_PITCH, 0, 100)).toBe(initial);
  });

  test('no-op for out-of-range eventIdx', () => {
    const initial = makeTracks([ev(0, 10)]);
    expect(applySetDJEventDurTicks(initial, 'dj1', CC_PITCH, 99, 100)).toBe(initial);
  });

  test('no-op for pitch mismatch', () => {
    const initial = makeTracks([ev(0, 10)]);
    expect(applySetDJEventDurTicks(initial, 'dj1', 99, 0, 100)).toBe(initial);
  });
});
