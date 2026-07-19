/**
 * @module @recurrsive/server
 *
 * Server factory for the Recurrsive REST + WebSocket API.
 *
 * Creates a configured Fastify instance with CORS, all REST routes,
 * and WebSocket support for real-time analysis streaming.
 *
 * @packageDocumentation
 */

import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { registerRoutes } from './routes/index.js';
import { registerWebSocket } from './ws/index.js';
import { registerRateLimit } from './middleware/rate-limit.js';
import { registerErrorHandler } from './middleware/error-handler.js';
import { registerAuditMiddleware } from './middleware/audit.js';
import { optionalAuth } from './middleware/auth.js';
import { store } from './store.js';

// ---------------------------------------------------------------------------
// Server options
// ---------------------------------------------------------------------------

/** Configuration options for the Recurrsive API server. */
export interface ServerOptions {
  /** Port to listen on (default: 3000). */
  port?: number;
  /** Host to bind to (default: '0.0.0.0'). */
  host?: string;
  /** Enable Fastify request logging (default: true). */
  logger?: boolean;
  /**
   * CORS allowed origins.
   *
   * Default: the `CORS_ORIGIN` env var (comma-separated allowlist) when set;
   * otherwise allow-all in dev/test. In production (`NODE_ENV=production`)
   * an explicit allowlist is REQUIRED — the server refuses to start with the
   * allow-all default.
   */
  corsOrigin?: boolean | string | string[];
  /** Max requests per minute per client (default: 100). Set 0 to disable. */
  rateLimitMax?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create and configure a Fastify server instance.
 *
 * Registers all middleware, route handlers, and the WebSocket plugin.
 * The returned instance is ready to be started with `.listen()`.
 *
 * @param options - Server configuration options.
 * @returns A fully configured but not-yet-listening Fastify instance.
 *
 * @example
 * ```ts
 * import { createServer } from '@recurrsive/server';
 *
 * const app = await createServer({ port: 3000 });
 * await app.listen({ port: 3000, host: '0.0.0.0' });
 * ```
 */
export async function createServer(options?: ServerOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options?.logger ?? true,
    trustProxy: true, // Behind EasyPanel reverse proxy — trust X-Forwarded-* headers
  });

  // Initialize the store backend (creates PostgreSQL tables if needed)
  await store.initialize();

  // Register global error handler
  registerErrorHandler(app);

  // Register CORS — restrict origins in production
  let corsOrigin: boolean | string | string[] | undefined = options?.corsOrigin;
  if (corsOrigin === undefined) {
    const envOrigins = process.env['CORS_ORIGIN']
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (envOrigins && envOrigins.length > 0) {
      corsOrigin = envOrigins;
    } else if (process.env['NODE_ENV'] === 'production') {
      // SECURITY: never default to allow-all CORS in production. An explicit
      // allowlist must be provided via CORS_ORIGIN (comma-separated origins)
      // or the corsOrigin server option; fail fast at startup otherwise.
      throw new Error(
        'CORS_ORIGIN must be set to an explicit, comma-separated origin allowlist ' +
        'in production (or pass the corsOrigin server option). Refusing to start ' +
        'with the allow-all CORS default.',
      );
    } else {
      corsOrigin = true; // Allow all in dev/test only
    }
  }
  await app.register(cors, {
    origin: corsOrigin,
  });

  // Register security headers (X-Frame-Options, CSP, etc.)
  await app.register(helmet, {
    contentSecurityPolicy: false, // Allow Swagger UI inline scripts
  });

  // Register rate limiting (skip if explicitly disabled)
  const rateLimitMax = options?.rateLimitMax ?? 100;
  if (rateLimitMax > 0) {
    await registerRateLimit(app, { max: rateLimitMax });
  }

  // Register audit logging (before routes, to capture all requests)
  registerAuditMiddleware(app);

  // Register optional auth (populates request.user if token present, never rejects)
  app.addHook('preHandler', optionalAuth);

  // Register all REST routes
  await registerRoutes(app);

  // Register WebSocket handler
  await registerWebSocket(app);

  // Register close hook to cleanly shut down the store
  app.addHook('onClose', async () => {
    await store.close();
  });

  return app;
}

// Re-export types for consumers
export type { ServerOptions as RecurrsiveServerOptions };
export { state } from './state.js';
export type {
  AnalysisPhase,
  AnalysisStatus,
  AnalysisHistoryEntry,
  AnalysisCache,
  WSEventType,
  WSEvent,
  WSBroadcast,
} from './state.js';
