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

/** Paths that don't require authentication. */
const PUBLIC_PATHS = new Set(['/login', '/setup']);

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublic = PUBLIC_PATHS.has(pathname);

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic) {
      router.replace('/login');
    }
    if (user && isPublic) {
      router.replace('/');
    }
  }, [user, loading, isPublic, router]);

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

  // Redirect in progress — render nothing.
  if (!user && !isPublic) return null;
  if (user && isPublic) return null;

  return <>{children}</>;
}
