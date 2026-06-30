/**
 * @module @recurrsive/server/middleware
 *
 * Server middleware for rate limiting, request logging, and API key validation.
 *
 * @packageDocumentation
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ---------------------------------------------------------------------------
// Rate Limiter
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  reset_at: number;
}

interface RateLimitConfig {
  /** Maximum requests per window. Default: 100 */
  max: number;
  /** Window duration in milliseconds. Default: 60_000 (1 minute) */
  windowMs: number;
  /** Custom key extractor. Default: IP address */
  keyGenerator?: (request: FastifyRequest) => string;
}

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  max: 100,
  windowMs: 60_000,
};

/**
 * Register rate limiting middleware on a Fastify instance.
 *
 * Uses an in-memory token-bucket approach. Adds standard rate-limit
 * headers to all responses:
 * - `X-RateLimit-Limit`
 * - `X-RateLimit-Remaining`
 * - `X-RateLimit-Reset`
 */
export function registerRateLimiter(
  app: FastifyInstance,
  config: Partial<RateLimitConfig> = {},
): void {
  const { max, windowMs, keyGenerator } = { ...DEFAULT_RATE_LIMIT, ...config };
  const store = new Map<string, RateLimitEntry>();

  // Cleanup expired entries every 5 minutes
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.reset_at <= now) {
        store.delete(key);
      }
    }
  }, 5 * 60_000);

  // Don't keep the process alive just for cleanup
  if (cleanup.unref) cleanup.unref();

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const key = keyGenerator
      ? keyGenerator(request)
      : request.ip ?? 'unknown';

    const now = Date.now();
    let entry = store.get(key);

    if (!entry || entry.reset_at <= now) {
      entry = { count: 0, reset_at: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    const remaining = Math.max(0, max - entry.count);
    const resetSeconds = Math.ceil((entry.reset_at - now) / 1000);

    reply.header('X-RateLimit-Limit', String(max));
    reply.header('X-RateLimit-Remaining', String(remaining));
    reply.header('X-RateLimit-Reset', String(resetSeconds));

    if (entry.count > max) {
      reply.header('Retry-After', String(resetSeconds));
      return reply.status(429).send({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${resetSeconds} seconds.`,
        retry_after: resetSeconds,
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Request Logger
// ---------------------------------------------------------------------------

interface RequestLogEntry {
  method: string;
  url: string;
  status: number;
  duration_ms: number;
  timestamp: string;
  ip: string;
}

const REQUEST_LOG: RequestLogEntry[] = [];
const MAX_LOG_ENTRIES = 500;

/**
 * Register request logging middleware.
 *
 * Captures method, URL, status code, duration, and IP for each request.
 * Maintains an in-memory circular buffer of the last 500 requests.
 */
export function registerRequestLogger(app: FastifyInstance): void {
  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const entry: RequestLogEntry = {
      method: request.method,
      url: request.url,
      status: reply.statusCode,
      duration_ms: Math.round(reply.elapsedTime),
      timestamp: new Date().toISOString(),
      ip: request.ip ?? 'unknown',
    };

    REQUEST_LOG.push(entry);
    if (REQUEST_LOG.length > MAX_LOG_ENTRIES) {
      REQUEST_LOG.shift();
    }
  });
}

/**
 * Get the in-memory request log.
 */
export function getRequestLog(): readonly RequestLogEntry[] {
  return REQUEST_LOG;
}

// ---------------------------------------------------------------------------
// API Key Validation
// ---------------------------------------------------------------------------

interface ApiKeyConfig {
  /** Header name to look for the API key. Default: 'X-API-Key' */
  headerName: string;
  /** Valid API keys (in production these would come from a database) */
  validKeys: Set<string>;
  /** Paths that don't require API key authentication */
  excludePaths: string[];
}

const DEFAULT_API_KEY_CONFIG: ApiKeyConfig = {
  headerName: 'X-API-Key',
  validKeys: new Set(),
  excludePaths: ['/health', '/api/v1/health-score'],
};

/**
 * Register optional API key validation middleware.
 *
 * When enabled (validKeys is non-empty), requires a valid API key
 * in the configured header for all non-excluded paths.
 */
export function registerApiKeyAuth(
  app: FastifyInstance,
  config: Partial<ApiKeyConfig> = {},
): void {
  const { headerName, validKeys, excludePaths } = {
    ...DEFAULT_API_KEY_CONFIG,
    ...config,
  };

  // If no keys configured, skip auth entirely
  if (validKeys.size === 0) return;

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip excluded paths
    if (excludePaths.some(p => request.url.startsWith(p))) return;

    const apiKey = request.headers[headerName.toLowerCase()] as string | undefined;

    if (!apiKey) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: `Missing ${headerName} header`,
      });
    }

    if (!validKeys.has(apiKey)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Invalid API key',
      });
    }
  });
}
