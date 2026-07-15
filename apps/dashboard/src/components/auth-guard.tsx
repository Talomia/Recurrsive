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

/**
 * Public prefixes that an ALREADY-authenticated user has no business staying
 * on — logging in again or re-running first-run setup — so we bounce them home.
 * `/invite` is deliberately excluded: a signed-in admin may legitimately open
 * an invite link (e.g. to inspect it), so we let them through.
 */
const AUTHED_REDIRECT_PREFIXES = ['/login', '/setup'];

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
  const redirectAuthedAway = AUTHED_REDIRECT_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic) {
      router.replace('/login');
    }
    if (user && redirectAuthedAway) {
      router.replace('/');
    }
  }, [user, loading, isPublic, redirectAuthedAway, router]);

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
  if (user && redirectAuthedAway) return null;

  return <>{children}</>;
}
