/**
 * Tests for the rate limiter, request logger, and API key auth middleware.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import {
  registerRateLimiter,
  registerRequestLogger,
  registerApiKeyAuth,
  getRequestLog,
} from '../middleware.js';

// ---------------------------------------------------------------------------
// Rate Limiter Tests
// ---------------------------------------------------------------------------

describe('Rate Limiter middleware', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    registerRateLimiter(app, { max: 3, windowMs: 60_000 });
    app.get('/test', async () => ({ ok: true }));
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows requests under the limit', async () => {
    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-ratelimit-limit']).toBe('3');
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
  });

  it('includes rate limit headers', async () => {
    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.headers['x-ratelimit-limit']).toBe('3');
    expect(res.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('returns 429 when limit exceeded', async () => {
    await app.inject({ method: 'GET', url: '/test' });
    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.statusCode).toBe(429);
    const body = res.json();
    expect(body.error).toBe('Too Many Requests');
    expect(body.retry_after).toBeTypeOf('number');
  });
});

// ---------------------------------------------------------------------------
// Request Logger Tests
// ---------------------------------------------------------------------------

describe('Request Logger middleware', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    registerRequestLogger(app);
    app.get('/logged', async () => ({ ok: true }));
    app.post('/logged', async () => ({ created: true }));
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('captures request method and URL', async () => {
    const before = getRequestLog().length;
    await app.inject({ method: 'GET', url: '/logged' });
    const after = getRequestLog();
    expect(after.length).toBeGreaterThan(before);
    const last = after[after.length - 1];
    expect(last?.method).toBe('GET');
    expect(last?.url).toBe('/logged');
  });

  it('records status code', async () => {
    await app.inject({ method: 'GET', url: '/logged' });
    const log = getRequestLog();
    const last = log[log.length - 1];
    expect(last?.status).toBe(200);
  });

  it('measures request duration', async () => {
    await app.inject({ method: 'GET', url: '/logged' });
    const log = getRequestLog();
    const last = log[log.length - 1];
    expect(last?.duration_ms).toBeTypeOf('number');
    expect(last?.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('includes timestamp', async () => {
    await app.inject({ method: 'POST', url: '/logged' });
    const log = getRequestLog();
    const last = log[log.length - 1];
    expect(last?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ---------------------------------------------------------------------------
// API Key Auth Tests
// ---------------------------------------------------------------------------

describe('API Key Auth middleware', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    registerApiKeyAuth(app, {
      headerName: 'X-API-Key',
      validKeys: new Set(['test-key-123']),
      excludePaths: ['/health'],
    });
    app.get('/health', async () => ({ status: 'ok' }));
    app.get('/protected', async () => ({ data: 'secret' }));
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows excluded paths without API key', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
  });

  it('returns 401 without API key header', async () => {
    const res = await app.inject({ method: 'GET', url: '/protected' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Unauthorized');
  });

  it('returns 403 with invalid API key', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { 'x-api-key': 'wrong-key' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('Forbidden');
  });

  it('allows requests with valid API key', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { 'x-api-key': 'test-key-123' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toBe('secret');
  });
});

// ---------------------------------------------------------------------------
// Disabled Auth Tests
// ---------------------------------------------------------------------------

describe('API Key Auth (disabled mode)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    registerApiKeyAuth(app, { validKeys: new Set() });
    app.get('/open', async () => ({ accessible: true }));
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows all requests when no keys configured', async () => {
    const res = await app.inject({ method: 'GET', url: '/open' });
    expect(res.statusCode).toBe(200);
    expect(res.json().accessible).toBe(true);
  });
});
