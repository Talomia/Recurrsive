/**
 * Tests for APIContractAnalyzer.
 *
 * Covers the 4 rules that evaluate produced endpoint data: inconsistent
 * naming, missing pagination, missing rate limiting, and breaking change risk.
 * Also asserts that the removed rules (missing descriptions, missing error
 * responses, missing examples) no longer fire — parsers never emit
 * description/summary/responses/status_codes/examples on endpoints.
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

  // ── Removed rules: descriptions / error responses / examples ──────
  // Code extractors emit only http_method, path, and framework on endpoints —
  // never description/summary/responses/status_codes/examples. These rules
  // fired on every endpoint and could never be satisfied, so they were removed.

  describe('missing descriptions / error responses / examples (removed)', () => {
    it('does not emit documentation-gap findings on a bare parsed endpoint', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: 'GET /api/users',
        properties: { http_method: 'GET', path: '/api/users', framework: 'express' },
      });
      const ctx = makeContext({ endpoint: [endpoint], api_contract: [] });

      const findings = await analyzer.analyze(ctx);

      expect(findings.filter((f) => f.title.includes('Missing API description'))).toHaveLength(0);
      expect(findings.filter((f) => f.title.includes('Missing error responses'))).toHaveLength(0);
      expect(findings.filter((f) => f.title.includes('Missing examples'))).toHaveLength(0);
    });
  });

  // ── Rule 1: Inconsistent Naming ────────────────────────────────────────

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

  // ── Rule 2: Missing Pagination ─────────────────────────────────────────

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

    it('resolves the method from http_method (the property parsers emit)', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: 'GET /api/orders',
        properties: { http_method: 'GET', path: '/api/orders', framework: 'express' },
      });
      const ctx = makeContext({ endpoint: [endpoint], api_contract: [] });

      const findings = await analyzer.analyze(ctx);

      const pagFindings = findings.filter((f) => f.title.includes('Missing pagination'));
      expect(pagFindings).toHaveLength(1);
      // Title must carry the resolved uppercase method, not an empty string.
      expect(pagFindings[0]!.title).toContain('GET /api/orders');
    });

    it('recognizes pagination parameters given as a string array', async () => {
      // Some producers emit `parameters` as string[] rather than
      // [{ name }] objects — both shapes must suppress the finding.
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: { method: 'GET', path: '/api/users', parameters: ['page', 'limit'] },
      });
      const ctx = makeContext({ endpoint: [endpoint], api_contract: [] });

      const findings = await analyzer.analyze(ctx);

      const pagFindings = findings.filter((f) => f.title.includes('Missing pagination'));
      expect(pagFindings).toHaveLength(0);
    });

    it('recognizes pagination parameters given as objects (incl. pageSize casing)', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: {
          method: 'GET',
          path: '/api/users',
          parameters: [{ name: 'pageSize' }],
        },
      });
      const ctx = makeContext({ endpoint: [endpoint], api_contract: [] });

      const findings = await analyzer.analyze(ctx);

      const pagFindings = findings.filter((f) => f.title.includes('Missing pagination'));
      expect(pagFindings).toHaveLength(0);
    });

    it('does not flag mutation (POST) endpoints even on a plural path', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: 'POST /api/orders',
        properties: { http_method: 'POST', path: '/api/orders', framework: 'express' },
      });
      const ctx = makeContext({ endpoint: [endpoint], api_contract: [] });

      const findings = await analyzer.analyze(ctx);

      const pagFindings = findings.filter((f) => f.title.includes('Missing pagination'));
      expect(pagFindings).toHaveLength(0);
    });
  });

  // ── Rule 3: Missing Rate Limiting ──────────────────────────────────────

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

  // ── Rule 4: Breaking Change Risk ───────────────────────────────────────

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

  it('finalize does not emit an undocumented-ratio finding (rule removed)', async () => {
    // Endpoints never carry a `description` property, so the old ratio was
    // always 0% and the finding always fired. The systemic check was removed.
    const endpoints: Entity[] = [];
    for (let i = 0; i < 6; i++) {
      endpoints.push(
        makeEntity({
          type: 'endpoint',
          name: `GET /api/resource-${i}`,
          properties: { http_method: 'GET', path: `/api/resource-${i}` },
        }),
      );
    }

    const ctx = makeContext({ endpoint: endpoints });

    const finalized = await analyzer.finalize(ctx);

    expect(finalized.filter((f) => f.title.includes('undocumented'))).toHaveLength(0);
    expect(finalized).toEqual([]);
  });
});
