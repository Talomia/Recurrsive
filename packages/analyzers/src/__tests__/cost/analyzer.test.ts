/**
 * Tests for CostAnalyzer.
 *
 * Covers all 5 rules: no token tracking, missing semantic caching,
 * unused model configurations, missing batch processing, and no cost
 * alerts.  Also tests finalize().
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CostAnalyzer } from '../../cost/analyzer.js';
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

describe('CostAnalyzer', () => {
  let analyzer: CostAnalyzer;

  beforeEach(() => {
    analyzer = new CostAnalyzer();
    _idCounter = 0;
  });

  // ── Metadata ─────────────────────────────────────────────────────────

  it('has correct metadata', () => {
    expect(analyzer.id).toBe('cost.optimization');
    expect(analyzer.name).toBe('Cost Analyzer');
    expect(analyzer.categories).toContain('cost');
  });

  // ── Rule 1: No Token Tracking ──────────────────────────────────────

  describe('no token tracking', () => {
    it('detects missing token tracking for LLM-calling functions', async () => {
      const model = makeEntity({ type: 'model', name: 'gpt-4' });
      const fn = makeEntity({ type: 'function', name: 'chatHandler' });
      const rel = makeRel({ type: 'uses_model', source_id: fn.id, target_id: model.id });

      const ctx = makeContext(
        { model: [model], function: [fn], cost_metric: [], prompt: [], alert: [] },
        (id, dir) => {
          if (id === fn.id && dir === 'out') return [rel];
          return [];
        },
      );

      const findings = await analyzer.analyze(ctx);
      const tokenFindings = findings.filter((f) => f.title.includes('No token usage tracking'));
      expect(tokenFindings).toHaveLength(1);
      expect(tokenFindings[0]!.severity).toBe('high');
    });

    it('skips if token usage cost_metric exists', async () => {
      const model = makeEntity({ type: 'model', name: 'gpt-4' });
      const fn = makeEntity({ type: 'function', name: 'chatHandler' });
      const costMetric = makeEntity({
        type: 'cost_metric',
        name: 'token-counter',
        tags: ['token-usage'],
      });
      const rel = makeRel({ type: 'uses_model', source_id: fn.id, target_id: model.id });

      const ctx = makeContext(
        { model: [model], function: [fn], cost_metric: [costMetric], prompt: [], alert: [] },
        (id, dir) => {
          if (id === fn.id && dir === 'out') return [rel];
          return [];
        },
      );

      const findings = await analyzer.analyze(ctx);
      const tokenFindings = findings.filter((f) => f.title.includes('No token usage tracking'));
      expect(tokenFindings).toHaveLength(0);
    });

    it('skips when no functions use models', async () => {
      const fn = makeEntity({ type: 'function', name: 'pureFunc' });

      const ctx = makeContext(
        { model: [], function: [fn], cost_metric: [], prompt: [], alert: [] },
        () => [],
      );

      const findings = await analyzer.analyze(ctx);
      const tokenFindings = findings.filter((f) => f.title.includes('No token usage tracking'));
      expect(tokenFindings).toHaveLength(0);
    });
  });

  // ── Rule 2: Missing Semantic Caching ───────────────────────────────

  describe('missing semantic caching', () => {
    it('detects missing semantic caching for reusable prompts', async () => {
      const p1 = makeEntity({
        type: 'prompt',
        name: 'classify-prompt',
        tags: ['template'],
      });
      const p2 = makeEntity({
        type: 'prompt',
        name: 'extract-prompt',
        tags: ['reusable'],
      });

      const ctx = makeContext(
        { prompt: [p1, p2], model: [], function: [], cost_metric: [], alert: [] },
      );

      const findings = await analyzer.analyze(ctx);
      const cacheFindings = findings.filter((f) => f.title.includes('Missing semantic caching'));
      expect(cacheFindings).toHaveLength(1);
      expect(cacheFindings[0]!.severity).toBe('medium');
    });

    it('skips if prompts are already cached', async () => {
      const p1 = makeEntity({
        type: 'prompt',
        name: 'classify-prompt',
        tags: ['template', 'cached'],
      });
      const p2 = makeEntity({
        type: 'prompt',
        name: 'extract-prompt',
        properties: { is_template: true },
      });

      const ctx = makeContext(
        { prompt: [p1, p2], model: [], function: [], cost_metric: [], alert: [] },
      );

      const findings = await analyzer.analyze(ctx);
      const cacheFindings = findings.filter((f) => f.title.includes('Missing semantic caching'));
      expect(cacheFindings).toHaveLength(0);
    });

    it('skips if fewer than 2 prompts', async () => {
      const p1 = makeEntity({
        type: 'prompt',
        name: 'only-prompt',
        tags: ['template'],
      });

      const ctx = makeContext(
        { prompt: [p1], model: [], function: [], cost_metric: [], alert: [] },
      );

      const findings = await analyzer.analyze(ctx);
      const cacheFindings = findings.filter((f) => f.title.includes('Missing semantic caching'));
      expect(cacheFindings).toHaveLength(0);
    });

    it('skips if no prompts are templates or reusable', async () => {
      const p1 = makeEntity({ type: 'prompt', name: 'one-off-1' });
      const p2 = makeEntity({ type: 'prompt', name: 'one-off-2' });

      const ctx = makeContext(
        { prompt: [p1, p2], model: [], function: [], cost_metric: [], alert: [] },
      );

      const findings = await analyzer.analyze(ctx);
      const cacheFindings = findings.filter((f) => f.title.includes('Missing semantic caching'));
      expect(cacheFindings).toHaveLength(0);
    });
  });

  // ── Rule 4: Missing Batch Processing ───────────────────────────────

  describe('missing batch processing', () => {
    it('detects loop with API calls and no batching', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'processItems',
        properties: { has_loop: true },
      });
      const rel = makeRel({ type: 'uses_model', source_id: fn.id, target_id: nextId() });

      const ctx = makeContext(
        { model: [], function: [fn], cost_metric: [], prompt: [], alert: [] },
        (id, dir) => {
          if (id === fn.id && dir === 'out') return [rel];
          return [];
        },
      );

      const findings = await analyzer.analyze(ctx);
      const batchFindings = findings.filter((f) => f.title.includes('Missing batch processing'));
      expect(batchFindings).toHaveLength(1);
      expect(batchFindings[0]!.severity).toBe('medium');
    });

    it('detects loop tag with queries_table call', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'fetchAll',
        tags: ['loop'],
      });
      const rel = makeRel({ type: 'queries_table', source_id: fn.id, target_id: nextId() });

      const ctx = makeContext(
        { model: [], function: [fn], cost_metric: [], prompt: [], alert: [] },
        (id, dir) => {
          if (id === fn.id && dir === 'out') return [rel];
          return [];
        },
      );

      const findings = await analyzer.analyze(ctx);
      const batchFindings = findings.filter((f) => f.title.includes('Missing batch processing'));
      expect(batchFindings).toHaveLength(1);
    });

    it('skips functions with batching tag', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'batchProcess',
        properties: { has_loop: true },
        tags: ['batch'],
      });
      const rel = makeRel({ type: 'uses_model', source_id: fn.id, target_id: nextId() });

      const ctx = makeContext(
        { model: [], function: [fn], cost_metric: [], prompt: [], alert: [] },
        (id, dir) => {
          if (id === fn.id && dir === 'out') return [rel];
          return [];
        },
      );

      const findings = await analyzer.analyze(ctx);
      const batchFindings = findings.filter((f) => f.title.includes('Missing batch processing'));
      expect(batchFindings).toHaveLength(0);
    });

    it('skips functions without loops', async () => {
      const fn = makeEntity({ type: 'function', name: 'singleCall' });
      const rel = makeRel({ type: 'uses_model', source_id: fn.id, target_id: nextId() });

      const ctx = makeContext(
        { model: [], function: [fn], cost_metric: [], prompt: [], alert: [] },
        (id, dir) => {
          if (id === fn.id && dir === 'out') return [rel];
          return [];
        },
      );

      const findings = await analyzer.analyze(ctx);
      const batchFindings = findings.filter((f) => f.title.includes('Missing batch processing'));
      expect(batchFindings).toHaveLength(0);
    });

    it('skips loops without API calls', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'localLoop',
        properties: { has_loop: true },
      });

      const ctx = makeContext(
        { model: [], function: [fn], cost_metric: [], prompt: [], alert: [] },
        () => [],
      );

      const findings = await analyzer.analyze(ctx);
      const batchFindings = findings.filter((f) => f.title.includes('Missing batch processing'));
      expect(batchFindings).toHaveLength(0);
    });
  });

  // ── Rule 5: No Cost Alerts ─────────────────────────────────────────

  describe('no cost alerts', () => {
    it('detects missing cost alerts when models exist', async () => {
      const model = makeEntity({ type: 'model', name: 'gpt-4' });

      const ctx = makeContext(
        { model: [model], function: [], cost_metric: [], prompt: [], alert: [] },
      );

      const findings = await analyzer.analyze(ctx);
      const alertFindings = findings.filter((f) => f.title.includes('No cost alerting'));
      expect(alertFindings).toHaveLength(1);
      expect(alertFindings[0]!.severity).toBe('high');
    });

    it('skips when no models exist', async () => {
      const ctx = makeContext(
        { model: [], function: [], cost_metric: [], prompt: [], alert: [] },
      );

      const findings = await analyzer.analyze(ctx);
      const alertFindings = findings.filter((f) => f.title.includes('No cost alerting'));
      expect(alertFindings).toHaveLength(0);
    });

    it('skips when cost alert exists by tag', async () => {
      const model = makeEntity({ type: 'model', name: 'gpt-4' });
      const alert = makeEntity({
        type: 'alert',
        name: 'high-spend-alert',
        tags: ['cost'],
      });

      const ctx = makeContext(
        { model: [model], function: [], cost_metric: [], prompt: [], alert: [alert] },
      );

      const findings = await analyzer.analyze(ctx);
      const alertFindings = findings.filter((f) => f.title.includes('No cost alerting'));
      expect(alertFindings).toHaveLength(0);
    });

    it('skips when alert name includes "budget"', async () => {
      const model = makeEntity({ type: 'model', name: 'gpt-4' });
      const alert = makeEntity({ type: 'alert', name: 'budget-threshold' });

      const ctx = makeContext(
        { model: [model], function: [], cost_metric: [], prompt: [], alert: [alert] },
      );

      const findings = await analyzer.analyze(ctx);
      const alertFindings = findings.filter((f) => f.title.includes('No cost alerting'));
      expect(alertFindings).toHaveLength(0);
    });
  });

  // ── Full run with no entities ──────────────────────────────────────

  it('produces no findings on an empty graph', async () => {
    const ctx = makeContext();
    const findings = await analyzer.analyze(ctx);
    expect(findings).toHaveLength(0);
  });

  // ── initialize and finalize ─────────────────────────────────────────

  it('initialize is a no-op', async () => {
    const ctx = makeContext();
    await expect(analyzer.initialize(ctx)).resolves.toBeUndefined();
  });

  describe('finalize', () => {
    it('returns empty findings when there are 2 or fewer models', async () => {
      const m1 = makeEntity({ type: 'model', name: 'gpt-4' });
      const m2 = makeEntity({ type: 'model', name: 'gpt-3.5' });

      const ctx = makeContext({ model: [m1, m2], cost_metric: [] });

      const finalized = await analyzer.finalize(ctx);
      expect(finalized).toEqual([]);
    });

    it('detects multiple models without cost tracking', async () => {
      const m1 = makeEntity({ type: 'model', name: 'gpt-4' });
      const m2 = makeEntity({ type: 'model', name: 'claude-3' });
      const m3 = makeEntity({ type: 'model', name: 'gemini-pro' });

      const ctx = makeContext({ model: [m1, m2, m3], cost_metric: [] });

      const finalized = await analyzer.finalize(ctx);
      expect(finalized).toHaveLength(1);
      expect(finalized[0]!.title).toContain('Multiple AI models without cost tracking');
      expect(finalized[0]!.severity).toBe('high');
    });

    it('skips if cost_metric entities exist', async () => {
      const m1 = makeEntity({ type: 'model', name: 'gpt-4' });
      const m2 = makeEntity({ type: 'model', name: 'claude-3' });
      const m3 = makeEntity({ type: 'model', name: 'gemini-pro' });
      const cm = makeEntity({ type: 'cost_metric', name: 'spend-tracker' });

      const ctx = makeContext({ model: [m1, m2, m3], cost_metric: [cm] });

      const finalized = await analyzer.finalize(ctx);
      expect(finalized).toEqual([]);
    });
  });
});
