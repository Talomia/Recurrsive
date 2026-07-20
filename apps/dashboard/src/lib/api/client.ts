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

/**
 * API error class for non-OK responses.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly path: string,
    /** Server-provided error message (from the response body), when present. */
    public readonly detail?: string,
  ) {
    // Prefer the server's specific message (e.g. "Repository URL is not
    // allowed") for display; fall back to the HTTP status line otherwise.
    super(detail?.trim() ? detail.trim() : `API ${status} ${statusText} — ${path}`);
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

  // Attach JWT token from localStorage (client) or cookie (SSR)
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('recurrsive_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } else {
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
  
  // Scoped project query parameter auto-appending. On the client the active
  // project comes from the URL; during SSR it comes from the
  // `x-recurrsive-project-id` request header that middleware derives from the
  // same URL query — otherwise server-rendered pages ignore `?projectId=`.
  let finalPath = path;
  // Apply to ALL methods, not just GET: mutations like the opportunity/finding
  // PATCH are per-project too, and the server loads the wrong (default) bucket
  // without the scope — previously Accept/Dismiss 404'd for every real project.
  if (!path.includes('projectId=')) {
    let projectId: string | null = null;
    if (typeof window !== 'undefined') {
      projectId = new URLSearchParams(window.location.search).get('projectId');
    } else {
      try {
        const { headers: nextHeaders } = await import('next/headers');
        const hdrs = await nextHeaders();
        projectId = hdrs.get('x-recurrsive-project-id');
      } catch {
        // Outside a request context — no project scoping available.
      }
    }
    if (projectId) {
      const separator = path.includes('?') ? '&' : '?';
      finalPath = `${path}${separator}projectId=${encodeURIComponent(projectId)}`;
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
        localStorage.removeItem('recurrsive_token');
        localStorage.removeItem('recurrsive_user');
        document.cookie = 'recurrsive_token=; path=/; max-age=0';
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    // Surface the server's specific error message (envelope `message`/`error`)
    // so callers can show *why* a request failed, not just the status code.
    let detail: string | undefined;
    try {
      const errBody = await res.json();
      if (errBody && typeof errBody === 'object') {
        detail = (errBody.message as string) || (errBody.error as string) || undefined;
      }
    } catch {
      // Non-JSON error body (HTML/empty) — fall back to the status line.
    }
    throw new ApiError(res.status, res.statusText, path, detail);
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



