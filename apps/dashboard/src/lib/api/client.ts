/**
 * @module API Client
 *
 * Shared base for all dashboard API modules.
 * Exports the `apiFetch` helper and `BASE_URL` constant.
 */

/**
 * Base URL for API requests.
 *
 * In production, the Next.js rewrite proxy (next.config.ts) forwards
 * `/api/v1/*` requests to the server. For direct access or SSR, the
 * full URL is used.
 */
export const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

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
    'Content-Type': 'application/json',
    ...(fetchOpts.headers as Record<string, string> ?? {}),
  };

  // Attach JWT token if available (client-side only)
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('recurrsive_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...fetchOpts,
    headers,
    next: { revalidate: 60 },
  } as RequestInit);

  if (!res.ok) {
    throw new ApiError(res.status, res.statusText, path);
  }

  const body = await res.json();

  if (unwrap && body && typeof body === 'object' && 'data' in body) {
    return body.data as T;
  }

  return body as T;
}



