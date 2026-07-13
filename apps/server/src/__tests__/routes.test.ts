/**
 * API route integration tests.
 *
 * Tests the REST API endpoints by injecting HTTP requests into a real
 * Fastify instance. Dependencies are mocked at the package level.
 *
 * These tests verify:
 * - Correct response shapes for all endpoints
 * - Status codes for success and error cases
 * - Endpoint behavior before and after initialization
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

// Mock all external dependencies before imports
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
    getEntity: vi.fn().mockImplementation(async (id: string) => {
      if (id === 'e1') return { id: 'e1', type: 'module', name: 'auth', qualified_name: 'auth', properties: {} };
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
      getPolicySet: vi.fn().mockImplementation((id: string) =>
        mockPolicySets.find((ps: { id: string }) => ps.id === id),
      ),
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
import { store } from '../store.js';
import type { AnalysisCache } from '../state.js';
import { installProjectScopedInjection, seedTestProject, TEST_PROJECT_ID } from './test-project.js';

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let app: FastifyInstance;

// Shared auth token for tests — routes now require auth middleware
const adminToken = createToken('test-admin', 'admin');
const authHeaders = { authorization: `Bearer ${adminToken}` };
const viewerHeaders = { authorization: `Bearer ${createToken('test-viewer', 'viewer')}` };

beforeAll (async () => {
  const { generateId } = await import('@recurrsive/core');
  let counter = 0;
  (generateId as ReturnType<typeof vi.fn>).mockImplementation(() => `route-id-${++counter}`);
  app = await createServer({ logger: false, rateLimitMax: 200 });
  await app.ready();
  await seedTestProject();
  installProjectScopedInjection(app);
});

afterAll (async () => {
  await app.close();
});

// ---------------------------------------------------------------------------
// Default-deny security boundary
// ---------------------------------------------------------------------------

describe('Default-deny authentication', () => {
  it.each([
    ['GET', '/api/v1/config/features'],
    ['GET', '/api/v1/settings/sections'],
    ['GET', '/api/v1/export/history'],
    ['POST', '/api/v1/export'],
    ['GET', '/api/v1/projects'],
    ['POST', '/api/v1/graphql'],
  ])('rejects unauthenticated %s %s', async (method, url) => {
    const res = await app.inject({
      method: method as 'GET' | 'POST',
      url,
      payload: method === 'POST' ? {} : undefined,
    });
    expect(res.statusCode).toBe(401);
  });

  it.each([
    ['GET', '/health'],
    ['GET', '/api/v1/setup/status'],
    ['GET', '/api/v1/openapi.json'],
    ['GET', '/api/v1/invites/example-token/validate'],
  ])('keeps intentional public endpoint %s %s reachable', async (method, url) => {
    const res = await app.inject({ method: method as 'GET', url });
    expect(res.statusCode).not.toBe(401);
  });

  it('allows invite acceptance to reach token validation without a session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/invites/example-token/accept',
      payload: { username: 'invitee', password: 'strong-password-123' },
    });
    expect(res.statusCode).not.toBe(401);
  });

  it.each([
    '/api/v1/tenants',
    '/api/v1/simulations',
    '/api/v1/pull-requests',
    '/api/v1/plugins/installed',
    '/api/v1/intelligence-packs',
  ]) (
    'does not expose removed synthetic or non-isolated surface %s',
    async (url) => {
      const res = await app.inject({ headers: authHeaders, method: 'GET', url });
      expect(res.statusCode).toBe(404);
    },
  );
});

describe('Project isolation boundary', () => {
  it('never returns another project’s analysis cache', async () => {
    const isolatedProjectId = 'isolated-project';
    await seedTestProject(isolatedProjectId);
    await store.set<AnalysisCache>('analysis_cache', isolatedProjectId, {
      findings: [{
        id: 'isolated-finding',
        title: 'Only visible in isolated project',
        severity: 'high',
        category: 'security',
        analyzer_id: 'security.vulnerabilities',
      }] as AnalysisCache['findings'],
      opportunities: [],
      consensus: null,
      analyzedAt: '2024-06-15T00:00:00.000Z',
      durationMs: 10,
    });

    const defaultScope = await app.inject({
      headers: authHeaders,
      method: 'GET',
      url: '/api/v1/findings',
    });
    expect(defaultScope.statusCode).toBe(404);

    const isolatedScope = await app.inject({
      headers: authHeaders,
      method: 'GET',
      url: `/api/v1/findings?projectId=${isolatedProjectId}`,
    });
    expect(isolatedScope.statusCode).toBe(200);
    expect(isolatedScope.json().data.map((finding: { id: string }) => finding.id)).toEqual(['isolated-finding']);

    const missingScope = await app.inject({
      headers: authHeaders,
      method: 'GET',
      url: '/api/v1/findings?projectId=unknown-project',
    });
    expect(missingScope.statusCode).toBe(404);
  });

  it('adds project-scoped workflow state to project finding rows', async () => {
    const projectId = 'workflow-project';
    const findingId = '5144a953-a9b2-4dd7-8cd4-fa1c4e7bc36a';
    await seedTestProject(projectId);
    await store.set<AnalysisCache>('analysis_cache', projectId, {
      findings: [{
        id: findingId,
        title: 'Workflow finding',
        severity: 'high',
        category: 'security',
        analyzer_id: 'security.vulnerabilities',
      }] as AnalysisCache['findings'],
      opportunities: [],
      consensus: null,
      analyzedAt: '2024-06-15T00:00:00.000Z',
      durationMs: 10,
    });
    await store.set('finding_states', projectId, {
      [findingId]: { status: 'resolved', assignee: 'alice', updatedAt: '2024-06-15T00:00:00.000Z' },
    });

    const response = await app.inject({
      headers: authHeaders,
      method: 'GET',
      url: `/api/v1/projects/${projectId}/findings`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data[0]).toMatchObject({ id: findingId, status: 'resolved', assignee: 'alice' });
  });
});

describe('Public submissions', () => {
  it('persists a valid contact message without requiring an account', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/contact',
      payload: {
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        company: 'Analytical Engines',
        subject: 'Technical Support',
        message: 'Please help us evaluate a production deployment.',
        website: '',
      },
    });
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.payload).data.id).toBeTruthy();
  });

  it('validates public contact input', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/contact',
      payload: { name: '', email: 'invalid', message: 'short' },
    });
    expect(res.statusCode).toBe(400);
  });

});

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

describe ('Health endpoints', () => {
  it('GET /health returns 200 with status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('ok');
    expect(body.version).toBeDefined();
    expect(body).toHaveProperty('uptime');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('initialized');
  });

  it ('GET /api/v1/health-score returns an empty score before analysis', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/health-score' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.overall).toBe(0);
    expect(body.data.finding_count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

describe ('Analysis endpoints', () => {
  it('GET /api/v1/analysis/status returns status object', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/analysis/status' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('phase');
    expect(body.data).toHaveProperty('progress');
    expect(body.data).toHaveProperty('message');
  });

  it ('GET /api/v1/analysis/history returns data array', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/analysis/history' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it ('POST /api/v1/analyze returns 400 without projectPath', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/analyze',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it ('POST /api/v1/analyze returns 400 with empty projectPath', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/analyze',
      payload: { projectPath: '' },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Pre-initialization gates (timeline, graph, findings, reports → 503/404)
// ---------------------------------------------------------------------------

describe ('Registered project before its first analysis', () => {
  it('GET /api/v1/graph/stats returns empty graph statistics', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/graph/stats' });
    expect(res.statusCode).toBe(200);
  });

  it ('GET /api/v1/graph/entities returns an empty result', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/graph/entities' });
    expect(res.statusCode).toBe(200);
  });

  it ('GET /api/v1/timeline returns an empty project timeline', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/timeline' });
    expect(res.statusCode).toBe(200);
  });

  it ('GET /api/v1/timeline/snapshots returns an empty snapshot list', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/timeline/snapshots' });
    expect(res.statusCode).toBe(200);
  });

  it ('GET /api/v1/timeline/trends returns an empty trend series', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/timeline/trends' });
    expect(res.statusCode).toBe(200);
  });

  it ('GET /api/v1/findings returns 404 before analysis', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/findings' });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('No analysis results available');
  });

  it ('GET /api/v1/findings/summary returns 404 before analysis', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/findings/summary' });
    expect(res.statusCode).toBe(404);
  });

  it ('POST /api/v1/policies/evaluate returns a valid empty evaluation', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/policies/evaluate',
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.summary.total).toBe(0);
  });

  it ('GET /api/v1/policies/compliance returns full compliance for no opportunities', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'GET',
      url: '/api/v1/policies/compliance',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.compliance_rate).toBe(100);
  });

  it ('GET /api/v1/snapshots/export returns an empty project snapshot', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'GET',
      url: '/api/v1/snapshots/export',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('version');
  });

  it ('GET /api/v1/analysis/compare requires explicit run IDs', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'GET',
      url: '/api/v1/analysis/compare',
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Bad Request');
  });
});

// ---------------------------------------------------------------------------
// Opportunities (work without initialization because they use the manager)
// ---------------------------------------------------------------------------

describe ('Opportunities endpoints', () => {
  it('GET /api/v1/opportunities returns paginated response', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/opportunities' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('has_more');
    expect(body).toHaveProperty('limit');
    expect(body).toHaveProperty('offset');
  });

  it ('GET /api/v1/opportunities respects limit parameter', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/opportunities?limit=5' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.limit).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

describe('Reports endpoints (require analysis cache)', async () => {
  it('GET /api/v1/reports/json returns 404 without cache', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/reports/json' });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('No analysis results available');
  });

  it ('GET /api/v1/reports/invalid returns 404 without cache', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/reports/invalid' });
    // Without cache, returns 404 before checking format
    expect(res.statusCode).toBe(404);
  });

  it ('GET /api/v1/reports/markdown returns 404 without cache', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/reports/markdown' });
    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Graph search (GET /api/v1/graph/search)
// ---------------------------------------------------------------------------

describe ('Graph search endpoint', () => {
  it('GET /api/v1/graph/search searches the scoped graph', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/graph/search?q=auth' });
    expect(res.statusCode).toBe(200);
  });

  it ('GET /api/v1/graph/search returns 400 when q is missing', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/graph/search' });
    expect(res.statusCode).toBe(400);
  });

  it ('GET /api/v1/graph/search returns 400 when q is empty string', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/graph/search?q=' });
    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Graph entity detail and neighbors (pre-init)
// ---------------------------------------------------------------------------

describe('Graph entity detail and neighbors', async () => {
  it('GET /api/v1/graph/entities/:id returns a scoped entity', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/graph/entities/e1' });
    expect(res.statusCode).toBe(200);
  });

  it ('GET /api/v1/graph/entities/:id/neighbors returns its neighborhood', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'GET',
      url: '/api/v1/graph/entities/e1/neighbors',
    });
    expect(res.statusCode).toBe(200);
  });

  it ('GET /api/v1/graph/entities/:id/neighbors validates depth range', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'GET',
      url: '/api/v1/graph/entities/e1/neighbors?depth=10',
    });
    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Metrics / Performance (pre-analysis)
// ---------------------------------------------------------------------------

describe ('Metrics endpoint', () => {
  it('GET /api/v1/metrics/performance returns 404 without analysis data', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/metrics/performance' });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('No analysis data');
  });
});

// ---------------------------------------------------------------------------
// Findings detail and ID lookup (pre-analysis)
// ---------------------------------------------------------------------------

describe ('Findings detail endpoints', () => {
  it('GET /api/v1/findings/:id returns 404 without analysis cache', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/findings/nonexistent' });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('No analysis results available');
  });
});

// ---------------------------------------------------------------------------
// Opportunities detail, update, export
// ---------------------------------------------------------------------------

describe ('Opportunities detail and update endpoints', () => {
  it('GET /api/v1/opportunities/:id returns 404 for unknown ID', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'GET',
      url: '/api/v1/opportunities/nonexistent-id',
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Not found');
  });

  it ('PATCH /api/v1/opportunities/:id returns 400 without status field', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'PATCH',
      url: '/api/v1/opportunities/opp-1',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Bad request');
  });

  it ('PATCH /api/v1/opportunities/:id returns 400 for invalid status', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'PATCH',
      url: '/api/v1/opportunities/opp-1',
      payload: { status: 'invalid_status' },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.message).toContain('Invalid status');
  });

  it ('GET /api/v1/opportunities/export/:format returns 400 for invalid format', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'GET',
      url: '/api/v1/opportunities/export/xml',
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Bad request');
    expect(body.message).toContain('Invalid format');
  });

  it ('GET /api/v1/opportunities respects offset parameter', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'GET',
      url: '/api/v1/opportunities?offset=10',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.offset).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Reports format validation
// ---------------------------------------------------------------------------

describe ('Reports format validation', () => {
  it('GET /api/v1/reports/sarif returns 404 without cache', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/reports/sarif' });
    expect(res.statusCode).toBe(404);
  });

  it ('GET /api/v1/reports/html returns 404 without cache', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/reports/html' });
    expect(res.statusCode).toBe(404);
  });

  it ('GET /api/v1/reports/md returns 404 without cache', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/reports/md' });
    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Analysis concurrency guard
// ---------------------------------------------------------------------------

describe ('Analysis concurrency', () => {
  it('POST /api/v1/analyze returns 400 with non-string projectPath', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/analyze',
      payload: { path: 123 },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Policies (work without initialization for listing, require init for eval)
// ---------------------------------------------------------------------------

describe ('Policy endpoints', () => {
  it('GET /api/v1/policies returns policy list with data and total', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/policies' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('builtin_count');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(0);
  });

  it ('GET /api/v1/policies returns individual rules within policy sets', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/policies' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    if (body.data.length > 0) {
      const first = body.data[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('enabled');
      expect(first).toHaveProperty('rules');
      expect(Array.isArray(first.rules)).toBe(true);
      if (first.rules.length > 0) {
        const rule = first.rules[0];
        expect(rule).toHaveProperty('id');
        expect(rule).toHaveProperty('name');
        expect(rule).toHaveProperty('scope');
        expect(rule).toHaveProperty('action');
        expect(rule).toHaveProperty('condition');
      }
    }
  });

  it('POST /api/v1/policies/evaluate returns compliance results when initialized', async () => {
    // Initialize the server state
    const { state } = await import('../state.js');
    await state.initialize('/tmp/test-policy-project', 'Test Project', TEST_PROJECT_ID);

    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/policies/evaluate',
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('results');
    expect(body.data).toHaveProperty('summary');
    expect(body.data.summary).toHaveProperty('total');
    expect(body.data.summary).toHaveProperty('passed');
    expect(body.data.summary).toHaveProperty('compliance_rate');
  });

  it ('GET /api/v1/policies/compliance returns compliance rate when initialized', async () => {
    // state was initialized in a previous test
    const res = await app.inject({
      headers: authHeaders,
      method: 'GET',
      url: '/api/v1/policies/compliance',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('total_opportunities');
    expect(body.data).toHaveProperty('compliant');
    expect(body.data).toHaveProperty('blocked');
    expect(body.data).toHaveProperty('compliance_rate');
    expect(body.data).toHaveProperty('policy_sets_active');
  });
});

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------

describe ('Snapshot endpoints', () => {
  it('GET /api/v1/snapshots/export returns snapshot data when initialized', async () => {
    // state was initialized in the policies test
    const res = await app.inject({
      headers: authHeaders,
      method: 'GET',
      url: '/api/v1/snapshots/export',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('exported_at');
    expect(body).toHaveProperty('project');
    expect(body).toHaveProperty('entities');
    expect(body).toHaveProperty('relationships');
    expect(body).toHaveProperty('stats');
  });

  it ('POST /api/v1/snapshots/import validates body', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/snapshots/import',
      payload: { invalid: true },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Bad request');
    expect(body.message).toContain('entities');
  });

  it ('GET /api/v1/analysis/compare returns 404 for unknown run IDs', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'GET',
      url: '/api/v1/analysis/compare?run_a=missing-a&run_b=missing-b',
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Not Found');
  });
});

// ---------------------------------------------------------------------------
// Webhooks (use in-memory store — no initialization required)
// ---------------------------------------------------------------------------

describe ('Webhook endpoints', () => {
  it('GET /api/v1/webhooks returns empty list initially', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/webhooks' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it ('POST /api/v1/webhooks creates a webhook with valid data', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/webhooks',
      payload: {
        url: 'https://example.com/hook',
        events: ['analysis.complete', 'policy.violation'],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('id');
    expect(body.data.url).toBe('https://example.com/hook');
    expect(body.data.events).toEqual(['analysis.complete', 'policy.violation']);
    expect(body.data.active).toBe(true);
    expect(body.data.delivery_count).toBe(0);
  });

  it ('POST /api/v1/webhooks returns 400 for missing url', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/webhooks',
      payload: {
        events: ['analysis.complete'],
      },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Invalid request');
    expect(body.message).toContain('url');
  });

  it('POST /api/v1/webhooks rejects private and alternate loopback destinations', async () => {
    for (const target of ['http://localhost/hook', 'http://169.254.169.254/hook', 'http://2130706433/hook']) {
      const res = await app.inject({
        headers: authHeaders,
        method: 'POST',
        url: '/api/v1/webhooks',
        payload: { url: target, events: ['analysis.complete'] },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().message).toMatch(/private|reserved|internal/i);
    }
  });

  it ('POST /api/v1/webhooks returns 400 for missing events', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/webhooks',
      payload: {
        url: 'https://example.com/hook',
      },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Invalid request');
    expect(body.message).toContain('events');
  });

  it ('POST /api/v1/webhooks returns 400 for invalid event types', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/webhooks',
      payload: {
        url: 'https://example.com/hook',
        events: ['invalid.event'],
      },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Invalid events');
    expect(body.message).toContain('invalid.event');
    expect(body).toHaveProperty('valid_events');
  });

  it ('GET /api/v1/webhooks/events returns all supported event types', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/webhooks/events' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(7);
    const eventNames = body.data.map((e: { event: string }) => e.event);
    expect(eventNames).toContain('analysis.complete');
    expect(eventNames).toContain('analysis.failed');
    expect(eventNames).toContain('opportunity.created');
    expect(eventNames).toContain('opportunity.updated');
    expect(eventNames).toContain('policy.violation');
    expect(eventNames).toContain('health.degraded');
    expect(eventNames).toContain('snapshot.created');
  });

  it ('DELETE /api/v1/webhooks/:id returns 404 for unknown ID', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'DELETE',
      url: '/api/v1/webhooks/wh_nonexistent',
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Not found');
  });

  it ('POST /api/v1/webhooks/:id/test returns 404 for unknown ID', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/webhooks/wh_nonexistent/test',
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Not found');
  });

  it ('PATCH /api/v1/webhooks/:id returns 404 for unknown ID', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'PATCH',
      url: '/api/v1/webhooks/wh_nonexistent',
      payload: { active: false },
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Not found');
  });

  it ('GET /api/v1/webhooks/:id/deliveries returns 404 for unknown ID', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'GET',
      url: '/api/v1/webhooks/wh_nonexistent/deliveries',
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Not found');
  });
});

// ---------------------------------------------------------------------------
// Config endpoints
// ---------------------------------------------------------------------------

describe ('Config endpoints', () => {
  it('GET /api/v1/config returns effective project and runtime configuration', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/config' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('project');
    expect(body.data).toHaveProperty('graph');
    expect(body.data).toHaveProperty('analysis');
    expect(body.data).toHaveProperty('report');
    expect(body.data.project).toHaveProperty('root');
    expect(body.data.graph).toHaveProperty('provider');
    expect(body.data.graph.isolatedByProject).toBe(true);
  });

  it ('GET /api/v1/config/features returns the project analyzer and collector inventory', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/config/features' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('analyzers');
    expect(body.data).toHaveProperty('collectors');
    expect(body.data).toHaveProperty('summary');
    expect(Array.isArray(body.data.analyzers)).toBe(true);
    expect(Array.isArray(body.data.collectors)).toBe(true);
  });

  it ('GET /api/v1/config/features includes correct counts', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/config/features' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.summary.enabled_analyzers).toBe(13);
    expect(body.data.summary.enabled_collectors).toBe(5);
  });

  it ('PATCH /api/v1/config updates the supported platform default', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'PATCH',
      url: '/api/v1/config',
      payload: { enable_reasoning: false },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('message');
    expect(body.data.enable_reasoning).toBe(false);
    expect(body.message).toContain('Platform defaults updated');
  });

  it ('PATCH /api/v1/config returns 400 for an invalid default type', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'PATCH',
      url: '/api/v1/config',
      payload: { enable_reasoning: 'yes' },
    });
    expect(res.statusCode).toBe(400);
  });

  it ('PATCH /api/v1/config rejects report format as a fake runtime override', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'PATCH',
      url: '/api/v1/config',
      payload: { reportFormat: 'xml' },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Bad Request');
  });

  it ('PATCH /api/v1/config rejects project analyzers as a platform override', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'PATCH',
      url: '/api/v1/config',
      payload: { enabledAnalyzers: ['nonexistent.analyzer'] },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Bad Request');
  });

  it ('PATCH /api/v1/config rejects process-level graph provider changes', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'PATCH',
      url: '/api/v1/config',
      payload: { graphProvider: 'postgresql_age' },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Notifications (use in-memory store — no initialization required)
// ---------------------------------------------------------------------------

describe ('Notification endpoints', () => {
  it('GET /api/v1/notifications/channels returns available channels', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/notifications/channels' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBe(3);
    const channelNames = body.data.map((c: { channel: string }) => c.channel);
    expect(channelNames).toContain('console');
    expect(channelNames).toContain('slack');
    expect(channelNames).toContain('http');
  });

  it ('GET /api/v1/notifications/channels includes configuration status', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/notifications/channels' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    const consoleChannel = body.data.find((c: { channel: string }) => c.channel === 'console');
    expect(consoleChannel).toBeDefined();
    expect(consoleChannel.configured).toBe(true);
    expect(consoleChannel).toHaveProperty('description');
    expect(consoleChannel).toHaveProperty('config_hint');
  });

  it ('POST /api/v1/notifications/test sends a test notification', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/notifications/test',
      payload: { channel: 'console' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('sent');
    expect(body.channel).toBe('console');
    expect(body.message).toBe('Test notification sent successfully');
  });

  it ('POST /api/v1/notifications/test returns 400 for missing channel', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/notifications/test',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toMatch(/Bad Request|Invalid request/);
    expect(body.message).toContain('channel');
  });

  it('POST /api/v1/notifications/test rejects private HTTP destinations', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/notifications/test',
      payload: { channel: 'http', config: { url: 'http://127.0.0.1/admin' } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/private|reserved|internal/i);
  });

  it ('POST /api/v1/notifications/test returns 400 for invalid channel', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/notifications/test',
      payload: { channel: 'sms' },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    // Fastify schema validation rejects 'sms' before the handler runs,
    // so we may get either schema or handler error format.
    expect(body.error).toMatch(/Bad Request|Invalid channel/);
  });

  it ('GET /api/v1/notifications/history returns notification records', async () => {
    // We sent a test notification above, so history should have at least 1 entry
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/notifications/history' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('max_retained');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.max_retained).toBe(50);
  });

  it ('GET /api/v1/notifications/history records include expected fields', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/notifications/history' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    if (body.data.length > 0) {
      const entry = body.data[0];
      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('channel');
      expect(entry).toHaveProperty('message');
      expect(entry).toHaveProperty('sent_at');
      expect(entry).toHaveProperty('status');
    }
  });
});

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------


describe ('CORS', () => {
  it('includes CORS headers on responses', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'http://localhost:3001' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });
});

describe('global authorization baseline', () => {
  it('allows viewers to read authenticated resources', async () => {
    const res = await app.inject({ headers: viewerHeaders, method: 'GET', url: '/api/v1/projects' });
    expect(res.statusCode).toBe(200);
  });

  it('prevents viewers from mutating project data', async () => {
    const res = await app.inject({
      headers: viewerHeaders,
      method: 'POST',
      url: '/api/v1/projects',
      payload: { name: 'unauthorized', repository: '/app/unauthorized' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('requires administrators for security configuration mutations', async () => {
    const analystHeaders = { authorization: `Bearer ${createToken('test-analyst', 'analyst')}` };
    const res = await app.inject({
      headers: analystHeaders,
      method: 'PATCH',
      url: '/api/v1/config',
      payload: { enable_reasoning: true },
    });
    expect(res.statusCode).toBe(403);
  });

  it.each([
    ['/api/v1/webhooks', { url: 'https://example.com/hook', events: ['analysis.complete'] }],
    ['/api/v1/notifications/test', { channel: 'console' }],
  ])('requires administrators for governance mutation %s', async (url, payload) => {
    const analystHeaders = { authorization: `Bearer ${createToken('test-analyst', 'analyst')}` };
    const res = await app.inject({ headers: analystHeaders, method: 'POST', url, payload });
    expect(res.statusCode).toBe(403);
  });
});

describe('WebSocket authentication tickets', () => {
  it('requires authentication to issue a ticket', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/ws-ticket' });
    expect(res.statusCode).toBe(401);
  });

  it('issues a short-lived opaque ticket without returning the JWT', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'POST', url: '/api/v1/auth/ws-ticket' });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.ticket).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(body.data.ticket).not.toContain(adminToken);
    expect(body.data.expiresAt).toBeGreaterThan(Date.now());
  });
});

describe ('Batch endpoints', () => {
  it('POST /api/v1/batch/analyze returns 400 without projectIds', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/batch/analyze',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBeDefined();
  });

  it ('POST /api/v1/batch/analyze returns 400 with empty projectIds', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/batch/analyze',
      payload: { projectIds: [] },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/v1/batch/analyze returns 400 with more than 100 projects', async () => {
    const projectIds = Array.from({ length: 101 }, (_, i) => `project-${i}`);
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/batch/analyze',
      payload: { projectIds },
    });
    expect(res.statusCode).toBe(400);
  });

  it ('POST /api/v1/batch/analyze returns 202 with valid projects', async () => {
    const ids: string[] = [];
    for (const name of ['batch-a', 'batch-b']) {
      const created = await app.inject({
        headers: authHeaders,
        method: 'POST',
        url: '/api/v1/projects',
        payload: { name, repository: `/app/${name}` },
      });
      ids.push(created.json().data.id);
    }
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/batch/analyze',
      payload: { projectIds: ids },
    });
    expect(res.statusCode).toBe(202);
    const body = res.json();
    expect(body.batch_id).toBeDefined();
    expect(body.projects).toHaveLength(2);
    expect(body.status).toBe('pending');
  });

  it ('GET /api/v1/batch/status/:id returns 404 for unknown batch', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'GET',
      url: '/api/v1/batch/status/nonexistent',
    });
    expect(res.statusCode).toBe(404);
  });

  it ('GET /api/v1/batch/history returns array', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'GET',
      url: '/api/v1/batch/history',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeInstanceOf(Array);
    expect(body.total).toBeTypeOf('number');
  });
});

// ---------------------------------------------------------------------------
// Audit Routes
// ---------------------------------------------------------------------------

describe ('Audit Routes', () => {
  it('GET /api/v1/audit requires authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/audit' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/v1/audit returns audit events with auth', async () => {
    // Import createToken to generate a valid JWT for testing
    const { createToken } = await import('../middleware/auth.js');
    const token = createToken('test-admin', 'admin');

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audit',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET /api/v1/audit respects limit param', async () => {
    const { createToken } = await import('../middleware/auth.js');
    const token = createToken('test-admin', 'admin');

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audit?limit=3',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.length).toBeLessThanOrEqual(3);
  });

  it('GET /api/v1/audit/stats returns audit statistics', async () => {
    const { createToken } = await import('../middleware/auth.js');
    const token = createToken('test-admin', 'admin');

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audit/stats',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('total');
    expect(body.data).toHaveProperty('byAction');
    expect(body.data).toHaveProperty('byStatusGroup');
  });
});

// ---------------------------------------------------------------------------
// Analytics Routes
// ---------------------------------------------------------------------------

describe ('Analytics Routes', () => {
  it('GET /api/v1/analytics/summary returns summary', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/analytics/summary' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('analysis_runs');
    expect(body.data).toHaveProperty('total_findings');
    expect(body.data).toHaveProperty('findings_resolved');
    expect(body.data).toHaveProperty('resolution_rate');
    expect(body.data).toHaveProperty('avg_health_score');
    expect(body.data).toHaveProperty('trends');
  });

  it ('GET /api/v1/analytics/summary has correct shape', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/analytics/summary' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data.trends)).toBe(true);
    expect(typeof body.data.analysis_runs).toBe('number');
    expect(typeof body.data.total_findings).toBe('number');
    expect(typeof body.data.resolution_rate).toBe('number');
    expect(typeof body.data.avg_health_score).toBe('number');
  });

  it ('GET /api/v1/analytics/top-categories returns categories', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/analytics/top-categories' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it ('GET /api/v1/analytics/top-categories returns valid array', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/analytics/top-categories' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    // When no analysis data exists, the array is empty
    if (body.data.length > 0) {
      const cat = body.data[0];
      expect(typeof cat.name).toBe('string');
      expect(typeof cat.count).toBe('number');
      expect(typeof cat.percentage).toBe('number');
    }
  });
});

// ---------------------------------------------------------------------------
// Experiment Routes
// ---------------------------------------------------------------------------

describe ('Experiment Routes', () => {
  const experimentPayload = (name: string) => ({
    name,
    description: 'Created from route test',
    hypothesis: 'Different analyzer sets produce measurable results',
    variants: [
      {
        name: 'Control',
        analyzers: ['architecture.structural'],
        collectors: ['git'],
        includeReasoning: false,
      },
      {
        name: 'Treatment',
        analyzers: ['architecture.structural', 'security.vulnerabilities'],
        collectors: ['git'],
        includeReasoning: true,
      },
    ],
  });

  it('GET /api/v1/experiments returns experiment list with data array', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/experiments' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
    // No seed data, so total may be 0
    expect(body.total).toBeGreaterThanOrEqual(0);
  });

  it ('GET /api/v1/experiments respects status filter', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/experiments?status=completed' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.data)).toBe(true);
    for (const exp of body.data) {
      expect(exp.status).toBe('completed');
    }
  });

  it ('POST /api/v1/experiments creates a new experiment', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/experiments',
      payload: experimentPayload('Route Test Experiment'),
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('id');
    expect(body.data.name).toBe('Route Test Experiment');
    expect(body.data.status).toBe('pending');
    expect(body.data.variants).toHaveLength(2);
    expect(body.data.metrics).toEqual([]);
    expect(body.data.startedAt).toBeNull();
    expect(body.data.completedAt).toBeNull();
    expect(body.data.conclusion).toBeNull();
  });

  it ('POST /api/v1/experiments validates required fields', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/experiments',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Bad Request');
    expect(body.message).toContain('name');
  });

  it ('GET /api/v1/experiments/:id returns single experiment', async () => {
    const created = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/experiments',
      payload: experimentPayload('Experiment Detail'),
    });
    const id = created.json().data.id;
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: `/api/v1/experiments/${id}` });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(body.data.id).toBe(id);
    expect(body.data).toHaveProperty('name');
    expect(body.data).toHaveProperty('description');
    expect(body.data).toHaveProperty('status');
    expect(body.data).toHaveProperty('hypothesis');
    expect(body.data).toHaveProperty('variants');
    expect(body.data).toHaveProperty('metrics');
    expect(body.data).toHaveProperty('createdAt');
  });

  it ('GET /api/v1/experiments/:id returns 404 for unknown ID', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/experiments/exp_nonexistent' });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Not Found');
    expect(body.message).toContain('not found');
  });

  it ('POST /api/v1/experiments/:id/run starts real variant analysis', async () => {
    const createRes = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/experiments',
      payload: experimentPayload('Run Test'),
    });
    const expId = JSON.parse(createRes.payload).data.id;

    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: `/api/v1/experiments/${expId}/run`,
    });
    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(body.data.status).toBe('running');
    expect(body.data.startedAt).not.toBeNull();

    let finalStatus = body.data.status as string;
    for (let attempt = 0; attempt < 100 && finalStatus === 'running'; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      const statusResponse = await app.inject({
        headers: authHeaders,
        method: 'GET',
        url: `/api/v1/experiments/${expId}`,
      });
      finalStatus = statusResponse.json().data.status;
    }
    expect(['completed', 'failed']).toContain(finalStatus);
  });

  it ('DELETE /api/v1/experiments/:id removes a pending experiment', async () => {
    const createRes = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/experiments',
      payload: experimentPayload('Delete Test'),
    });
    const expId = JSON.parse(createRes.payload).data.id;

    const res = await app.inject({
      headers: authHeaders,
      method: 'DELETE',
      url: `/api/v1/experiments/${expId}`,
    });
    expect(res.statusCode).toBe(204);
  });
});

// ---------------------------------------------------------------------------
// Export Routes
// ---------------------------------------------------------------------------

describe ('Export Routes', () => {
  it('POST /api/v1/export creates export', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/export',
      payload: { format: 'json', scope: 'findings' },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('export_id');
    expect(body.data.format).toBe('json');
    expect(body.data.scope).toBe('findings');
    expect(body.data.status).toBe('completed');
    expect(body.data).toHaveProperty('download_url');
    expect(body.data).toHaveProperty('record_count');
    expect(body.data).toHaveProperty('generated_at');
  });

  it ('POST /api/v1/export validates format', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/export',
      payload: { format: 'xml', scope: 'findings' },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Invalid format');
  });

  it ('POST /api/v1/export validates scope', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/export',
      payload: { format: 'json', scope: 'invalid' },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Invalid scope');
  });

  it ('GET /api/v1/export/:id/download returns content', async () => {
    // First create an export to get an ID
    const createRes = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/export',
      payload: { format: 'json', scope: 'findings' },
    });
    const { data } = JSON.parse(createRes.payload);
    const export_id = data.export_id;

    const res = await app.inject({
      headers: authHeaders,
      method: 'GET',
      url: `/api/v1/export/${export_id}/download`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.payload.length).toBeGreaterThan(0);
  });

  it ('GET /api/v1/export/history returns list', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'GET',
      url: '/api/v1/export/history',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThan(0);
  });

  it ('POST /api/v1/export with filters works', async () => {
    const res = await app.inject({
      headers: authHeaders,
      method: 'POST',
      url: '/api/v1/export',
      payload: {
        format: 'csv',
        scope: 'all',
        filters: { severity: 'high', category: 'security' },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.data.format).toBe('csv');
    expect(body.data.scope).toBe('all');
  });
});

// ---------------------------------------------------------------------------
// Search Routes
// ---------------------------------------------------------------------------

describe ('Search Routes', () => {
  it('GET /api/v1/search returns results for valid query', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/search?q=auth' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('query');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThan(0);
    expect(body.query).toBe('auth');
  });

  it ('GET /api/v1/search returns 400 without query param', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/search' });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Bad request');
    expect(body.message).toContain('q');
  });

  it('GET /api/v1/search filters by scope (findings, opportunities, entities)', async () => {
    const findingsRes = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/search?q=a&scope=findings' });
    expect(findingsRes.statusCode).toBe(200);
    const findingsBody = JSON.parse(findingsRes.payload);
    for (const r of findingsBody.data) {
      expect(r.type).toBe('finding');
    }

    const oppsRes = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/search?q=a&scope=opportunities' });
    expect(oppsRes.statusCode).toBe(200);
    const oppsBody = JSON.parse(oppsRes.payload);
    for (const r of oppsBody.data) {
      expect(r.type).toBe('opportunity');
    }

    const entitiesRes = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/search?q=a&scope=entities' });
    expect(entitiesRes.statusCode).toBe(200);
    const entitiesBody = JSON.parse(entitiesRes.payload);
    for (const r of entitiesBody.data) {
      expect(r.type).toBe('entity');
    }
  });

  it ('GET /api/v1/search returns empty array for non-matching query', async () => {
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/search?q=zzzznonexistent' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);
  });

  it ('GET /api/v1/search returns empty when no analysis data is available', async () => {
    // With no analysis run, search returns empty results (no seed/mock data)
    const res = await app.inject({ headers: authHeaders, method: 'GET', url: '/api/v1/search?q=notification' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('query', 'notification');
    expect(Array.isArray(body.data)).toBe(true);
    // No seed data — results may be empty when state is not initialized
    expect(body.total).toBe(body.data.length);
  });
});
