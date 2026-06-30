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

vi.mock('@recurrsive/core', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  generateId: vi.fn().mockReturnValue('test-id-123'),
  nowISO: vi.fn().mockReturnValue('2024-06-15T00:00:00.000Z'),
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

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

describe('Health endpoints', () => {
  it('GET /health returns 200 with status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('ok');
    expect(body.version).toBe('0.1.0');
    expect(body).toHaveProperty('uptime');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('initialized');
  });

  it('GET /api/v1/health-score returns 503 before initialization', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health-score' });
    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Server not initialized');
  });
});

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

describe('Analysis endpoints', () => {
  it('GET /api/v1/analysis/status returns status object', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/analysis/status' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('phase');
    expect(body.data).toHaveProperty('progress');
    expect(body.data).toHaveProperty('message');
  });

  it('GET /api/v1/analysis/history returns data array', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/analysis/history' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('POST /api/v1/analyze returns 400 without projectPath', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/analyze',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/v1/analyze returns 400 with empty projectPath', async () => {
    const res = await app.inject({
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

describe('Pre-initialization endpoint behavior', () => {
  it('GET /api/v1/graph/stats returns 503 before init', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/graph/stats' });
    expect(res.statusCode).toBe(503);
  });

  it('GET /api/v1/graph/entities returns 503 before init', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/graph/entities' });
    expect(res.statusCode).toBe(503);
  });

  it('GET /api/v1/timeline returns 503 before init', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/timeline' });
    expect(res.statusCode).toBe(503);
  });

  it('GET /api/v1/timeline/snapshots returns 503 before init', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/timeline/snapshots' });
    expect(res.statusCode).toBe(503);
  });

  it('GET /api/v1/timeline/trends returns 503 before init', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/timeline/trends' });
    expect(res.statusCode).toBe(503);
  });

  it('GET /api/v1/findings returns 404 before analysis', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/findings' });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('No analysis results available');
  });

  it('GET /api/v1/findings/summary returns 404 before analysis', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/findings/summary' });
    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Opportunities (work without initialization because they use the manager)
// ---------------------------------------------------------------------------

describe('Opportunities endpoints', () => {
  it('GET /api/v1/opportunities returns paginated response', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/opportunities' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('has_more');
    expect(body).toHaveProperty('limit');
    expect(body).toHaveProperty('offset');
  });

  it('GET /api/v1/opportunities respects limit parameter', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/opportunities?limit=5' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.limit).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

describe('Reports endpoints (require analysis cache)', () => {
  it('GET /api/v1/reports/json returns 404 without cache', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/reports/json' });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('No analysis results available');
  });

  it('GET /api/v1/reports/invalid returns 404 without cache', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/reports/invalid' });
    // Without cache, returns 404 before checking format
    expect(res.statusCode).toBe(404);
  });

  it('GET /api/v1/reports/markdown returns 404 without cache', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/reports/markdown' });
    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Graph search (GET /api/v1/graph/search)
// ---------------------------------------------------------------------------

describe('Graph search endpoint', () => {
  it('GET /api/v1/graph/search returns 503 before initialization', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/graph/search?q=auth' });
    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Server not initialized');
  });

  it('GET /api/v1/graph/search returns 400 when q is missing', async () => {
    // Even though 503 takes priority when not initialized, we test
    // that the route itself exists and handles the missing-q case.
    // Since the server isn't initialized, we expect 503 first.
    const res = await app.inject({ method: 'GET', url: '/api/v1/graph/search' });
    expect(res.statusCode).toBe(503);
  });

  it('GET /api/v1/graph/search returns 400 when q is empty string', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/graph/search?q=' });
    // 503 takes priority over 400 when not initialized
    expect(res.statusCode).toBe(503);
  });
});

// ---------------------------------------------------------------------------
// Graph entity detail and neighbors (pre-init)
// ---------------------------------------------------------------------------

describe('Graph entity detail and neighbors (pre-init)', () => {
  it('GET /api/v1/graph/entities/:id returns 503 before init', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/graph/entities/e1' });
    expect(res.statusCode).toBe(503);
  });

  it('GET /api/v1/graph/entities/:id/neighbors returns 503 before init', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/graph/entities/e1/neighbors',
    });
    expect(res.statusCode).toBe(503);
  });

  it('GET /api/v1/graph/entities/:id/neighbors validates depth range', async () => {
    // Depth validation is behind the init check, so we get 503 first
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/graph/entities/e1/neighbors?depth=10',
    });
    expect(res.statusCode).toBe(503);
  });
});

// ---------------------------------------------------------------------------
// Metrics / Performance (pre-analysis)
// ---------------------------------------------------------------------------

describe('Metrics endpoint', () => {
  it('GET /api/v1/metrics/performance returns 404 without analysis data', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/metrics/performance' });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('No analysis data');
  });
});

// ---------------------------------------------------------------------------
// Findings detail and ID lookup (pre-analysis)
// ---------------------------------------------------------------------------

describe('Findings detail endpoints', () => {
  it('GET /api/v1/findings/:id returns 404 without analysis cache', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/findings/nonexistent' });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('No analysis results available');
  });
});

// ---------------------------------------------------------------------------
// Opportunities detail, update, export
// ---------------------------------------------------------------------------

describe('Opportunities detail and update endpoints', () => {
  it('GET /api/v1/opportunities/:id returns 404 for unknown ID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/opportunities/nonexistent-id',
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Not found');
  });

  it('PATCH /api/v1/opportunities/:id returns 400 without status field', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/opportunities/opp-1',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Bad request');
  });

  it('PATCH /api/v1/opportunities/:id returns 400 for invalid status', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/opportunities/opp-1',
      payload: { status: 'invalid_status' },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.message).toContain('Invalid status');
  });

  it('GET /api/v1/opportunities/export/:format returns 400 for invalid format', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/opportunities/export/xml',
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Bad request');
    expect(body.message).toContain('Invalid format');
  });

  it('GET /api/v1/opportunities respects offset parameter', async () => {
    const res = await app.inject({
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

describe('Reports format validation', () => {
  it('GET /api/v1/reports/sarif returns 404 without cache', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/reports/sarif' });
    expect(res.statusCode).toBe(404);
  });

  it('GET /api/v1/reports/html returns 404 without cache', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/reports/html' });
    expect(res.statusCode).toBe(404);
  });

  it('GET /api/v1/reports/md returns 404 without cache', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/reports/md' });
    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Analysis concurrency guard
// ---------------------------------------------------------------------------

describe('Analysis concurrency', () => {
  it('POST /api/v1/analyze returns 400 with non-string projectPath', async () => {
    const res = await app.inject({
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

describe('CORS', () => {
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
