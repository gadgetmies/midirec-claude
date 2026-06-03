import { AppShell } from './components/shell/AppShell';
import { ToastProvider } from './components/toast/Toast';
import { StageProvider } from './hooks/useStage';
import { TimelineDropProvider } from './hooks/useTimelineDrop';
import { TimelineStorageProvider } from './hooks/useTimelineStorage';
import { TransportProvider } from './hooks/useTransport';
import { ControlMapStoreProvider } from './hooks/useControlMapStore';
import { MidiClockProvider } from './midi/MidiClockProvider';
import { MidiClockSendProvider } from './midi/MidiClockSendProvider';
import { MidiControlProvider } from './midi/MidiControlProvider';
import { ControlFeedbackRunner } from './midi/ControlFeedbackRunner';
import { MidiRuntimeProvider } from './midi/MidiRuntimeProvider';
import { MetronomeRunner } from './midi/metronome';
import { MidiRecorderRunner } from './midi/recorder';
import { MidiSchedulerRunner } from './midi/scheduler';

export function App() {
  return (
    <div className="mr-app" data-mr-theme="console">
      <TransportProvider>
        <ToastProvider>
          <MidiRuntimeProvider>
            <MidiClockProvider>
              <MidiClockSendProvider>
                {/* Global control-mapping store loads at app start, independent
                    of the session. The recorder (consumption) and the control
                    receiver / feedback both read it, so it wraps them all. */}
                <ControlMapStoreProvider>
                  <MidiControlProvider>
                    <StageProvider>
                      <TimelineStorageProvider>
                        <TimelineDropProvider>
                          <MidiRecorderRunner />
                          <MidiSchedulerRunner />
                          <MetronomeRunner />
                          <ControlFeedbackRunner />
                          <AppShell />
                        </TimelineDropProvider>
                      </TimelineStorageProvider>
                    </StageProvider>
                  </MidiControlProvider>
                </ControlMapStoreProvider>
              </MidiClockSendProvider>
            </MidiClockProvider>
          </MidiRuntimeProvider>
        </ToastProvider>
      </TransportProvider>
    </div>
  );
}
