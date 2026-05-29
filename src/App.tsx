import { AppShell } from './components/shell/AppShell';
import { ToastProvider } from './components/toast/Toast';
import { StageProvider } from './hooks/useStage';
import { TransportProvider } from './hooks/useTransport';
import { MidiClockProvider } from './midi/MidiClockProvider';
import { MidiRuntimeProvider } from './midi/MidiRuntimeProvider';
import { MidiRecorderRunner } from './midi/recorder';
import { MidiSchedulerRunner } from './midi/scheduler';

export function App() {
  return (
    <div className="mr-app" data-mr-theme="console">
      <TransportProvider>
        <ToastProvider>
          <MidiRuntimeProvider>
            <MidiClockProvider>
              <StageProvider>
                <MidiRecorderRunner />
                <MidiSchedulerRunner />
                <AppShell />
              </StageProvider>
            </MidiClockProvider>
          </MidiRuntimeProvider>
        </ToastProvider>
      </TransportProvider>
    </div>
  );
}
