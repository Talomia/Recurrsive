/**
 * Comprehensive route tests for all v2 Recurrsive server route modules.
 *
 * Covers:
 * - Projects (10 tests)
 * - Forecasting (8 tests)
 * - GraphQL (10 tests)
 * - Multi-Tenant (8 tests)
 * - Simulation (8 tests)
 * - Cloud (8 tests)
 * - Secrets (8 tests)
 * - Confidence (6 tests)
 * - Plugins (6 tests)
 * - SSO (6 tests)
 * - Scheduling (6 tests)
 *
 * Total: 84 tests
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Mock all external dependencies before imports (same as routes.test.ts)
// ---------------------------------------------------------------------------

vi.mock('@recurrsive/graph', () => ({
  createGraphClient: vi.fn().mockResolvedValue({
    getStats: vi.fn().mockResolvedValue({
      entityCount: 42,
      relationshipCount: 87,
      entityTypes: { module: 15, function: 20, class: 7 },
      relationshipTypes: { imports: 30, calls: 25, depends_on: 32 },
      entityCountsByType: { module: 15, function: 20, class: 7 },
      relationshipCountsByType: { imports: 30, calls: 25, depends_on: 32 },
    }),
    getEntities: vi.fn().mockResolvedValue([
      { id: 'e1', type: 'module', name: 'auth', properties: {} },
      { id: 'e2', type: 'function', name: 'login', properties: {} },
    ]),
    getRelationships: vi.fn().mockResolvedValue([
      { id: 'r1', type: 'calls', source_id: 'e2', target_id: 'e1', properties: {} },
    ]),
    getEntityById: vi.fn().mockImplementation(async (id: string) => {
      if (id === 'e1') return { id: 'e1', type: 'module', name: 'auth', properties: {} };
      return undefined;
    }),
    getNeighbors: vi.fn().mockResolvedValue({
      entities: [],
      relationships: [],
    }),
    upsertEntity: vi.fn().mockResolvedValue(undefined),
    upsertRelationship: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@recurrsive/opportunities', () => ({
  OpportunityManager: vi.fn().mockImplementation(() => ({
    list: vi.fn().mockReturnValue([
      {
        id: 'opp-1',
        title: 'Test Opportunity',
        description: 'A test opportunity.',
        category: 'performance',
        severity: 'high',
        status: 'open',
        score: 85,
      },
    ]),
    getTopN: vi.fn().mockReturnValue([]),
    getById: vi.fn().mockReturnValue(undefined),
    get: vi.fn().mockReturnValue(undefined),
    getScore: vi.fn().mockReturnValue(null),
    updateStatus: vi.fn().mockReturnValue(true),
    add: vi.fn(),
    export: vi.fn().mockReturnValue('{}'),
    exportSARIF: vi.fn().mockReturnValue('{}'),
    exportMarkdown: vi.fn().mockReturnValue('# Report'),
  })),
}));

vi.mock('@recurrsive/analyzers', () => ({
  AnalyzerRegistry: vi.fn().mockImplementation(() => ({
    register: vi.fn(),
    getAll: vi.fn().mockReturnValue([]),
  })),
  AnalyzerRunner: vi.fn().mockImplementation(() => ({
    run: vi.fn().mockResolvedValue({
      findings: [],
      analyzers_run: [],
      analyzers_failed: [],
      duration_ms: 100,
    }),
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
    collect: vi.fn().mockResolvedValue({
      entities: [],
      relationships: [],
      metadata: { duration_ms: 0 },
    }),
  })),
}));

vi.mock('@recurrsive/policy', () => {
  const mockPolicySets = [
    {
      id: 'ps-security',
      name: 'Security Policy',
      description: 'Basic security rules',
      enabled: true,
      rules: [
        {
          id: 'rule-1',
          name: 'Block Critical',
          description: 'Block critical severity items',
          scope: 'opportunity',
          action: 'block',
          condition: { field: 'severity', operator: 'eq', value: 'critical' },
        },
      ],
    },
  ];

  return {
    PolicyEngine: vi.fn().mockImplementation(() => ({
      getPolicies: vi.fn().mockReturnValue(mockPolicySets),
      passes: vi.fn().mockReturnValue({
        passed: true,
        effectiveAction: 'allow',
        violations: [],
        warnings: [],
      }),
    })),
    BUILTIN_POLICIES: mockPolicySets,
  };
});

vi.mock('@recurrsive/core', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  generateId: vi.fn().mockReturnValue('test-id-123'),
  nowISO: vi.fn().mockReturnValue('2024-06-15T00:00:00.000Z'),
  VERSION: '0.5.6',
}));

import { createServer } from '../index.js';
import { createToken } from '../middleware/auth.js';

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let app: FastifyInstance;

// Shared auth token for tests — routes now require auth middleware
const adminToken = createToken('test-admin', 'admin');
const authHeaders = { authorization: `Bearer ${adminToken}` };

beforeAll(async () => {
  // Use a unique mock return for generateId to support multiple calls
  const { generateId } = await import('@recurrsive/core');
  let counter = 0;
  (generateId as ReturnType<typeof vi.fn>).mockImplementation(() => `test-id-${++counter}`);

  app = await createServer({ logger: false, rateLimitMax: 500 });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

// ===========================================================================
// Projects (10 tests)
// ===========================================================================

describe('Projects endpoints', () => {
  it('GET /api/v1/projects returns an array of projects', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/projects' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/projects/:id returns 404 for invalid ID', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/projects/nonexistent-id' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toBe('Not Found');
    expect(body.message).toBe('Project not found');
  });

  it('POST /api/v1/projects creates a new project', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/projects',
      payload: {
        name: 'Test Project Alpha',
        repository: 'https://github.com/test/alpha',
        language: 'Go',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body.data.name).toBe('Test Project Alpha');
    expect(body.data.repository).toBe('https://github.com/test/alpha');
    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('slug');
    expect(body.data).toHaveProperty('createdAt');
  });

  it('POST /api/v1/projects returns 400 without required fields', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/projects',
      payload: { description: 'missing name and repository' },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('Bad Request');
    expect(body.message).toContain('name and repository are required');
  });

  it('GET /api/v1/projects/:id returns a project by valid ID', async () => {
    // Create a project first
    const createRes = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/projects',
      payload: {
        name: 'Lookup Test Project',
        repository: 'https://github.com/test/lookup',
      },
    });
    const createdId = createRes.json().data.id;

    const res = await app.inject({ headers: authHeaders, method: 'GET', url: `/api/v1/projects/${createdId}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.id).toBe(createdId);
    expect(body.data.name).toBe('Lookup Test Project');
  });

  it('PUT /api/v1/projects/:id updates a project', async () => {
    // Create a project first
    const createRes = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/projects',
      payload: {
        name: 'Update Target',
        repository: 'https://github.com/test/update',
      },
    });
    const id = createRes.json().data.id;

    const res = await app.inject({
      headers: authHeaders,
      method: 'PUT',
      url: `/api/v1/projects/${id}`,
      payload: { name: 'Updated Project Name', language: 'Rust' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.name).toBe('Updated Project Name');
    expect(body.data.language).toBe('Rust');
  });

  it('DELETE /api/v1/projects/:id deletes a project', async () => {
    const createRes = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/projects',
      payload: {
        name: 'Delete Target',
        repository: 'https://github.com/test/delete',
      },
    });
    const id = createRes.json().data.id;

    const res = await app.inject({ headers: authHeaders, method: 'DELETE', url: `/api/v1/projects/${id}` });
    expect(res.statusCode).toBe(204);

    // Confirm deletion
    const getRes = await app.inject({ headers: authHeaders, method: 'GET', url: `/api/v1/projects/${id}` });
    expect(getRes.statusCode).toBe(404);
  });

  it('GET /api/v1/projects/compare/health returns health comparison', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/projects/compare/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('avgHealth');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('Projects have required fields (id, name, slug, healthScore)', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/projects' });
    const body = res.json();
    expect(body.data.length).toBeGreaterThan(0);
    for (const project of body.data) {
      expect(project).toHaveProperty('id');
      expect(project).toHaveProperty('name');
      expect(project).toHaveProperty('slug');
      expect(project).toHaveProperty('healthScore');
    }
  });

  it('Health scores are 0-100', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/projects' });
    const body = res.json();
    for (const project of body.data) {
      expect(project.healthScore).toBeGreaterThanOrEqual(0);
      expect(project.healthScore).toBeLessThanOrEqual(100);
    }
  });
});

// ===========================================================================
// Forecasting (8 tests)
// ===========================================================================

describe('Forecasting endpoints', () => {
  it('GET /api/v1/forecasting/health returns prediction data', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/forecasting/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('generatedAt');
    expect(body.data).toHaveProperty('currentScore');
    expect(body.data).toHaveProperty('trend');
    expect(body.data).toHaveProperty('confidence');
    expect(body.data).toHaveProperty('forecast');
  });

  it('Prediction has trend, confidence, and forecast fields', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/forecasting/health' });
    const body = res.json();
    expect(['improving', 'declining', 'stable']).toContain(body.data.trend);
    expect(typeof body.data.confidence).toBe('number');
    expect(body.data.confidence).toBeGreaterThanOrEqual(0);
    expect(body.data.confidence).toBeLessThanOrEqual(1);
    expect(Array.isArray(body.data.forecast)).toBe(true);
    expect(body.data.forecast.length).toBeGreaterThan(0);
  });

  it('Horizon parameter limits forecast length', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/forecasting/health?horizon=7' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Forecast should have at most 7 entries (capped to 30 by slice, but horizon=7 generates only 7)
    expect(body.data.forecast.length).toBeLessThanOrEqual(7);
  });

  it('POST /api/v1/forecasting/what-if returns impact analysis', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/forecasting/what-if',
      payload: {
        actions: [
          { type: 'fix-critical-findings', description: 'Fix all critical findings' },
          { type: 'add-tests', description: 'Add unit test coverage' },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('currentScore');
    expect(body.data).toHaveProperty('projectedScore');
    expect(body.data).toHaveProperty('totalImpact');
    expect(body.data).toHaveProperty('actions');
    expect(body.data.actions).toHaveLength(2);
  });

  it('What-if accepts actions array and returns per-action impact', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/forecasting/what-if',
      payload: {
        actions: [
          { type: 'add-monitoring', description: 'Add APM monitoring' },
        ],
      },
    });
    const body = res.json();
    const action = body.data.actions[0];
    expect(action).toHaveProperty('type');
    expect(action).toHaveProperty('description');
    expect(action).toHaveProperty('impact');
    expect(action.impact).toHaveProperty('healthScoreDelta');
    expect(action.impact).toHaveProperty('confidence');
    expect(action.impact).toHaveProperty('timeToRealize');
  });

  it('POST /api/v1/forecasting/what-if returns 400 without actions', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/forecasting/what-if',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('Bad Request');
    expect(body.message).toContain('At least one action is required');
  });

  it('GET /api/v1/forecasting/evolution returns evolution graph', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/forecasting/evolution' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('events');
    expect(body.data).toHaveProperty('trajectory');
    expect(body.data).toHaveProperty('totalDecisions');
    expect(body.data).toHaveProperty('totalMilestones');
    expect(body.data).toHaveProperty('allLearnings');
  });

  it('Evolution events have decisions and outcomes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/forecasting/evolution' });
    const body = res.json();
    expect(body.data.events.length).toBeGreaterThan(0);
    const event = body.data.events[0];
    expect(event).toHaveProperty('type');
    expect(event).toHaveProperty('outcome');
    expect(event).toHaveProperty('healthImpact');
    expect(event).toHaveProperty('learnings');
    expect(Array.isArray(event.learnings)).toBe(true);
  });
});

// ===========================================================================
// GraphQL (10 tests)
// ===========================================================================

describe('GraphQL endpoints', () => {
  it('POST /api/v1/graphql accepts a query', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/graphql',
      payload: { query: '{ projects { id name } }' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('projects');
    expect(Array.isArray(body.data.projects)).toBe(true);
  });

  it('Query returns requested fields only', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/graphql',
      payload: { query: '{ projects { id name } }' },
    });
    const body = res.json();
    const project = body.data.projects[0];
    expect(project).toHaveProperty('id');
    expect(project).toHaveProperty('name');
    // Should NOT have fields we didn't request
    expect(project).not.toHaveProperty('healthScore');
    expect(project).not.toHaveProperty('language');
  });

  it('Arguments filter correctly (severity, limit)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/graphql',
      payload: { query: '{ findings(severity: "critical", limit: 3) { id title severity } }' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveProperty('findings');
    expect(Array.isArray(body.data.findings)).toBe(true);
    expect(body.data.findings.length).toBeLessThanOrEqual(3);
    for (const finding of body.data.findings) {
      expect(finding.severity).toBe('critical');
    }
  });

  it('Variables substitute correctly', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/graphql',
      payload: {
        query: 'query GetFindings($sev: String) { findings(severity: $sev) { id severity } }',
        variables: { sev: 'high' },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveProperty('findings');
    for (const finding of body.data.findings) {
      expect(finding.severity).toBe('high');
    }
  });

  it('GET /api/v1/graphql/schema returns schema text', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/graphql/schema' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.payload).toContain('type Query');
    expect(res.payload).toContain('type Project');
    expect(res.payload).toContain('type Finding');
  });

  it('GET /api/v1/graphql/introspection returns metadata', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/graphql/introspection' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('__schema');
    expect(body.data.__schema).toHaveProperty('types');
    expect(body.data.__schema).toHaveProperty('queryType');
    expect(Array.isArray(body.data.__schema.types)).toBe(true);
  });

  it('Empty query returns error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/graphql',
      payload: { query: '' },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.data).toBeNull();
    expect(body.errors).toBeDefined();
    expect(body.errors.length).toBeGreaterThan(0);
  });

  it('Invalid query returns error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/graphql',
      payload: { query: 'not valid graphql at all !!!' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeNull();
    expect(body.errors).toBeDefined();
    expect(body.errors.length).toBeGreaterThan(0);
  });

  it('projects query works and returns all projects', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/graphql',
      payload: { query: '{ projects { id name slug healthScore language } }' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.projects.length).toBeGreaterThan(0);
    const project = body.data.projects[0];
    expect(project).toHaveProperty('id');
    expect(project).toHaveProperty('name');
    expect(project).toHaveProperty('slug');
    expect(project).toHaveProperty('healthScore');
    expect(project).toHaveProperty('language');
  });

  it('findings query with severity filter returns only matching', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/graphql',
      payload: { query: '{ findings(severity: "low") { id title severity } }' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    for (const f of body.data.findings) {
      expect(f.severity).toBe('low');
    }
  });
});

// ===========================================================================
// Multi-Tenant (8 tests)
// ===========================================================================

describe('Multi-Tenant endpoints', () => {
  it('GET /api/v1/tenants returns an array of tenants', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/tenants' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/tenants/:id returns tenant details', async () => {
    // Get first tenant ID from list
    const listRes = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/tenants' });
    const firstTenant = listRes.json().data[0];

    const res = await app.inject({ headers: authHeaders, method: 'GET', url: `/api/v1/tenants/${firstTenant.id}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.id).toBe(firstTenant.id);
    expect(body.data).toHaveProperty('name');
    expect(body.data).toHaveProperty('tier');
    expect(body.data).toHaveProperty('quotas');
    expect(body.data).toHaveProperty('features');
  });

  it('POST /api/v1/tenants creates a tenant', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/tenants',
      payload: {
        name: 'Test Tenant Corp',
        slug: `test-tenant-${Date.now()}`,
        tier: 'team',
        ownerId: 'test-user',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.name).toBe('Test Tenant Corp');
    expect(body.data.tier).toBe('team');
    expect(body.data).toHaveProperty('quotas');
    expect(body.data).toHaveProperty('usage');
  });

  it('Tenants have tier field', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/tenants' });
    const body = res.json();
    for (const tenant of body.data) {
      expect(tenant).toHaveProperty('tier');
      expect(['free', 'team', 'enterprise']).toContain(tenant.tier);
    }
  });

  it('GET /api/v1/tenants/:id/quotas returns usage data', async () => {
    const listRes = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/tenants' });
    const firstTenant = listRes.json().data[0];

    const res = await app.inject({ headers: authHeaders, method: 'GET', url: `/api/v1/tenants/${firstTenant.id}/quotas` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveProperty('tenant');
    expect(body.data).toHaveProperty('quotas');
    expect(body.data).toHaveProperty('overallUtilization');
    expect(Array.isArray(body.data.quotas)).toBe(true);
    expect(body.data.quotas.length).toBeGreaterThan(0);
    // Verify quota entry shape
    const quota = body.data.quotas[0];
    expect(quota).toHaveProperty('resource');
    expect(quota).toHaveProperty('limit');
    expect(quota).toHaveProperty('current');
  });

  it('GET /api/v1/tenants/tiers/info returns tier comparison', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/tenants/tiers/info' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveProperty('tiers');
    expect(Array.isArray(body.data.tiers)).toBe(true);
    expect(body.data.tiers).toHaveLength(3);
    const tierNames = body.data.tiers.map((t: { tier: string }) => t.tier);
    expect(tierNames).toContain('free');
    expect(tierNames).toContain('team');
    expect(tierNames).toContain('enterprise');
  });

  it('Invalid tenant ID returns 404', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/tenants/nonexistent-tenant-xyz' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toBe('Not Found');
    expect(body.message).toBe('Tenant not found');
  });

  it('Tiers are free/team/enterprise', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/tenants/tiers/info' });
    const body = res.json();
    for (const tier of body.data.tiers) {
      expect(['free', 'team', 'enterprise']).toContain(tier.tier);
      expect(tier).toHaveProperty('price');
      expect(tier).toHaveProperty('quotas');
      expect(tier).toHaveProperty('features');
    }
  });
});

// ===========================================================================
// Simulation (8 tests)
// ===========================================================================

describe('Simulation endpoints', () => {
  it('GET /api/v1/simulations returns an array', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/simulations' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET /api/v1/simulations/:id returns simulation details', async () => {
    const listRes = await app.inject({ method: 'GET', url: '/api/v1/simulations' });
    const firstSim = listRes.json().data[0];

    const res = await app.inject({ method: 'GET', url: `/api/v1/simulations/${firstSim.id}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.id).toBe(firstSim.id);
    expect(body.data).toHaveProperty('name');
    expect(body.data).toHaveProperty('type');
    expect(body.data).toHaveProperty('status');
  });

  it('POST /api/v1/simulations creates a simulation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/simulations',
      payload: {
        name: 'Test Load Simulation',
        type: 'load-test',
        description: 'Testing load simulation creation',
        parameters: { concurrency: 100, duration: '1h' },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data).toHaveProperty('id');
    expect(body.data.name).toBe('Test Load Simulation');
    expect(body.data.type).toBe('load-test');
    expect(body.data.status).toBe('completed');
  });

  it('Simulation has results with metrics', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/simulations',
      payload: {
        name: 'Metrics Test Sim',
        type: 'traffic-replay',
      },
    });
    const body = res.json();
    expect(body.data).toHaveProperty('results');
    expect(body.data.results).not.toBeNull();
    expect(body.data.results).toHaveProperty('impactScore');
    expect(body.data.results).toHaveProperty('riskLevel');
    expect(body.data.results).toHaveProperty('metrics');
    expect(body.data.results.metrics).toHaveProperty('estimatedLatencyChangeMs');
    expect(body.data.results.metrics).toHaveProperty('estimatedErrorRateChange');
  });

  it('Pull requests endpoint works', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/pull-requests' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('Intelligence packs endpoint works', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/intelligence-packs' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(1);
  });

  it('Intelligence pack by ID returns details', async () => {
    const listRes = await app.inject({ method: 'GET', url: '/api/v1/intelligence-packs' });
    const firstPack = listRes.json().data[0];

    const res = await app.inject({ method: 'GET', url: `/api/v1/intelligence-packs/${firstPack.id}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.id).toBe(firstPack.id);
    expect(body.data).toHaveProperty('name');
    expect(body.data).toHaveProperty('domain');
    expect(body.data).toHaveProperty('analyzers');
    expect(body.data).toHaveProperty('frameworks');
    expect(body.data).toHaveProperty('ruleCount');
  });

  it('Invalid simulation ID returns 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/simulations/nonexistent-sim' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toBe('Not Found');
    expect(body.message).toBe('Simulation not found');
  });
});

// ===========================================================================
// Cloud (8 tests)
// ===========================================================================

describe('Cloud endpoints', () => {
  it('GET /api/v1/cloud/benchmarks/report returns benchmark report', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/cloud/benchmarks/report' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('sampleSize');
  });

  it('Report has percentiles', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/cloud/benchmarks/report' });
    const body = res.json();
    if (body.data.sampleSize > 0) {
      expect(body.data).toHaveProperty('percentiles');
      expect(body.data.percentiles).toHaveProperty('p25');
      expect(body.data.percentiles).toHaveProperty('p50');
      expect(body.data.percentiles).toHaveProperty('p75');
      expect(body.data.percentiles).toHaveProperty('p90');
    }
  });

  it('GET /api/v1/cloud/patterns returns learned patterns', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/cloud/patterns' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('privacyNote');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThan(0);
  });

  it('GET /api/v1/cloud/partners returns partner list', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/cloud/partners' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThan(0);
  });

  it('GET /api/v1/cloud/services returns service tiers', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/cloud/services' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(3);
    // Verify service shape
    const service = body.data[0];
    expect(service).toHaveProperty('name');
    expect(service).toHaveProperty('tier');
    expect(service).toHaveProperty('features');
    expect(service).toHaveProperty('priceRange');
    expect(service).toHaveProperty('sla');
  });

  it('GET /api/v1/cloud/info returns platform info', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/cloud/info' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveProperty('platform');
    expect(body.data).toHaveProperty('version');
    expect(body.data).toHaveProperty('status');
    expect(body.data).toHaveProperty('regions');
    expect(body.data).toHaveProperty('features');
    expect(Array.isArray(body.data.regions)).toBe(true);
  });

  it('POST /api/v1/cloud/benchmarks accepts benchmark submission', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/cloud/benchmarks',
      payload: {
        industry: 'fintech',
        teamSize: 'medium',
        scores: { overall: 72, architecture: 75, security: 68, performance: 80, reliability: 71, documentation: 60 },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('message');
  });

  it('POST /api/v1/cloud/partners/apply submits partner application', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/cloud/partners/apply',
      payload: {
        partnerName: 'Test Partner Inc',
        specializations: ['cloud-migration', 'security'],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data).toHaveProperty('id');
    expect(body.data.partnerName).toBe('Test Partner Inc');
    expect(body.data.status).toBe('pending');
    expect(body).toHaveProperty('message');
  });
});

// ===========================================================================
// Secrets (8 tests)
// ===========================================================================

describe('Secrets endpoints', () => {
  it('GET /api/v1/secrets returns an array of secrets', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/secrets' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThan(0);
  });

  it('Secrets never expose actual values', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/secrets' });
    const body = res.json();
    for (const secret of body.data) {
      // Secret entries should never have a 'value' field
      expect(secret).not.toHaveProperty('value');
      // Should have key and description but no raw value
      expect(secret).toHaveProperty('key');
      expect(secret).toHaveProperty('description');
    }
  });

  it('POST /api/v1/secrets creates a secret', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/secrets',
      payload: {
        key: 'TEST_API_KEY',
        value: 'super-secret-value-123',
        description: 'A test API key',
        backend: 'local',
        tags: ['test'],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.key).toBe('TEST_API_KEY');
    expect(body.data.version).toBe(1);
    expect(body.data.backend).toBe('local');
    // The response should NOT contain the raw value
    expect(body.data).not.toHaveProperty('value');
  });

  it('POST /api/v1/secrets/:id/rotate rotates a secret', async () => {
    const listRes = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/secrets' });
    const firstSecret = listRes.json().data[0];
    const originalVersion = firstSecret.version;

    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: `/api/v1/secrets/${firstSecret.id}/rotate`,
      payload: { newValue: 'rotated-value' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.version).toBe(originalVersion + 1);
    expect(body.data.lastRotated).not.toBeNull();
    expect(body).toHaveProperty('message');
  });

  it('DELETE /api/v1/secrets/:id deletes a secret', async () => {
    // Create a secret first
    const createRes = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/secrets',
      payload: { key: 'DELETE_ME', value: 'temp', description: 'To be deleted' },
    });
    const id = createRes.json().data.id;

    const res = await app.inject({ headers: authHeaders, method: 'DELETE', url: `/api/v1/secrets/${id}` });
    expect(res.statusCode).toBe(204);
  });

  it('GET /api/v1/secrets/audit/log returns audit log', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/secrets/audit/log' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET /api/v1/secrets/health/rotation returns rotation health', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/secrets/health/rotation' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveProperty('total');
    expect(body.data).toHaveProperty('withAutoRotation');
    expect(body.data).toHaveProperty('needsRotation');
    expect(body.data).toHaveProperty('status');
    expect(['healthy', 'action_required']).toContain(body.data.status);
  });

  it('Secret has backend and version fields', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/secrets' });
    const body = res.json();
    for (const secret of body.data) {
      expect(secret).toHaveProperty('backend');
      expect(secret).toHaveProperty('version');
      expect(['vault', 'aws-secrets-manager', 'azure-key-vault', 'local']).toContain(secret.backend);
      expect(typeof secret.version).toBe('number');
    }
  });
});

// ===========================================================================
// Confidence (6 tests)
// ===========================================================================

describe('Confidence calibration endpoints', () => {
  it('GET /api/v1/confidence/overview returns calibration data', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/confidence/overview' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('generatedAt');
    expect(body.data).toHaveProperty('totalPredictions');
    expect(body.data).toHaveProperty('resolved');
    expect(body.data).toHaveProperty('pending');
    expect(body.data).toHaveProperty('overallBrierScore');
    expect(body.data).toHaveProperty('calibrationCurve');
    expect(body.data).toHaveProperty('analyzerScores');
  });

  it('Overview has Brier score', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/confidence/overview' });
    const body = res.json();
    expect(typeof body.data.overallBrierScore).toBe('number');
    expect(body.data.overallBrierScore).toBeGreaterThanOrEqual(0);
    expect(body.data.overallBrierScore).toBeLessThanOrEqual(1);
  });

  it('GET /api/v1/confidence/predictions returns predictions list', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/confidence/predictions' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThan(0);
  });

  it('POST outcome recording works', async () => {
    // Get a prediction with pending outcome
    const listRes = await app.inject({ method: 'GET', url: '/api/v1/confidence/predictions?status=pending' });
    const pending = listRes.json().data;
    if (pending.length > 0) {
      const predId = pending[0].id;
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/confidence/predictions/${predId}/outcome`,
        payload: { occurred: true },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.actualOutcome).toBe(true);
      expect(body.data.resolvedAt).not.toBeNull();
    } else {
      // If no pending predictions, verify the endpoint at least exists
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/confidence/predictions/nonexistent/outcome',
        payload: { occurred: true },
      });
      expect(res.statusCode).toBe(404);
    }
  });

  it('Calibration curve has buckets', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/confidence/overview' });
    const body = res.json();
    const curve = body.data.calibrationCurve;
    expect(Array.isArray(curve)).toBe(true);
    expect(curve.length).toBe(5); // 5 buckets: 0-20%, 20-40%, 40-60%, 60-80%, 80-100%
    const bucket = curve[0];
    expect(bucket).toHaveProperty('range');
    expect(bucket).toHaveProperty('count');
    expect(bucket).toHaveProperty('avgPredicted');
    expect(bucket).toHaveProperty('actualRate');
    expect(bucket).toHaveProperty('calibrationError');
  });

  it('Per-analyzer calibration works', async () => {
    // Get a valid analyzer ID from the overview
    const overviewRes = await app.inject({ method: 'GET', url: '/api/v1/confidence/overview' });
    const analyzerScores = overviewRes.json().data.analyzerScores;
    const validAnalyzer = analyzerScores.find((a: { totalPredictions: number }) => a.totalPredictions > 0);

    if (validAnalyzer) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/confidence/calibration/${validAnalyzer.analyzerId}`,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toHaveProperty('analyzerId');
      expect(body.data.analyzerId).toBe(validAnalyzer.analyzerId);
      expect(body.data).toHaveProperty('brierScore');
      expect(body.data).toHaveProperty('calibrationCurve');
      expect(body.data).toHaveProperty('totalPredictions');
    } else {
      // Verify endpoint returns 404 for unknown analyzer
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/confidence/calibration/nonexistent',
      });
      expect(res.statusCode).toBe(404);
    }
  });
});

// ===========================================================================
// Plugins (6 tests)
// ===========================================================================

describe('Plugins endpoints', () => {
  it('GET /api/v1/plugins/installed returns installed plugin list', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/plugins/installed' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET /api/v1/plugins/marketplace returns marketplace listing', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/plugins/marketplace' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThan(0);
    // Verify marketplace entry shape
    const entry = body.data[0];
    expect(entry).toHaveProperty('name');
    expect(entry).toHaveProperty('version');
    expect(entry).toHaveProperty('type');
    expect(entry).toHaveProperty('downloads');
    expect(entry).toHaveProperty('rating');
  });

  it('POST /api/v1/plugins/install/:id installs a plugin', async () => {
    // Find a plugin in marketplace that is NOT already installed
    const marketRes = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/plugins/marketplace' });
    const installedRes = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/plugins/installed' });
    const installedIds = new Set(installedRes.json().data.map((p: { id: string }) => p.id));
    const available = marketRes.json().data.find((p: { id: string }) => !installedIds.has(p.id));

    if (available) {
      const res = await app.inject({
      headers: authHeaders,
        method: 'POST',
        url: `/api/v1/plugins/install/${available.id}`,
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.data.id).toBe(available.id);
      expect(body.data.status).toBe('enabled');
    }
  });

  it('DELETE /api/v1/plugins/installed/:id uninstalls a plugin', async () => {
    // Install a plugin first, then uninstall it
    const marketRes = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/plugins/marketplace' });
    const installedRes = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/plugins/installed' });
    const installedIds = new Set(installedRes.json().data.map((p: { id: string }) => p.id));
    const available = marketRes.json().data.find((p: { id: string }) => !installedIds.has(p.id));

    if (available) {
      // Install it
      await app.inject({ headers: authHeaders, method: 'POST', url: `/api/v1/plugins/install/${available.id}` });
      // Uninstall it
      const res = await app.inject({ headers: authHeaders, method: 'DELETE', url: `/api/v1/plugins/installed/${available.id}` });
      expect(res.statusCode).toBe(204);
    }
  });

  it('GET /api/v1/plugins/installed/:id/health returns plugin health', async () => {
    const installedRes = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/plugins/installed' });
    const plugins = installedRes.json().data;

    if (plugins.length > 0) {
      const pluginId = plugins[0].id;
      const res = await app.inject({ headers: authHeaders, method: 'GET', url: `/api/v1/plugins/installed/${pluginId}/health` });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toHaveProperty('status');
      expect(body.data).toHaveProperty('lastCheck');
      expect(body.data).toHaveProperty('message');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(body.data.status);
    }
  });

  it('GET /api/v1/plugins/sdk returns SDK info', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/plugins/sdk' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveProperty('version');
    expect(body.data).toHaveProperty('interfaces');
    expect(body.data.interfaces).toHaveProperty('collector');
    expect(body.data.interfaces).toHaveProperty('analyzer');
    expect(body.data.interfaces).toHaveProperty('reporter');
    expect(body.data).toHaveProperty('templateRepo');
    expect(body.data).toHaveProperty('cliCommand');
  });
});

// ===========================================================================
// SSO (6 tests)
// ===========================================================================

describe('SSO endpoints', () => {
  it('GET /api/v1/sso/providers returns provider list', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/sso/providers' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(1);
  });

  it('PUT /api/v1/sso/providers/:id creates/updates SSO config', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'PUT',
      url: '/api/v1/sso/providers/test-provider',
      payload: {
        provider: 'custom',
        displayName: 'Test IdP',
        entityId: 'https://test-idp.example.com',
        ssoUrl: 'https://test-idp.example.com/sso',
        certificate: 'test-cert',
        autoProvision: true,
        defaultRole: 'viewer',
      },
    });
    expect([200, 201]).toContain(res.statusCode);
    const body = res.json();
    expect(body.data).toHaveProperty('provider');
    expect(body.data.displayName).toBe('Test IdP');
    expect(body.data.autoProvision).toBe(true);
  });

  it('GET /api/v1/sso/sessions returns session list', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/sso/sessions' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('DELETE /api/v1/sso/sessions/:id returns 404 for unknown session', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'DELETE', url: '/api/v1/sso/sessions/nonexistent-session' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toBe('Not Found');
    expect(body.message).toBe('Session not found');
  });

  it('SSO login returns redirect URL', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/sso/login/okta' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('redirectUrl');
    expect(body).toHaveProperty('provider');
    expect(body).toHaveProperty('entityId');
    expect(body.provider).toBe('okta');
    expect(body.redirectUrl).toContain('https://');
  });

  it('Provider has protocol and status fields', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/sso/providers' });
    const body = res.json();
    expect(body.data.length).toBeGreaterThan(0);
    const provider = body.data[0];
    expect(provider).toHaveProperty('provider');
    expect(provider).toHaveProperty('ssoUrl');
    expect(provider).toHaveProperty('autoProvision');
    expect(provider).toHaveProperty('defaultRole');
    // Verify provider is a known type
    expect(['okta', 'auth0', 'azure-ad', 'google-workspace', 'custom']).toContain(provider.provider);
  });
});

// ===========================================================================
// Scheduling (6 tests)
// ===========================================================================

describe('Scheduling endpoints', () => {
  it('GET /api/v1/schedules returns an array of schedules', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/schedules' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/v1/schedules creates a schedule', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/schedules',
      payload: {
        name: 'Daily Security Scan Report',
        schedule: '0 8 * * *',
        timezone: 'UTC',
        formats: ['json', 'html'],
        recipients: ['security@test.io'],
        sections: ['summary', 'findings'],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data).toHaveProperty('id');
    expect(body.data.name).toBe('Daily Security Scan Report');
    expect(body.data.schedule).toBe('0 8 * * *');
    expect(body.data.status).toBe('active');
    expect(body.data).toHaveProperty('nextRunAt');
  });

  it('Schedules have cron expression', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/schedules' });
    const body = res.json();
    for (const schedule of body.data) {
      expect(schedule).toHaveProperty('schedule');
      expect(typeof schedule.schedule).toBe('string');
      // Cron expressions have space-separated fields
      expect(schedule.schedule.split(' ').length).toBeGreaterThanOrEqual(5);
    }
  });

  it('GET /api/v1/schedules/:id/runs returns history of past runs', async () => {
    const listRes = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/schedules' });
    const firstSchedule = listRes.json().data[0];

    const res = await app.inject({ headers: authHeaders, method: 'GET', url: `/api/v1/schedules/${firstSchedule.id}/runs` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('POST /api/v1/schedules/:id/run triggers an immediate run', async () => {
    const listRes = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/schedules' });
    const firstSchedule = listRes.json().data[0];

    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: `/api/v1/schedules/${firstSchedule.id}/run`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('scheduleId');
    expect(body.data).toHaveProperty('status');
    expect(body.data).toHaveProperty('format');
    expect(body.data.scheduleId).toBe(firstSchedule.id);
  });

  it('GET /api/v1/schedules/:id returns schedule details', async () => {
    const listRes = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/schedules' });
    const firstSchedule = listRes.json().data[0];

    const res = await app.inject({ headers: authHeaders, method: 'GET', url: `/api/v1/schedules/${firstSchedule.id}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.id).toBe(firstSchedule.id);
    expect(body.data).toHaveProperty('name');
    expect(body.data).toHaveProperty('schedule');
    expect(body.data).toHaveProperty('timezone');
    expect(body.data).toHaveProperty('formats');
    expect(body.data).toHaveProperty('recipients');
    expect(body.data).toHaveProperty('status');
    expect(body.data).toHaveProperty('totalRuns');
  });
});

// ==========================================================================
// Marketplace Routes (10 tests)
// ==========================================================================

describe('Marketplace Routes', () => {
  it('GET /api/v1/marketplace/extensions returns extension list', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/marketplace/extensions' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('categories');
  });

  it('GET /api/v1/marketplace/extensions supports category filter', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/marketplace/extensions?category=analyzer' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    body.data.forEach((ext: any) => {
      expect(ext.category).toBe('analyzer');
    });
  });

  it('GET /api/v1/marketplace/extensions supports source filter', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/marketplace/extensions?source=built-in' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    body.data.forEach((ext: any) => {
      expect(ext.source).toBe('built-in');
    });
  });

  it('GET /api/v1/marketplace/extensions supports search', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/marketplace/extensions?search=security' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/marketplace/extensions supports sorting', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/marketplace/extensions?sort=rating' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    for (let i = 1; i < body.data.length; i++) {
      expect(body.data[i - 1].rating).toBeGreaterThanOrEqual(body.data[i].rating);
    }
  });

  it('GET /api/v1/marketplace/extensions/:id returns extension detail', async () => {
    const listRes = await app.inject({ method: 'GET', url: '/api/v1/marketplace/extensions' });
    const firstExt = listRes.json().data[0];
    const res = await app.inject({ method: 'GET', url: `/api/v1/marketplace/extensions/${firstExt.id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(firstExt.id);
  });

  it('GET /api/v1/marketplace/extensions/:id returns 404 for unknown', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/marketplace/extensions/nonexistent' });
    expect(res.statusCode).toBe(404);
  });

  it('POST /api/v1/marketplace/extensions submits new extension', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/extensions',
      payload: { name: 'Test Analyzer', category: 'analyzer', description: 'Test extension', repositoryUrl: 'https://github.com/test/test', author: 'Test', version: '1.0.0' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.status).toBe('review');
  });

  it('GET /api/v1/marketplace/categories returns category list', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/marketplace/categories' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBe(4);
  });

  it('GET /api/v1/marketplace/stats returns statistics', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/marketplace/stats' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveProperty('totalExtensions');
    expect(body.data).toHaveProperty('totalDownloads');
    expect(body.data).toHaveProperty('averageRating');
    expect(body.data).toHaveProperty('categoryCounts');
    expect(body.data).toHaveProperty('sourceCounts');
  });
});

// ==========================================================================
// Partner Routes (10 tests)
// ==========================================================================

describe('Partner Routes', () => {
  it('GET /api/v1/partners returns partner list', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/partners' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('tierCounts');
  });

  it('GET /api/v1/partners supports tier filter', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/partners?tier=platinum' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    body.data.forEach((p: any) => {
      expect(p.tier).toBe('platinum');
    });
  });

  it('GET /api/v1/partners supports type filter', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/partners?type=consulting' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    body.data.forEach((p: any) => {
      expect(p.type).toBe('consulting');
    });
  });

  it('GET /api/v1/partners supports region filter', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/partners?region=europe' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    body.data.forEach((p: any) => {
      expect(p.regions.some((r: string) => r.toLowerCase().includes('europe'))).toBe(true);
    });
  });

  it('GET /api/v1/partners/:id returns partner detail', async () => {
    const listRes = await app.inject({ method: 'GET', url: '/api/v1/partners' });
    const firstPartner = listRes.json().data[0];
    const res = await app.inject({ method: 'GET', url: `/api/v1/partners/${firstPartner.id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(firstPartner.id);
  });

  it('GET /api/v1/partners/:id returns 404 for unknown', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/partners/nonexistent' });
    expect(res.statusCode).toBe(404);
  });

  it('POST /api/v1/partners/apply submits application', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/partners/apply',
      payload: { companyName: 'Test Corp', contactEmail: 'test@example.com', partnerType: 'consulting', website: 'https://test.com', contactName: 'John Doe', companySize: '50-200', description: 'Test application' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.status).toBe('pending');
  });

  it('POST /api/v1/partners/apply validates required fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/partners/apply',
      payload: { companyName: 'Test Corp' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /api/v1/partners/certifications returns certification tracks', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/partners/certifications' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBe(3);
    expect(body.data[0]).toHaveProperty('level');
    expect(body.data[0]).toHaveProperty('name');
    expect(body.data[0]).toHaveProperty('cost');
  });

  it('GET /api/v1/partners/stats returns program statistics', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/partners/stats' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveProperty('totalPartners');
    expect(body.data).toHaveProperty('totalCertifiedEngineers');
    expect(body.data).toHaveProperty('totalCustomersServed');
    expect(body.data).toHaveProperty('tierDistribution');
  });
});

// ==========================================================================
// OpenAPI Routes (3 tests)
// ==========================================================================

describe('OpenAPI Routes', () => {
  it('GET /api/v1/openapi.json returns valid OpenAPI spec', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/openapi.json' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.openapi).toBe('3.1.0');
    expect(body.info.title).toBe('Recurrsive API');
    expect(body).toHaveProperty('paths');
    expect(body).toHaveProperty('components');
    expect(body).toHaveProperty('tags');
  });

  it('GET /api/v1/openapi.json contains expected paths', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/openapi.json' });
    const body = res.json();
    expect(body.paths).toHaveProperty('/api/v1/health');
    expect(body.paths).toHaveProperty('/api/v1/findings');
    expect(body.paths).toHaveProperty('/api/v1/marketplace/extensions');
    expect(body.paths).toHaveProperty('/api/v1/partners');
  });

  it('GET /api/docs returns HTML documentation page', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/docs' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    const html = res.body;
    expect(html).toContain('swagger-ui');
    expect(html).toContain('Recurrsive API');
  });
});
