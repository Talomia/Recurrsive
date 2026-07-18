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
import { error } from './output/terminal.js';

/**
 * Read the CLI config file (`~/.recurrsive/config`) if present.
 *
 * @returns Parsed config object, or `{}` when missing/unreadable.
 */
function readCliConfig(): Record<string, unknown> {
  try {
    const configPath = join(homedir(), '.recurrsive', 'config');
    if (existsSync(configPath)) {
      return JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    }
  } catch {
    // Unreadable config — treat as absent.
  }
  return {};
}

/**
 * Resolve the base URL for the Recurrsive API server.
 *
 * Priority: `RECURRSIVE_SERVER` / `RECURRSIVE_API_URL` env vars →
 * the `server` saved by `recurrsive login --server <url>` in
 * `~/.recurrsive/config` → localhost default. Without the config step,
 * logging in against a remote server would save a URL that nothing ever
 * read, and every subsequent command would silently hit localhost.
 */
function resolveServerUrl(): string {
  const fromEnv = process.env['RECURRSIVE_SERVER'] ?? process.env['RECURRSIVE_API_URL'];
  if (fromEnv) return fromEnv;
  const saved = readCliConfig()['server'];
  if (typeof saved === 'string' && saved.length > 0) return saved;
  return 'http://localhost:3000';
}

/** Base URL for the Recurrsive API server (env → saved config → default). */
export const API_BASE_URL = resolveServerUrl();

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
  const token = readCliConfig()['token'];
  if (token && typeof token === 'string') return token;

  return undefined;
}

/**
 * Resolve the active project id for API scoping.
 *
 * Priority: `--project` global flag (surfaced as `RECURRSIVE_PROJECT` by the
 * program before commands run) → `projectId` persisted by
 * `recurrsive projects use <id>` in `~/.recurrsive/config` → none (the
 * server's implicit default project).
 */
export function resolveProjectId(): string | undefined {
  const fromEnv = process.env['RECURRSIVE_PROJECT'];
  if (fromEnv) return fromEnv;
  const saved = readCliConfig()['projectId'];
  if (typeof saved === 'string' && saved.length > 0) return saved;
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
 * Error thrown when the server responds with a non-2xx status.
 *
 * Carries the HTTP status code so callers can distinguish
 * authentication (401), authorization (403), not-found (404), and
 * other server errors.
 */
export class ApiError extends Error {
  constructor(
    /** HTTP status code returned by the server. */
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Error thrown when the server could not be reached at all
 * (connection refused, DNS failure, timeout, etc.).
 */
export class ApiConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiConnectionError';
  }
}

/**
 * Make an API request to the Recurrsive server.
 *
 * Automatically injects the auth token (if available) as a
 * `Authorization: Bearer <token>` header. Returns the parsed JSON
 * envelope (`{ data, total?, message? }` on success).
 *
 * @param path - API path (e.g. `/api/v1/analytics/summary`).
 * @param options - Standard fetch options.
 * @returns Parsed JSON envelope.
 * @throws {ApiConnectionError} If the server cannot be reached.
 * @throws {ApiError} If the response is not ok (non-2xx status).
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

  // Scope the request to the active project (from --project or
  // `recurrsive projects use`) unless the caller already set one. Server
  // routes that don't take projectId simply ignore the parameter.
  let finalPath = path;
  const projectId = resolveProjectId();
  if (projectId && !path.includes('projectId=')) {
    const sep = path.includes('?') ? '&' : '?';
    finalPath = `${path}${sep}projectId=${encodeURIComponent(projectId)}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${finalPath}`, { ...options, headers });
  } catch (err) {
    // Network-level failure: server unreachable, DNS, TLS, timeout, etc.
    throw new ApiConnectionError(
      err instanceof Error ? err.message : String(err),
    );
  }

  if (!res.ok) {
    // Try to extract the server's structured `{ error, message }` body.
    let message = res.statusText;
    try {
      const body = await res.text();
      if (body) {
        try {
          const parsed = JSON.parse(body) as { error?: string; message?: string };
          message = parsed.message ?? parsed.error ?? body;
        } catch {
          message = body;
        }
      }
    } catch {
      // Ignore body read errors — fall back to statusText.
    }
    throw new ApiError(res.status, message);
  }

  // 204 No Content and empty bodies have nothing to parse.
  if (res.status === 204) return { data: undefined };
  const text = await res.text();
  if (!text) return { data: undefined };
  return JSON.parse(text);
}

/**
 * Make an API request and unwrap the `{ data }` envelope, returning
 * the payload directly.
 *
 * @param path - API path.
 * @param options - Standard fetch options.
 * @returns The unwrapped `data` payload.
 */
export async function apiRequestData<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const env = (await apiRequest(path, options)) as { data?: T };
  return env.data as T;
}

/**
 * Make an API request for a list endpoint and unwrap both the `data`
 * array and the `total` count from the envelope.
 *
 * @param path - API path.
 * @param options - Standard fetch options.
 * @returns The unwrapped list and total count.
 */
export async function apiRequestList<T>(
  path: string,
  options: RequestInit = {},
): Promise<{ items: T[]; total: number }> {
  const env = (await apiRequest(path, options)) as {
    data?: T[];
    total?: number;
  };
  const items = Array.isArray(env.data) ? env.data : [];
  return { items, total: env.total ?? items.length };
}

/**
 * Print an honest, actionable error message for an API failure and
 * exit the process. Distinguishes authentication, authorization,
 * not-found, other server errors, and connection failures.
 *
 * This is the single shared error handler for all server-backed CLI
 * commands — do not print blanket "server may be down" messages
 * elsewhere.
 *
 * @param err - The caught error.
 * @param opts - Optional context (e.g. the resource being fetched).
 */
export function reportApiError(
  err: unknown,
  opts: { resource?: string; action?: string } = {},
): never {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 401:
        error(
          'Not authenticated. Run `recurrsive login`, or `recurrsive setup` for first-time setup.',
        );
        break;
      case 403:
        error(`Access denied: ${err.message}`);
        break;
      case 404:
        error(
          opts.resource
            ? `Not found: ${opts.resource}`
            : `Not found (404): ${err.message}`,
        );
        break;
      default:
        error(
          `${opts.action ? `${opts.action}: ` : ''}Server error (HTTP ${err.status}): ${err.message}`,
        );
    }
  } else if (err instanceof ApiConnectionError) {
    error(
      `Could not reach the API server at ${API_BASE_URL} (${err.message}). ` +
        'Ensure it is running, or set RECURRSIVE_SERVER to the correct URL.',
    );
  } else {
    error(
      `${opts.action ? `${opts.action}: ` : ''}${err instanceof Error ? err.message : String(err)}`,
    );
  }
  process.exit(1);
}
