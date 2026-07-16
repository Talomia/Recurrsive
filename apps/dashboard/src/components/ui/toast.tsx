'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'info' | 'error';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  /** Show a toast. Returns the toast id. */
  toast: (message: string, type?: ToastType) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 5000;

const STYLES: Record<ToastType, { wrap: string; icon: typeof CheckCircle2; iconColor: string }> = {
  success: { wrap: 'border-green-500/20 bg-green-500/10', icon: CheckCircle2, iconColor: 'text-green-400' },
  info: { wrap: 'border-blue-500/20 bg-blue-500/10', icon: Info, iconColor: 'text-blue-400' },
  error: { wrap: 'border-red-500/20 bg-red-500/10', icon: AlertTriangle, iconColor: 'text-red-400' },
};

/**
 * App-wide toast provider. Renders an accessible, auto-dismissing toast stack
 * in the bottom-right. Consume via {@link useToast}.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    return id;
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[90] flex w-full max-w-sm flex-col gap-2 pointer-events-none"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const { wrap, icon: Icon, iconColor } = STYLES[item.type];

  useEffect(() => {
    const t = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      role="status"
      aria-live={item.type === 'error' ? 'assertive' : 'polite'}
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur-md animate-fade-in-up ${wrap}`}
    >
      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${iconColor}`} aria-hidden="true" />
      <span className="flex-1 text-text-primary">{item.message}</span>
      <button
        onClick={onDismiss}
        className="shrink-0 rounded-md p-0.5 text-text-muted hover:text-text-primary transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Access the toast API. Must be used within a {@link ToastProvider}.
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
