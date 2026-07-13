/**
 * Dashboard route scoping rules.
 *
 * Project-scoped pages must carry `projectId` so every API request and link is
 * bound to the selected repository. Organization and deployment pages are
 * deliberately global and must not retain a stale project query parameter.
 */

const GLOBAL_ROUTE_PREFIXES = [
  '/batch',
  '/cloud',
  '/data-masking',
  '/invites',
  '/notifications',
  '/secrets',
  '/sso',
  '/settings',
  '/users',
  '/webhooks',
  '/audit',
] as const;

const PUBLIC_ROUTE_PREFIXES = ['/login', '/setup', '/invite'] as const;

function matchesRoutePrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPublicDashboardPath(pathname: string): boolean {
  return PUBLIC_ROUTE_PREFIXES.some((prefix) => matchesRoutePrefix(pathname, prefix));
}

export function isProjectScopedPath(pathname: string): boolean {
  if (isPublicDashboardPath(pathname)) return false;
  // The collection is global; an individual project's workspace is scoped.
  if (pathname === '/projects') return false;
  if (pathname.startsWith('/projects/')) return true;
  return !GLOBAL_ROUTE_PREFIXES.some((prefix) => matchesRoutePrefix(pathname, prefix));
}

/** Attach or remove project scope without discarding existing query values. */
export function withProjectScope(href: string, projectId?: string | null): string {
  const url = new URL(href, 'http://recurrsive.local');
  if (projectId && isProjectScopedPath(url.pathname)) {
    url.searchParams.set('projectId', projectId);
  } else {
    url.searchParams.delete('projectId');
  }
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ''}${url.hash}`;
}
