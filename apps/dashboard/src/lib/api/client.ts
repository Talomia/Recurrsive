/**
 * @module API Client
 *
 * Shared base client used by all domain-specific API modules.
 * Provides the fetch wrapper and deterministic random helpers for mock data.
 */

// ─── API Client ──────────────────────────────────────────────────────────────

/**
 * Base URL for API requests.
 *
 * In production, the Next.js rewrite proxy (next.config.ts) forwards
 * `/api/v1/*` requests to the server. For direct access or SSR, the
 * full URL is used.
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

/**
 * Fetch JSON from the API, falling back to a default value if the
 * server is unreachable or returns an error.
 */
export async function apiFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return (await res.json()) as T;
  } catch {
    // Return mock data when the API server is unreachable
    return fallback;
  }
}

// ─── Mock Data Helpers ───────────────────────────────────────────────────────

/** Deterministic pseudo-random — prevents SSR/client hydration mismatches. */
export function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function miniSparkline(base: number, count = 14, volatility = 5): { value: number }[] {
  return Array.from({ length: count }, (_, i) => ({
    value: Math.round(base + Math.sin(i * 0.7) * volatility + (seededRandom(i * 31 + base) - 0.5) * volatility),
  }));
}
