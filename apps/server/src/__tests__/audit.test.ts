/**
 * Audit middleware and route tests.
 *
 * Tests cover action classification, resource extraction, circular buffer
 * behaviour, user info capture, duration tracking, audit event querying
 * with filters, and aggregated statistics.
 *
 * Route tests use Fastify's `inject()` against a real server instance.
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Fastify from 'fastify';

// ---------------------------------------------------------------------------
// Mock @recurrsive/core BEFORE any app imports
// ---------------------------------------------------------------------------

let idCounter = 0;

vi.mock('@recurrsive/core', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  generateId: vi.fn(() => `audit-id-${++idCounter}`),
  nowISO: vi.fn(() => '2026-07-01T12:00:00.000Z'),
}));

// ---------------------------------------------------------------------------
// Imports under test
// ---------------------------------------------------------------------------

import {
  registerAuditMiddleware,
  classifyAction,
  extractResource,
  getAuditEvents,
  getAuditStats,
  clearAuditEvents,
  getAuditBuffer,
} from '../middleware/audit.js';
import type { AuditEvent, AuditAction } from '../middleware/audit.js';
import { registerAuditRoutes } from '../routes/audit.js';
import { createToken } from '../middleware/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import type { AuthUser } from '../middleware/auth.js';

// ---------------------------------------------------------------------------
// Unit tests — classifyAction
// ---------------------------------------------------------------------------

describe('classifyAction — action classification', () => {
  it('classifies GET requests as "read"', async () => {
    expect(classifyAction('GET', '/api/v1/opportunities')).toBe('read');
  });

  it('classifies HEAD requests as "read"', async () => {
    expect(classifyAction('HEAD', '/api/v1/health')).toBe('read');
  });

  it('classifies OPTIONS requests as "read"', async () => {
    expect(classifyAction('OPTIONS', '/api/v1/opportunities')).toBe('read');
  });

  it('classifies POST requests as "write"', async () => {
    expect(classifyAction('POST', '/api/v1/analyze')).toBe('write');
  });

  it('classifies PUT requests as "write"', async () => {
    expect(classifyAction('PUT', '/api/v1/opportunities/123')).toBe('write');
  });

  it('classifies PATCH requests as "write"', async () => {
    expect(classifyAction('PATCH', '/api/v1/opportunities/123')).toBe('write');
  });

  it('classifies DELETE requests as "delete"', async () => {
    expect(classifyAction('DELETE', '/api/v1/api-keys/key-1')).toBe('delete');
  });

  it('classifies auth URLs as "auth"', async () => {
    expect(classifyAction('POST', '/api/v1/auth/login')).toBe('auth');
  });

  it('classifies auth refresh as "auth"', async () => {
    expect(classifyAction('POST', '/api/v1/auth/refresh')).toBe('auth');
  });

  it('classifies GET /api/v1/auth/me as "auth"', async () => {
    expect(classifyAction('GET', '/api/v1/auth/me')).toBe('auth');
  });

  it('classifies admin URLs as "admin"', async () => {
    expect(classifyAction('POST', '/api/v1/admin/settings')).toBe('admin');
  });

  it('classifies admin URLs with GET as "admin"', async () => {
    expect(classifyAction('GET', '/api/v1/admin/users')).toBe('admin');
  });

  it('strips query params before classification', async () => {
    expect(classifyAction('GET', '/api/v1/opportunities?limit=10')).toBe('read');
  });

  it('is case-insensitive on method', async () => {
    expect(classifyAction('get', '/api/v1/findings')).toBe('read');
    expect(classifyAction('post', '/api/v1/analyze')).toBe('write');
    expect(classifyAction('delete', '/api/v1/webhooks/123')).toBe('delete');
  });
});

// ---------------------------------------------------------------------------
// Unit tests — extractResource
// ---------------------------------------------------------------------------

describe('extractResource — URL resource extraction', () => {
  it('extracts opportunity resource from /api/v1/opportunities/123', async () => {
    const result = extractResource('/api/v1/opportunities/123');
    expect(result.resourceType).toBe('opportunity');
    expect(result.resourceId).toBe('123');
  });

  it('extracts finding resource from /api/v1/findings/f-456', async () => {
    const result = extractResource('/api/v1/findings/f-456');
    expect(result.resourceType).toBe('finding');
    expect(result.resourceId).toBe('f-456');
  });

  it('extracts resource type without ID for collection endpoints', async () => {
    const result = extractResource('/api/v1/webhooks');
    expect(result.resourceType).toBe('webhook');
    expect(result.resourceId).toBeUndefined();
  });

  it('handles api-keys resource with hyphen', async () => {
    const result = extractResource('/api/v1/api-keys/key-abc');
    expect(result.resourceType).toBe('api-key');
    expect(result.resourceId).toBe('key-abc');
  });

  it('returns empty for non-API URLs', async () => {
    const result = extractResource('/health');
    expect(result.resourceType).toBeUndefined();
    expect(result.resourceId).toBeUndefined();
  });

  it('strips query params before extraction', async () => {
    const result = extractResource('/api/v1/opportunities/99?include=details');
    expect(result.resourceType).toBe('opportunity');
    expect(result.resourceId).toBe('99');
  });

  it('extracts audit resource', async () => {
    const result = extractResource('/api/v1/audit');
    expect(result.resourceType).toBe('audit');
    expect(result.resourceId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Integration tests — audit middleware with Fastify inject
// ---------------------------------------------------------------------------

describe('Audit middleware — Fastify integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    // Register audit middleware (onResponse hook)
    registerAuditMiddleware(app);

    // Public route
    app.get('/api/v1/opportunities', async (_request, reply) => {
      return reply.send({ data: [] });
    });

    // Protected route (simulates auth by decorating user)
    app.get('/api/v1/findings/:id', {
      preHandler: async (request: FastifyRequest) => {
        (request as FastifyRequest & { user: AuthUser }).user = {
          id: 'user-42',
          role: 'analyst',
          authMethod: 'jwt',
        };
      },
    }, async (request, reply) => {
      const params = request.params as { id: string };
      return reply.status(404).send({ id: params.id, error: 'Not found' });
    });

    // POST endpoint
    app.post('/api/v1/analyze', async (_request, reply) => {
      return reply.status(202).send({ status: 'started' });
    });

    // DELETE endpoint
    app.delete('/api/v1/webhooks/:id', async (_request, reply) => {
      return reply.send({ deleted: true });
    });

    // Auth endpoint
    app.post('/api/v1/auth/login', async (_request, reply) => {
      return reply.send({ token: 'mock' });
    });

    // Endpoint that returns 404
    app.get('/api/v1/notfound', async (_request, reply) => {
      return reply.status(404).send({ error: 'Not found' });
    });

    // Endpoint that returns 500
    app.get('/api/v1/error', async (_request, reply) => {
      return reply.status(500).send({ error: 'Internal error' });
    });

    await app.ready();
  });

  afterAll (async () => {
    await app.close();
  });

  beforeEach (async () => {
    await clearAuditEvents();
    idCounter = 0;
  });

  it ('does not record successful passive reads', async () => {
    await app.inject({ method: 'GET', url: '/api/v1/opportunities' });
    expect((await getAuditEvents()).events).toHaveLength(0);
  });

  it ('captures request method and URL', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/analyze' });

    const { events } = await getAuditEvents();
    expect(events).toHaveLength(1);
    expect(events[0]!.method).toBe('POST');
    expect(events[0]!.url).toBe('/api/v1/analyze');
  });

  it ('captures status code', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/analyze' });

    const { events } = await getAuditEvents();
    expect(events).toHaveLength(1);
    expect(events[0]!.statusCode).toBe(202);
  });

  it ('captures authenticated user info', async () => {
    await app.inject({ method: 'GET', url: '/api/v1/findings/f-1' });

    const { events } = await getAuditEvents();
    expect(events).toHaveLength(1);
    expect(events[0]!.userId).toBe('user-42');
    expect(events[0]!.username).toBe('user-42');
    expect(events[0]!.role).toBe('analyst');
  });

  it ('omits user info for anonymous requests', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/analyze' });

    const { events } = await getAuditEvents();
    expect(events).toHaveLength(1);
    expect(events[0]!.userId).toBeUndefined();
    expect(events[0]!.username).toBeUndefined();
    expect(events[0]!.role).toBeUndefined();
  });

  it ('classifies GET as "read" action', async () => {
    await app.inject({ method: 'GET', url: '/api/v1/notfound' });

    const { events } = await getAuditEvents();
    expect(events[0]!.action).toBe('read');
  });

  it ('classifies POST as "write" action', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/analyze' });

    const { events } = await getAuditEvents();
    expect(events[0]!.action).toBe('write');
  });

  it ('classifies DELETE as "delete" action', async () => {
    await app.inject({ method: 'DELETE', url: '/api/v1/webhooks/wh-1' });

    const { events } = await getAuditEvents();
    expect(events[0]!.action).toBe('delete');
  });

  it ('classifies auth URLs as "auth" action', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/auth/login' });

    const { events } = await getAuditEvents();
    expect(events[0]!.action).toBe('auth');
  });

  it ('extracts resource type from URL', async () => {
    await app.inject({ method: 'GET', url: '/api/v1/findings/f-1' });

    const { events } = await getAuditEvents();
    expect(events[0]!.resourceType).toBe('finding');
    expect(events[0]!.resourceId).toBe('f-1');
  });

  it ('captures IP address', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/analyze' });

    const { events } = await getAuditEvents();
    expect(events[0]!.ip).toBeDefined();
    expect(typeof events[0]!.ip).toBe('string');
  });

  it ('captures user-agent header', async () => {
    await app.inject({
      method: 'GET',
      url: '/api/v1/error',
      headers: { 'user-agent': 'TestRunner/1.0' },
    });

    const { events } = await getAuditEvents();
    expect(events[0]!.userAgent).toBe('TestRunner/1.0');
  });

  it ('captures duration_ms as a non-negative number', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/analyze' });

    const { events } = await getAuditEvents();
    expect(events[0]!.duration_ms).toBeGreaterThanOrEqual(0);
    expect(typeof events[0]!.duration_ms).toBe('number');
  });

  it ('assigns unique IDs to each event', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/analyze' });
    await app.inject({ method: 'DELETE', url: '/api/v1/webhooks/wh-1' });

    const { events } = await getAuditEvents();
    expect(events).toHaveLength(2);
    expect(events[0]!.id).not.toBe(events[1]!.id);
  });

  it ('sets timestamp on each event', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/analyze' });

    const { events } = await getAuditEvents();
    expect(events[0]!.timestamp).toBe('2026-07-01T12:00:00.000Z');
  });

  it('returns events in reverse chronological order (newest first)', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/analyze' });
    await app.inject({ method: 'DELETE', url: '/api/v1/webhooks/wh-1' });

    const { events } = await getAuditEvents();
    expect(events[0]!.method).toBe('DELETE');
    expect(events[1]!.method).toBe('POST');
  });

  it ('clearAuditEvents removes all events', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/analyze' });
    await app.inject({ method: 'DELETE', url: '/api/v1/webhooks/wh-1' });

    expect((await getAuditBuffer()).length).toBe(2);

    await clearAuditEvents();

    expect((await getAuditBuffer()).length).toBe(0);
    expect((await getAuditEvents()).events).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Circular buffer tests
// ---------------------------------------------------------------------------

describe('Audit buffer — circular buffer behaviour', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    registerAuditMiddleware(app);

    app.post('/ping', async (_request, reply) => {
      return reply.send({ pong: true });
    });

    await app.ready();
  });

  afterAll (async () => {
    await app.close();
  });

  beforeEach (async () => {
    await clearAuditEvents();
  });

  it('does not exceed 1000 events', async () => {
    // Generate 1005 events by injecting requests
    const promises: Promise<unknown>[] = [];
    for (let i = 0; i < 1005; i++) {
      promises.push(app.inject({ method: 'POST', url: '/ping' }));
    }
    await Promise.all(promises);

    const buffer = await getAuditBuffer();
    expect(buffer.length).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// Filter tests
// ---------------------------------------------------------------------------

describe('getAuditEvents — filtering', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    registerAuditMiddleware(app);

    app.get('/api/v1/opportunities', async (_request, reply) => reply.send({}));
    app.post('/api/v1/analyze', async (_request, reply) => reply.status(202).send({}));
    app.delete('/api/v1/webhooks/:id', async (_request, reply) => reply.send({}));
    app.get('/api/v1/error', async (_request, reply) => reply.status(500).send({}));

    await app.ready();
  });

  afterAll (async () => {
    await app.close();
  });

  beforeEach (async () => {
    await clearAuditEvents();
  });

  it ('filters by action', async () => {
    await app.inject({ method: 'GET', url: '/api/v1/error' });
    await app.inject({ method: 'POST', url: '/api/v1/analyze' });
    await app.inject({ method: 'DELETE', url: '/api/v1/webhooks/1' });

    const { events } = await getAuditEvents({ action: 'read' });
    expect(events).toHaveLength(1);
    expect(events[0]!.action).toBe('read');
  });

  it ('filters by method', async () => {
    await app.inject({ method: 'GET', url: '/api/v1/error' });
    await app.inject({ method: 'POST', url: '/api/v1/analyze' });

    const { events } = await getAuditEvents({ method: 'POST' });
    expect(events).toHaveLength(1);
    expect(events[0]!.method).toBe('POST');
  });

  it ('filters by status group', async () => {
    await app.inject({ method: 'GET', url: '/api/v1/opportunities' });
    await app.inject({ method: 'GET', url: '/api/v1/error' });

    const { events } = await getAuditEvents({ status: '5xx' });
    expect(events).toHaveLength(1);
    expect(events[0]!.statusCode).toBe(500);
  });

  it ('respects limit parameter', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/analyze' });
    await app.inject({ method: 'POST', url: '/api/v1/analyze' });
    await app.inject({ method: 'POST', url: '/api/v1/analyze' });

    const { events, total } = await getAuditEvents({ limit: 2 });
    expect(events).toHaveLength(2);
    expect(total).toBe(3);
  });

  it ('respects offset parameter', async () => {
    await app.inject({ method: 'GET', url: '/api/v1/opportunities' });
    await app.inject({ method: 'POST', url: '/api/v1/analyze' });
    await app.inject({ method: 'DELETE', url: '/api/v1/webhooks/1' });

    const { events } = await getAuditEvents({ offset: 1, limit: 1 });
    expect(events).toHaveLength(1);
    // Offset 1 from newest-first, so should be the second-newest (POST)
    expect(events[0]!.method).toBe('POST');
  });
});

// ---------------------------------------------------------------------------
// Stats tests
// ---------------------------------------------------------------------------

describe('getAuditStats — aggregation', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    registerAuditMiddleware(app);

    app.get('/api/v1/opportunities', async (_request, reply) => reply.send({}));
    app.post('/api/v1/analyze', async (_request, reply) => reply.status(202).send({}));
    app.get('/api/v1/error', async (_request, reply) => reply.status(500).send({}));
    app.get('/api/v1/notfound', async (_request, reply) => reply.status(404).send({}));

    await app.ready();
  });

  afterAll (async () => {
    await app.close();
  });

  beforeEach (async () => {
    await clearAuditEvents();
  });

  it ('returns correct total', async () => {
    await app.inject({ method: 'GET', url: '/api/v1/error' });
    await app.inject({ method: 'POST', url: '/api/v1/analyze' });

    const stats = await getAuditStats();
    expect(stats.total).toBe(2);
  });

  it ('groups by action correctly', async () => {
    await app.inject({ method: 'GET', url: '/api/v1/error' });
    await app.inject({ method: 'GET', url: '/api/v1/error' });
    await app.inject({ method: 'POST', url: '/api/v1/analyze' });

    const stats = await getAuditStats();
    expect(stats.byAction['read']).toBe(2);
    expect(stats.byAction['write']).toBe(1);
  });

  it ('groups by status correctly', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/analyze' });
    await app.inject({ method: 'GET', url: '/api/v1/error' });
    await app.inject({ method: 'GET', url: '/api/v1/notfound' });

    const stats = await getAuditStats();
    expect(stats.byStatusGroup['2xx']).toBe(1);
    expect(stats.byStatusGroup['5xx']).toBe(1);
    expect(stats.byStatusGroup['4xx']).toBe(1);
  });

  it ('includes recent errors', async () => {
    await app.inject({ method: 'GET', url: '/api/v1/opportunities' });
    await app.inject({ method: 'GET', url: '/api/v1/error' });
    await app.inject({ method: 'GET', url: '/api/v1/notfound' });

    const stats = await getAuditStats();
    expect(stats.recentErrors).toHaveLength(2);
    // Recent errors should include the 404 and 500
    const errorCodes = stats.recentErrors.map((e) => e.statusCode);
    expect(errorCodes).toContain(404);
    expect(errorCodes).toContain(500);
  });

  it ('counts anonymous users under "anonymous" key', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/analyze' });

    const stats = await getAuditStats();
    expect(stats.byUser['anonymous']).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Route tests — GET /api/v1/audit and GET /api/v1/audit/stats
// ---------------------------------------------------------------------------

describe('Audit routes — /api/v1/audit', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    // Register audit middleware first (to capture all requests)
    registerAuditMiddleware(app);

    // Register a public endpoint to generate audit events
    app.get('/api/v1/opportunities', async (_request, reply) => reply.send({ data: [] }));
    app.post('/api/v1/analyze', async (_request, reply) => reply.status(202).send({}));
    app.get('/api/v1/error', async (_request, reply) => reply.status(500).send({ error: 'failure' }));

    // Register audit routes (requires auth)
    await registerAuditRoutes(app);

    await app.ready();
  });

  afterAll (async () => {
    await app.close();
  });

  beforeEach (async () => {
    await clearAuditEvents();
  });

  it ('GET /api/v1/audit requires authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/audit' });
    expect(res.statusCode).toBe(401);
  });

  it ('GET /api/v1/audit/stats requires authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/audit/stats' });
    expect(res.statusCode).toBe(401);
  });

  it ('GET /api/v1/audit rejects viewer role', async () => {
    const token = createToken('user-viewer', 'viewer');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audit',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it ('GET /api/v1/audit rejects analyst role', async () => {
    // Generate some events first
    await app.inject({ method: 'GET', url: '/api/v1/opportunities' });
    await app.inject({ method: 'POST', url: '/api/v1/analyze' });

    const token = createToken('user-analyst', 'analyst');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audit',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it ('GET /api/v1/audit returns events for admin', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/analyze' });

    const token = createToken('user-admin', 'admin');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audit',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data).toBeDefined();
  });

  it ('GET /api/v1/audit supports action filter', async () => {
    await app.inject({ method: 'GET', url: '/api/v1/error' });
    await app.inject({ method: 'POST', url: '/api/v1/analyze' });

    const token = createToken('user-admin', 'admin');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audit?action=read',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    // All returned events should be "read"
    for (const event of body.data) {
      expect(event.action).toBe('read');
    }
  });

  it ('GET /api/v1/audit rejects invalid action filter', async () => {
    const token = createToken('user-admin', 'admin');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audit?action=invalid',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Invalid filter');
  });

  it ('GET /api/v1/audit supports limit parameter', async () => {
    // Generate multiple events
    await app.inject({ method: 'POST', url: '/api/v1/analyze' });
    await app.inject({ method: 'POST', url: '/api/v1/analyze' });
    await app.inject({ method: 'POST', url: '/api/v1/analyze' });

    const token = createToken('user-admin', 'admin');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audit?limit=2',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.length).toBeLessThanOrEqual(2);
    expect(body.limit).toBe(2);
  });

  it ('GET /api/v1/audit/stats returns aggregated stats', async () => {
    await app.inject({ method: 'GET', url: '/api/v1/opportunities' });
    await app.inject({ method: 'POST', url: '/api/v1/analyze' });

    const token = createToken('user-admin', 'admin');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audit/stats',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data).toBeDefined();
    expect(typeof body.data.total).toBe('number');
    expect(body.data.byAction).toBeDefined();
    expect(body.data.byUser).toBeDefined();
    expect(body.data.byStatusGroup).toBeDefined();
    expect(Array.isArray(body.data.recentErrors)).toBe(true);
  });

  it ('GET /api/v1/audit includes pagination metadata', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/analyze' });

    const token = createToken('user-admin', 'admin');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audit?limit=50&offset=0',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.limit).toBe(50);
    expect(body.offset).toBe(0);
    expect(typeof body.total).toBe('number');
  });
});
