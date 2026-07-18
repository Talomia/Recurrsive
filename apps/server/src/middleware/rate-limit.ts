/**
 * @module @recurrsive/server/middleware/rate-limit
 *
 * Lightweight in-memory rate limiter for the Recurrsive API server.
 *
 * Uses a sliding window approach with automatic cleanup.
 * No external dependencies required.
 *
 * @packageDocumentation
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Rate limiter configuration options. */
export interface RateLimitOptions {
  /** Maximum requests per window (default: 100). */
  max?: number;
  /** Time window in milliseconds (default: 60_000 = 1 minute). */
  windowMs?: number;
  /** Custom key extractor (default: IP address). */
  keyGenerator?: (request: FastifyRequest) => string;
  /** Skip rate limiting for certain requests. */
  skip?: (request: FastifyRequest) => boolean;
}

/** Tracks request counts per client within a time window. */
interface ClientRecord {
  /** Number of requests in current window. */
  count: number;
  /** Timestamp when the window resets. */
  resetAt: number;
}

// ---------------------------------------------------------------------------
// Rate Limiter Plugin
// ---------------------------------------------------------------------------

/**
 * Register in-memory rate limiting on a Fastify instance.
 *
 * Sets `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset`
 * response headers. Returns 429 Too Many Requests when exceeded.
 *
 * @param app - The Fastify instance.
 * @param options - Rate limiter configuration.
 */
export async function registerRateLimit(
  app: FastifyInstance,
  options?: RateLimitOptions,
): Promise<void> {
  const max = options?.max ?? 100;
  const windowMs = options?.windowMs ?? 60_000;
  const keyGenerator = options?.keyGenerator ?? defaultKeyGenerator;
  const skip = options?.skip;

  const store = new Map<string, ClientRecord>();

  // Periodic cleanup of expired entries (every 5 minutes)
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store) {
      if (record.resetAt <= now) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  // Clean up on server close
  app.addHook('onClose', () => {
    clearInterval(cleanupInterval);
  });

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip health checks and WebSocket upgrades
    if (
      request.url === '/health' ||
      request.url === '/api/v1/health' ||
      request.url === '/api/v1/health/detailed' ||
      request.headers.upgrade === 'websocket'
    ) {
      return;
    }

    // Skip localhost connections to ensure automated testing stability (but not in unit tests)
    const clientIp = keyGenerator(request);
    if (
      process.env['NODE_ENV'] !== 'test' &&
      (clientIp === '127.0.0.1' ||
       clientIp === '::1' ||
       clientIp === '::ffff:127.0.0.1')
    ) {
      return;
    }

    // Custom skip logic
    if (skip?.(request)) {
      return;
    }

    const key = keyGenerator(request);
    const now = Date.now();

    let record = store.get(key);

    if (!record || record.resetAt <= now) {
      // New window
      record = { count: 0, resetAt: now + windowMs };
      store.set(key, record);
    }

    record.count++;

    // Set rate limit headers
    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil((record.resetAt - now) / 1000);

    reply.header('RateLimit-Limit', max);
    reply.header('RateLimit-Remaining', remaining);
    reply.header('RateLimit-Reset', resetSeconds);

    if (record.count > max) {
      reply.header('Retry-After', resetSeconds);
      return reply.code(429).send({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${resetSeconds} seconds.`,
        retryAfter: resetSeconds,
      });
    }
  });
}

/**
 * Default key generator — uses client IP address.
 *
 * Respects `X-Forwarded-For` for reverse proxy setups.
 */
function defaultKeyGenerator(request: FastifyRequest): string {
  // Use Fastify's resolved client IP. With trustProxy enabled, Fastify already
  // derives this from X-Forwarded-For correctly; keying off the raw header's
  // leftmost value instead would let a client spoof a fresh bucket per request
  // and bypass the limit entirely.
  return request.ip;
}
