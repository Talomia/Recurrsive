import { Loader2 } from 'lucide-react';

interface LoadingSkeletonProps {
  /** Visual variant matching the content being loaded */
  variant?: 'card' | 'table' | 'chart' | 'list' | 'page';
  /** Number of skeleton items to show */
  count?: number;
  /** Optional page title to display while loading */
  title?: string;
}

/**
 * Shared loading skeleton component for consistent loading states.
 * Uses Loader2 spinner for the main indicator and shimmer skeleton for content shapes.
 */
export default function LoadingSkeleton({
  variant = 'page',
  count = 4,
  title,
}: LoadingSkeletonProps) {
  if (variant === 'page') {
    return (
      <div className="flex flex-col h-screen">
        {/* Header skeleton */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <div className="skeleton h-6 w-48" />
            <div className="skeleton h-4 w-64 mt-2" />
          </div>
          <div className="flex items-center gap-3">
            <div className="skeleton h-9 w-48 rounded-xl" />
            <div className="skeleton h-9 w-9 rounded-xl" />
          </div>
        </div>
        {/* Content skeleton */}
        <div className="flex-1 p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="glass-card p-5 min-h-[160px]">
                <div className="skeleton h-4 w-20 mb-3" />
                <div className="skeleton h-8 w-24 mb-2" />
                <div className="skeleton h-3 w-16" />
              </div>
            ))}
          </div>
          <div className="glass-card p-6 min-h-[300px]">
            <div className="skeleton h-5 w-32 mb-4" />
            <div className="skeleton h-[200px] w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="glass-card p-5 min-h-[140px]">
            <div className="skeleton h-4 w-20 mb-3" />
            <div className="skeleton h-7 w-24 mb-2" />
            <div className="skeleton h-3 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className="glass-card overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-4 border-b border-white/10 px-5 py-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-3 w-16 flex-1" />
          ))}
        </div>
        {/* Table rows */}
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-white/5 px-5 py-3 last:border-b-0"
          >
            {Array.from({ length: 5 }).map((_, j) => (
              <div
                key={j}
                className={`skeleton h-4 flex-1 ${j === 0 ? 'max-w-[80px]' : ''}`}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'chart') {
    return (
      <div className="glass-card p-6">
        <div className="skeleton h-5 w-32 mb-4" />
        <div className="skeleton h-[240px] w-full rounded-xl" />
      </div>
    );
  }

  // list variant
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-card p-4 flex items-center gap-3">
          <div className="skeleton h-10 w-10 rounded-xl shrink-0" />
          <div className="flex-1">
            <div className="skeleton h-4 w-48 mb-2" />
            <div className="skeleton h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Simple centered spinner for inline loading states.
 */
export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  }[size];

  return (
    <div className="flex items-center justify-center py-12" role="status" aria-live="polite">
      <Loader2 className={`${sizeClass} animate-spin text-accent-blue`} aria-hidden="true" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
