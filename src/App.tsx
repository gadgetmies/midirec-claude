import { AppShell } from './components/shell/AppShell';
import { ToastProvider } from './components/toast/Toast';
import { TransportProvider } from './hooks/useTransport';

export function App() {
  return (
    <div className="mr-app" data-mr-theme="console">
      <TransportProvider>
        <ToastProvider>
          <AppShell />
        </ToastProvider>
      </TransportProvider>
    </div>
  );
}
