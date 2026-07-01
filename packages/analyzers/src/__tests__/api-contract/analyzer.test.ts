/**
 * Tests for APIContractAnalyzer.
 *
 * Covers all 7 rules: missing descriptions, missing error responses,
 * missing examples, inconsistent naming, missing pagination, missing
 * rate limiting, and breaking change risk.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APIContractAnalyzer } from '../../api-contract/analyzer.js';
import type { AnalysisContext, Entity, Relationship } from '@recurrsive/core';

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

describe('APIContractAnalyzer', () => {
  let analyzer: APIContractAnalyzer;

  beforeEach(() => {
    analyzer = new APIContractAnalyzer();
    _idCounter = 0;
  });

  // ── Metadata ─────────────────────────────────────────────────────────

  it('has correct metadata', () => {
    expect(analyzer.id).toBe('api-contract.quality');
    expect(analyzer.name).toBe('API Contract Analyzer');
    expect(analyzer.categories).toContain('documentation');
    expect(analyzer.categories).toContain('developer_experience');
    expect(analyzer.version).toBe('0.1.0');
  });

  it('has a description', () => {
    expect(analyzer.description).toBeTruthy();
    expect(analyzer.description.length).toBeGreaterThan(10);
  });

  // ── Rule 1: Missing API Descriptions ──────────────────────────────────

  describe('missing descriptions', () => {
    it('detects endpoints without description', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: { method: 'GET', path: '/api/users' },
      });
      const ctx = makeContext({ endpoint: [endpoint], api_contract: [] });

      const findings = await analyzer.analyze(ctx);

      const descFindings = findings.filter((f) => f.title.includes('Missing API description'));
      expect(descFindings).toHaveLength(1);
      expect(descFindings[0]!.severity).toBe('medium');
    });

    it('does not flag endpoints with description', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: { method: 'GET', path: '/api/users', description: 'List all users' },
      });
      const ctx = makeContext({ endpoint: [endpoint], api_contract: [] });

      const findings = await analyzer.analyze(ctx);

      const descFindings = findings.filter((f) => f.title.includes('Missing API description'));
      expect(descFindings).toHaveLength(0);
    });

    it('does not flag endpoints with summary', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: { method: 'GET', path: '/api/users', summary: 'Get users' },
      });
      const ctx = makeContext({ endpoint: [endpoint], api_contract: [] });

      const findings = await analyzer.analyze(ctx);

      const descFindings = findings.filter((f) => f.title.includes('Missing API description'));
      expect(descFindings).toHaveLength(0);
    });
  });

  // ── Rule 2: Missing Error Responses ────────────────────────────────────

  describe('missing error responses', () => {
    it('detects endpoints without error responses', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: { method: 'POST', path: '/api/users' },
      });
      const ctx = makeContext({ endpoint: [endpoint], api_contract: [] });

      const findings = await analyzer.analyze(ctx);

      const errorFindings = findings.filter((f) => f.title.includes('Missing error responses'));
      expect(errorFindings).toHaveLength(1);
      expect(errorFindings[0]!.severity).toBe('medium');
    });

    it('does not flag endpoints with error status codes in responses', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: {
          method: 'POST',
          path: '/api/users',
          responses: { '200': { description: 'OK' }, '400': { description: 'Bad Request' } },
        },
      });
      const ctx = makeContext({ endpoint: [endpoint], api_contract: [] });

      const findings = await analyzer.analyze(ctx);

      const errorFindings = findings.filter((f) => f.title.includes('Missing error responses'));
      expect(errorFindings).toHaveLength(0);
    });

    it('does not flag endpoints with error-responses tag', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: { method: 'GET', path: '/api/users' },
        tags: ['error-responses'],
      });
      const ctx = makeContext({ endpoint: [endpoint], api_contract: [] });

      const findings = await analyzer.analyze(ctx);

      const errorFindings = findings.filter((f) => f.title.includes('Missing error responses'));
      expect(errorFindings).toHaveLength(0);
    });
  });

  // ── Rule 3: Missing Examples ───────────────────────────────────────────

  describe('missing examples', () => {
    it('detects endpoints without examples', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: { method: 'GET', path: '/api/users' },
      });
      const ctx = makeContext({ endpoint: [endpoint], api_contract: [] });

      const findings = await analyzer.analyze(ctx);

      const exampleFindings = findings.filter((f) => f.title.includes('Missing examples'));
      expect(exampleFindings).toHaveLength(1);
      expect(exampleFindings[0]!.severity).toBe('low');
    });

    it('does not flag endpoints with has_examples property', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: { method: 'GET', path: '/api/users', has_examples: true },
      });
      const ctx = makeContext({ endpoint: [endpoint], api_contract: [] });

      const findings = await analyzer.analyze(ctx);

      const exampleFindings = findings.filter((f) => f.title.includes('Missing examples'));
      expect(exampleFindings).toHaveLength(0);
    });
  });

  // ── Rule 4: Inconsistent Naming ────────────────────────────────────────

  describe('inconsistent naming', () => {
    it('detects mixed camelCase and snake_case paths', async () => {
      const endpoints = [
        makeEntity({
          type: 'endpoint',
          name: '/api/user_profiles',
          properties: { method: 'GET', path: '/api/user_profiles' },
        }),
        makeEntity({
          type: 'endpoint',
          name: '/api/userSettings',
          properties: { method: 'GET', path: '/api/userSettings' },
        }),
        makeEntity({
          type: 'endpoint',
          name: '/api/orderItems',
          properties: { method: 'GET', path: '/api/orderItems' },
        }),
      ];
      const ctx = makeContext({ endpoint: endpoints, api_contract: [] });

      const findings = await analyzer.analyze(ctx);

      const namingFindings = findings.filter((f) => f.title.includes('Inconsistent API naming'));
      expect(namingFindings).toHaveLength(1);
      expect(namingFindings[0]!.severity).toBe('medium');
    });

    it('does not flag consistent snake_case paths', async () => {
      const endpoints = [
        makeEntity({
          type: 'endpoint',
          name: '/api/user_profiles',
          properties: { method: 'GET', path: '/api/user_profiles' },
        }),
        makeEntity({
          type: 'endpoint',
          name: '/api/order_items',
          properties: { method: 'GET', path: '/api/order_items' },
        }),
      ];
      const ctx = makeContext({ endpoint: endpoints, api_contract: [] });

      const findings = await analyzer.analyze(ctx);

      const namingFindings = findings.filter((f) => f.title.includes('Inconsistent API naming'));
      expect(namingFindings).toHaveLength(0);
    });

    it('does not flag with fewer than 2 endpoints', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/user_profiles',
        properties: { method: 'GET', path: '/api/user_profiles' },
      });
      const ctx = makeContext({ endpoint: [endpoint], api_contract: [] });

      const findings = await analyzer.analyze(ctx);

      const namingFindings = findings.filter((f) => f.title.includes('Inconsistent'));
      expect(namingFindings).toHaveLength(0);
    });
  });

  // ── Rule 5: Missing Pagination ─────────────────────────────────────────

  describe('missing pagination', () => {
    it('detects list endpoints without pagination', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: { method: 'GET', path: '/api/users', returns_list: true },
      });
      const ctx = makeContext({ endpoint: [endpoint], api_contract: [] });

      const findings = await analyzer.analyze(ctx);

      const pagFindings = findings.filter((f) => f.title.includes('Missing pagination'));
      expect(pagFindings).toHaveLength(1);
      expect(pagFindings[0]!.severity).toBe('medium');
    });

    it('does not flag paginated endpoints', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: { method: 'GET', path: '/api/users', returns_list: true, has_pagination: true },
      });
      const ctx = makeContext({ endpoint: [endpoint], api_contract: [] });

      const findings = await analyzer.analyze(ctx);

      const pagFindings = findings.filter((f) => f.title.includes('Missing pagination'));
      expect(pagFindings).toHaveLength(0);
    });

    it('detects via plural path heuristic', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/orders',
        properties: { method: 'GET', path: '/api/orders' },
      });
      const ctx = makeContext({ endpoint: [endpoint], api_contract: [] });

      const findings = await analyzer.analyze(ctx);

      const pagFindings = findings.filter((f) => f.title.includes('Missing pagination'));
      expect(pagFindings).toHaveLength(1);
    });
  });

  // ── Rule 6: Missing Rate Limiting ──────────────────────────────────────

  describe('missing rate limiting', () => {
    it('detects missing rate limiting when endpoints exist', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: { method: 'GET', path: '/api/users' },
      });
      const ctx = makeContext({ endpoint: [endpoint], api_contract: [] });

      const findings = await analyzer.analyze(ctx);

      const rlFindings = findings.filter((f) => f.title.includes('Missing rate limiting'));
      expect(rlFindings).toHaveLength(1);
      expect(rlFindings[0]!.severity).toBe('medium');
    });

    it('does not flag when API contract has rate limiting', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: { method: 'GET', path: '/api/users' },
      });
      const contract = makeEntity({
        type: 'api_contract',
        name: 'Main API',
        properties: { rate_limiting: { requests_per_minute: 60 } },
      });
      const ctx = makeContext({ endpoint: [endpoint], api_contract: [contract] });

      const findings = await analyzer.analyze(ctx);

      const rlFindings = findings.filter((f) => f.title.includes('Missing rate limiting'));
      expect(rlFindings).toHaveLength(0);
    });

    it('does not flag when endpoints are tagged rate-limited', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: { method: 'GET', path: '/api/users' },
        tags: ['rate-limited'],
      });
      const ctx = makeContext({ endpoint: [endpoint], api_contract: [] });

      const findings = await analyzer.analyze(ctx);

      const rlFindings = findings.filter((f) => f.title.includes('Missing rate limiting'));
      expect(rlFindings).toHaveLength(0);
    });
  });

  // ── Rule 7: Breaking Change Risk ───────────────────────────────────────

  describe('breaking change risk', () => {
    it('detects endpoints without versioning (>= 3 endpoints)', async () => {
      const endpoints = [
        makeEntity({ type: 'endpoint', name: '/api/users', properties: { method: 'GET', path: '/api/users' } }),
        makeEntity({ type: 'endpoint', name: '/api/orders', properties: { method: 'GET', path: '/api/orders' } }),
        makeEntity({ type: 'endpoint', name: '/api/products', properties: { method: 'GET', path: '/api/products' } }),
      ];
      const ctx = makeContext({ endpoint: endpoints, api_contract: [] });

      const findings = await analyzer.analyze(ctx);

      const versionFindings = findings.filter((f) => f.title.includes('Breaking change risk'));
      expect(versionFindings).toHaveLength(1);
      expect(versionFindings[0]!.severity).toBe('high');
    });

    it('does not flag versioned endpoints', async () => {
      const endpoints = [
        makeEntity({ type: 'endpoint', name: '/v1/users', properties: { method: 'GET', path: '/v1/users' } }),
        makeEntity({ type: 'endpoint', name: '/v1/orders', properties: { method: 'GET', path: '/v1/orders' } }),
        makeEntity({ type: 'endpoint', name: '/v1/products', properties: { method: 'GET', path: '/v1/products' } }),
      ];
      const ctx = makeContext({ endpoint: endpoints, api_contract: [] });

      const findings = await analyzer.analyze(ctx);

      const versionFindings = findings.filter((f) => f.title.includes('Breaking change risk'));
      expect(versionFindings).toHaveLength(0);
    });

    it('does not flag with fewer than 3 endpoints', async () => {
      const endpoints = [
        makeEntity({ type: 'endpoint', name: '/api/users', properties: { method: 'GET', path: '/api/users' } }),
      ];
      const ctx = makeContext({ endpoint: endpoints, api_contract: [] });

      const findings = await analyzer.analyze(ctx);

      const versionFindings = findings.filter((f) => f.title.includes('Breaking change risk'));
      expect(versionFindings).toHaveLength(0);
    });
  });

  // ── Full run with no entities ──────────────────────────────────────

  it('produces no findings on an empty graph', async () => {
    const ctx = makeContext();
    const findings = await analyzer.analyze(ctx);
    expect(findings).toHaveLength(0);
  });

  // ── initialize and finalize ─────────────────────────────────────────

  it('initialize resolves without error', async () => {
    const ctx = makeContext();
    await expect(analyzer.initialize(ctx)).resolves.toBeUndefined();
  });

  it('finalize returns empty array when no systemic issues', async () => {
    const ctx = makeContext();
    const finalized = await analyzer.finalize(ctx);
    expect(finalized).toEqual([]);
  });

  it('finalize detects majority undocumented endpoints', async () => {
    const endpoints: Entity[] = [];
    for (let i = 0; i < 6; i++) {
      endpoints.push(
        makeEntity({
          type: 'endpoint',
          name: `/api/resource-${i}`,
          properties: { method: 'GET', path: `/api/resource-${i}` },
        }),
      );
    }
    // Only 1 out of 6 is documented → ratio < 0.3
    endpoints[0]!.properties['description'] = 'A documented endpoint';

    const ctx = makeContext({ endpoint: endpoints });

    const finalized = await analyzer.finalize(ctx);

    expect(finalized).toHaveLength(1);
    expect(finalized[0]!.title).toContain('undocumented');
    expect(finalized[0]!.severity).toBe('high');
  });
});
