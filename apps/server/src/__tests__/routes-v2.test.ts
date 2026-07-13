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
 * - Marketplace (10 tests)
 * - Partners (10 tests)
 * - OpenAPI (3 tests)
 * - Setup Wizard (4 tests)
 * - User Management (6 tests)
 * - Store-backed Login (3 tests)
 * - Invite System (5 tests)
 * - Password Change (3 tests)
 * - Admin Password Reset (2 tests)
 *
 * Total: 130+ tests
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
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
    clearAll: vi.fn().mockResolvedValue(undefined),
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
  VERSION: '0.5.7',
}));

import { createServer } from '../index.js';
import { createToken } from '../middleware/auth.js';
import { installProjectScopedInjection, seedTestProject } from './test-project.js';

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
  await seedTestProject();
  installProjectScopedInjection(app);
});

afterAll (async () => {
  await app.close();
});

// ===========================================================================
// Projects (10 tests)
// ===========================================================================

describe ('Projects endpoints', () => {
  it('GET /api/v1/projects returns an array of projects', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/projects' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(0);
  });

  it ('GET /api/v1/projects/:id returns 404 for invalid ID', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/projects/nonexistent-id' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toBe('Not Found');
    expect(body.message).toBe('Project not found');
  });

  it ('POST /api/v1/projects creates a new project', async () => {
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

  it ('POST /api/v1/projects returns 400 without required fields', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/projects',
      payload: { description: 'missing name and repository' },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('Bad Request');
    expect(body.message).toMatch(/name and repository are required|must have required property/);
  });

  it ('GET /api/v1/projects/:id returns a project by valid ID', async () => {
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

  it ('PUT /api/v1/projects/:id updates a project', async () => {
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

  it ('DELETE /api/v1/projects/:id deletes a project', async () => {
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

  it ('GET /api/v1/projects/compare/health returns health comparison', async () => {
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

  it ('Health scores are 0-100', async () => {
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

describe ('Forecasting endpoints', () => {
  it('GET /api/v1/forecasting/health returns prediction data', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/forecasting/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('generatedAt');
    expect(body.data).toHaveProperty('currentScore');
    expect(body.data).toHaveProperty('trend');
    expect(body.data).toHaveProperty('confidence');
    expect(body.data).toHaveProperty('forecast');
    expect(body.data).toHaveProperty('available');
  });

  it ('Prediction has trend, confidence, and forecast fields', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/forecasting/health' });
    const body = res.json();
    expect(['improving', 'declining', 'stable', 'insufficient-data']).toContain(body.data.trend);
    expect(typeof body.data.confidence).toBe('number');
    expect(body.data.confidence).toBeGreaterThanOrEqual(0);
    expect(body.data.confidence).toBeLessThanOrEqual(1);
    expect(Array.isArray(body.data.forecast)).toBe(true);
    expect(body.data.forecast.length).toBeGreaterThanOrEqual(0);
  });

  it ('Horizon parameter limits forecast length', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/forecasting/health?horizon=7' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Forecast should have at most 7 entries (capped to 30 by slice, but horizon=7 generates only 7)
    expect(body.data.forecast.length).toBeLessThanOrEqual(7);
  });

  it ('GET /api/v1/forecasting/evolution returns evolution graph', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/forecasting/evolution' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('events');
    expect(body.data).toHaveProperty('trajectory');
    expect(body.data).toHaveProperty('totalAnalyses');
    expect(body.data).toHaveProperty('netHealthChange');
    expect(body.data).toHaveProperty('allLearnings');
  });

  it ('Evolution events contain recorded analysis evidence', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/forecasting/evolution' });
    const body = res.json();
    expect(body.data.events.length).toBeGreaterThanOrEqual(0);
    if (body.data.events.length > 0) {
      const event = body.data.events[0];
      expect(event.type).toBe('analysis');
      expect(event).toHaveProperty('healthImpact');
      expect(event).toHaveProperty('learnings');
      expect(Array.isArray(event.learnings)).toBe(true);
    }
  });
});

// ===========================================================================
// GraphQL (10 tests)
// ===========================================================================

describe ('GraphQL endpoints', () => {
  it('POST /api/v1/graphql accepts a query', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/graphql',
      payload: { query: '{ project { id name } }' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('project');
    expect(body.data.project.id).toBe('test-project');
  });

  it ('Query returns requested fields only', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/graphql',
      payload: { query: '{ project { id name } }' },
    });
    const body = res.json();
    const project = body.data.project;
    expect(project).toHaveProperty('id');
    expect(project).toHaveProperty('name');
    expect(project).not.toHaveProperty('healthScore');
    expect(project).not.toHaveProperty('language');
  });

  it('Arguments filter correctly (severity, limit)', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/graphql',
      payload: { query: '{ findings(severity: critical, limit: 3) { nodes { id title severity } total } }' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveProperty('findings');
    expect(Array.isArray(body.data.findings.nodes)).toBe(true);
    expect(body.data.findings.nodes.length).toBeLessThanOrEqual(3);
    for (const finding of body.data.findings.nodes) {
      expect(finding.severity).toBe('critical');
    }
  });

  it ('Variables substitute correctly', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/graphql',
      payload: {
        query: 'query GetFindings($sev: Severity!) { findings(severity: $sev) { nodes { id severity } } }',
        variables: { sev: 'high' },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveProperty('findings');
    for (const finding of body.data.findings.nodes) {
      expect(finding.severity).toBe('high');
    }
  });

  it ('supports named operations, aliases, and fragments', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/graphql',
      payload: {
        operationName: 'ScopedProject',
        query: `
          query ScopedProject {
            selected: project { ...ProjectIdentity }
          }
          fragment ProjectIdentity on Project { id name }
        `,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.selected).toEqual({ id: 'test-project', name: 'Test Project' });
  });

  it ('GET /api/v1/graphql/schema returns schema text', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/graphql/schema' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.payload).toContain('type Query');
    expect(res.payload).toContain('type Project');
    expect(res.payload).toContain('type Finding');
  });

  it ('GET /api/v1/graphql/introspection returns metadata', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/graphql/introspection' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('__schema');
    expect(body.data.__schema).toHaveProperty('types');
    expect(body.data.__schema).toHaveProperty('queryType');
    expect(Array.isArray(body.data.__schema.types)).toBe(true);
  });

  it ('Empty query returns error', async () => {
    const res = await app.inject({
      headers: authHeaders,
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

  it ('Invalid query returns error', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/graphql',
      payload: { query: 'not valid graphql at all !!!' },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.data).toBeNull();
    expect(body.errors).toBeDefined();
    expect(body.errors.length).toBeGreaterThan(0);
  });

  it ('project query returns the selected scoped project', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/graphql',
      payload: { query: '{ project { id name slug healthScore language } }' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const project = body.data.project;
    expect(project).toHaveProperty('id');
    expect(project).toHaveProperty('name');
    expect(project).toHaveProperty('slug');
    expect(project).toHaveProperty('healthScore');
    expect(project).toHaveProperty('language');
  });

  it ('findings query with severity filter returns only matching', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/graphql',
      payload: { query: '{ findings(severity: low) { nodes { id title severity } } }' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    for (const f of body.data.findings.nodes) {
      expect(f.severity).toBe('low');
    }
  });
});

// ===========================================================================
// Cloud (8 tests)
// ===========================================================================

describe ('Cloud endpoints', () => {
  it('GET /api/v1/cloud/benchmarks/report returns benchmark report', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/cloud/benchmarks/report' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('sampleSize');
  });

  it ('Report has percentiles', async () => {
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

  it ('GET /api/v1/cloud/patterns returns learned patterns', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/cloud/patterns' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('privacyNote');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(0);
  });

  it ('GET /api/v1/cloud/services returns service tiers', async () => {
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
    expect(service).toHaveProperty('availability');
  });

  it ('GET /api/v1/cloud/info returns platform info', async () => {
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

  it ('POST /api/v1/cloud/benchmarks accepts benchmark submission', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/cloud/benchmarks',
      payload: {
        industry: 'fintech',
        teamSize: 'medium',
        scores: { overall: 72, architecture: 75, security: 68, performance: 80, reliability: 71, documentation: 60 },
        meta: { codebaseSize: 'medium', primaryLanguage: 'TypeScript', analyzersUsed: 10, collectorsUsed: 4 },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('message');
  });

});

// ===========================================================================
// Secrets (8 tests)
// ===========================================================================

describe ('Secrets endpoints', () => {
  it('GET /api/v1/secrets returns an array of secrets', async () => {
    // Create a secret first since there is no seed data
    await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/secrets',
      payload: { key: 'LIST_TEST_KEY', value: 'test-value', description: 'For list test', backend: 'local', tags: ['test'] },
    });

    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/secrets' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThan(0);
  });

  it ('Secrets never expose actual values', async () => {
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

  it ('POST /api/v1/secrets creates a secret', async () => {
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

  it ('POST /api/v1/secrets/:id/rotate rotates a secret', async () => {
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

  it ('DELETE /api/v1/secrets/:id deletes a secret', async () => {
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

  it ('GET /api/v1/secrets/audit/log returns audit log', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/secrets/audit/log' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it ('GET /api/v1/secrets/health/rotation returns rotation health', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/secrets/health/rotation' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveProperty('total');
    expect(body.data).toHaveProperty('withAutoRotation');
    expect(body.data).toHaveProperty('needsRotation');
    expect(body.data).toHaveProperty('status');
    expect(['healthy', 'action_required']).toContain(body.data.status);
  });

  it ('Secret has backend and version fields', async () => {
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

describe('Removed confidence-calibration surface', () => {
  it('does not expose analyzer findings as outcome predictions', async () => {
    const response = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/confidence/overview' });
    expect(response.statusCode).toBe(404);
  });
});

// ===========================================================================
// SSO (6 tests)
// ===========================================================================

describe ('SSO endpoints', () => {
  const testIdpCertificate = `-----BEGIN CERTIFICATE-----
MIIDHTCCAgWgAwIBAgIUNOygQHFJCnkIOXZC4/6B4z0tgjUwDQYJKoZIhvcNAQEL
BQAwHjEcMBoGA1UEAwwTcmVjdXJyc2l2ZS10ZXN0LWlkcDAeFw0yNjA3MTMxNTU0
NDFaFw0zNjA3MTAxNTU0NDFaMB4xHDAaBgNVBAMME3JlY3VycnNpdmUtdGVzdC1p
ZHAwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC46jfl4LmVAQ4kve6C
XEOPmWFbCFKGMnLaDiXOctGJ6nzEcSiiD4RturIbGlASLhmHyYhIantupkaGrQfA
tDv97rTvZWpZSWvR4UzWgBcrj/oTxjFXMFSOxJq9RZpjzguPTZfGcCUwxWAKoegx
+Dipz8VHDE1z96kDQHRRds7YQaMoov/Ndj8/wr9KKNQSb7PHyVnVN3WmpPxTVt5j
2hm7I3fCDebLaAp5k/1W5J9eTUl9LJcPkqieU4esQ5Frt9634wV4bfk9QbcfAI8z
293nLdtUlx6eWpNPeHCSk06HYqszl4ZX78YupTcFN1CF4j1ADaSoI/ppUKsq1eh1
GkZJAgMBAAGjUzBRMB0GA1UdDgQWBBQZpghYp4EfnXHXnfrTE4vSe8aAGzAfBgNV
HSMEGDAWgBQZpghYp4EfnXHXnfrTE4vSe8aAGzAPBgNVHRMBAf8EBTADAQH/MA0G
CSqGSIb3DQEBCwUAA4IBAQBdRxMv5HdR5OMYvyqifAEm5/xC3aIh3uBvqRtt10jC
inOgMvf+JfgWW3zMjSjBekAkytTelr95Qp6fT0zJ2vg4SErB4KddL6wlgBRtwefJ
wFsEJodh//yyV/lC3m4SMcJcJgPaDnGl9GL268Ml2mbd0mn8F9rJoljv2pRvQ0df
o9NTiWalTh0gaezTJYHwYNl7h+oSbExCIXylYldwPkTk1xuwAbS2m3cNTay1mn+a
oU5S4c4C7xjlYnSmqEumfcIjoMif7LrEuzPfR/BA2ZN8bodYMX7haCj8nTsczC24
BL+ux5ISEOzWXKg/2wB4+gVdNlO3sfnYKhHryobNw0qo
-----END CERTIFICATE-----`;

  const providerPayload = (displayName: string) => ({
    provider: 'custom',
    displayName,
    idpEntityId: 'https://test-idp.example.com/metadata',
    spEntityId: 'https://recurrsive.example.com/saml/metadata',
    ssoUrl: 'https://test-idp.example.com/sso',
    certificate: testIdpCertificate,
    signatureMode: 'both',
    autoProvision: true,
    defaultRole: 'viewer',
  });

  it('GET /api/v1/sso/providers returns provider list', async () => {
    // Create a provider first since there is no seed data
    await app.inject({
      headers: authHeaders,
      method: 'PUT',
      url: '/api/v1/sso/providers/okta',
      payload: { ...providerPayload('Test Okta'), provider: 'okta', defaultRole: 'analyst' },
    });

    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/sso/providers' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(1);
  });

  it ('PUT /api/v1/sso/providers/:id creates/updates SSO config', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'PUT',
      url: '/api/v1/sso/providers/test-provider',
      payload: providerPayload('Test IdP'),
    });
    expect([200, 201]).toContain(res.statusCode);
    const body = res.json();
    expect(body.data).toHaveProperty('provider');
    expect(body.data.displayName).toBe('Test IdP');
    expect(body.data.autoProvision).toBe(true);
  });

  it ('GET /api/v1/sso/sessions returns session list', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/sso/sessions' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it ('DELETE /api/v1/sso/sessions/:id returns 404 for unknown session', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'DELETE', url: '/api/v1/sso/sessions/nonexistent-session' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toBe('Not Found');
    expect(body.message).toBe('Session not found');
  });

  it ('SSO login returns redirect URL', async () => {
    // Ensure the okta provider exists (created in a prior test or create here)
    await app.inject({
      headers: authHeaders,
      method: 'PUT',
      url: '/api/v1/sso/providers/okta',
      payload: { ...providerPayload('Test Okta'), provider: 'okta', defaultRole: 'analyst' },
    });

    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/sso/login/okta' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('https://test-idp.example.com/sso');
  });

  it ('Provider exposes the signed SAML configuration', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/sso/providers' });
    const body = res.json();
    expect(body.data.length).toBeGreaterThan(0);
    const provider = body.data[0];
    expect(provider).toHaveProperty('provider');
    expect(provider).toHaveProperty('ssoUrl');
    expect(provider).toHaveProperty('idpEntityId');
    expect(provider).toHaveProperty('spEntityId');
    expect(provider).toHaveProperty('autoProvision');
    expect(provider).toHaveProperty('defaultRole');
    // Verify provider is a known type
    expect(['okta', 'auth0', 'azure-ad', 'google-workspace', 'custom']).toContain(provider.provider);

    const detail = await app.inject({
      headers: authHeaders,
      method: 'GET',
      url: `/api/v1/sso/providers/${provider.id}`,
    });
    expect(detail.json().data.signatureMode).toBe('both');
  });
});

// ===========================================================================
// Scheduling (6 tests)
// ===========================================================================

describe ('Scheduling endpoints', () => {
  it('GET /api/v1/schedules returns an array of schedules', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/schedules' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(0);
  });

  it ('POST /api/v1/schedules creates a schedule', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/schedules',
      payload: {
        name: 'Daily Security Scan Report',
        cron: '0 8 * * *',
        timezone: 'UTC',
        format: 'html',
        includeActionItems: true,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data).toHaveProperty('id');
    expect(body.data.name).toBe('Daily Security Scan Report');
    expect(body.data.cron).toBe('0 8 * * *');
    expect(body.data.status).toBe('active');
    expect(body.data).toHaveProperty('nextRunAt');
  });

  it ('Schedules have cron expression', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/schedules' });
    const body = res.json();
    for (const schedule of body.data) {
      expect(schedule).toHaveProperty('cron');
      expect(typeof schedule.cron).toBe('string');
      // Cron expressions have space-separated fields
      expect(schedule.cron.split(' ').length).toBeGreaterThanOrEqual(5);
    }
  });

  it ('GET /api/v1/schedules/:id/runs returns history of past runs', async () => {
    const listRes = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/schedules' });
    const firstSchedule = listRes.json().data[0];

    const res = await app.inject({ headers: authHeaders, method: 'GET', url: `/api/v1/schedules/${firstSchedule.id}/runs` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it ('POST /api/v1/schedules/:id/run triggers an immediate run', async () => {
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


  it ('GET /api/v1/schedules/:id returns schedule details', async () => {
    const listRes = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/schedules' });
    const firstSchedule = listRes.json().data[0];

    const res = await app.inject({ headers: authHeaders, method: 'GET', url: `/api/v1/schedules/${firstSchedule.id}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.id).toBe(firstSchedule.id);
    expect(body.data).toHaveProperty('name');
    expect(body.data).toHaveProperty('cron');
    expect(body.data).toHaveProperty('timezone');
    expect(body.data).toHaveProperty('format');
    expect(body.data).toHaveProperty('includeActionItems');
    expect(body.data).toHaveProperty('status');
    expect(body.data).toHaveProperty('totalRuns');
  });
});

describe('Removed promotional program routes', () => {
  it.each([
    '/api/v1/marketplace/extensions',
    '/api/v1/partners',
  ])('does not expose %s', async (url) => {
    const response = await app.inject({ headers: authHeaders, method: 'GET', url });
    expect(response.statusCode).toBe(404);
  });
});
// ==========================================================================
// OpenAPI Routes (3 tests)
// ==========================================================================

describe ('OpenAPI Routes', () => {
  it('GET /api/v1/openapi.json returns valid OpenAPI spec', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/openapi.json' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.openapi).toBe('3.1.0');
    expect(body.info.title).toBe('Recurrsive API');
    expect(body).toHaveProperty('paths');
    expect(body).toHaveProperty('components');
    expect(body).toHaveProperty('tags');
  });

  it ('GET /api/v1/openapi.json contains expected paths', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/openapi.json' });
    const body = res.json();
    expect(body.paths).toHaveProperty('/api/v1/health');
    expect(body.paths).toHaveProperty('/api/v1/findings');
  });

  it ('GET /api/docs redirects to the generated OpenAPI document', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/docs' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/api/v1/openapi.json');
  });
});

// ===========================================================================
// Setup Wizard (4 tests)
// ===========================================================================

describe ('Setup Wizard endpoints', () => {
  it('GET /api/v1/setup/status returns setup status', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/setup/status' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('setupRequired');
    expect(body.data).toHaveProperty('hasUsers');
    expect(typeof body.data.setupRequired).toBe('boolean');
    expect(typeof body.data.hasUsers).toBe('boolean');
  });

  it ('POST /api/v1/setup creates first admin user', async () => {
    // First check if setup is needed (may already have users from prior tests)
    const statusRes = await app.inject({ method: 'GET', url: '/api/v1/setup/status' });
    const { setupRequired } = statusRes.json().data;

    if (setupRequired) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/setup',
        payload: {
          username: 'setup-admin',
          email: 'setup-admin@test.com',
          password: 'secure-password-123',
          displayName: 'Setup Admin',
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.data).toHaveProperty('token');
      expect(body.data).toHaveProperty('user');
      expect(body.data.user.username).toBe('setup-admin');
      expect(body.data.user.role).toBe('admin');
      expect(body).toHaveProperty('message');
    } else {
      // Setup already done — verify 409
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/setup',
        payload: {
          username: 'another-admin',
          email: 'another@test.com',
          password: 'password',
        },
      });
      expect(res.statusCode).toBe(409);
    }
  });

  it ('POST /api/v1/setup returns 409 after setup is complete', async () => {
    // Ensure setup has been done at least once
    const statusRes = await app.inject({ method: 'GET', url: '/api/v1/setup/status' });
    const { setupRequired } = statusRes.json().data;

    if (setupRequired) {
      // Do setup first
      await app.inject({
        method: 'POST',
        url: '/api/v1/setup',
        payload: {
          username: 'first-admin',
          email: 'first@test.com',
          password: 'password-123',
        },
      });
    }

    // Now try again — should be 409
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/setup',
      payload: {
        username: 'duplicate-admin',
        email: 'dup@test.com',
        password: 'strong-password-123',
      },
    });
    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error).toBe('Conflict');
  });

  it ('POST /api/v1/setup returns 400 without required fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/setup',
      payload: { username: 'only-username' },
    });
    // Could be 400 (missing fields) or 409 (already set up)
    expect([400, 409]).toContain(res.statusCode);
  });
});

// ===========================================================================
// User Management (6 tests)
// ===========================================================================

describe ('User Management endpoints', () => {
  it('POST /api/v1/users creates a new user (admin only)', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/users',
      payload: {
        username: 'test-newuser',
        email: 'newuser@test.com',
        password: 'user-password-456',
        role: 'analyst',
        displayName: 'Test New User',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data).toHaveProperty('id');
    expect(body.data.username).toBe('test-newuser');
    expect(body.data.email).toBe('newuser@test.com');
    expect(body.data.role).toBe('analyst');
    expect(body.data.displayName).toBe('Test New User');
    expect(body.data.status).toBe('active');
    // Should NOT contain password fields
    expect(body.data).not.toHaveProperty('passwordHash');
    expect(body.data).not.toHaveProperty('passwordSalt');
  });

  it ('GET /api/v1/users lists all users', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'GET',
      url: '/api/v1/users',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThan(0);
  });

  it ('GET /api/v1/users/:id returns a specific user', async () => {
    // Create user first
    const createRes = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/users',
      payload: {
        username: 'lookup-user',
        email: 'lookup@test.com',
        password: 'password-789',
        role: 'viewer',
      },
    });
    const userId = createRes.json().data.id;

    const res = await app.inject({
      headers: authHeaders,
      method: 'GET',
      url: `/api/v1/users/${userId}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.id).toBe(userId);
    expect(body.data.username).toBe('lookup-user');
  });

  it ('PUT /api/v1/users/:id updates a user', async () => {
    // Create user first
    const createRes = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/users',
      payload: {
        username: 'update-target-user',
        email: 'update-target@test.com',
        password: 'strong-password-123',
        role: 'viewer',
      },
    });
    const userId = createRes.json().data.id;

    const res = await app.inject({
      headers: authHeaders,
      method: 'PUT',
      url: `/api/v1/users/${userId}`,
      payload: { displayName: 'Updated Display Name', role: 'analyst' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.displayName).toBe('Updated Display Name');
    expect(body.data.role).toBe('analyst');
  });

  it ('DELETE /api/v1/users/:id disables a user', async () => {
    // Create user first
    const createRes = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/users',
      payload: {
        username: 'delete-target-user',
        email: 'delete-target@test.com',
        password: 'strong-password-123',
      },
    });
    const userId = createRes.json().data.id;

    const res = await app.inject({
      headers: authHeaders,
      method: 'DELETE',
      url: `/api/v1/users/${userId}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().message).toContain('disabled');
  });

  it ('POST /api/v1/users returns 400 without required fields', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/users',
      payload: { displayName: 'Missing username/email/password' },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('Bad Request');
  });
});

// ===========================================================================
// Store-backed Login (3 tests)
// ===========================================================================

describe ('Store-backed login', () => {
  it('Login works with a store-backed user', async () => {
    // Create a user first
    await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/users',
      payload: {
        username: 'login-test-user',
        email: 'login-test@test.com',
        password: 'my-secure-password',
        role: 'analyst',
      },
    });

    // Now login with those credentials
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        username: 'login-test-user',
        password: 'my-secure-password',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveProperty('token');
    expect(body.data).toHaveProperty('user');
    expect(body.data.user.username).toBe('login-test-user');
    expect(body.data.user.role).toBe('analyst');
  });

  it ('Login still works with demo users in test mode', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        username: 'admin',
        password: 'admin',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveProperty('token');
    expect(body.data.user.username).toBe('admin');
    expect(body.data.user.role).toBe('admin');
  });

  it ('Login fails with wrong password for store-backed user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        username: 'login-test-user',
        password: 'wrong-password',
      },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error).toBe('Unauthorized');
  });
});

// ===========================================================================
// Invite Endpoints (5 tests)
// ===========================================================================

describe ('Invite endpoints', () => {
  let inviteToken: string;
  let inviteId: string;

  it('POST /api/v1/invites creates an invite', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/invites',
      payload: {
        email: 'newuser@recurrsive.dev',
        role: 'analyst',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('token');
    expect(body.data.email).toBe('newuser@recurrsive.dev');
    expect(body.data.role).toBe('analyst');
    expect(body.data.status).toBe('pending');
    inviteToken = body.data.token;
    inviteId = body.data.id;
  });

  it ('GET /api/v1/invites lists all invites', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'GET',
      url: '/api/v1/invites',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThan(0);
  });

  it ('GET /api/v1/invites/:token/validate validates a valid invite', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/invites/${inviteToken}/validate`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.email).toBe('newuser@recurrsive.dev');
    expect(body.data.role).toBe('analyst');
    expect(body.data).toHaveProperty('expiresAt');
  });

  it ('POST /api/v1/invites/:token/accept creates a user and returns token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/invites/${inviteToken}/accept`,
      payload: {
        username: 'invited-user',
        password: 'secure-pass-123',
        displayName: 'Invited User',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data).toHaveProperty('token');
    expect(body.data).toHaveProperty('user');
    expect(body.data.user.username).toBe('invited-user');
    expect(body.data.user.email).toBe('newuser@recurrsive.dev');
    expect(body.data.user.role).toBe('analyst');
  });

  it ('Login works with the invited user credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        username: 'invited-user',
        password: 'secure-pass-123',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveProperty('token');
    expect(body.data.user.username).toBe('invited-user');
    expect(body.data.user.role).toBe('analyst');
  });
});

// ===========================================================================
// Password Change (3 tests)
// ===========================================================================

describe ('Password change endpoint', () => {
  let userId: string;
  let userToken: string;
  let userSequence = 0;

  beforeEach(async () => {
    userSequence += 1;
    const username = `pwd-change-user-${userSequence}`;
    // Create a user to test password change on
    const createRes = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/users',
      payload: {
        username,
        email: `pwdchange-${userSequence}@recurrsive.dev`,
        password: 'old-password-123',
        role: 'viewer',
      },
    });
    userId = createRes.json().data.id;

    // Login to get a JWT token
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        username,
        password: 'old-password-123',
      },
    });
    userToken = loginRes.json().data.token;
  });

  it ('PUT /api/v1/auth/change-password succeeds with correct current password', async () => {
    const res = await app.inject({
      headers: { authorization: `Bearer ${userToken}` },
      method: 'PUT',
      url: '/api/v1/auth/change-password',
      payload: {
        currentPassword: 'old-password-123',
        newPassword: 'new-password-456',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.message).toBe('Password changed successfully');

    const staleSession = await app.inject({
      headers: { authorization: `Bearer ${userToken}` },
      method: 'GET',
      url: '/api/v1/auth/me',
    });
    expect(staleSession.statusCode).toBe(401);
  });

  it ('PUT /api/v1/auth/change-password fails with wrong current password', async () => {
    const res = await app.inject({
      headers: { authorization: `Bearer ${userToken}` },
      method: 'PUT',
      url: '/api/v1/auth/change-password',
      payload: {
        currentPassword: 'wrong-old-password',
        newPassword: 'another-new-pass',
      },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error).toBe('Unauthorized');
    expect(body.message).toBe('Current password is incorrect');
  });

  it ('PUT /api/v1/auth/change-password rejects short new password', async () => {
    const res = await app.inject({
      headers: { authorization: `Bearer ${userToken}` },
      method: 'PUT',
      url: '/api/v1/auth/change-password',
      payload: {
        currentPassword: 'new-password-456',
        newPassword: '123',
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('Bad Request');
    expect(body.message).toContain('at least 12 characters');
  });
});

// ===========================================================================
// Admin Password Reset (2 tests)
// ===========================================================================

describe ('Admin password reset endpoint', () => {
  let targetUserId: string;

  beforeAll(async () => {
    // Create a user for the admin to reset
    const createRes = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/users',
      payload: {
        username: 'reset-target-user',
        email: 'resettarget@recurrsive.dev',
        password: 'original-password',
        role: 'viewer',
      },
    });
    targetUserId = createRes.json().data.id;
  });

  it ('PUT /api/v1/users/:id/reset-password resets the password', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'PUT',
      url: `/api/v1/users/${targetUserId}/reset-password`,
      payload: {
        password: 'admin-reset-password',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.message).toBe('Password has been reset');
    expect(body.data).toHaveProperty('id');
    expect(body.data.username).toBe('reset-target-user');
  });

  it ('User can login with the new password after admin reset', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        username: 'reset-target-user',
        password: 'admin-reset-password',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveProperty('token');
    expect(body.data.user.username).toBe('reset-target-user');
  });
});
