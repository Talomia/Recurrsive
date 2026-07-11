'use client';

import { useState } from 'react';
import { AlertTriangle, X, RefreshCw } from 'lucide-react';

interface ErrorBannerProps {
  /** The error message to display */
  message: string;
  /** Optional callback to retry the failed operation */
  onRetry?: () => void;
  /** Optional callback when the banner is dismissed */
  onDismiss?: () => void;
  /** Whether to show in a compact style */
  compact?: boolean;
}

/**
 * Consistent dismissible error banner with retry support.
 * Used across all pages to surface API errors to users.
 */
export default function ErrorBanner({
  message,
  onRetry,
  onDismiss,
  compact = false,
}: ErrorBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] ${
        compact ? 'px-3 py-2' : 'px-4 py-3'
      }`}
    >
      <AlertTriangle
        className={`shrink-0 text-red-400 ${compact ? 'h-4 w-4 mt-0.5' : 'h-5 w-5 mt-0.5'}`}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className={`font-medium text-red-400 ${compact ? 'text-xs' : 'text-sm'}`}>
          Something went wrong
        </p>
        <p className={`text-red-400/80 mt-0.5 ${compact ? 'text-[11px]' : 'text-xs'}`}>
          {message}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1 rounded-lg bg-red-500/10 border border-red-500/20 px-2 py-1 text-[11px] font-medium text-red-400 hover:bg-red-500/20 transition-colors"
            aria-label="Retry failed operation"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            Retry
          </button>
        )}
        <button
          onClick={handleDismiss}
          className="flex h-6 w-6 items-center justify-center rounded-lg hover:bg-red-500/10 transition-colors"
          aria-label="Dismiss error"
        >
          <X className="h-3.5 w-3.5 text-red-400/60" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
