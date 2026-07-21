/**
 * @module @recurrsive/server/ws
 *
 * WebSocket registration for the Fastify server.
 *
 * Sets up the `@fastify/websocket` plugin and registers the `/ws`
 * route for real-time analysis progress streaming.
 *
 * Authentication is enforced on WebSocket upgrade: clients must
 * provide a JWT token via the `?token=` query parameter.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { registerClient, createBroadcast } from './events.js';
import { state } from '../state.js';
import { verifyToken, isTokenRevoked } from '../middleware/auth.js';
import { createLogger } from '@recurrsive/core';

const logger = createLogger({ context: { component: 'server:ws' } });

/**
 * Register the WebSocket plugin and the `/ws` upgrade route.
 *
 * Clients connect to `ws://host:port/ws?token=JWT_TOKEN` to receive
 * real-time events:
 * - `analysis:started` — Analysis begun
 * - `analysis:progress` — Progress update (phase, percentage)
 * - `analysis:finding` — New finding discovered
 * - `analysis:complete` — Analysis finished
 * - `analysis:error` — Error occurred
 *
 * A valid JWT token must be provided via the `token` query parameter.
 * Connections without a valid token are rejected with HTTP 401.
 *
 * @param app - The Fastify application instance.
 */
export async function registerWebSocket(app: FastifyInstance): Promise<void> {
  // Register the websocket plugin with message size limits
  await app.register(websocket, {
    options: {
      maxPayload: 64 * 1024, // 64 KB max message size
    },
  });

  // Wire up the broadcast function so ServerState events reach WS clients
  state.setWSBroadcast(createBroadcast());

  // Register the WebSocket route with auth verification
  app.get('/ws', { websocket: true }, async (socket, request) => {
    // Extract token from query parameter
    const url = new URL(request.url, `http://${request.hostname}`);
    const token = url.searchParams.get('token');

    if (!token) {
      logger.warn('WebSocket connection rejected: no token provided');
      socket.close(4001, 'Authentication required — provide ?token=JWT');
      return;
    }

    const payload = verifyToken(token);
    if (!payload) {
      logger.warn('WebSocket connection rejected: invalid token');
      socket.close(4001, 'Authentication failed — invalid or expired token');
      return;
    }

    // Honor logout/revocation: a revoked-but-not-yet-expired token must not
    // open a live event stream (REST checks this; WS previously did not).
    if (await isTokenRevoked(payload.jti)) {
      logger.warn('WebSocket connection rejected: revoked token');
      socket.close(4001, 'Authentication failed — token revoked');
      return;
    }

    logger.info(`WebSocket client authenticated: ${payload.sub} (${payload.role})`);
    registerClient(socket);
  });

  logger.info('WebSocket handler registered at /ws');
}
