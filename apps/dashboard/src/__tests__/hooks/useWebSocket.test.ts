/**
 * Tests for the useWebSocket hook types and exports.
 */

import { describe, it, expect } from 'vitest';
import type { ConnectionStatus, WSEvent, UseWebSocketOptions } from '../../hooks/useWebSocket';

describe('useWebSocket types', () => {
  it('ConnectionStatus type has expected values', () => {
    // Type-level test — ensures the type is importable and assignable
    const statuses: ConnectionStatus[] = [
      'connecting',
      'connected',
      'disconnected',
      'reconnecting',
    ];
    expect(statuses).toHaveLength(4);
  });

  it('WSEvent type has expected shape', () => {
    const event: WSEvent = {
      type: 'analysis:started',
      timestamp: new Date().toISOString(),
      data: { projectId: 'test' },
    };
    expect(event.type).toBe('analysis:started');
    expect(event.data).toBeDefined();
  });

  it('UseWebSocketOptions defaults are reasonable', () => {
    const opts: UseWebSocketOptions = {};
    // url, eventTypes, autoConnect are all optional
    expect(opts.url).toBeUndefined();
    expect(opts.eventTypes).toBeUndefined();
    expect(opts.autoConnect).toBeUndefined();
    expect(opts.maxReconnectAttempts).toBeUndefined();
  });
});
