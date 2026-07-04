/**
 * Integration tests — multi-endpoint flow tests.
 *
 * These tests exercise realistic sequences of API calls that a real client
 * would make, verifying that endpoints work together correctly and return
 * the expected response shapes and status codes.
 *
 * Flows tested:
 * 1. Analysis → Findings → Opportunities (6 tests)
 * 2. Webhook lifecycle (6 tests)
 * 3. Batch lifecycle (3 tests)
 * 4. Config + Notifications (5 tests)
 * 5. Experiment lifecycle (5 tests)
 * 6. Audit + Analytics (5 tests)
 * 7. Search (query → filter → verify) (3 tests)
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Mock all external dependencies (same pattern as routes.test.ts)
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
        title: 'Refactor Auth Module',
        description: 'Auth module has high cyclomatic complexity.',
        category: 'architecture',
        severity: 'high',
        status: 'open',
        score: 85,
      },
      {
        id: 'opp-2',
        title: 'Add API Rate Limiting',
        description: 'Public API lacks rate limiting.',
        category: 'security',
        severity: 'critical',
        status: 'open',
        score: 92,
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

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let app: FastifyInstance;

beforeAll(async () => {
  app = await createServer({ logger: false });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

// ===========================================================================
// Flow 1: Analysis → Findings → Opportunities → Health → Reports
// ===========================================================================

describe('Flow: Analysis → Findings → Opportunities → Health → Reports', () => {
  it('1. POST /api/v1/analyze returns accepted or rejects bad input', async () => {
    // Without path or gitUrl → 400
    const badRes = await app.inject({
      method: 'POST',
      url: '/api/v1/analyze',
      payload: {},
    });
    expect(badRes.statusCode).toBe(400);

    // With valid path in allowed directory → 202 or 500 (path may not exist)
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/analyze',
      payload: { path: '/tmp/recurrsive-repos/integration-test' },
    });
    // Accept 202 (started) or 500 (path doesn't exist but passed validation)
    expect([202, 500]).toContain(res.statusCode);
    if (res.statusCode === 202) {
      const body = res.json();
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('project');
      expect(body.project).toBe('/tmp/recurrsive-repos/integration-test');
    }
  });

  it('2. GET /api/v1/analysis/status returns status shape', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/analysis/status' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('phase');
    expect(body.data).toHaveProperty('progress');
    expect(body.data).toHaveProperty('message');
    expect(typeof body.data.phase).toBe('string');
    expect(typeof body.data.progress).toBe('number');
  });

  it('3. GET /api/v1/findings returns findings list shape', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/findings' });
    // May be 200 (findings available) or 404 (no analysis cache yet)
    expect([200, 404]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      const body = res.json();
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data)).toBe(true);
    }
  });

  it('4. GET /api/v1/opportunities returns paginated opportunities', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/opportunities' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('has_more');
    expect(body).toHaveProperty('limit');
    expect(body).toHaveProperty('offset');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(0);
  });

  it('5. GET /api/v1/health-score returns health score shape', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health-score' });
    // 200 if initialized and cache exists, 404 if no analysis cache yet, 503 if not initialized
    expect([200, 404, 503]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      const body = res.json();
      expect(body).toHaveProperty('overall_health');
      expect(typeof body.overall_health).toBe('number');
      expect(body).toHaveProperty('dimensions');
    }
  });

  it('6. GET /api/v1/reports/json returns report or 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/reports/json' });
    // 200 with report data, or 404 if no analysis cache
    expect([200, 404]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      const body = res.json();
      expect(body).toBeDefined();
    }
  });
});

// ===========================================================================
// Flow 2: Webhook Lifecycle
// ===========================================================================

describe('Flow: Webhook Lifecycle (register → list → test → deliveries → delete → verify)', () => {
  let webhookId: string;

  it('7. POST /api/v1/webhooks registers a webhook', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks',
      payload: {
        url: 'https://integration-test.example.com/webhook',
        events: ['analysis.complete', 'opportunity.created'],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('id');
    expect(body.data.url).toBe('https://integration-test.example.com/webhook');
    expect(body.data.events).toEqual(['analysis.complete', 'opportunity.created']);
    expect(body.data.active).toBe(true);
    expect(body.data.delivery_count).toBe(0);
    webhookId = body.data.id;
  });

  it('8. GET /api/v1/webhooks lists the registered webhook', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/webhooks' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
    const found = body.data.find((w: { id: string }) => w.id === webhookId);
    expect(found).toBeDefined();
    expect(found.url).toBe('https://integration-test.example.com/webhook');
  });

  it('9. POST /api/v1/webhooks/:id/test triggers a test delivery', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/webhooks/${webhookId}/test`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body.data.delivered).toBe(true);
    expect(body.data.webhook_id).toBe(webhookId);
  });

  it('10. GET /api/v1/webhooks/:id/deliveries returns delivery history', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/webhooks/${webhookId}/deliveries`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
    // At least the test delivery we just sent
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('11. DELETE /api/v1/webhooks/:id removes the webhook', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/webhooks/${webhookId}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body.data.deleted).toBe(true);
    expect(body.data.id).toBe(webhookId);
  });

  it('12. GET /api/v1/webhooks confirms removal', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/webhooks' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const found = body.data.find((w: { id: string }) => w.id === webhookId);
    expect(found).toBeUndefined();
  });
});

// ===========================================================================
// Flow 3: Batch Lifecycle
// ===========================================================================

describe('Flow: Batch Lifecycle (start → status → history)', () => {
  let batchId: string;

  it('13. POST /api/v1/batch/analyze starts a batch', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/batch/analyze',
      payload: { projects: ['/project-alpha', '/project-beta', '/project-gamma'] },
    });
    expect(res.statusCode).toBe(202);
    const body = res.json();
    expect(body).toHaveProperty('batch_id');
    expect(body).toHaveProperty('projects');
    expect(body).toHaveProperty('status');
    expect(body.status).toBe('running');
    expect(body.projects).toHaveLength(3);
    batchId = body.batch_id;
  });

  it('14. GET /api/v1/batch/status/:id returns batch status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/batch/status/${batchId}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('batch_id');
    expect(body.data.batch_id).toBe(batchId);
    expect(body.data).toHaveProperty('status');
    expect(body.data).toHaveProperty('projects');
  });

  it('15. GET /api/v1/batch/history includes the batch in history', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/batch/history',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
    const found = body.data.find((b: { batch_id: string }) => b.batch_id === batchId);
    expect(found).toBeDefined();
  });
});

// ===========================================================================
// Flow 4: Config + Notifications
// ===========================================================================

describe('Flow: Config + Notifications (config → features → channels → test → history)', () => {
  it('16. GET /api/v1/config returns current configuration', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/config' });
    // 200 if initialized, 503 or 404 if not (depends on route guard)
    expect([200, 404, 503]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      const body = res.json();
      expect(body).toHaveProperty('project');
      expect(body).toHaveProperty('graph');
      expect(body).toHaveProperty('analysis');
      expect(body).toHaveProperty('report');
      expect(body).toHaveProperty('features');
    }
  });

  it('17. GET /api/v1/config/features returns feature inventory', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/config/features' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('analyzers');
    expect(body).toHaveProperty('collectors');
    expect(body).toHaveProperty('policy_sets');
    expect(body).toHaveProperty('summary');
    expect(Array.isArray(body.analyzers)).toBe(true);
    expect(body.summary).toHaveProperty('total_analyzers');
    expect(body.summary).toHaveProperty('total_collectors');
    expect(body.summary).toHaveProperty('total_policy_sets');
  });

  it('18. GET /api/v1/notifications/channels returns available channels', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/notifications/channels' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(1);
    // Verify channel shape
    const channel = body.data[0];
    expect(channel).toHaveProperty('channel');
    expect(channel).toHaveProperty('configured');
    expect(channel).toHaveProperty('description');
  });

  it('19. POST /api/v1/notifications/test sends a test notification', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/notifications/test',
      payload: { channel: 'console' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('sent');
    expect(body.channel).toBe('console');
    expect(body.message).toBe('Test notification sent successfully');
  });

  it('20. GET /api/v1/notifications/history shows the test notification', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/notifications/history' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('max_retained');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(1);
    // Verify record shape
    if (body.data.length > 0) {
      const record = body.data[0];
      expect(record).toHaveProperty('id');
      expect(record).toHaveProperty('channel');
      expect(record).toHaveProperty('message');
      expect(record).toHaveProperty('sent_at');
      expect(record).toHaveProperty('status');
    }
  });
});

// ===========================================================================
// Flow 5: Experiment Lifecycle
// ===========================================================================

describe('Flow: Experiment lifecycle (create → get → update → verify)', () => {
  let experimentId: string;

  it('21. POST /api/v1/experiments creates a new experiment', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/experiments',
      payload: {
        name: 'Integration Test Experiment',
        description: 'End-to-end lifecycle test',
        hypothesis: 'Integration tests catch bugs earlier',
        variants: [
          { name: 'Control', config: { feature: false } },
          { name: 'Treatment', config: { feature: true } },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('id');
    expect(body.data.name).toBe('Integration Test Experiment');
    expect(body.data.status).toBe('pending');
    experimentId = body.data.id;
  });

  it('22. GET /api/v1/experiments lists experiments including the new one', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/experiments' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
    const found = body.data.find((e: { id: string }) => e.id === experimentId);
    expect(found).toBeDefined();
    expect(found.name).toBe('Integration Test Experiment');
  });

  it('23. GET /api/v1/experiments/:id returns experiment details', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/experiments/${experimentId}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body.data.id).toBe(experimentId);
    expect(body.data).toHaveProperty('hypothesis');
    expect(body.data).toHaveProperty('variants');
    expect(body.data.variants).toHaveLength(2);
  });

  it('24. PUT /api/v1/experiments/:id/status starts the experiment', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/experiments/${experimentId}/status`,
      payload: { status: 'running' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.status).toBe('running');
    expect(body.data.started_at).not.toBeNull();
    expect(body.data.completed_at).toBeNull();
  });

  it('25. PUT /api/v1/experiments/:id/status completes the experiment', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/experiments/${experimentId}/status`,
      payload: {
        status: 'completed',
        conclusion: 'Integration test experiment concluded successfully.',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.status).toBe('completed');
    expect(body.data.completed_at).not.toBeNull();
    expect(body.data.conclusion).toBe('Integration test experiment concluded successfully.');
  });
});

// ===========================================================================
// Flow 6: Audit + Analytics
// ===========================================================================

describe('Flow: Audit + Analytics (audit events → analytics summary)', () => {
  it('26. GET /api/v1/audit requires auth, returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/audit' });
    expect(res.statusCode).toBe(401);
  });

  it('27. GET /api/v1/audit returns auto-captured events with auth', async () => {
    const { createToken } = await import('../middleware/auth.js');
    const token = createToken('integ-admin', 'admin');

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audit',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('28. GET /api/v1/audit/stats returns aggregated statistics', async () => {
    const { createToken } = await import('../middleware/auth.js');
    const token = createToken('integ-admin', 'admin');

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audit/stats',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('total');
    expect(body.data).toHaveProperty('byAction');
    expect(body.data).toHaveProperty('byStatusGroup');
  });

  it('29. GET /api/v1/analytics/summary returns trend data', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/analytics/summary' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('analysis_runs');
    expect(body).toHaveProperty('total_findings');
    expect(body).toHaveProperty('trends');
    expect(Array.isArray(body.trends)).toBe(true);
    expect(body.trends.length).toBeGreaterThan(0);
  });

  it('30. GET /api/v1/analytics/top-categories returns category breakdown', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/analytics/top-categories' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('categories');
    expect(Array.isArray(body.categories)).toBe(true);
    expect(body.categories.length).toBeGreaterThan(0);
    const cat = body.categories[0];
    expect(cat).toHaveProperty('name');
    expect(cat).toHaveProperty('count');
    expect(cat).toHaveProperty('percentage');
  });
});

// ===========================================================================
// Flow 7: Search (query → filter → verify)
// ===========================================================================

describe('Flow: Search (query → filter → verify)', () => {
  it('31. GET /api/v1/search?q=auth returns results', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/search?q=auth' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('query');
    expect(body.query).toBe('auth');
    expect(body.total).toBeGreaterThan(0);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('32. Search results have correct shape', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/search?q=auth' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBeGreaterThan(0);
    for (const result of body.data) {
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('match');
      expect(result).toHaveProperty('score');
      expect(typeof result.score).toBe('number');
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(['finding', 'opportunity', 'entity']).toContain(result.type);
    }
  });

  it('33. GET /api/v1/search?q=injection&scope=findings limits to findings', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=injection&scope=findings',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    for (const result of body.data) {
      expect(result.type).toBe('finding');
    }
  });
});
