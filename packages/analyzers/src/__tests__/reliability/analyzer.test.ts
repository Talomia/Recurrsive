/**
 * Tests for ReliabilityAnalyzer.
 *
 * Covers all 7 rules: single point of failure, missing retries,
 * missing timeouts, no circuit breaker, missing health checks,
 * no graceful shutdown, and error swallowing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReliabilityAnalyzer } from '../../reliability/analyzer.js';
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

describe('ReliabilityAnalyzer', () => {
  let analyzer: ReliabilityAnalyzer;

  beforeEach(() => {
    analyzer = new ReliabilityAnalyzer();
    _idCounter = 0;
  });

  // ── Metadata ─────────────────────────────────────────────────────────

  it('has correct metadata', () => {
    expect(analyzer.id).toBe('reliability.resilience');
    expect(analyzer.name).toBe('Reliability Analyzer');
    expect(analyzer.categories).toContain('reliability');
  });

  // ── Rule 1: Single Point of Failure ────────────────────────────────

  describe('single point of failure', () => {
    it('detects infrastructure resource with many dependents and no redundancy', async () => {
      const db = makeEntity({
        type: 'infrastructure_resource',
        name: 'primary-db',
      });
      const svc1 = makeEntity({ type: 'function', name: 'svc1' });
      const svc2 = makeEntity({ type: 'function', name: 'svc2' });
      const svc3 = makeEntity({ type: 'function', name: 'svc3' });

      const inRels = [
        makeRel({ type: 'depends_on', source_id: svc1.id, target_id: db.id }),
        makeRel({ type: 'depends_on', source_id: svc2.id, target_id: db.id }),
        makeRel({ type: 'depends_on', source_id: svc3.id, target_id: db.id }),
      ];

      const ctx = makeContext(
        { infrastructure_resource: [db], deployment: [] },
        (id, dir) => (id === db.id && dir === 'in' ? inRels : []),
      );

      const findings = await analyzer.analyze(ctx);

      const spofFindings = findings.filter((f) => f.title.includes('Single point of failure'));
      expect(spofFindings).toHaveLength(1);
      expect(spofFindings[0]!.severity).toBe('critical');
      expect(spofFindings[0]!.title).toContain('primary-db');
    });

    it('detects deployment entities as SPOF', async () => {
      const deployment = makeEntity({
        type: 'deployment',
        name: 'cache-server',
      });
      const svc1 = makeEntity({ type: 'function', name: 'a' });
      const svc2 = makeEntity({ type: 'function', name: 'b' });
      const svc3 = makeEntity({ type: 'function', name: 'c' });

      const inRels = [
        makeRel({ type: 'routes_to', source_id: svc1.id, target_id: deployment.id }),
        makeRel({ type: 'routes_to', source_id: svc2.id, target_id: deployment.id }),
        makeRel({ type: 'reads_from', source_id: svc3.id, target_id: deployment.id }),
      ];

      const ctx = makeContext(
        { infrastructure_resource: [], deployment: [deployment] },
        (id, dir) => (id === deployment.id && dir === 'in' ? inRels : []),
      );

      const findings = await analyzer.analyze(ctx);

      const spofFindings = findings.filter((f) => f.title.includes('Single point of failure'));
      expect(spofFindings).toHaveLength(1);
    });

    it('skips resources with replicas > 1', async () => {
      const db = makeEntity({
        type: 'infrastructure_resource',
        name: 'replicated-db',
        properties: { replicas: 3 },
      });
      const svc1 = makeEntity({ type: 'function', name: 's1' });
      const svc2 = makeEntity({ type: 'function', name: 's2' });
      const svc3 = makeEntity({ type: 'function', name: 's3' });

      const inRels = [
        makeRel({ type: 'depends_on', source_id: svc1.id, target_id: db.id }),
        makeRel({ type: 'depends_on', source_id: svc2.id, target_id: db.id }),
        makeRel({ type: 'depends_on', source_id: svc3.id, target_id: db.id }),
      ];

      const ctx = makeContext(
        { infrastructure_resource: [db], deployment: [] },
        (id, dir) => (id === db.id && dir === 'in' ? inRels : []),
      );

      const findings = await analyzer.analyze(ctx);

      const spofFindings = findings.filter((f) => f.title.includes('Single point of failure'));
      expect(spofFindings).toHaveLength(0);
    });

    it('skips resources tagged as high-availability', async () => {
      const db = makeEntity({
        type: 'infrastructure_resource',
        name: 'ha-db',
        tags: ['high-availability'],
      });
      const svc1 = makeEntity({ type: 'function', name: 's1' });
      const svc2 = makeEntity({ type: 'function', name: 's2' });
      const svc3 = makeEntity({ type: 'function', name: 's3' });

      const inRels = [
        makeRel({ type: 'depends_on', source_id: svc1.id, target_id: db.id }),
        makeRel({ type: 'depends_on', source_id: svc2.id, target_id: db.id }),
        makeRel({ type: 'depends_on', source_id: svc3.id, target_id: db.id }),
      ];

      const ctx = makeContext(
        { infrastructure_resource: [db], deployment: [] },
        (id, dir) => (id === db.id && dir === 'in' ? inRels : []),
      );

      const findings = await analyzer.analyze(ctx);

      const spofFindings = findings.filter((f) => f.title.includes('Single point of failure'));
      expect(spofFindings).toHaveLength(0);
    });

    it('skips resources with fewer than 3 dependents', async () => {
      const db = makeEntity({
        type: 'infrastructure_resource',
        name: 'small-db',
      });
      const svc1 = makeEntity({ type: 'function', name: 's1' });
      const svc2 = makeEntity({ type: 'function', name: 's2' });

      const inRels = [
        makeRel({ type: 'depends_on', source_id: svc1.id, target_id: db.id }),
        makeRel({ type: 'depends_on', source_id: svc2.id, target_id: db.id }),
      ];

      const ctx = makeContext(
        { infrastructure_resource: [db], deployment: [] },
        (id, dir) => (id === db.id && dir === 'in' ? inRels : []),
      );

      const findings = await analyzer.analyze(ctx);

      const spofFindings = findings.filter((f) => f.title.includes('Single point of failure'));
      expect(spofFindings).toHaveLength(0);
    });
  });

  // ── Rule 2: Missing Retries ────────────────────────────────────────

  describe('missing retries', () => {
    it('detects functions calling external services without retry', async () => {
      const fn = makeEntity({ type: 'function', name: 'callAPI' });
      const modelId = nextId();

      const rels = [
        makeRel({ type: 'uses_model', source_id: fn.id, target_id: modelId }),
      ];

      const ctx = makeContext(
        { function: [fn] },
        (id, dir) => (id === fn.id && dir === 'out' ? rels : []),
      );

      const findings = await analyzer.analyze(ctx);

      const retryFindings = findings.filter((f) => f.title.includes('Missing retry logic'));
      expect(retryFindings).toHaveLength(1);
      expect(retryFindings[0]!.severity).toBe('medium');
      expect(retryFindings[0]!.title).toContain('callAPI');
    });

    it('skips functions with has_retry property', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'resilientCall',
        properties: { has_retry: true },
      });
      const modelId = nextId();

      const rels = [
        makeRel({ type: 'uses_model', source_id: fn.id, target_id: modelId }),
      ];

      const ctx = makeContext(
        { function: [fn] },
        (id, dir) => (id === fn.id && dir === 'out' ? rels : []),
      );

      const findings = await analyzer.analyze(ctx);

      const retryFindings = findings.filter((f) => f.title.includes('Missing retry logic'));
      expect(retryFindings).toHaveLength(0);
    });

    it('skips functions tagged with retry', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'retryableCall',
        tags: ['retry'],
      });
      const modelId = nextId();

      const rels = [
        makeRel({ type: 'uses_model', source_id: fn.id, target_id: modelId }),
      ];

      const ctx = makeContext(
        { function: [fn] },
        (id, dir) => (id === fn.id && dir === 'out' ? rels : []),
      );

      const findings = await analyzer.analyze(ctx);

      const retryFindings = findings.filter((f) => f.title.includes('Missing retry logic'));
      expect(retryFindings).toHaveLength(0);
    });

    it('skips functions without external calls', async () => {
      const fn = makeEntity({ type: 'function', name: 'pureFunction' });

      const rels = [
        makeRel({ type: 'calls', source_id: fn.id, target_id: nextId() }),
      ];

      const ctx = makeContext(
        { function: [fn] },
        (id, dir) => (id === fn.id && dir === 'out' ? rels : []),
      );

      const findings = await analyzer.analyze(ctx);

      const retryFindings = findings.filter((f) => f.title.includes('Missing retry logic'));
      expect(retryFindings).toHaveLength(0);
    });
  });

  // ── Rule 3: Missing Timeouts ───────────────────────────────────────

  describe('missing timeouts', () => {
    it('detects network calls without timeout', async () => {
      const fn = makeEntity({ type: 'function', name: 'fetchData' });
      const serviceId = nextId();

      const rels = [
        makeRel({ type: 'routes_to', source_id: fn.id, target_id: serviceId }),
      ];

      const ctx = makeContext(
        { function: [fn] },
        (id, dir) => (id === fn.id && dir === 'out' ? rels : []),
      );

      const findings = await analyzer.analyze(ctx);

      const timeoutFindings = findings.filter((f) => f.title.includes('Missing timeout'));
      expect(timeoutFindings).toHaveLength(1);
      expect(timeoutFindings[0]!.severity).toBe('high');
      expect(timeoutFindings[0]!.title).toContain('fetchData');
    });

    it('skips functions with has_timeout property', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'safeFetch',
        properties: { has_timeout: true },
      });
      const serviceId = nextId();

      const rels = [
        makeRel({ type: 'routes_to', source_id: fn.id, target_id: serviceId }),
      ];

      const ctx = makeContext(
        { function: [fn] },
        (id, dir) => (id === fn.id && dir === 'out' ? rels : []),
      );

      const findings = await analyzer.analyze(ctx);

      const timeoutFindings = findings.filter((f) => f.title.includes('Missing timeout'));
      expect(timeoutFindings).toHaveLength(0);
    });

    it('skips functions tagged with timeout', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'timedCall',
        tags: ['timeout'],
      });
      const serviceId = nextId();

      const rels = [
        makeRel({ type: 'routes_to', source_id: fn.id, target_id: serviceId }),
      ];

      const ctx = makeContext(
        { function: [fn] },
        (id, dir) => (id === fn.id && dir === 'out' ? rels : []),
      );

      const findings = await analyzer.analyze(ctx);

      const timeoutFindings = findings.filter((f) => f.title.includes('Missing timeout'));
      expect(timeoutFindings).toHaveLength(0);
    });

    it('skips functions without network calls', async () => {
      const fn = makeEntity({ type: 'function', name: 'localCalc' });

      const ctx = makeContext(
        { function: [fn] },
        () => [],
      );

      const findings = await analyzer.analyze(ctx);

      const timeoutFindings = findings.filter((f) => f.title.includes('Missing timeout'));
      expect(timeoutFindings).toHaveLength(0);
    });
  });

  // ── Rule 4: No Circuit Breaker ─────────────────────────────────────

  describe('no circuit breaker', () => {
    it('detects multiple external callers without circuit breaker', async () => {
      const fn1 = makeEntity({ type: 'function', name: 'callExternal1' });
      const fn2 = makeEntity({ type: 'function', name: 'callExternal2' });
      const modelId = nextId();
      const serviceId = nextId();

      const relsFn: GetRelsFn = (id, dir) => {
        if (dir === 'out') {
          if (id === fn1.id) {
            return [makeRel({ type: 'uses_model', source_id: fn1.id, target_id: modelId })];
          }
          if (id === fn2.id) {
            return [makeRel({ type: 'routes_to', source_id: fn2.id, target_id: serviceId })];
          }
        }
        return [];
      };

      const ctx = makeContext({ function: [fn1, fn2] }, relsFn);

      const findings = await analyzer.analyze(ctx);

      const cbFindings = findings.filter((f) => f.title.includes('No circuit breaker'));
      expect(cbFindings).toHaveLength(1);
      expect(cbFindings[0]!.severity).toBe('medium');
    });

    it('skips when circuit breaker tag is present on any caller', async () => {
      const fn1 = makeEntity({
        type: 'function',
        name: 'protectedCall',
        tags: ['circuit-breaker'],
      });
      const fn2 = makeEntity({ type: 'function', name: 'otherCall' });
      const modelId = nextId();
      const serviceId = nextId();

      const relsFn: GetRelsFn = (id, dir) => {
        if (dir === 'out') {
          if (id === fn1.id) {
            return [makeRel({ type: 'uses_model', source_id: fn1.id, target_id: modelId })];
          }
          if (id === fn2.id) {
            return [makeRel({ type: 'routes_to', source_id: fn2.id, target_id: serviceId })];
          }
        }
        return [];
      };

      const ctx = makeContext({ function: [fn1, fn2] }, relsFn);

      const findings = await analyzer.analyze(ctx);

      const cbFindings = findings.filter((f) => f.title.includes('No circuit breaker'));
      expect(cbFindings).toHaveLength(0);
    });

    it('skips when fewer than 2 external callers', async () => {
      const fn1 = makeEntity({ type: 'function', name: 'singleCaller' });
      const modelId = nextId();

      const relsFn: GetRelsFn = (id, dir) => {
        if (dir === 'out' && id === fn1.id) {
          return [makeRel({ type: 'uses_model', source_id: fn1.id, target_id: modelId })];
        }
        return [];
      };

      const ctx = makeContext({ function: [fn1] }, relsFn);

      const findings = await analyzer.analyze(ctx);

      const cbFindings = findings.filter((f) => f.title.includes('No circuit breaker'));
      expect(cbFindings).toHaveLength(0);
    });
  });

  // ── Rule 5: Missing Health Checks ──────────────────────────────────

  describe('missing health checks', () => {
    it('detects service with >2 endpoints but no health check', async () => {
      const endpoints = [
        makeEntity({ type: 'endpoint', name: '/api/users', properties: { path: '/api/users' } }),
        makeEntity({ type: 'endpoint', name: '/api/orders', properties: { path: '/api/orders' } }),
        makeEntity({ type: 'endpoint', name: '/api/products', properties: { path: '/api/products' } }),
      ];

      const ctx = makeContext({ endpoint: endpoints, deployment: [] });

      const findings = await analyzer.analyze(ctx);

      const healthFindings = findings.filter((f) => f.title.includes('Missing health check endpoint'));
      expect(healthFindings).toHaveLength(1);
      expect(healthFindings[0]!.severity).toBe('medium');
    });

    it('skips when health endpoint exists', async () => {
      const endpoints = [
        makeEntity({ type: 'endpoint', name: '/api/users', properties: { path: '/api/users' } }),
        makeEntity({ type: 'endpoint', name: '/api/orders', properties: { path: '/api/orders' } }),
        makeEntity({ type: 'endpoint', name: '/health', properties: { path: '/health' } }),
      ];

      const ctx = makeContext({ endpoint: endpoints, deployment: [] });

      const findings = await analyzer.analyze(ctx);

      const healthFindings = findings.filter((f) => f.title.includes('Missing health check endpoint'));
      expect(healthFindings).toHaveLength(0);
    });

    it('skips when endpoint is tagged health-check', async () => {
      const endpoints = [
        makeEntity({ type: 'endpoint', name: '/api/users', properties: { path: '/api/users' } }),
        makeEntity({ type: 'endpoint', name: '/api/orders', properties: { path: '/api/orders' } }),
        makeEntity({ type: 'endpoint', name: '/status', tags: ['health-check'] }),
      ];

      const ctx = makeContext({ endpoint: endpoints, deployment: [] });

      const findings = await analyzer.analyze(ctx);

      const healthFindings = findings.filter((f) => f.title.includes('Missing health check endpoint'));
      expect(healthFindings).toHaveLength(0);
    });

    it('detects deployment without health check probes', async () => {
      const deployment = makeEntity({
        type: 'deployment',
        name: 'api-service',
      });

      const ctx = makeContext({ endpoint: [], deployment: [deployment] });

      const findings = await analyzer.analyze(ctx);

      const healthFindings = findings.filter((f) => f.title.includes('Deployment without health check'));
      expect(healthFindings).toHaveLength(1);
      expect(healthFindings[0]!.severity).toBe('high');
      expect(healthFindings[0]!.title).toContain('api-service');
    });

    it('skips deployment with liveness_probe configured', async () => {
      const deployment = makeEntity({
        type: 'deployment',
        name: 'healthy-service',
        properties: { liveness_probe: { path: '/health', port: 8080 } },
      });

      const ctx = makeContext({ endpoint: [], deployment: [deployment] });

      const findings = await analyzer.analyze(ctx);

      const healthFindings = findings.filter((f) => f.title.includes('Deployment without health check'));
      expect(healthFindings).toHaveLength(0);
    });

    it('skips deployment tagged health-configured', async () => {
      const deployment = makeEntity({
        type: 'deployment',
        name: 'configured-service',
        tags: ['health-configured'],
      });

      const ctx = makeContext({ endpoint: [], deployment: [deployment] });

      const findings = await analyzer.analyze(ctx);

      const healthFindings = findings.filter((f) => f.title.includes('Deployment without health check'));
      expect(healthFindings).toHaveLength(0);
    });
  });

  // ── Rule 6: No Graceful Shutdown ───────────────────────────────────

  describe('no graceful shutdown', () => {
    it('detects service without shutdown handler', async () => {
      const endpoints = [
        makeEntity({ type: 'endpoint', name: '/api/data' }),
      ];
      const functions = [
        makeEntity({ type: 'function', name: 'handleRequest' }),
      ];

      const ctx = makeContext({ endpoint: endpoints, function: functions });

      const findings = await analyzer.analyze(ctx);

      const shutdownFindings = findings.filter((f) => f.title.includes('No graceful shutdown'));
      expect(shutdownFindings).toHaveLength(1);
      expect(shutdownFindings[0]!.severity).toBe('medium');
    });

    it('skips when shutdown handler function exists', async () => {
      const endpoints = [
        makeEntity({ type: 'endpoint', name: '/api/data' }),
      ];
      const functions = [
        makeEntity({ type: 'function', name: 'handleRequest' }),
        makeEntity({ type: 'function', name: 'gracefulShutdown' }),
      ];

      const ctx = makeContext({ endpoint: endpoints, function: functions });

      const findings = await analyzer.analyze(ctx);

      const shutdownFindings = findings.filter((f) => f.title.includes('No graceful shutdown'));
      expect(shutdownFindings).toHaveLength(0);
    });

    it('skips when function tagged as shutdown-handler', async () => {
      const endpoints = [
        makeEntity({ type: 'endpoint', name: '/api/data' }),
      ];
      const functions = [
        makeEntity({ type: 'function', name: 'onExit', tags: ['shutdown-handler'] }),
      ];

      const ctx = makeContext({ endpoint: endpoints, function: functions });

      const findings = await analyzer.analyze(ctx);

      const shutdownFindings = findings.filter((f) => f.title.includes('No graceful shutdown'));
      expect(shutdownFindings).toHaveLength(0);
    });

    it('skips when function name contains sigterm', async () => {
      const endpoints = [
        makeEntity({ type: 'endpoint', name: '/api/data' }),
      ];
      const functions = [
        makeEntity({ type: 'function', name: 'handleSigterm' }),
      ];

      const ctx = makeContext({ endpoint: endpoints, function: functions });

      const findings = await analyzer.analyze(ctx);

      const shutdownFindings = findings.filter((f) => f.title.includes('No graceful shutdown'));
      expect(shutdownFindings).toHaveLength(0);
    });

    it('skips when no endpoints exist (not a service)', async () => {
      const functions = [
        makeEntity({ type: 'function', name: 'utilFunc' }),
      ];

      const ctx = makeContext({ endpoint: [], function: functions });

      const findings = await analyzer.analyze(ctx);

      const shutdownFindings = findings.filter((f) => f.title.includes('No graceful shutdown'));
      expect(shutdownFindings).toHaveLength(0);
    });
  });

  // ── Rule 7: Error Swallowing ───────────────────────────────────────

  describe('error swallowing', () => {
    it('detects functions with has_empty_catch property', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'riskyHandler',
        properties: { has_empty_catch: true },
      });
      const ctx = makeContext({ function: [fn] });

      const findings = await analyzer.analyze(ctx);

      const errFindings = findings.filter((f) => f.title.includes('Error swallowing'));
      expect(errFindings).toHaveLength(1);
      expect(errFindings[0]!.severity).toBe('high');
      expect(errFindings[0]!.title).toContain('riskyHandler');
    });

    it('detects functions with swallows_errors property', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'silentFailer',
        properties: { swallows_errors: true },
      });
      const ctx = makeContext({ function: [fn] });

      const findings = await analyzer.analyze(ctx);

      const errFindings = findings.filter((f) => f.title.includes('Error swallowing'));
      expect(errFindings).toHaveLength(1);
    });

    it('detects functions tagged empty-catch', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'badCatch',
        tags: ['empty-catch'],
      });
      const ctx = makeContext({ function: [fn] });

      const findings = await analyzer.analyze(ctx);

      const errFindings = findings.filter((f) => f.title.includes('Error swallowing'));
      expect(errFindings).toHaveLength(1);
    });

    it('detects functions tagged error-swallowed', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'ignoredError',
        tags: ['error-swallowed'],
      });
      const ctx = makeContext({ function: [fn] });

      const findings = await analyzer.analyze(ctx);

      const errFindings = findings.filter((f) => f.title.includes('Error swallowing'));
      expect(errFindings).toHaveLength(1);
    });

    it('produces no finding for functions with proper error handling', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'goodHandler',
      });
      const ctx = makeContext({ function: [fn] });

      const findings = await analyzer.analyze(ctx);

      const errFindings = findings.filter((f) => f.title.includes('Error swallowing'));
      expect(errFindings).toHaveLength(0);
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
