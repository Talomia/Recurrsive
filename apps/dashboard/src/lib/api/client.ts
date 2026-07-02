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
 * Fetch JSON from the API, falling back to a default value if the
 * server is unreachable or returns an error.
 */
export async function apiFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return (await res.json()) as T;
  } catch {
    // Return mock data when the API server is unreachable
    return fallback;
  }
}

/** Deterministic pseudo-random — prevents SSR/client hydration mismatches. */
export function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
