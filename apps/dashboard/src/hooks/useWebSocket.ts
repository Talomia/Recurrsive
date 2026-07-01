/**
 * @module useWebSocket
 *
 * React hook for consuming real-time WebSocket events from the
 * Recurrsive analysis server.
 *
 * Provides automatic reconnection with exponential backoff,
 * connection status tracking, and typed event handling.
 *
 * @packageDocumentation
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** WebSocket connection status. */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

/** Shape of a WebSocket event from the Recurrsive server. */
export interface WSEvent {
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
}

/** Options for the useWebSocket hook. */
export interface UseWebSocketOptions {
  /** WebSocket URL. Defaults to ws://localhost:3000/ws */
  url?: string;
  /** Event types to filter for. If empty, receives all events. */
  eventTypes?: string[];
  /** Whether to auto-connect on mount. Defaults to true. */
  autoConnect?: boolean;
  /** Maximum reconnection attempts. Defaults to 10. */
  maxReconnectAttempts?: number;
  /** Base delay for reconnection backoff in ms. Defaults to 1000. */
  reconnectBaseDelay?: number;
}

/** Return value from the useWebSocket hook. */
export interface UseWebSocketReturn {
  /** Current connection status. */
  status: ConnectionStatus;
  /** Most recent event received (matching filter if set). */
  lastEvent: WSEvent | null;
  /** All events received during this session (capped at 100). */
  events: WSEvent[];
  /** Number of connected clients (from server). */
  clientCount: number;
  /** Manually connect to the WebSocket server. */
  connect: () => void;
  /** Manually disconnect from the WebSocket server. */
  disconnect: () => void;
  /** Send a message to the server. */
  send: (data: Record<string, unknown>) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_URL = 'ws://localhost:3000/ws';
const MAX_EVENT_BUFFER = 100;
const DEFAULT_MAX_RECONNECT = 10;
const DEFAULT_RECONNECT_DELAY = 1000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * React hook for consuming real-time WebSocket events.
 *
 * @param options - Configuration options.
 * @returns WebSocket state and control functions.
 *
 * @example
 * ```tsx
 * function AnalysisProgress() {
 *   const { status, lastEvent, events } = useWebSocket({
 *     eventTypes: ['analysis:progress', 'analysis:complete'],
 *   });
 *
 *   return (
 *     <div>
 *       <p>Status: {status}</p>
 *       {lastEvent && <p>Last: {lastEvent.type}</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    url = DEFAULT_URL,
    eventTypes = [],
    autoConnect = true,
    maxReconnectAttempts = DEFAULT_MAX_RECONNECT,
    reconnectBaseDelay = DEFAULT_RECONNECT_DELAY,
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lastEvent, setLastEvent] = useState<WSEvent | null>(null);
  const [events, setEvents] = useState<WSEvent[]>([]);
  const [clientCount, setClientCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  /** Clear any pending reconnect timer. */
  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  /** Disconnect from the WebSocket server. */
  const disconnect = useCallback(() => {
    clearReconnectTimer();
    reconnectAttemptsRef.current = maxReconnectAttempts; // Prevent auto-reconnect
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }
    if (mountedRef.current) {
      setStatus('disconnected');
    }
  }, [clearReconnectTimer, maxReconnectAttempts]);

  /** Send a message to the server. */
  const send = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  /** Connect to the WebSocket server. */
  const connect = useCallback(() => {
    // Don't connect if already connected or connecting
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    clearReconnectTimer();
    reconnectAttemptsRef.current = 0;

    if (mountedRef.current) {
      setStatus('connecting');
    }

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (mountedRef.current) {
          setStatus('connected');
          reconnectAttemptsRef.current = 0;
        }

        // Subscribe to events
        ws.send(JSON.stringify({ type: 'subscribe' }));
      };

      ws.onmessage = (messageEvent: MessageEvent) => {
        try {
          const event = JSON.parse(messageEvent.data as string) as WSEvent;

          // Update client count if present
          if (typeof event.data?.['clients'] === 'number') {
            if (mountedRef.current) {
              setClientCount(event.data['clients'] as number);
            }
          }

          // Apply event type filter
          if (eventTypes.length > 0 && !eventTypes.includes(event.type)) {
            return;
          }

          if (mountedRef.current) {
            setLastEvent(event);
            setEvents((prev) => {
              const updated = [event, ...prev];
              return updated.slice(0, MAX_EVENT_BUFFER);
            });
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = (closeEvent: CloseEvent) => {
        wsRef.current = null;

        if (!mountedRef.current) return;

        // Don't reconnect on intentional close
        if (closeEvent.code === 1000) {
          setStatus('disconnected');
          return;
        }

        // Attempt reconnection with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          setStatus('reconnecting');
          const delay = reconnectBaseDelay * Math.pow(2, reconnectAttemptsRef.current);
          reconnectAttemptsRef.current++;

          reconnectTimerRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connect();
            }
          }, Math.min(delay, 30000)); // Cap at 30 seconds
        } else {
          setStatus('disconnected');
        }
      };

      ws.onerror = () => {
        // onclose will fire after onerror, handle reconnect there
      };
    } catch {
      if (mountedRef.current) {
        setStatus('disconnected');
      }
    }
  }, [url, eventTypes, clearReconnectTimer, maxReconnectAttempts, reconnectBaseDelay]);

  // Auto-connect on mount
  useEffect(() => {
    mountedRef.current = true;

    if (autoConnect) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      clearReconnectTimer();
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmount');
        wsRef.current = null;
      }
    };
  }, [autoConnect, connect, clearReconnectTimer]);

  return {
    status,
    lastEvent,
    events,
    clientCount,
    connect,
    disconnect,
    send,
  };
}
