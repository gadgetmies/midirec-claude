import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import './Toast.css';

export type ToastKind = 'info' | 'ok' | 'warn';

export interface ToastOptions {
  kind?: ToastKind;
  durationMs?: number;
  shortcut?: string;
}

interface ToastState {
  id: number;
  message: string;
  kind: ToastKind;
  shortcut?: string;
}

interface ToastContextValue {
  show(message: string, opts?: ToastOptions): void;
  dismiss(): void;
  toast: ToastState | null;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const idRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);

  const dismiss = useCallback(() => {
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setToast(null);
  }, []);

  const show = useCallback((message: string, opts?: ToastOptions) => {
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const id = ++idRef.current;
    const next: ToastState = {
      id,
      message,
      kind: opts?.kind ?? 'ok',
      shortcut: opts?.shortcut,
    };
    setToast(next);
    const duration = opts?.durationMs ?? 2000;
    if (duration > 0) {
      timeoutRef.current = window.setTimeout(() => {
        setToast((current) => (current?.id === id ? null : current));
        timeoutRef.current = null;
      }, duration);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current != null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <ToastContext.Provider value={{ show, dismiss, toast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return { show: ctx.show, dismiss: ctx.dismiss };
}

export function ToastViewport() {
  const ctx = useContext(ToastContext);
  if (!ctx) return null;
  const { toast } = ctx;
  return (
    <div className="mr-toast-viewport" aria-live="polite">
      {toast && (
        <div className="mr-toast" role="status" key={toast.id}>
          <span className="mr-toast__dot" data-kind={toast.kind} />
          <span className="mr-toast__msg">{toast.message}</span>
          {toast.shortcut && <kbd className="mr-toast__hint mr-mono">{toast.shortcut}</kbd>}
        </div>
      )}
    </div>
  );
}
