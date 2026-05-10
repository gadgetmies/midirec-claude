import { AppShell } from './components/shell/AppShell';
import { ToastProvider } from './components/toast/Toast';
import { StageProvider } from './hooks/useStage';
import { TransportProvider } from './hooks/useTransport';

export function App() {
  return (
    <div className="mr-app" data-mr-theme="console">
      <TransportProvider>
        <ToastProvider>
          <StageProvider>
            <AppShell />
          </StageProvider>
        </ToastProvider>
      </TransportProvider>
    </div>
  );
}
