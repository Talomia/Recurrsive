/**
 * Unit tests for the ServerState class.
 *
 * Tests cover:
 * - Initial state values
 * - Status tracking (phase, progress, message)
 * - WebSocket broadcast registration and invocation
 * - Initialization with project path
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external dependencies
vi.mock('@recurrsive/graph', () => ({
  createGraphClient: vi.fn().mockResolvedValue({
    getStats: vi.fn().mockResolvedValue({ entityCount: 0, relationshipCount: 0, entityTypes: {}, relationshipTypes: {} }),
    getEntities: vi.fn().mockResolvedValue([]),
    getRelationships: vi.fn().mockResolvedValue([]),
    upsertEntity: vi.fn().mockResolvedValue(undefined),
    upsertRelationship: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@recurrsive/opportunities', () => ({
  OpportunityManager: vi.fn().mockImplementation(() => ({
    list: vi.fn().mockReturnValue([]),
    getTopN: vi.fn().mockReturnValue([]),
    add: vi.fn(),
  })),
}));

vi.mock('@recurrsive/analyzers', () => ({
  AnalyzerRegistry: vi.fn().mockImplementation(() => ({
    register: vi.fn(),
    getAll: vi.fn().mockReturnValue([]),
  })),
  AnalyzerRunner: vi.fn().mockImplementation(() => ({
    run: vi.fn().mockResolvedValue([]),
  })),
  createDefaultAnalyzers: vi.fn().mockReturnValue([]),
}));

vi.mock('@recurrsive/reasoning', () => ({
  ReasoningEngine: vi.fn().mockImplementation(() => ({
    analyze: vi.fn().mockResolvedValue({ hypotheses: [], consensus: null }),
  })),
}));

vi.mock('@recurrsive/collectors', () => ({
  GitCollector: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    collect: vi.fn().mockResolvedValue({ entities: [], relationships: [] }),
  })),
}));

vi.mock('@recurrsive/core', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  generateId: vi.fn().mockReturnValue('test-id-123'),
  nowISO: vi.fn().mockReturnValue('2024-06-15T00:00:00.000Z'),
}));

import { ServerState } from '../state.js';
import type { WSEvent } from '../state.js';

describe('ServerState', () => {
  let state: ServerState;

  beforeEach(() => {
    vi.clearAllMocks();
    state = new ServerState();
  });

  // ── Initial State ─────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts in idle phase', () => {
      const status = state.getAnalysisStatus();
      expect(status.phase).toBe('idle');
    });

    it('starts with 0 progress', () => {
      const status = state.getAnalysisStatus();
      expect(status.progress).toBe(0);
    });

    it('has no analysis in progress', () => {
      const status = state.getAnalysisStatus();
      expect(status.startedAt).toBeNull();
      expect(status.completedAt).toBeNull();
      expect(status.error).toBeNull();
    });

    it('has empty analysis history', () => {
      expect(state.getAnalysisHistory()).toEqual([]);
    });

    it('has no cached results', () => {
      expect(state.getAnalysisCache()).toBeNull();
    });

    it('is not initialized before calling initialize()', () => {
      expect(state.isInitialized()).toBe(false);
    });
  });

  // ── Initialization ────────────────────────────────────────────────────

  describe('initialization', () => {
    it('initializes with a project path', async () => {
      await state.initialize('/tmp/test-project');
      expect(state.getProjectPath()).toBe('/tmp/test-project');
    });

    it('marks state as initialized', async () => {
      await state.initialize('/tmp/test-project');
      expect(state.isInitialized()).toBe(true);
    });

    it('sets project info with name from path', async () => {
      await state.initialize('/tmp/test-project');
      const info = state.getProjectInfo();
      expect(info).not.toBeNull();
      expect(info.name).toBe('test-project');
    });

    it('sets project info root_path', async () => {
      await state.initialize('/tmp/test-project');
      const info = state.getProjectInfo();
      expect(info.root_path).toBe('/tmp/test-project');
    });
  });

  // ── WebSocket Broadcast ───────────────────────────────────────────────

  describe('WebSocket broadcast', () => {
    it('sets a broadcast function and invokes it', () => {
      const broadcastFn = vi.fn();
      state.setWSBroadcast(broadcastFn);

      const event: WSEvent = {
        type: 'analysis:started',
        timestamp: '2024-06-15T00:00:00Z',
        data: { message: 'test' },
      };
      state.broadcast(event);

      expect(broadcastFn).toHaveBeenCalledWith(event);
    });

    it('does nothing if no broadcast function is set', () => {
      const event: WSEvent = {
        type: 'analysis:started',
        timestamp: '2024-06-15T00:00:00Z',
        data: {},
      };
      expect(() => state.broadcast(event)).not.toThrow();
    });

    it('passes the correct event type', () => {
      const broadcastFn = vi.fn();
      state.setWSBroadcast(broadcastFn);

      state.broadcast({
        type: 'analysis:progress',
        timestamp: '2024-06-15T00:00:00Z',
        data: { progress: 50 },
      });

      expect(broadcastFn.mock.calls[0]![0].type).toBe('analysis:progress');
    });
  });

  // ── Status Tracking ───────────────────────────────────────────────────

  describe('status tracking', () => {
    it('getAnalysisStatus returns full status object', () => {
      const status = state.getAnalysisStatus();
      expect(status).toHaveProperty('phase');
      expect(status).toHaveProperty('progress');
      expect(status).toHaveProperty('message');
      expect(status).toHaveProperty('startedAt');
      expect(status).toHaveProperty('completedAt');
      expect(status).toHaveProperty('error');
    });

    it('status message defaults to no analysis running', () => {
      expect(state.getAnalysisStatus().message).toBe('No analysis running');
    });
  });

  // ── Dispose ───────────────────────────────────────────────────────────

  describe('dispose', () => {
    it('does not throw when not initialized', async () => {
      await expect(state.dispose()).resolves.not.toThrow();
    });

    it('disposes graph client after initialization', async () => {
      await state.initialize('/tmp/test-project');
      await expect(state.dispose()).resolves.not.toThrow();
    });
  });
});
