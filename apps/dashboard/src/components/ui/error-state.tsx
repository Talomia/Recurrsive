'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  /** Short human title. Defaults to a generic message. */
  title?: string;
  /** Detailed message — typically the API error text. */
  message: string;
  /** Optional retry affordance. */
  onRetry?: () => void;
  /** Compact variant for in-panel errors. */
  compact?: boolean;
  className?: string;
}

/**
 * Shared full-panel error state with a retry affordance.
 *
 * Distinct from the empty state: this means something actually failed
 * (server unreachable / 5xx), not that there is no data yet.
 */
export default function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  compact = false,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'py-12 px-6' : 'py-20 px-6'
      } ${className ?? ''}`}
    >
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 mb-4">
        <AlertTriangle className="h-7 w-7 text-red-400" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-semibold text-text-primary mb-2">{title}</h2>
      <p className="text-sm text-text-secondary max-w-md mb-2">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      )}
    </div>
  );
}
