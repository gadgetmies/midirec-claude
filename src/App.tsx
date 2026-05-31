import { AppShell } from './components/shell/AppShell';
import { ToastProvider } from './components/toast/Toast';
import { StageProvider } from './hooks/useStage';
import { TimelineDropProvider } from './hooks/useTimelineDrop';
import { TimelineStorageProvider } from './hooks/useTimelineStorage';
import { TransportProvider } from './hooks/useTransport';
import { MidiClockProvider } from './midi/MidiClockProvider';
import { MidiClockSendProvider } from './midi/MidiClockSendProvider';
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
                <StageProvider>
                  <TimelineStorageProvider>
                    <TimelineDropProvider>
                      <MidiRecorderRunner />
                      <MidiSchedulerRunner />
                      <MetronomeRunner />
                      <AppShell />
                    </TimelineDropProvider>
                  </TimelineStorageProvider>
                </StageProvider>
              </MidiClockSendProvider>
            </MidiClockProvider>
          </MidiRuntimeProvider>
        </ToastProvider>
      </TransportProvider>
    </div>
  );
}
