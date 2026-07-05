/**
 * @module Dashboard Middleware
 *
 * Next.js Edge middleware for server-side route protection.
 *
 * Checks for a valid JWT in cookies before allowing access to
 * protected routes. This prevents SSR data exposure and eliminates
 * the client-side redirect flash.
 *
 * @packageDocumentation
 */

import { NextResponse, type NextRequest } from 'next/server';

/** Paths that don't require authentication. */
const PUBLIC_PATHS = new Set(['/login', '/setup', '/invite']);

/** Cookie/header name for the JWT token. */
const TOKEN_COOKIE = 'recurrsive_token';

/**
 * Simple JWT expiry check (client-side only — no signature verification).
 *
 * Edge Runtime doesn't have access to the server's JWT_SECRET, so we
 * can only check structural validity and expiry. Full verification
 * happens server-side when the API receives the token.
 */
function isTokenValid(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1]!));
    if (!payload.sub || !payload.role) return false;
    // Check expiry
    if (payload.exp && payload.exp * 1000 < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths (exact match or prefix, e.g. /invite/abc)
  const isPublic = PUBLIC_PATHS.has(pathname)
    || [...PUBLIC_PATHS].some((p) => pathname.startsWith(p + '/'));
  if (isPublic) {
    return NextResponse.next();
  }

  // Allow static assets and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check for token in cookie (set by the client-side AuthProvider)
  const token = request.cookies.get(TOKEN_COOKIE)?.value;

  if (!token || !isTokenValid(token)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (browser icon)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
