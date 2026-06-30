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
import { registerRoutes } from './routes/index.js';
import { registerWebSocket } from './ws/index.js';
import { registerRateLimit } from './middleware/rate-limit.js';
import { registerErrorHandler } from './middleware/error-handler.js';

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
  });

  // Register global error handler
  registerErrorHandler(app);

  // Register CORS
  await app.register(cors, {
    origin: options?.corsOrigin ?? true,
  });

  // Register rate limiting (skip if explicitly disabled)
  const rateLimitMax = options?.rateLimitMax ?? 100;
  if (rateLimitMax > 0) {
    await registerRateLimit(app, { max: rateLimitMax });
  }

  // Register all REST routes
  await registerRoutes(app);

  // Register WebSocket handler
  await registerWebSocket(app);

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
