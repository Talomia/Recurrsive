/**
 * Tests for WebSocket event handler.
 *
 * Tests the event broadcasting system, client management,
 * and message handling using mock WebSocket objects.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerClient, broadcastEvent, getClientCount, disconnectAll, createBroadcast } from '../ws/events.js';

// Mock @recurrsive/core
vi.mock('@recurrsive/core', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  nowISO: () => '2026-06-30T12:00:00Z',
}));

// ---------------------------------------------------------------------------
// Mock WebSocket
// ---------------------------------------------------------------------------

type MessageHandler = (data: Buffer) => void;
type CloseHandler = () => void;
type ErrorHandler = (err: Error) => void;

interface MockSocket {
  OPEN: number;
  CLOSED: number;
  readyState: number;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  ping: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  handlers: Record<string, Function[]>;
}

function createMockSocket(): MockSocket {
  const handlers: Record<string, Function[]> = {};

  return {
    OPEN: 1,
    CLOSED: 3,
    readyState: 1, // OPEN
    send: vi.fn(),
    close: vi.fn(),
    ping: vi.fn(),
    handlers,
    on: vi.fn((event: string, handler: Function) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event]!.push(handler);
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WebSocket Events', () => {
  beforeEach(async () => {
    // Clean up all clients between tests
    disconnectAll();
  });

  describe('registerClient', () => {
    it('adds the client and sends a welcome event', async () => {
      const socket = createMockSocket();
      registerClient(socket as any);

      expect(getClientCount()).toBe(1);
      expect(socket.send).toHaveBeenCalledTimes(1);

      const welcome = JSON.parse(socket.send.mock.calls[0][0]);
      expect(welcome.type).toBe('analysis:progress');
      expect(welcome.data.phase).toBe('connected');
    });

    it('registers message, close, and error handlers', async () => {
      const socket = createMockSocket();
      registerClient(socket as any);

      expect(socket.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(socket.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(socket.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('handles ping messages with pong response', async () => {
      const socket = createMockSocket();
      registerClient(socket as any);

      // Simulate a ping message
      const messageHandler = socket.handlers['message']![0]! as MessageHandler;
      messageHandler(Buffer.from(JSON.stringify({ type: 'ping' })));

      // Should have sent welcome + pong
      expect(socket.send).toHaveBeenCalledTimes(2);
      const pong = JSON.parse(socket.send.mock.calls[1][0]);
      expect(pong.data.pong).toBe(true);
    });

    it('handles subscribe messages', async () => {
      const socket = createMockSocket();
      registerClient(socket as any);

      const messageHandler = socket.handlers['message']![0]! as MessageHandler;
      messageHandler(Buffer.from(JSON.stringify({ type: 'subscribe' })));

      expect(socket.send).toHaveBeenCalledTimes(2);
      const sub = JSON.parse(socket.send.mock.calls[1][0]);
      expect(sub.data.subscribed).toBe(true);
      expect(sub.data.events).toContain('analysis:started');
    });

    it('handles unknown message types with error', async () => {
      const socket = createMockSocket();
      registerClient(socket as any);

      const messageHandler = socket.handlers['message']![0]! as MessageHandler;
      messageHandler(Buffer.from(JSON.stringify({ type: 'unknown' })));

      expect(socket.send).toHaveBeenCalledTimes(2);
      const err = JSON.parse(socket.send.mock.calls[1][0]);
      expect(err.type).toBe('analysis:error');
      expect(err.data.error).toBe('Unknown message type');
    });

    it('handles invalid JSON messages with error', async () => {
      const socket = createMockSocket();
      registerClient(socket as any);

      const messageHandler = socket.handlers['message']![0]! as MessageHandler;
      messageHandler(Buffer.from('not valid json'));

      expect(socket.send).toHaveBeenCalledTimes(2);
      const err = JSON.parse(socket.send.mock.calls[1][0]);
      expect(err.type).toBe('analysis:error');
      expect(err.data.error).toBe('Invalid JSON message');
    });

    it('removes client on close', async () => {
      const socket = createMockSocket();
      registerClient(socket as any);
      expect(getClientCount()).toBe(1);

      const closeHandler = socket.handlers['close']![0]! as CloseHandler;
      closeHandler();

      expect(getClientCount()).toBe(0);
    });

    it('removes client on error', async () => {
      const socket = createMockSocket();
      registerClient(socket as any);
      expect(getClientCount()).toBe(1);

      const errorHandler = socket.handlers['error']![0]! as ErrorHandler;
      errorHandler(new Error('Connection lost'));

      expect(getClientCount()).toBe(0);
    });
  });

  describe('broadcastEvent', () => {
    it('sends event to all connected clients', async () => {
      const s1 = createMockSocket();
      const s2 = createMockSocket();
      registerClient(s1 as any);
      registerClient(s2 as any);

      broadcastEvent({
        type: 'analysis:started',
        timestamp: '2026-06-30T12:00:00Z',
        data: { project: 'test' },
      });

      // Each client gets welcome + broadcast
      expect(s1.send).toHaveBeenCalledTimes(2);
      expect(s2.send).toHaveBeenCalledTimes(2);

      const event1 = JSON.parse(s1.send.mock.calls[1][0]);
      const event2 = JSON.parse(s2.send.mock.calls[1][0]);
      expect(event1.type).toBe('analysis:started');
      expect(event2.type).toBe('analysis:started');
    });

    it('removes closed clients during broadcast', async () => {
      const s1 = createMockSocket();
      const s2 = createMockSocket();
      registerClient(s1 as any);
      registerClient(s2 as any);

      // Simulate s2 closing
      s2.readyState = s2.CLOSED;

      broadcastEvent({
        type: 'analysis:progress',
        timestamp: '2026-06-30T12:00:00Z',
        data: { step: 'collect' },
      });

      // s2 should be removed
      expect(getClientCount()).toBe(1);
    });

    it('handles empty client list gracefully', async () => {
      expect(() => {
        broadcastEvent({
          type: 'analysis:complete',
          timestamp: '2026-06-30T12:00:00Z',
          data: {},
        });
      }).not.toThrow();
    });
  });

  describe('getClientCount', () => {
    it('returns 0 when no clients connected', async () => {
      expect(getClientCount()).toBe(0);
    });

    it('returns correct count with multiple clients', async () => {
      registerClient(createMockSocket() as any);
      registerClient(createMockSocket() as any);
      registerClient(createMockSocket() as any);
      expect(getClientCount()).toBe(3);
    });
  });

  describe('disconnectAll', () => {
    it('closes all connections and clears client list', async () => {
      const s1 = createMockSocket();
      const s2 = createMockSocket();
      registerClient(s1 as any);
      registerClient(s2 as any);

      disconnectAll();

      expect(getClientCount()).toBe(0);
      expect(s1.close).toHaveBeenCalledWith(1001, 'Server shutting down');
      expect(s2.close).toHaveBeenCalledWith(1001, 'Server shutting down');
    });
  });

  describe('createBroadcast', () => {
    it('returns a function that broadcasts events', async () => {
      const broadcast = createBroadcast();
      expect(typeof broadcast).toBe('function');

      const socket = createMockSocket();
      registerClient(socket as any);

      broadcast({
        type: 'analysis:progress',
        timestamp: '2026-06-30T12:00:00Z',
        data: { phase: 'analyze' },
      });

      expect(socket.send).toHaveBeenCalledTimes(2); // welcome + broadcast
    });
  });
});
