#!/usr/bin/env node

/**
 * @module @recurrsive/server/bin
 *
 * CLI entry point for the Recurrsive API server.
 *
 * Starts the Fastify server on the configured port (default: 3000).
 * The port can be overridden via the `PORT` environment variable.
 *
 * @packageDocumentation
 */

import { createServer } from './index.js';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';

async function main(): Promise<void> {
  const app = await createServer({
    port: PORT,
    host: HOST,
    logger: true,
  });

  // Handle graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`Received ${signal}, shutting down gracefully…`);
    try {
      await app.close();
      app.log.info('Server closed');
      process.exit(0);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      app.log.error(`Error during shutdown: ${message}`);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    await app.listen({ port: PORT, host: HOST });

    app.log.info(`
┌──────────────────────────────────────────────────────┐
│                                                      │
│   🔄 Recurrsive API Server                           │
│                                                      │
│   REST API:    http://${HOST}:${PORT}                 │
│   WebSocket:   ws://${HOST}:${PORT}/ws                │
│   Health:      http://${HOST}:${PORT}/health          │
│                                                      │
│   Endpoints:                                         │
│     POST   /api/v1/analyze                           │
│     GET    /api/v1/analysis/status                    │
│     GET    /api/v1/analysis/history                   │
│     GET    /api/v1/health-score                       │
│     GET    /api/v1/opportunities                      │
│     GET    /api/v1/opportunities/:id                  │
│     PATCH  /api/v1/opportunities/:id                  │
│     GET    /api/v1/opportunities/export/:format       │
│     GET    /api/v1/graph/stats                        │
│     GET    /api/v1/graph/entities                     │
│     GET    /api/v1/graph/entities/:id                 │
│     GET    /api/v1/graph/entities/:id/neighbors       │
│     GET    /api/v1/timeline                           │
│     GET    /api/v1/timeline/snapshots                 │
│     GET    /api/v1/timeline/trends                    │
│                                                      │
└──────────────────────────────────────────────────────┘
`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    app.log.error(`Failed to start server: ${message}`);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[recurrsive-server] Fatal error: ${message}\n`);
  process.exit(1);
});
