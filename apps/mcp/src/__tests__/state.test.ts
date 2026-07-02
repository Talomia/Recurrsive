/**
 * Unit tests for the ServerState class.
 *
 * Tests cover:
 * - State construction defaults
 * - isInitialized() behavior
 * - getGraph / getOpportunities / getProjectInfo / getProjectPath throw when uninitialized
 * - getAnalysisCache returns null before any analysis
 * - initialize() wires up graph, opportunity manager, and project info
 * - dispose() resets all state
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// NOTE: vi.mock factories are hoisted — all references must be inline.
// We retrieve the mock graph client via the createGraphClient mock's return value.

vi.mock('@recurrsive/graph', () => ({
  createGraphClient: vi.fn().mockResolvedValue({
    dispose: vi.fn().mockResolvedValue(undefined),
    upsertEntity: vi.fn().mockResolvedValue(undefined),
    upsertRelationship: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockResolvedValue({
      totalEntities: 0,
      totalRelationships: 0,
      entityCountsByType: {},
      relationshipCountsByType: {},
    }),
    getEntities: vi.fn().mockResolvedValue([]),
    getRelationships: vi.fn().mockResolvedValue([]),
    getEntity: vi.fn().mockResolvedValue(null),
    getNeighbors: vi.fn().mockResolvedValue({ entities: [], relationships: [] }),
    query: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock('@recurrsive/opportunities', () => ({
  OpportunityManager: vi.fn().mockImplementation(() => ({
    list: vi.fn().mockReturnValue([]),
    get: vi.fn(),
    getTopN: vi.fn().mockReturnValue([]),
  })),
}));

vi.mock('@recurrsive/analyzers', () => ({
  AnalyzerRegistry: vi.fn(),
  AnalyzerRunner: vi.fn(),
  createDefaultAnalyzers: vi.fn().mockReturnValue([]),
}));

vi.mock('@recurrsive/reasoning', () => ({
  ReasoningEngine: vi.fn(),
}));

vi.mock('@recurrsive/collectors', () => ({
  GitCollector: vi.fn(),
  DocumentationCollector: vi.fn(),
  EnvironmentCollector: vi.fn(),
  CICDCollector: vi.fn(),
  DatabaseCollector: vi.fn(),
}));

vi.mock('@recurrsive/core', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  nowISO: vi.fn(() => '2024-01-01T00:00:00Z'),
  generateId: vi.fn(() => 'test-id'),
}));

import { ServerState } from '../state.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ServerState', () => {
  let serverState: ServerState;

  beforeEach(() => {
    vi.clearAllMocks();
    serverState = new ServerState();
  });

  // ── Construction Defaults ────────────────────────────────────────────

  describe('construction defaults', () => {
    it('is not initialized by default', () => {
      expect(serverState.isInitialized()).toBe(false);
    });

    it('has no analysis cache by default', () => {
      expect(serverState.getAnalysisCache()).toBeNull();
    });
  });

  // ── Uninitialized Guards ─────────────────────────────────────────────

  describe('uninitialized guards', () => {
    it('getGraph throws when not initialized', () => {
      expect(() => serverState.getGraph()).toThrow(
        /Server not initialized/,
      );
    });

    it('getOpportunities throws when not initialized', () => {
      expect(() => serverState.getOpportunities()).toThrow(
        /Server not initialized/,
      );
    });

    it('getProjectInfo throws when not initialized', () => {
      expect(() => serverState.getProjectInfo()).toThrow(
        /Server not initialized/,
      );
    });

    it('getProjectPath throws when not initialized', () => {
      expect(() => serverState.getProjectPath()).toThrow(
        /Server not initialized/,
      );
    });
  });

  // ── initialize() ────────────────────────────────────────────────────

  describe('initialize', () => {
    it('marks the state as initialized after calling initialize()', async () => {
      await serverState.initialize('/tmp/test-project');
      expect(serverState.isInitialized()).toBe(true);
    });

    it('stores the project path', async () => {
      await serverState.initialize('/tmp/test-project');
      expect(serverState.getProjectPath()).toBe('/tmp/test-project');
    });

    it('creates graph client during initialization', async () => {
      const { createGraphClient } = await import('@recurrsive/graph');
      await serverState.initialize('/tmp/test-project');
      expect(createGraphClient).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'sqlite',
          sqlitePath: ':memory:',
          autoMigrate: true,
        }),
      );
    });

    it('sets up project info with basename of path', async () => {
      await serverState.initialize('/home/user/my-project');
      const info = serverState.getProjectInfo();
      expect(info.name).toBe('my-project');
      expect(info.root_path).toBe('/home/user/my-project');
      expect(info.languages).toEqual([]);
      expect(info.frameworks).toEqual([]);
      expect(info.ai_providers).toEqual([]);
    });

    it('getGraph returns the graph client after init', async () => {
      await serverState.initialize('/tmp/test-project');
      const graph = serverState.getGraph();
      expect(graph).toBeDefined();
      // Verify it's the same object returned by createGraphClient
      expect(graph).toHaveProperty('dispose');
      expect(graph).toHaveProperty('upsertEntity');
    });

    it('getOpportunities returns the opportunity manager after init', async () => {
      await serverState.initialize('/tmp/test-project');
      const opps = serverState.getOpportunities();
      expect(opps).toBeDefined();
      expect(opps).toHaveProperty('list');
    });
  });

  // ── dispose() ───────────────────────────────────────────────────────

  describe('dispose', () => {
    it('marks the state as uninitialized after dispose', async () => {
      await serverState.initialize('/tmp/test-project');
      expect(serverState.isInitialized()).toBe(true);

      await serverState.dispose();
      expect(serverState.isInitialized()).toBe(false);
    });

    it('calls dispose on the graph client', async () => {
      await serverState.initialize('/tmp/test-project');
      const graph = serverState.getGraph();
      await serverState.dispose();
      expect(graph.dispose).toHaveBeenCalled();
    });

    it('clears analysis cache after dispose', async () => {
      await serverState.initialize('/tmp/test-project');
      await serverState.dispose();
      expect(serverState.getAnalysisCache()).toBeNull();
    });

    it('getGraph throws after dispose', async () => {
      await serverState.initialize('/tmp/test-project');
      await serverState.dispose();
      expect(() => serverState.getGraph()).toThrow(/Server not initialized/);
    });

    it('dispose is safe to call when not initialized', async () => {
      // Should not throw
      await serverState.dispose();
      expect(serverState.isInitialized()).toBe(false);
    });
  });

  // ── AnalysisCache accessor ──────────────────────────────────────────

  describe('getAnalysisCache', () => {
    it('returns null when no analysis has been run', () => {
      expect(serverState.getAnalysisCache()).toBeNull();
    });

    it('does not require initialization to call', () => {
      // getAnalysisCache is the one getter that doesn't assert init
      expect(() => serverState.getAnalysisCache()).not.toThrow();
    });
  });

  // ── Singleton export ─────────────────────────────────────────────────

  describe('singleton export', () => {
    it('exports a state singleton', async () => {
      const mod = await import('../state.js');
      expect(mod.state).toBeInstanceOf(ServerState);
    });
  });
});
