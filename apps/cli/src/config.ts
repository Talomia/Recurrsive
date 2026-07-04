/**
 * @module @recurrsive/cli/config
 *
 * Shared CLI configuration constants. Centralizes the API server URL
 * and other settings that were previously duplicated across command files.
 *
 * @packageDocumentation
 */

/**
 * Base URL for the Recurrsive API server.
 *
 * Reads from `RECURRSIVE_SERVER` env var, falling back to localhost:3000.
 * Also checks `RECURRSIVE_API_URL` for consistency with `.env.example`.
 */
export const API_BASE_URL =
  process.env['RECURRSIVE_SERVER'] ??
  process.env['RECURRSIVE_API_URL'] ??
  'http://localhost:3000';

/**
 * Make an API request to the Recurrsive server.
 *
 * @param path - API path (e.g. `/api/v1/analytics/summary`).
 * @param options - Standard fetch options.
 * @returns Parsed JSON response.
 * @throws Error if the response is not ok (non-2xx status).
 */
export async function apiRequest(
  path: string,
  options: RequestInit = {},
): Promise<unknown> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }

  return res.json();
}
