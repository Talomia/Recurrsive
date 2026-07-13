/**
 * @module API Client
 *
 * Shared base for all dashboard API modules.
 * Exports the `apiFetch` helper and `BASE_URL` constant.
 */

/**
 * Base URL for API requests.
 *
 * Client-side (browser): Uses empty string so requests go to `/api/v1/*`
 * which the Next.js rewrite proxy forwards to the API server.
 *
 * Server-side (SSR): Uses `NEXT_PUBLIC_API_URL` for direct server-to-server
 * calls where the proxy isn't available.
 */
export const BASE_URL =
  typeof window !== 'undefined'
    ? ''  // Browser: use relative URLs → Next.js rewrite proxy
    : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000');

/** Endpoints whose read models are scoped to the active project. */
const PROJECT_SCOPED_PREFIXES = [
  '/api/v1/activity',
  '/api/v1/analysis',
  '/api/v1/assistant',
  '/api/v1/analytics',
  '/api/v1/confidence',
  '/api/v1/findings',
  '/api/v1/forecasting',
  '/api/v1/graph',
  '/api/v1/health-score',
  '/api/v1/opportunities',
  '/api/v1/reports',
  '/api/v1/search',
  '/api/v1/snapshots',
  '/api/v1/timeline',
] as const;

/**
 * API error class for non-OK responses.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly path: string,
  ) {
    super(`API ${status} ${statusText} — ${path}`);
    this.name = 'ApiError';
  }
}

/**
 * Fetch JSON from the API, unwrapping the `{ data }` envelope.
 *
 * - On success: returns the `data` field from the response
 * - On error: throws `ApiError`
 *
 * For endpoints that don't use the `{ data }` envelope, pass
 * `{ unwrap: false }` in options to get the raw response body.
 *
 * @param path - API path (e.g. `/api/v1/projects`)
 * @param options - Optional fetch options and unwrap flag
 * @returns The unwrapped data from the API response
 */
export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { unwrap?: boolean },
): Promise<T> {
  const { unwrap = true, ...fetchOpts } = options ?? {};

  const headers: Record<string, string> = {
    ...(fetchOpts.headers as Record<string, string> || {}),
  };

  // Browser requests authenticate through the dashboard's HttpOnly cookie.
  // Server-side direct requests translate that cookie into a Bearer header.
  if (typeof window === 'undefined') {
    // Server-side: read token from the incoming request cookies
    try {
      // Dynamic import to avoid bundling issues in client code
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      const token = cookieStore.get('recurrsive_token')?.value;
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch {
      // cookies() may fail outside of request context — skip auth
    }
  }

  if (fetchOpts.body) headers['Content-Type'] = 'application/json';
  
  // Scoped project query parameter auto-appending
  let finalPath = path;
  if (typeof window !== 'undefined') {
    if (PROJECT_SCOPED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      const searchParams = new URLSearchParams(window.location.search);
      const projectId = searchParams.get('projectId');
      if (projectId && !path.includes('projectId=')) {
        const separator = path.includes('?') ? '&' : '?';
        finalPath = `${path}${separator}projectId=${encodeURIComponent(projectId)}`;
      }
    }
  }

  const res = await fetch(`${BASE_URL}${finalPath}`, {
    ...fetchOpts,
    headers,
    cache: 'no-store',
  } as RequestInit);

  if (!res.ok) {
    if (res.status === 401) {
      // Clear stored auth on token expiry
      if (typeof window !== 'undefined') {
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    throw new ApiError(res.status, res.statusText, path);
  }

  if (res.status === 204) {
    return null as unknown as T;
  }

  const body = await res.json();

  if (unwrap && body && typeof body === 'object' && 'data' in body) {
    return body.data as T;
  }

  return body as T;
}
