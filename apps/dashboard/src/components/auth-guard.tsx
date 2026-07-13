/**
 * @module Dashboard Auth Guard
 *
 * Client-side wrapper that redirects unauthenticated users to the
 * login page. Used in the root layout to protect all dashboard routes.
 *
 * @packageDocumentation
 */

'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

/** Path prefixes that don't require authentication. */
const PUBLIC_PREFIXES = ['/login', '/setup', '/invite'];

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading, error, refreshSession } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic && !error) {
      router.replace('/login');
    }
    if (user && isPublic) {
      router.replace('/');
    }
  }, [user, loading, error, isPublic, router]);

  // Show nothing while resolving auth state (prevents flash).
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-base)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
               style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
          <span className="text-sm text-text-secondary">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user && !isPublic && error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--color-base)' }}>
        <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <h1 className="text-lg font-semibold text-text-primary">Unable to verify your session</h1>
          <p className="mt-2 text-sm text-text-secondary">{error}</p>
          <button
            type="button"
            onClick={() => void refreshSession()}
            className="mt-5 rounded-xl bg-accent-blue px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Retry connection
          </button>
        </div>
      </div>
    );
  }

  // Redirect in progress — render nothing.
  if (!user && !isPublic) return null;
  if (user && isPublic) return null;

  return <>{children}</>;
}
