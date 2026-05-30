/* Audible metronome: produces a click tone via Web Audio on each beat
   boundary while `useTransport().mode === 'play'` AND `metronomeOn === true`.
   The browser routes the output to the user's OS-selected audio device.

   This is a deliberate exception to the project's MIDI-only rule: the
   metronome is a click reference for the human author, not a MIDI emission.
   No other audio synthesis happens elsewhere in the codebase. */

import { useEffect, useRef } from 'react';
import { useTransport } from '../hooks/useTransport';
import { DEFAULT_MIDI_TPQ } from './timelineTicks';

const ACCENT_FREQ_HZ = 1500;
const TICK_FREQ_HZ = 1000;
const CLICK_DURATION_S = 0.05;
const CLICK_PEAK_GAIN = 0.25;
const CLICK_ATTACK_S = 0.001;

function parseBeatsPerBar(sig: string): number {
  const [numStr] = sig.split('/');
  const n = Number.parseInt(numStr ?? '4', 10);
  return Number.isFinite(n) && n > 0 ? n : 4;
}

/* Resolve the click frequency for a beat number within a bar. `beatInBar0`
   is zero-based: 0 = downbeat accent. Exported for tests. */
export function resolveClickFrequency(beatInBar0: number): number {
  return beatInBar0 === 0 ? ACCENT_FREQ_HZ : TICK_FREQ_HZ;
}

/* Emit a single click at the given audio time. Each click is an independent
   short oscillator + gain envelope; the oscillator stops itself once the
   tail finishes, so we don't leak nodes. Exported for tests. */
export function emitClick(ctx: AudioContext, freqHz: number, atSec: number): void {
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = freqHz;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, atSec);
  gain.gain.linearRampToValueAtTime(CLICK_PEAK_GAIN, atSec + CLICK_ATTACK_S);
  /* exponentialRampToValueAtTime needs a strictly positive target; using a
     small epsilon avoids the WebAudio error path. */
  gain.gain.exponentialRampToValueAtTime(0.0001, atSec + CLICK_DURATION_S);

  osc.connect(gain).connect(ctx.destination);
  osc.start(atSec);
  osc.stop(atSec + CLICK_DURATION_S + 0.01);
}

interface AudioContextCtor {
  new (): AudioContext;
}

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof globalThis === 'undefined') return null;
  const w = globalThis as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export function useMetronome(): void {
  const { mode, metronomeOn, playheadTicks, sig } = useTransport();
  const lastBeatRef = useRef<number>(-1);
  const ctxRef = useRef<AudioContext | null>(null);

  /* Reset beat tracking on play/toggle transitions so the first click after
     a stop+resume fires on the next beat boundary, not on a stale "last
     emitted" memory. */
  useEffect(() => {
    if (mode !== 'play' || !metronomeOn) {
      lastBeatRef.current = -1;
    }
  }, [mode, metronomeOn]);

  useEffect(() => {
    if (mode !== 'play') return;
    if (!metronomeOn) return;

    const tpq = DEFAULT_MIDI_TPQ;
    const currentBeat = Math.floor(playheadTicks / tpq);

    /* Playhead rewound below the last-emitted beat (rewind, cue, manual
       seek): reset tracking so the next forward beat re-fires. */
    if (currentBeat < lastBeatRef.current) {
      lastBeatRef.current = -1;
    }

    if (currentBeat === lastBeatRef.current) return;

    /* Lazy-create the AudioContext on the first beat. The user-driven
       metronome toggle is a gesture that satisfies the browser's autoplay
       policy; creating earlier (e.g. on mount) would fail. */
    if (ctxRef.current === null) {
      const Ctor = getAudioContextCtor();
      if (Ctor === null) return;
      try {
        ctxRef.current = new Ctor();
      } catch {
        return;
      }
    }
    const ctx = ctxRef.current;
    /* If the context was suspended (e.g. tab backgrounded), kick it back. */
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {
        /* User hasn't gestured yet; nothing to do — the next click will retry. */
      });
    }

    const beatsPerBar = parseBeatsPerBar(sig);
    const beatInBar = ((currentBeat % beatsPerBar) + beatsPerBar) % beatsPerBar;
    const freq = resolveClickFrequency(beatInBar);

    try {
      emitClick(ctx, freq, ctx.currentTime);
    } catch {
      /* If WebAudio is in an unrecoverable state, skip this click rather
         than crash the render. */
    }

    lastBeatRef.current = currentBeat;
  }, [mode, metronomeOn, playheadTicks, sig]);

  /* Final cleanup: close the AudioContext on unmount so we don't leak it
     across hot-module-replacement reloads in dev. */
  useEffect(() => {
    return () => {
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
      }
    };
  }, []);
}

export function MetronomeRunner(): null {
  useMetronome();
  return null;
}
