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
import { assertProductionAuthConfig, defaultAuthMiddleware } from './middleware/auth.js';
import { defaultAuthorizationMiddleware } from './middleware/rbac.js';
import { store } from './store.js';
import { assertProductionPersistenceConfig } from './production-config.js';
import { registerRouteInventory } from './route-inventory.js';

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
  /** CORS allowed origins (default: true = allow all). */
  corsOrigin?: boolean | string | string[];
  /** Max requests per minute per client (default: 100). Set 0 to disable. */
  rateLimitMax?: number;
}

/**
 * Keep credentials and opaque tickets out of request logs.
 *
 * Query strings are not required for production request tracing and may carry
 * password-reset tokens, OAuth codes, WebSocket tickets, or values sent by an
 * outdated client. Request IDs still provide end-to-end correlation.
 */
export function sanitizeRequestUrl(url: string): string {
  const queryIndex = url.indexOf('?');
  return queryIndex === -1 ? url : url.slice(0, queryIndex);
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
  assertProductionAuthConfig();
  assertProductionPersistenceConfig();

  if (process.env['NODE_ENV'] === 'production' && !options?.corsOrigin && !process.env['CORS_ORIGIN']) {
    throw new Error('Refusing to start in production: CORS_ORIGIN must be explicitly configured.');
  }

  const app = Fastify({
    logger: options?.logger === false
      ? false
      : {
          serializers: {
            req: (request) => ({
              method: request.method,
              url: sanitizeRequestUrl(request.url),
              host: request.hostname,
              remoteAddress: request.ip,
              remotePort: request.socket.remotePort,
            }),
          },
        },
    // EasyPanel deployments opt in with TRUST_PROXY=true. Never trust forwarded
    // client addresses when the API is reachable directly.
    trustProxy: process.env['TRUST_PROXY'] === 'true',
  });
  registerRouteInventory(app);

  // Initialize the store backend (creates PostgreSQL tables if needed)
  await store.initialize();

  // Register global error handler
  registerErrorHandler(app);

  // Register CORS — restrict origins in production
  const corsOrigin = options?.corsOrigin
    ?? (process.env['CORS_ORIGIN']
      ? process.env['CORS_ORIGIN'].split(',').map((s) => s.trim())
      : true); // Allow all in dev; set CORS_ORIGIN in production
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

  // Default-deny authentication. Public endpoints are explicitly allow-listed
  // by the middleware; route-level RBAC handlers still enforce permissions.
  app.addHook('preHandler', defaultAuthMiddleware);
  app.addHook('preHandler', defaultAuthorizationMiddleware);

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
