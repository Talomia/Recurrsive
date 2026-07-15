/**
 * @module @recurrsive/mcp/api
 *
 * Shared HTTP client for communicating with the Recurrsive server API.
 *
 * All MCP tools that need data from the Recurrsive server should use
 * {@link apiRequest} to fetch data from the server.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Resolve the Recurrsive server base URL.
 *
 * Reads from `RECURRSIVE_API_URL` env var, falling back to `http://localhost:3000`.
 */
function getBaseUrl(): string {
  return process.env['RECURRSIVE_API_URL'] ?? 'http://localhost:3000';
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

/**
 * Error thrown when no server credentials are configured.
 *
 * Every server-backed request requires authentication. Rather than firing a
 * request that is guaranteed to fail with a raw `401`, we fail fast with an
 * actionable message that tells the operator which env var to set.
 */
export class AuthConfigError extends Error {
  constructor() {
    super(
      'Not authenticated — set RECURRSIVE_API_KEY (or RECURRSIVE_TOKEN) so the ' +
      'MCP server can authenticate to the Recurrsive API. See the MCP server docs ' +
      'for configuring credentials.',
    );
    this.name = 'AuthConfigError';
  }
}

/**
 * Resolve the authentication header for server requests.
 *
 * Credentials are read from the environment (which is how the MCP server
 * receives its configuration):
 * - `RECURRSIVE_TOKEN` → `Authorization: Bearer <token>`
 * - `RECURRSIVE_API_KEY` → `X-API-Key: <key>`
 *
 * A bearer token takes precedence over an API key when both are set.
 *
 * @returns The auth header to attach to every request.
 * @throws {AuthConfigError} If neither credential is configured.
 */
function getAuthHeaders(): Record<string, string> {
  const token = process.env['RECURRSIVE_TOKEN']?.trim();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }

  const apiKey = process.env['RECURRSIVE_API_KEY']?.trim();
  if (apiKey) {
    return { 'X-API-Key': apiKey };
  }

  throw new AuthConfigError();
}

// ---------------------------------------------------------------------------
// API Request Helper
// ---------------------------------------------------------------------------

/**
 * Make an HTTP request to the Recurrsive server API.
 *
 * @typeParam T - Expected shape of the response data.
 * @param path - API path (e.g. `/api/v1/plugins/installed`).
 * @param options - Optional fetch options (method, body, headers, etc.).
 * @returns The parsed response data.
 * @throws {ApiError} If the request fails or returns a non-OK status.
 */
export async function apiRequest<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${path}`;

  // Attach credentials on every request. Throws AuthConfigError (handled by
  // apiErrorResult) when nothing is configured, so tools return an honest
  // "not authenticated" message instead of a raw 401 dump.
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...getAuthHeaders(),
    ...(options?.headers as Record<string, string> ?? {}),
  };
  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers,
    });

    if (!response.ok) {
      throw new ApiError(
        `API request failed: ${response.status} ${response.statusText}`,
        response.status,
        url,
      );
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Make a GET request and unwrap the `{ data: T }` envelope.
 *
 * Most Recurrsive server endpoints return `{ data: T }`. This helper
 * extracts the inner `data` field automatically.
 *
 * @typeParam T - Expected shape of `data`.
 * @param path - API path (e.g. `/api/v1/tenants`).
 * @returns The unwrapped data.
 */
export async function apiGet<T = unknown>(path: string): Promise<T> {
  const envelope = await apiRequest<{ data: T }>(path);
  return envelope.data;
}

/**
 * Make a request and return the raw response body as text.
 *
 * Some endpoints (e.g. export downloads) return raw file content — markdown,
 * CSV, SARIF — rather than a JSON envelope. Use this for those.
 *
 * @param path - API path.
 * @param options - Optional fetch options.
 * @returns The raw response body as a string.
 * @throws {ApiError} If the request fails or returns a non-OK status.
 * @throws {AuthConfigError} If no credentials are configured.
 */
export async function apiRequestText(
  path: string,
  options?: RequestInit,
): Promise<string> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    'Accept': '*/*',
    ...getAuthHeaders(),
    ...(options?.headers as Record<string, string> ?? {}),
  };
  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, headers });
    if (!response.ok) {
      throw new ApiError(
        `API request failed: ${response.status} ${response.statusText}`,
        response.status,
        url,
      );
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

/**
 * Custom error class for API failures.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly url: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Format an API error into an MCP-friendly error content block.
 *
 * @param error - The caught error.
 * @param context - Human-readable context (e.g. "list plugins").
 * @returns MCP tool result with `isError: true`.
 */
export function apiErrorResult(error: unknown, context: string): {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
} {
  const baseUrl = getBaseUrl();

  // No credentials configured — give an actionable message, not a raw 401.
  if (error instanceof AuthConfigError) {
    return {
      content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
      isError: true,
    };
  }

  if (error instanceof ApiError) {
    // The server rejected our credentials (or none reached it).
    if (error.status === 401 || error.status === 403) {
      return {
        content: [{
          type: 'text' as const,
          text: `Error: Could not ${context} — authentication failed (${error.status}). ` +
            'Check that RECURRSIVE_API_KEY (or RECURRSIVE_TOKEN) is set to a valid credential.',
        }],
        isError: true,
      };
    }
    return {
      content: [{
        type: 'text' as const,
        text: `Error: Could not ${context}. Server returned ${error.status} from ${error.url}.`,
      }],
      isError: true,
    };
  }

  // Network / connection errors
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{
      type: 'text' as const,
      text: `Error: Could not reach Recurrsive server at ${baseUrl}. Ensure the server is running.\nDetails: ${message}`,
    }],
    isError: true,
  };
}
