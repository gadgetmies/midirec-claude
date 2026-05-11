import { AppShell } from './components/shell/AppShell';
import { ToastProvider } from './components/toast/Toast';
import { StageProvider } from './hooks/useStage';
import { TransportProvider } from './hooks/useTransport';
import { MidiRuntimeProvider } from './midi/MidiRuntimeProvider';

export function App() {
  return (
    <div className="mr-app" data-mr-theme="console">
      <TransportProvider>
        <ToastProvider>
          <MidiRuntimeProvider>
            <StageProvider>
              <AppShell />
            </StageProvider>
          </MidiRuntimeProvider>
        </ToastProvider>
      </TransportProvider>
    </div>
  );
}
