/**
 * @module @recurrsive/server/ws/events
 *
 * WebSocket event handler for real-time analysis progress streaming.
 *
 * Manages connected WebSocket clients and broadcasts analysis lifecycle
 * events to all active connections.
 *
 * @packageDocumentation
 */

import type { WebSocket } from '@fastify/websocket';
import type { WSEvent, WSBroadcast } from '../state.js';
import { createLogger, nowISO } from '@recurrsive/core';

const logger = createLogger({ context: { component: 'server:ws:events' } });

// ---------------------------------------------------------------------------
// Client registry
// ---------------------------------------------------------------------------

/** Set of active WebSocket connections. */
const clients = new Set<WebSocket>();

/** Tracks which clients have responded to the latest ping. */
const alive = new WeakSet<WebSocket>();

/** Heartbeat interval handle (30 seconds). */
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

/** Heartbeat period in milliseconds. */
const HEARTBEAT_MS = 30_000;

/**
 * Register a new WebSocket client connection.
 *
 * Sets up message handling for incoming client messages and automatic
 * cleanup on close/error. Sends a welcome event on connection.
 *
 * @param socket - The WebSocket connection to register.
 */
export function registerClient(socket: WebSocket): void {
  clients.add(socket);
  alive.add(socket);

  // Start heartbeat if this is the first client
  if (clients.size === 1) startHeartbeat();

  logger.info(`WebSocket client connected (total: ${clients.size})`);

  // Send welcome event
  const welcome: WSEvent = {
    type: 'analysis:progress',
    timestamp: nowISO(),
    data: {
      phase: 'connected',
      message: 'Connected to Recurrsive analysis stream',
      clients: clients.size,
    },
  };
  sendToClient(socket, welcome);

  // Handle incoming messages from the client
  socket.on('message', (rawData: Buffer | ArrayBuffer | Buffer[]) => {
    alive.add(socket); // Any message counts as alive
    try {
      const data = JSON.parse(rawData.toString()) as Record<string, unknown>;
      handleClientMessage(socket, data);
    } catch {
      sendToClient(socket, {
        type: 'analysis:error',
        timestamp: nowISO(),
        data: {
          error: 'Invalid JSON message',
          message: 'Messages must be valid JSON objects',
        },
      });
    }
  });

  // Handle pong responses (mark client as alive)
  socket.on('pong', () => {
    alive.add(socket);
  });

  // Clean up on close
  socket.on('close', () => {
    clients.delete(socket);
    logger.info(`WebSocket client disconnected (total: ${clients.size})`);
    if (clients.size === 0) stopHeartbeat();
  });

  // Clean up on error
  socket.on('error', (err: Error) => {
    clients.delete(socket);
    logger.error(`WebSocket client error: ${err.message}`);
    if (clients.size === 0) stopHeartbeat();
  });
}

/**
 * Handle an incoming message from a WebSocket client.
 *
 * Currently supports:
 * - `ping` — Respond with a pong event.
 * - `subscribe` — Acknowledge subscription (all clients receive all events).
 *
 * @param socket - The client socket.
 * @param data - Parsed JSON message from the client.
 */
function handleClientMessage(socket: WebSocket, data: Record<string, unknown>): void {
  const type = data['type'];

  switch (type) {
    case 'ping':
      sendToClient(socket, {
        type: 'analysis:progress',
        timestamp: nowISO(),
        data: { pong: true },
      });
      break;

    case 'subscribe':
      sendToClient(socket, {
        type: 'analysis:progress',
        timestamp: nowISO(),
        data: {
          subscribed: true,
          message: 'Subscribed to analysis events',
          events: [
            'analysis:started',
            'analysis:progress',
            'analysis:finding',
            'analysis:complete',
            'analysis:error',
          ],
        },
      });
      break;

    default:
      sendToClient(socket, {
        type: 'analysis:error',
        timestamp: nowISO(),
        data: {
          error: 'Unknown message type',
          received: String(type),
          supported: ['ping', 'subscribe'],
        },
      });
  }
}

/**
 * Send a single event to a specific WebSocket client.
 *
 * Silently ignores send failures (client may have disconnected between
 * readyState check and send).
 *
 * @param socket - Target WebSocket connection.
 * @param event - The event to send.
 */
function sendToClient(socket: WebSocket, event: WSEvent): void {
  if (socket.readyState === socket.OPEN) {
    try {
      socket.send(JSON.stringify(event));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to send to WebSocket client: ${message}`);
      clients.delete(socket);
    }
  }
}

/**
 * Broadcast an event to all connected WebSocket clients.
 *
 * Removes any clients that have closed since last check.
 *
 * @param event - The event to broadcast.
 */
export function broadcastEvent(event: WSEvent): void {
  const deadClients: WebSocket[] = [];

  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      try {
        client.send(JSON.stringify(event));
      } catch {
        deadClients.push(client);
      }
    } else {
      deadClients.push(client);
    }
  }

  // Clean up dead connections
  for (const dead of deadClients) {
    clients.delete(dead);
  }
}

/**
 * Create a broadcast function suitable for use with {@link ServerState.setWSBroadcast}.
 *
 * @returns A broadcast callback that sends events to all connected WS clients.
 */
export function createBroadcast(): WSBroadcast {
  return broadcastEvent;
}

/**
 * Get the count of currently connected WebSocket clients.
 *
 * @returns Number of active connections.
 */
export function getClientCount(): number {
  return clients.size;
}

/**
 * Disconnect all WebSocket clients gracefully.
 *
 * Sends a close frame to each client before removing them.
 */
export function disconnectAll(): void {
  stopHeartbeat();
  for (const client of clients) {
    try {
      client.close(1001, 'Server shutting down');
    } catch {
      // Ignore errors during shutdown
    }
  }
  clients.clear();
  logger.info('All WebSocket clients disconnected');
}

// ---------------------------------------------------------------------------
// Heartbeat — detect and clean up zombie connections
// ---------------------------------------------------------------------------

/**
 * Start the heartbeat interval.
 *
 * Every {@link HEARTBEAT_MS} (30 s), the server:
 * 1. Terminates any client that did not respond to the previous ping.
 * 2. Resets the alive flag for all remaining clients.
 * 3. Sends a new ping frame to each client.
 */
function startHeartbeat(): void {
  if (heartbeatInterval) return; // Already running

  heartbeatInterval = setInterval(() => {
    const deadClients: WebSocket[] = [];

    for (const client of clients) {
      if (!alive.has(client)) {
        // Did not respond to the last ping — terminate
        deadClients.push(client);
        continue;
      }

      // Reset flag and send a new ping
      alive.delete(client);
      try {
        client.ping();
      } catch {
        deadClients.push(client);
      }
    }

    // Clean up dead connections
    for (const dead of deadClients) {
      clients.delete(dead);
      try {
        dead.terminate();
      } catch {
        // Already gone
      }
    }

    if (deadClients.length > 0) {
      logger.info(`Heartbeat: removed ${deadClients.length} stale connection(s) (remaining: ${clients.size})`);
    }

    if (clients.size === 0) stopHeartbeat();
  }, HEARTBEAT_MS);

  logger.debug('WebSocket heartbeat started');
}

/**
 * Stop the heartbeat interval.
 */
function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    logger.debug('WebSocket heartbeat stopped');
  }
}
