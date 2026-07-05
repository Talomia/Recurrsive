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
export async function apiRequest(
  path: string,
  options: RequestInit = {},
): Promise<unknown> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }

  return res.json();
}
