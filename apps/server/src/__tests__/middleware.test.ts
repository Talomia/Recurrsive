/**
 * Tests for server middleware: rate limiter, error handler, and validation.
 *
 * Uses Fastify's inject() for zero-network-overhead request simulation.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerRateLimit } from '../middleware/rate-limit.js';
import { registerErrorHandler } from '../middleware/error-handler.js';
import { validateBody, ANALYZE_REQUEST_FIELDS } from '../middleware/validate.js';

// Suppress Fastify logs during tests
vi.mock('@recurrsive/core', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Rate Limiter Tests
// ---------------------------------------------------------------------------

describe('registerRateLimit', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await registerRateLimit(app, { max: 3, windowMs: 10_000 });

    app.get('/test', async () => ({ ok: true }));
    app.get('/health', async () => ({ status: 'ok' }));

    await app.ready();
  });

  afterAll (async () => {
    await app.close();
  });

  it ('allows requests within the limit', async () => {
    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['ratelimit-limit']).toBe('3');
    expect(res.headers['ratelimit-remaining']).toBe('2');
  });

  it ('sets rate limit headers on each request', async () => {
    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(res.headers['ratelimit-remaining']).toBeDefined();
    expect(res.headers['ratelimit-reset']).toBeDefined();
  });

  it ('returns 429 after exceeding the limit', async () => {
    // Use up remaining requests
    await app.inject({ method: 'GET', url: '/test' });
    await app.inject({ method: 'GET', url: '/test' });

    // This should be over the limit
    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.statusCode).toBe(429);

    const body = JSON.parse(res.body);
    expect(body.error).toBe('Too Many Requests');
    expect(body.retryAfter).toBeGreaterThan(0);
  });

  it ('skips rate limiting for /health endpoint', async () => {
    // Health checks should always succeed regardless of rate limit
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['ratelimit-limit']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Error Handler Tests
// ---------------------------------------------------------------------------

describe('registerErrorHandler', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    registerErrorHandler(app);

    app.get('/error/500', async () => {
      throw new Error('Internal failure');
    });

    app.get('/error/400', async (_req, reply) => {
      reply.code(400).send({ error: 'Bad Request', message: 'Invalid param' });
    });

    await app.ready();
  });

  afterAll (async () => {
    await app.close();
  });

  it ('returns 404 for unknown routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/nonexistent' });
    expect(res.statusCode).toBe(404);

    const body = JSON.parse(res.body);
    expect(body.error).toBe('Not Found');
    expect(body.statusCode).toBe(404);
  });

  it ('returns structured error for 500 errors', async () => {
    const res = await app.inject({ method: 'GET', url: '/error/500' });
    expect(res.statusCode).toBe(500);

    const body = JSON.parse(res.body);
    expect(body.error).toBe('Internal Server Error');
    expect(body.statusCode).toBe(500);
    expect(body.requestId).toBeDefined();
    // Should NOT leak the actual error message
    expect(body.message).toBe('An unexpected error occurred');
  });
});

// ---------------------------------------------------------------------------
// Validation Tests
// ---------------------------------------------------------------------------

describe('validateBody', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    app.post('/validate', {
      preHandler: validateBody(ANALYZE_REQUEST_FIELDS),
    }, async (req) => {
      return { ok: true, body: req.body };
    });

    await app.ready();
  });

  afterAll (async () => {
    await app.close();
  });

  it ('passes valid request body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/validate',
      payload: { projectId: 'project-1', path: '/my/project' },
    });
    expect(res.statusCode).toBe(200);
  });

  it ('passes body with optional fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/validate',
      payload: {
        projectId: 'project-1',
        path: '/my/project',
        analyzers: ['security', 'cost'],
        include_reasoning: true,
      },
    });
    expect(res.statusCode).toBe(200);
  });

  it ('rejects body with wrong type for "path" field', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/validate',
      payload: { projectId: 'project-1', path: 12345 },
    });
    expect(res.statusCode).toBe(400);

    const body = JSON.parse(res.body);
    expect(body.error).toBe('Validation Error');
    expect(body.issues).toBeDefined();
    expect(body.issues.length).toBeGreaterThan(0);
    expect(body.issues[0].field).toBe('path');
  });

  it ('rejects body with empty "path" string', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/validate',
      payload: { projectId: 'project-1', path: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it ('rejects body with wrong type for "analyzers"', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/validate',
      payload: { projectId: 'project-1', path: '/project', analyzers: 'not-an-array' },
    });
    expect(res.statusCode).toBe(400);

    const body = JSON.parse(res.body);
    expect(body.issues.some((i: { field: string }) => i.field === 'analyzers')).toBe(true);
  });

  it ('rejects non-JSON body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/validate',
      headers: { 'content-type': 'text/plain' },
      payload: 'not json',
    });
    // Fastify will either return 400 or 415 for invalid content type
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it ('rejects body with wrong type for "include_reasoning"', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/validate',
      payload: { projectId: 'project-1', path: '/project', include_reasoning: 'yes' },
    });
    expect(res.statusCode).toBe(400);
  });
});
