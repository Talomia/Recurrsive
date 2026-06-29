/**
 * @module @recurrsive/server/ws
 *
 * WebSocket registration for the Fastify server.
 *
 * Sets up the `@fastify/websocket` plugin and registers the `/ws`
 * route for real-time analysis progress streaming.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { registerClient, createBroadcast } from './events.js';
import { state } from '../state.js';
import { createLogger } from '@recurrsive/core';

const logger = createLogger({ context: { component: 'server:ws' } });

/**
 * Register the WebSocket plugin and the `/ws` upgrade route.
 *
 * Clients connect to `ws://host:port/ws` to receive real-time events:
 * - `analysis:started` — Analysis begun
 * - `analysis:progress` — Progress update (phase, percentage)
 * - `analysis:finding` — New finding discovered
 * - `analysis:complete` — Analysis finished
 * - `analysis:error` — Error occurred
 *
 * @param app - The Fastify application instance.
 */
export async function registerWebSocket(app: FastifyInstance): Promise<void> {
  // Register the websocket plugin
  await app.register(websocket);

  // Wire up the broadcast function so ServerState events reach WS clients
  state.setWSBroadcast(createBroadcast());

  // Register the WebSocket route
  app.get('/ws', { websocket: true }, (socket, _request) => {
    logger.info('New WebSocket connection established');
    registerClient(socket);
  });

  logger.info('WebSocket handler registered at /ws');
}
