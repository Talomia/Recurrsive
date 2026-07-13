/**
 * @module @recurrsive/cli/config
 *
 * Shared CLI configuration constants. Centralizes the API server URL,
 * auth token management, and other settings.
 *
 * @packageDocumentation
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

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

const PROJECT_SCOPED_PREFIXES = [
  '/api/v1/analytics/',
  '/api/v1/analysis/history',
  '/api/v1/analysis/compare',
  '/api/v1/experiments',
  '/api/v1/export',
  '/api/v1/forecasting/',
] as const;

/** Add the API's required projectId query parameter to a scoped path. */
export function projectScopedPath(path: string, projectId?: string): string {
  const resolvedProjectId = projectId?.trim() || process.env['RECURRSIVE_PROJECT_ID']?.trim();
  if (!resolvedProjectId) {
    throw new Error(
      'Project scope is required. Pass --project-id or set RECURRSIVE_PROJECT_ID.',
    );
  }

  const url = new URL(path, 'http://recurrsive.local');
  url.searchParams.set('projectId', resolvedProjectId);
  return `${url.pathname}${url.search}`;
}

function requiresProjectScope(path: string): boolean {
  return PROJECT_SCOPED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * Resolve the API auth token from available sources.
 *
 * Token is resolved in this priority order:
 * 1. `RECURRSIVE_TOKEN` environment variable
 * 2. `~/.recurrsive/config` file (JSON with `token` field)
 * 3. `undefined` (no auth — will fail on protected routes)
 */
function resolveToken(): string | undefined {
  // 1. Environment variable (highest priority)
  const envToken = process.env['RECURRSIVE_TOKEN'];
  if (envToken) return envToken;

  // 2. Config file (~/.recurrsive/config)
  try {
    const configPath = join(homedir(), '.recurrsive', 'config');
    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (config.token && typeof config.token === 'string') {
        return config.token;
      }
    }
  } catch {
    // Config file unreadable — fall through
  }

  return undefined;
}

/** Cached auth token (resolved once on first use). */
let _cachedToken: string | undefined;
let _tokenResolved = false;

/** Get the auth token, caching the result. */
function getToken(): string | undefined {
  if (!_tokenResolved) {
    _cachedToken = resolveToken();
    _tokenResolved = true;
  }
  return _cachedToken;
}

/**
 * Make an API request to the Recurrsive server.
 *
 * Automatically injects the auth token (if available) as a
 * `Authorization: Bearer <token>` header.
 *
 * @param path - API path (e.g. `/api/v1/analytics/summary`).
 * @param options - Standard fetch options.
 * @returns Parsed JSON response.
 * @throws Error if the response is not ok (non-2xx status).
 */
export interface ApiRequestOptions extends RequestInit {
  /** Explicit project scope; otherwise RECURRSIVE_PROJECT_ID is used. */
  projectId?: string;
  /** Set false only when the response envelope metadata is required. */
  unwrap?: boolean;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { projectId, unwrap = true, ...fetchOptions } = options;
  const token = getToken();
  const apiKey = process.env['RECURRSIVE_API_KEY']?.trim();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> ?? {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  const requestPath = requiresProjectScope(path) ? projectScopedPath(path, projectId) : path;
  const res = await fetch(`${API_BASE_URL.replace(/\/$/, '')}${requestPath}`, {
    ...fetchOptions,
    headers,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }

  if (res.status === 204) return undefined as T;

  const json = await res.json() as unknown;
  if (
    unwrap &&
    json !== null &&
    typeof json === 'object' &&
    Object.prototype.hasOwnProperty.call(json, 'data')
  ) {
    return (json as { data: T }).data;
  }
  return json as T;
}
