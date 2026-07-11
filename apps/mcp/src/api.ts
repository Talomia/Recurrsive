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

  const headers: Record<string, string> = {
    'Accept': 'application/json',
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

  if (error instanceof ApiError) {
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
