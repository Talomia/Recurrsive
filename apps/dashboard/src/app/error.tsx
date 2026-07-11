'use client';

/**
 * Global error boundary for the dashboard.
 *
 * Catches unhandled errors in client components and provides a retry button.
 * Uses the design system's CSS variables for consistent theming.
 */

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    // Log error to console for debugging (production would use an error reporter)
    console.error('[Dashboard Error Boundary]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="glass-card p-8 max-w-lg w-full text-center">
        <div
          className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
          style={{ background: 'rgba(251, 146, 60, 0.1)' }}
        >
          <AlertTriangle className="h-8 w-8 text-orange-400" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">Something went wrong</h2>
        <p className="text-text-secondary mb-6 text-sm leading-relaxed">{error.message}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all flex items-center gap-2 hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary))' }}
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Try Again
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-text-secondary bg-white/5 border border-white/10 hover:bg-white/8 transition-all"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}
