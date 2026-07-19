/**
 * Tests for PerformanceAnalyzer.
 *
 * Covers all 6 rules: sequential LLM calls, N+1 queries,
 * missing caching, large context windows, synchronous blocking,
 * and unbounded loops. (Missing pagination is owned by the
 * api-contract analyzer to avoid double-reporting.)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PerformanceAnalyzer } from '../../performance/analyzer.js';
import type { AnalysisContext, Entity, Relationship, Finding } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date().toISOString();
let _idCounter = 0;
function nextId(): string {
  _idCounter++;
  const hex = _idCounter.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${hex}`;
}

function makeEntity(overrides: Partial<Entity> & Pick<Entity, 'type' | 'name'>): Entity {
  return {
    id: nextId(),
    qualified_name: `test:${overrides.name}`,
    source: 'test-collector',
    properties: {},
    tags: [],
    created_at: NOW,
    updated_at: NOW,
    last_seen_at: NOW,
    ...overrides,
  };
}

function makeRel(overrides: Partial<Relationship> & Pick<Relationship, 'type' | 'source_id' | 'target_id'>): Relationship {
  return {
    id: nextId(),
    properties: {},
    confidence: 1,
    source: 'test',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

type GetRelsFn = (id: string, dir: string) => Relationship[];

function makeContext(
  entitiesByType: Record<string, Entity[]> = {},
  relsFn: GetRelsFn = () => [],
): AnalysisContext {
  return {
    graph: {
      getEntity: vi.fn(),
      getEntities: vi.fn().mockImplementation((type: string) =>
        Promise.resolve(entitiesByType[type] ?? []),
      ),
      getRelationships: vi.fn().mockImplementation((id: string, dir: string) =>
        Promise.resolve(relsFn(id, dir)),
      ),
      query: vi.fn(),
      getNeighbors: vi.fn(),
    },
    config: { enabled: true, severity_threshold: 'low', custom: {} },
    history: {
      getPreviousFindings: vi.fn().mockResolvedValue([]),
      getAcceptedOpportunities: vi.fn().mockResolvedValue([]),
      getRejectedOpportunities: vi.fn().mockResolvedValue([]),
    },
    project: {
      name: 'test-project',
      root_path: '/tmp/test',
      languages: ['typescript'],
      frameworks: [],
      ai_providers: [],
    },
    emit: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PerformanceAnalyzer', () => {
  let analyzer: PerformanceAnalyzer;

  beforeEach(() => {
    analyzer = new PerformanceAnalyzer();
    _idCounter = 0;
  });

  // ── Metadata ─────────────────────────────────────────────────────────

  it('has correct metadata', () => {
    expect(analyzer.id).toBe('performance.general');
    expect(analyzer.name).toBe('Performance Analyzer');
    expect(analyzer.categories).toContain('performance');
  });

  // ── Rule 1: Sequential LLM Calls ───────────────────────────────────

  describe('sequential LLM calls', () => {
    it('detects functions with multiple sequential LLM calls', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'generateReport',
      });
      const model1 = makeEntity({ type: 'model', name: 'gpt-4' });
      const model2 = makeEntity({ type: 'model', name: 'gpt-3.5' });

      const rels = [
        makeRel({ type: 'uses_model', source_id: fn.id, target_id: model1.id }),
        makeRel({ type: 'uses_model', source_id: fn.id, target_id: model2.id }),
      ];

      const ctx = makeContext(
        { function: [fn] },
        (id, dir) => (id === fn.id && dir === 'out' ? rels : []),
      );

      const findings = await analyzer.analyze(ctx);

      const seqFindings = findings.filter((f) => f.title.includes('Sequential LLM calls'));
      expect(seqFindings).toHaveLength(1);
      expect(seqFindings[0]!.severity).toBe('medium');
      expect(seqFindings[0]!.title).toContain('generateReport');
    });

    it('skips functions marked with uses_promise_all', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'parallelReport',
        properties: { uses_promise_all: true },
      });
      const model1 = makeEntity({ type: 'model', name: 'gpt-4' });
      const model2 = makeEntity({ type: 'model', name: 'gpt-3.5' });

      const rels = [
        makeRel({ type: 'uses_model', source_id: fn.id, target_id: model1.id }),
        makeRel({ type: 'uses_model', source_id: fn.id, target_id: model2.id }),
      ];

      const ctx = makeContext(
        { function: [fn] },
        (id, dir) => (id === fn.id && dir === 'out' ? rels : []),
      );

      const findings = await analyzer.analyze(ctx);

      const seqFindings = findings.filter((f) => f.title.includes('Sequential LLM calls'));
      expect(seqFindings).toHaveLength(0);
    });

    it('skips functions tagged as parallel', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'concurrentReport',
        tags: ['parallel'],
      });
      const model1 = makeEntity({ type: 'model', name: 'gpt-4' });
      const model2 = makeEntity({ type: 'model', name: 'gpt-3.5' });

      const rels = [
        makeRel({ type: 'uses_model', source_id: fn.id, target_id: model1.id }),
        makeRel({ type: 'uses_model', source_id: fn.id, target_id: model2.id }),
      ];

      const ctx = makeContext(
        { function: [fn] },
        (id, dir) => (id === fn.id && dir === 'out' ? rels : []),
      );

      const findings = await analyzer.analyze(ctx);

      const seqFindings = findings.filter((f) => f.title.includes('Sequential LLM calls'));
      expect(seqFindings).toHaveLength(0);
    });

    it('skips functions with only one LLM call', async () => {
      const fn = makeEntity({ type: 'function', name: 'singleCall' });
      const model1 = makeEntity({ type: 'model', name: 'gpt-4' });

      const rels = [
        makeRel({ type: 'uses_model', source_id: fn.id, target_id: model1.id }),
      ];

      const ctx = makeContext(
        { function: [fn] },
        (id, dir) => (id === fn.id && dir === 'out' ? rels : []),
      );

      const findings = await analyzer.analyze(ctx);

      const seqFindings = findings.filter((f) => f.title.includes('Sequential LLM calls'));
      expect(seqFindings).toHaveLength(0);
    });
  });

  // ── Rule 2: N+1 Queries ────────────────────────────────────────────

  describe('N+1 queries', () => {
    it('detects function querying same table multiple times', async () => {
      const fn = makeEntity({ type: 'function', name: 'fetchUsers' });
      const tableId = nextId();

      const rels = [
        makeRel({ type: 'queries_table', source_id: fn.id, target_id: tableId }),
        makeRel({ type: 'queries_table', source_id: fn.id, target_id: tableId }),
      ];

      const ctx = makeContext(
        { function: [fn] },
        (id, dir) => (id === fn.id && dir === 'out' ? rels : []),
      );

      const findings = await analyzer.analyze(ctx);

      const nPlusFindings = findings.filter((f) => f.title.includes('N+1 query'));
      expect(nPlusFindings).toHaveLength(1);
      expect(nPlusFindings[0]!.severity).toBe('high');
      expect(nPlusFindings[0]!.title).toContain('fetchUsers');
    });

    it('detects function with loop tag querying multiple tables', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'processOrders',
        tags: ['loop'],
      });
      const table1 = nextId();
      const table2 = nextId();

      const rels = [
        makeRel({ type: 'queries_table', source_id: fn.id, target_id: table1 }),
        makeRel({ type: 'reads_from', source_id: fn.id, target_id: table2 }),
      ];

      const ctx = makeContext(
        { function: [fn] },
        (id, dir) => (id === fn.id && dir === 'out' ? rels : []),
      );

      const findings = await analyzer.analyze(ctx);

      const nPlusFindings = findings.filter((f) => f.title.includes('N+1 query'));
      expect(nPlusFindings).toHaveLength(1);
    });

    it('skips function with only one query', async () => {
      const fn = makeEntity({ type: 'function', name: 'singleQuery' });
      const tableId = nextId();

      const rels = [
        makeRel({ type: 'queries_table', source_id: fn.id, target_id: tableId }),
      ];

      const ctx = makeContext(
        { function: [fn] },
        (id, dir) => (id === fn.id && dir === 'out' ? rels : []),
      );

      const findings = await analyzer.analyze(ctx);

      const nPlusFindings = findings.filter((f) => f.title.includes('N+1 query'));
      expect(nPlusFindings).toHaveLength(0);
    });

    it('skips function with has_loop but only one query', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'loopSingleQuery',
        properties: { has_loop: true },
      });
      const tableId = nextId();

      const rels = [
        makeRel({ type: 'queries_table', source_id: fn.id, target_id: tableId }),
      ];

      const ctx = makeContext(
        { function: [fn] },
        (id, dir) => (id === fn.id && dir === 'out' ? rels : []),
      );

      const findings = await analyzer.analyze(ctx);

      const nPlusFindings = findings.filter((f) => f.title.includes('N+1 query'));
      expect(nPlusFindings).toHaveLength(0);
    });
  });

  // ── Rule 3: Missing Caching ────────────────────────────────────────

  describe('missing caching', () => {
    it('detects expensive function called many times without caching', async () => {
      // We need: a callee function called ≥3 times, that makes expensive ops
      const callee = makeEntity({
        type: 'function',
        name: 'fetchUserProfile',
      });
      const caller1 = makeEntity({ type: 'function', name: 'handler1' });
      const caller2 = makeEntity({ type: 'function', name: 'handler2' });
      const caller3 = makeEntity({ type: 'function', name: 'handler3' });
      const tableId = nextId();

      const allFunctions = [callee, caller1, caller2, caller3];

      // Each caller calls the callee
      const relsFn: GetRelsFn = (id, dir) => {
        if (dir === 'out') {
          if (id === caller1.id || id === caller2.id || id === caller3.id) {
            return [makeRel({ type: 'calls', source_id: id, target_id: callee.id })];
          }
          if (id === callee.id) {
            return [makeRel({ type: 'queries_table', source_id: callee.id, target_id: tableId })];
          }
        }
        return [];
      };

      const ctx = makeContext({ function: allFunctions }, relsFn);

      const findings = await analyzer.analyze(ctx);

      const cacheFindings = findings.filter((f) => f.title.includes('Missing caching'));
      expect(cacheFindings).toHaveLength(1);
      expect(cacheFindings[0]!.severity).toBe('medium');
      expect(cacheFindings[0]!.title).toContain('fetchUserProfile');
    });

    it('skips cached functions', async () => {
      const callee = makeEntity({
        type: 'function',
        name: 'cachedProfile',
        tags: ['cached'],
      });
      const caller1 = makeEntity({ type: 'function', name: 'h1' });
      const caller2 = makeEntity({ type: 'function', name: 'h2' });
      const caller3 = makeEntity({ type: 'function', name: 'h3' });
      const tableId = nextId();

      const allFunctions = [callee, caller1, caller2, caller3];

      const relsFn: GetRelsFn = (id, dir) => {
        if (dir === 'out') {
          if (id === caller1.id || id === caller2.id || id === caller3.id) {
            return [makeRel({ type: 'calls', source_id: id, target_id: callee.id })];
          }
          if (id === callee.id) {
            return [makeRel({ type: 'queries_table', source_id: callee.id, target_id: tableId })];
          }
        }
        return [];
      };

      const ctx = makeContext({ function: allFunctions }, relsFn);

      const findings = await analyzer.analyze(ctx);

      const cacheFindings = findings.filter((f) => f.title.includes('Missing caching'));
      expect(cacheFindings).toHaveLength(0);
    });

    it('skips non-expensive functions called many times', async () => {
      const callee = makeEntity({ type: 'function', name: 'cheapHelper' });
      const caller1 = makeEntity({ type: 'function', name: 'c1' });
      const caller2 = makeEntity({ type: 'function', name: 'c2' });
      const caller3 = makeEntity({ type: 'function', name: 'c3' });

      const allFunctions = [callee, caller1, caller2, caller3];

      const relsFn: GetRelsFn = (id, dir) => {
        if (dir === 'out') {
          if (id === caller1.id || id === caller2.id || id === caller3.id) {
            return [makeRel({ type: 'calls', source_id: id, target_id: callee.id })];
          }
          // callee has no expensive outgoing relationships
          if (id === callee.id) {
            return [];
          }
        }
        return [];
      };

      const ctx = makeContext({ function: allFunctions }, relsFn);

      const findings = await analyzer.analyze(ctx);

      const cacheFindings = findings.filter((f) => f.title.includes('Missing caching'));
      expect(cacheFindings).toHaveLength(0);
    });
  });

  // ── Rule 4: Large Context Windows ──────────────────────────────────

  describe('large context windows', () => {
    it('detects prompt with explicit context_token_count exceeding 80% of max', async () => {
      const prompt = makeEntity({
        type: 'prompt',
        name: 'mega-prompt',
        properties: { context_token_count: 90000 },
      });
      const ctx = makeContext({ prompt: [prompt] });

      const findings = await analyzer.analyze(ctx);

      const ctxFindings = findings.filter((f) => f.title.includes('Near-maximum context'));
      expect(ctxFindings).toHaveLength(1);
      expect(ctxFindings[0]!.severity).toBe('medium');
      expect(ctxFindings[0]!.title).toContain('mega-prompt');
    });

    it('detects prompt with large template content (estimated tokens)', async () => {
      // 100k tokens × 4 chars/token = 400k chars → >80% of 100k default threshold
      const largeContent = 'x'.repeat(400_000);
      const prompt = makeEntity({
        type: 'prompt',
        name: 'long-template',
        properties: { template: largeContent },
      });
      const ctx = makeContext({ prompt: [prompt] });

      const findings = await analyzer.analyze(ctx);

      const ctxFindings = findings.filter((f) => f.title.includes('Near-maximum context'));
      expect(ctxFindings).toHaveLength(1);
    });

    it('respects custom max_context_tokens', async () => {
      const prompt = makeEntity({
        type: 'prompt',
        name: 'small-window',
        properties: { context_token_count: 500, max_context_tokens: 600 },
      });
      const ctx = makeContext({ prompt: [prompt] });

      const findings = await analyzer.analyze(ctx);

      // 500/600 = 83% > 80%
      const ctxFindings = findings.filter((f) => f.title.includes('Near-maximum context'));
      expect(ctxFindings).toHaveLength(1);
    });

    it('produces no finding for small prompts', async () => {
      const prompt = makeEntity({
        type: 'prompt',
        name: 'tiny-prompt',
        properties: { template: 'Hello world' },
      });
      const ctx = makeContext({ prompt: [prompt] });

      const findings = await analyzer.analyze(ctx);

      const ctxFindings = findings.filter((f) => f.title.includes('Near-maximum context'));
      expect(ctxFindings).toHaveLength(0);
    });
  });

  // ── Rule 5: Synchronous Blocking ───────────────────────────────────

  describe('synchronous blocking', () => {
    it('detects functions with sync_file_io property', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'loadConfig',
        properties: { sync_file_io: true },
      });
      const ctx = makeContext({ function: [fn] });

      const findings = await analyzer.analyze(ctx);

      const syncFindings = findings.filter((f) => f.title.includes('Synchronous blocking'));
      expect(syncFindings).toHaveLength(1);
      expect(syncFindings[0]!.severity).toBe('high');
    });

    it('detects functions tagged sync-blocking', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'processFile',
        tags: ['sync-blocking'],
      });
      const ctx = makeContext({ function: [fn] });

      const findings = await analyzer.analyze(ctx);

      const syncFindings = findings.filter((f) => f.title.includes('Synchronous blocking'));
      expect(syncFindings).toHaveLength(1);
    });

    it('detects functions with Sync suffix in name', async () => {
      const fn = makeEntity({ type: 'function', name: 'readFileSync' });
      const ctx = makeContext({ function: [fn] });

      const findings = await analyzer.analyze(ctx);

      const syncFindings = findings.filter((f) => f.title.includes('Synchronous blocking'));
      expect(syncFindings).toHaveLength(1);
    });

    it('detects execSync in function name', async () => {
      const fn = makeEntity({ type: 'function', name: 'execSync' });
      const ctx = makeContext({ function: [fn] });

      const findings = await analyzer.analyze(ctx);

      const syncFindings = findings.filter((f) => f.title.includes('Synchronous blocking'));
      expect(syncFindings).toHaveLength(1);
    });

    it('produces no finding for async functions', async () => {
      const fn = makeEntity({ type: 'function', name: 'readFile' });
      const ctx = makeContext({ function: [fn] });

      const findings = await analyzer.analyze(ctx);

      const syncFindings = findings.filter((f) => f.title.includes('Synchronous blocking'));
      expect(syncFindings).toHaveLength(0);
    });

    it('does NOT assert definite blocking for generic Sync-suffixed names (initSync/dataSync)', async () => {
      // wasm-bindgen's initSync and tfjs's dataSync are not Node blocking
      // I/O APIs — they must not get the HIGH/0.95 definite claim.
      // (dataSync is excluded entirely by the `...aSync` guard; initSync is
      // downgraded to a hedged "possible" finding.)
      const fns = [
        makeEntity({ type: 'function', name: 'initSync' }),
        makeEntity({ type: 'function', name: 'dataSync' }),
      ];
      const ctx = makeContext({ function: fns });

      const findings = await analyzer.analyze(ctx);

      expect(findings.filter((f) => f.title.startsWith('Synchronous blocking'))).toHaveLength(0);
      const possible = findings.filter((f) => f.title.startsWith('Possible synchronous blocking'));
      expect(possible).toHaveLength(1);
      expect(possible[0]!.title).toContain('initSync');
      expect(possible[0]!.severity).toBe('medium');
      expect(possible[0]!.confidence).toBeLessThanOrEqual(0.5);
      expect(possible[0]!.description).toContain('may also be an unrelated naming convention');
    });
  });

  // ── Missing Pagination (moved to api-contract analyzer) ──────────────

  describe('missing pagination (not owned by this analyzer)', () => {
    it('does not report missing pagination — the api-contract analyzer owns that rule', async () => {
      // Previously BOTH analyzers reported every unpaginated list endpoint,
      // double-counting the same issue.
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: { method: 'GET', path: '/api/users' },
      });
      const ctx = makeContext({ endpoint: [endpoint] });

      const findings = await analyzer.analyze(ctx);

      const pageFindings = findings.filter((f) => f.title.includes('Missing pagination'));
      expect(pageFindings).toHaveLength(0);
    });
  });

  // ── Rule 7: Unbounded Loops ────────────────────────────────────────

  describe('unbounded loops', () => {
    it('detects functions with has_unbounded_loop property', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'processAll',
        properties: { has_unbounded_loop: true },
      });
      const ctx = makeContext(
        { function: [fn] },
        () => [],
      );

      const findings = await analyzer.analyze(ctx);

      const loopFindings = findings.filter((f) => f.title.includes('Unbounded loop'));
      expect(loopFindings).toHaveLength(1);
      expect(loopFindings[0]!.severity).toBe('medium');
    });

    it('detects functions tagged unbounded-loop', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'iterate',
        tags: ['unbounded-loop'],
      });
      const ctx = makeContext(
        { function: [fn] },
        () => [],
      );

      const findings = await analyzer.analyze(ctx);

      const loopFindings = findings.filter((f) => f.title.includes('Unbounded loop'));
      expect(loopFindings).toHaveLength(1);
    });

    it('detects while-true loops with high severity', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'pollForever',
        properties: { has_while_true: true },
      });
      const ctx = makeContext(
        { function: [fn] },
        () => [],
      );

      const findings = await analyzer.analyze(ctx);

      const loopFindings = findings.filter((f) => f.title.includes('Unbounded loop'));
      expect(loopFindings).toHaveLength(1);
      expect(loopFindings[0]!.severity).toBe('high');
    });

    it('detects loop over data source without size limit', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'processBatch',
        properties: { has_loop: true },
      });
      const tableId = nextId();
      const rels = [
        makeRel({ type: 'reads_from', source_id: fn.id, target_id: tableId }),
      ];

      const ctx = makeContext(
        { function: [fn] },
        (id, dir) => (id === fn.id && dir === 'out' ? rels : []),
      );

      const findings = await analyzer.analyze(ctx);

      const loopFindings = findings.filter((f) => f.title.includes('Unbounded loop'));
      expect(loopFindings).toHaveLength(1);
    });

    it('skips bounded loops (size-limited tag)', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'safeBatch',
        properties: { has_loop: true },
        tags: ['size-limited'],
      });
      const tableId = nextId();
      const rels = [
        makeRel({ type: 'reads_from', source_id: fn.id, target_id: tableId }),
      ];

      const ctx = makeContext(
        { function: [fn] },
        (id, dir) => (id === fn.id && dir === 'out' ? rels : []),
      );

      const findings = await analyzer.analyze(ctx);

      const loopFindings = findings.filter((f) => f.title.includes('Unbounded loop'));
      expect(loopFindings).toHaveLength(0);
    });

    it('skips functions with loops but no data source', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'localLoop',
        properties: { has_loop: true },
      });

      const ctx = makeContext(
        { function: [fn] },
        () => [],
      );

      const findings = await analyzer.analyze(ctx);

      const loopFindings = findings.filter((f) => f.title.includes('Unbounded loop'));
      expect(loopFindings).toHaveLength(0);
    });
  });

  // ── Full run with no entities ──────────────────────────────────────

  it('produces no findings on an empty graph', async () => {
    const ctx = makeContext();
    const findings = await analyzer.analyze(ctx);
    expect(findings).toHaveLength(0);
  });

  // ── initialize and finalize ─────────────────────────────────────────

  it('initialize and finalize are no-ops', async () => {
    const ctx = makeContext();
    await expect(analyzer.initialize(ctx)).resolves.toBeUndefined();
    const finalized = await analyzer.finalize(ctx);
    expect(finalized).toEqual([]);
  });
});
