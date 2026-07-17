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
  DEFAULT_AGE_GRAPH: 'recurrsive',
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

  beforeEach(async () => {
    vi.clearAllMocks();
    state = new ServerState();
  });

  // ── Initial State ─────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts in idle phase', async () => {
      const status = state.getAnalysisStatus();
      expect(status.phase).toBe('idle');
    });

    it('starts with 0 progress', async () => {
      const status = state.getAnalysisStatus();
      expect(status.progress).toBe(0);
    });

    it('has no analysis in progress', async () => {
      const status = state.getAnalysisStatus();
      expect(status.startedAt).toBeNull();
      expect(status.completedAt).toBeNull();
      expect(status.error).toBeNull();
    });

    it('has empty analysis history', async () => {
      expect(state.getAnalysisHistory()).toEqual([]);
    });

    it('has no cached results', async () => {
      expect(state.getAnalysisCache()).toBeNull();
    });

    it('is not initialized before calling initialize()', async () => {
      expect(state.isInitialized()).toBe(false);
    });
  });

  // ── Initialization ────────────────────────────────────────────────────

  describe ('initialization', () => {
    it('initializes with a project path', async () => {
      await state.initialize('/tmp/test-project');
      expect(state.getProjectPath()).toBe('/tmp/test-project');
    });

    it ('marks state as initialized', async () => {
      await state.initialize('/tmp/test-project');
      expect(state.isInitialized()).toBe(true);
    });

    it ('sets project info with name from path', async () => {
      await state.initialize('/tmp/test-project');
      const info = state.getProjectInfo();
      expect(info).not.toBeNull();
      expect(info.name).toBe('test-project');
    });

    it ('sets project info root_path', async () => {
      await state.initialize('/tmp/test-project');
      const info = state.getProjectInfo();
      expect(info.root_path).toBe('/tmp/test-project');
    });
  });

  // ── WebSocket Broadcast ───────────────────────────────────────────────

  describe('WebSocket broadcast', () => {
    it('sets a broadcast function and invokes it', async () => {
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

    it('does nothing if no broadcast function is set', async () => {
      const event: WSEvent = {
        type: 'analysis:started',
        timestamp: '2024-06-15T00:00:00Z',
        data: {},
      };
      expect(() => state.broadcast(event)).not.toThrow();
    });

    it('passes the correct event type', async () => {
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
    it('getAnalysisStatus returns full status object', async () => {
      const status = state.getAnalysisStatus();
      expect(status).toHaveProperty('phase');
      expect(status).toHaveProperty('progress');
      expect(status).toHaveProperty('message');
      expect(status).toHaveProperty('startedAt');
      expect(status).toHaveProperty('completedAt');
      expect(status).toHaveProperty('error');
    });

    it('status message defaults to no analysis running', async () => {
      expect(state.getAnalysisStatus().message).toBe('No analysis running');
    });
  });

  // ── Dispose ───────────────────────────────────────────────────────────

  describe ('dispose', () => {
    it('does not throw when not initialized', async () => {
      await expect(state.dispose()).resolves.not.toThrow();
    });

    it ('disposes graph client after initialization', async () => {
      await state.initialize('/tmp/test-project');
      await expect(state.dispose()).resolves.not.toThrow();
    });

    it ('resets initialized state after dispose', async () => {
      await state.initialize('/tmp/test-project');
      expect(state.isInitialized()).toBe(true);
      await state.dispose();
      expect(state.isInitialized()).toBe(false);
    });
  });

  // ── Analysis History ─────────────────────────────────────────────────

  describe('analysis history tracking', () => {
    it('starts with empty history', async () => {
      expect(state.getAnalysisHistory()).toEqual([]);
    });

    it('getAnalysisHistory returns a copy, not a reference', async () => {
      const h1 = state.getAnalysisHistory();
      const h2 = state.getAnalysisHistory();
      expect(h1).toEqual(h2);
      expect(h1).not.toBe(h2);
    });
  });

  // ── Evolution Timeline ───────────────────────────────────────────────

  describe('evolution timeline', () => {
    it('returns an honest empty timeline when not initialized and no cache', async () => {
      const timeline = state.getEvolutionTimeline();
      expect(timeline).toHaveProperty('snapshots');
      expect(timeline).toHaveProperty('trends');
      expect(Array.isArray(timeline.snapshots)).toBe(true);
      // No analysis → NO fabricated synthetic snapshot.
      expect(timeline.snapshots.length).toBe(0);
    });

    it('has no snapshots (no fabricated overall_health) without cache', async () => {
      const timeline = state.getEvolutionTimeline();
      expect(timeline.snapshots).toEqual([]);
    });

    it('has empty trends array without cache', async () => {
      const timeline = state.getEvolutionTimeline();
      expect(timeline.trends).toEqual([]);
    });
  });

  // ── Health Score ─────────────────────────────────────────────────────

  describe('health score', () => {
    it('returns a not_analyzed sentinel (null overall) without analysis cache', async () => {
      const score = state.getHealthScore();
      expect(score.overall).toBeNull();
      expect(score.status).toBe('not_analyzed');
      expect(score.dimensions).toEqual([]);
    });
  });

  // ── Uninitialized Accessor Errors ────────────────────────────────────

  describe('uninitialized accessor errors', () => {
    it('getGraph rejects when not initialized', async () => {
      await expect(state.getGraph()).rejects.toThrow(/not initialized/i);
    });

    it('getProjectInfo throws when not initialized', async () => {
      expect(() => state.getProjectInfo()).toThrow(/not initialized/i);
    });

    it('getProjectPath throws when not initialized', async () => {
      expect(() => state.getProjectPath()).toThrow(/not initialized/i);
    });
  });

  // ── Analysis Cache ──────────────────────────────────────────────────

  describe('analysis cache', () => {
    it('getAnalysisCache returns null initially', async () => {
      expect(state.getAnalysisCache()).toBeNull();
    });
  });

  // ── Broadcast Integration ────────────────────────────────────────────

  describe('broadcast integration', () => {
    it('setWSBroadcast can be called multiple times', async () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      state.setWSBroadcast(fn1);
      state.broadcast({ type: 'analysis:started', timestamp: '2024-01-01T00:00:00Z', data: {} });
      expect(fn1).toHaveBeenCalledTimes(1);

      state.setWSBroadcast(fn2);
      state.broadcast({ type: 'analysis:started', timestamp: '2024-01-01T00:00:00Z', data: {} });
      expect(fn2).toHaveBeenCalledTimes(1);
      // fn1 should not have been called again
      expect(fn1).toHaveBeenCalledTimes(1);
    });

    it('broadcast includes all event fields', async () => {
      const broadcastFn = vi.fn();
      state.setWSBroadcast(broadcastFn);

      const event: WSEvent = {
        type: 'analysis:complete',
        timestamp: '2024-06-15T12:00:00Z',
        data: { runId: 'test-run', durationMs: 1234 },
      };
      state.broadcast(event);

      const called = broadcastFn.mock.calls[0]![0];
      expect(called.type).toBe('analysis:complete');
      expect(called.timestamp).toBe('2024-06-15T12:00:00Z');
      expect(called.data.runId).toBe('test-run');
      expect(called.data.durationMs).toBe(1234);
    });
  });

  // ── markAnalysisStarting ─────────────────────────────────────────────

  describe('markAnalysisStarting', () => {
    it('transitions phase from idle to collecting', async () => {
      expect(state.getAnalysisStatus().phase).toBe('idle');
      state.markAnalysisStarting();
      expect(state.getAnalysisStatus().phase).toBe('collecting');
    });

    it('sets progress to 0', async () => {
      state.markAnalysisStarting();
      expect(state.getAnalysisStatus().progress).toBe(0);
    });

    it('sets startedAt to a non-null value', async () => {
      state.markAnalysisStarting();
      expect(state.getAnalysisStatus().startedAt).not.toBeNull();
    });

    it('leaves completedAt as null', async () => {
      state.markAnalysisStarting();
      expect(state.getAnalysisStatus().completedAt).toBeNull();
    });
  });

  // ── getOpportunities ────────────────────────────────────────────────

  describe('opportunity manager', () => {
    it('getOpportunities returns a manager even before initialization', async () => {
      const manager = state.getOpportunities();
      expect(manager).toBeDefined();
      expect(typeof manager.list).toBe('function');
    });
  });
});

