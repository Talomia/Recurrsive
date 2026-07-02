'use client';

/**
 * Global error boundary for the dashboard.
 *
 * Catches unhandled errors in client components and provides a retry button.
 * Uses the design system's CSS variables for consistent theming.
 */

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // Log error to console for debugging (production would use an error reporter)
    console.error('[Dashboard Error Boundary]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div
        className="p-8 max-w-lg w-full text-center rounded-2xl"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div
          className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
          style={{ background: 'rgba(251, 146, 60, 0.1)' }}
        >
          <AlertTriangle className="h-8 w-8 text-orange-400" />
        </div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">Something went wrong</h2>
        <p className="text-text-secondary mb-6 text-sm leading-relaxed">{error.message}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all flex items-center gap-2"
            style={{ background: 'var(--color-accent)' }}
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: 'var(--color-base)',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
            }}
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}
