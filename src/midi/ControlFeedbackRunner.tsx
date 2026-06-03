import { useCallback, useEffect, useRef } from 'react';
import { useTransport } from '../hooks/useTransport';
import { useControlMapStore } from '../hooks/useControlMapStore';
import { useMidiClockSend } from './MidiClockSendProvider';
import { useMidiRuntime } from './MidiRuntimeProvider';
import { useMidiControl } from './MidiControlProvider';
import { buildControlSurface } from './MidiControlProvider';
import { emitFeedback, feedbackEmissionsForState } from './controlFeedback';
import type { ClockOutput } from './clockSender';
import type { TargetKey } from './controlMap';

/* Watches mapped toggle/enum target state and emits MIDI feedback to drive
   controller LEDs. Emits on each state change, plus a forced initial sync at
   load and whenever map mode exits. Output writes are independent of the clock
   sender; a missing feedback port is skipped silently. */
export function ControlFeedbackRunner(): null {
  const transport = useTransport();
  const clockSend = useMidiClockSend();
  const store = useControlMapStore();
  const { state: runtimeState } = useMidiRuntime();
  const { mapMode } = useMidiControl();

  const lastRef = useRef(new Map<TargetKey, number>());

  const surface = buildControlSurface(transport, clockSend);
  const surfaceRef = useRef(surface);
  surfaceRef.current = surface;

  const resolveOutput = useCallback(
    (portId: string): ClockOutput | null => {
      if (runtimeState.status !== 'granted') return null;
      const port = runtimeState.access.outputs.get(portId);
      return port ? (port as unknown as ClockOutput) : null;
    },
    [runtimeState],
  );

  // Emit on each state change. The surface is rebuilt every render, so this
  // effect runs frequently, but `feedbackEmissionsForState` diffs against
  // `lastRef` and only emits genuine changes. Feedback is paused in map mode.
  useEffect(() => {
    if (!store.loaded || mapMode) return;
    const emissions = feedbackEmissionsForState(store.state, surfaceRef.current, lastRef.current);
    emitFeedback(emissions, resolveOutput);
  });

  // Forced sync: at load and whenever map mode exits, push the current state of
  // every feedback mapping so the controller LEDs match the app.
  useEffect(() => {
    if (!store.loaded || mapMode) return;
    const emissions = feedbackEmissionsForState(store.state, surfaceRef.current, lastRef.current, {
      force: true,
    });
    emitFeedback(emissions, resolveOutput);
    // Run on load and on each map-mode exit; resolveOutput changes on hotplug.
  }, [store.loaded, mapMode, resolveOutput, store.state]);

  return null;
}
