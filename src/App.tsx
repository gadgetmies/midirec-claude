import { AppShell } from './components/shell/AppShell';
import { ToastProvider } from './components/toast/Toast';
import { StageProvider } from './hooks/useStage';
import { TransportProvider } from './hooks/useTransport';
import { MidiRuntimeProvider } from './midi/MidiRuntimeProvider';
import { MidiRecorderRunner } from './midi/recorder';

export function App() {
  return (
    <div className="mr-app" data-mr-theme="console">
      <TransportProvider>
        <ToastProvider>
          <MidiRuntimeProvider>
            <StageProvider>
              <MidiRecorderRunner />
              <AppShell />
            </StageProvider>
          </MidiRuntimeProvider>
        </ToastProvider>
      </TransportProvider>
    </div>
  );
}
