/**
 * @module @recurrsive/server/ws
 *
 * WebSocket registration for the Fastify server.
 *
 * Sets up the `@fastify/websocket` plugin and registers the `/ws`
 * route for real-time analysis progress streaming.
 *
 * Authentication is enforced on WebSocket upgrade: clients must
 * obtain a short-lived, single-use ticket over the authenticated HTTP API.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { registerClient, createBroadcast } from './events.js';
import { state } from '../state.js';
import { createLogger } from '@recurrsive/core';
import { createHash, randomBytes } from 'node:crypto';
import { store } from '../store.js';
import type { AuthUser } from '../middleware/auth.js';

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

  app.post('/api/v1/auth/ws-ticket', async (request, reply) => {
    const user = (request as typeof request & { user: AuthUser }).user;
    const ticket = randomBytes(32).toString('base64url');
    const ticketHash = createHash('sha256').update(ticket).digest('hex');
    const expiresAt = Date.now() + 60_000;
    await store.set('websocket_tickets', ticketHash, {
      userId: user.id,
      role: user.role,
      expiresAt,
    });
    return reply.status(201).send({ data: { ticket, expiresAt } });
  });

  // Register the WebSocket route with auth verification
  app.get('/ws', { websocket: true }, async (socket, request) => {
    const url = new URL(request.url, `http://${request.hostname}`);
    const ticket = url.searchParams.get('ticket');

    if (!ticket) {
      logger.warn('WebSocket connection rejected: no ticket provided');
      socket.close(4001, 'Authentication ticket required');
      return;
    }

    const ticketHash = createHash('sha256').update(ticket).digest('hex');
    const record = await store.get<{ userId: string; role: string; expiresAt: number }>('websocket_tickets', ticketHash);
    await store.delete('websocket_tickets', ticketHash);
    if (!record || record.expiresAt <= Date.now()) {
      logger.warn('WebSocket connection rejected: invalid or expired ticket');
      socket.close(4001, 'Authentication failed');
      return;
    }

    logger.info(`WebSocket client authenticated: ${record.userId} (${record.role})`);
    registerClient(socket);
  });

  logger.info('WebSocket handler registered at /ws');
}
