/**
 * Authentication, API key, and RBAC middleware tests.
 *
 * Tests cover JWT creation/verification, API key lifecycle, login
 * endpoints, auth middleware enforcement, and RBAC role checks.
 * Route tests use Fastify's `inject()` against a real server instance.
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Fastify from 'fastify';

// ---------------------------------------------------------------------------
// Mock @recurrsive/core BEFORE any app imports
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Imports under test
// ---------------------------------------------------------------------------

import { createToken, verifyToken, authMiddleware, optionalAuth } from '../middleware/auth.js';
import type { AuthUser } from '../middleware/auth.js';
import {
  generateApiKey,
  validateApiKey,
  revokeApiKey,
  listApiKeys,
  clearApiKeys,
} from '../middleware/api-keys.js';
import { requireRole, hasMinRole, isValidRole, PERMISSIONS } from '../middleware/rbac.js';
import type { Role } from '../middleware/rbac.js';
import { registerAuthRoutes } from '../routes/auth.js';

// ---------------------------------------------------------------------------
// JWT unit tests
// ---------------------------------------------------------------------------

describe('JWT Token — createToken / verifyToken', () => {
  it('creates a token string with three dot-separated parts', async () => {
    const token = createToken('user-1', 'admin');
    const parts = token.split('.');
    expect(parts).toHaveLength(3);
    // Each part should be non-empty base64url
    for (const part of parts) {
      expect(part.length).toBeGreaterThan(0);
    }
  });

  it('verifyToken returns the correct payload for a valid token', async () => {
    const token = createToken('user-42', 'analyst');
    const payload = verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe('user-42');
    expect(payload!.role).toBe('analyst');
    expect(typeof payload!.iat).toBe('number');
    expect(typeof payload!.exp).toBe('number');
    expect(payload!.exp).toBeGreaterThan(payload!.iat);
  });

  it('rejects a token with a tampered payload', async () => {
    const token = createToken('user-1', 'admin');
    const parts = token.split('.');
    // Tamper with the payload (flip a character)
    const tampered = `${parts[0]}.${parts[1]!.slice(0, -1)}X.${parts[2]}`;
    expect(verifyToken(tampered)).toBeNull();
  });

  it('rejects a token with a tampered signature', async () => {
    const token = createToken('user-1', 'admin');
    const parts = token.split('.');
    const tampered = `${parts[0]}.${parts[1]}.invalidsignature`;
    expect(verifyToken(tampered)).toBeNull();
  });

  it('rejects a token with wrong number of parts', async () => {
    expect(verifyToken('only.two')).toBeNull();
    expect(verifyToken('one')).toBeNull();
    expect(verifyToken('a.b.c.d')).toBeNull();
  });

  it('rejects an expired token', async () => {
    // Create a token with -1 second TTL (already expired)
    const token = createToken('user-1', 'viewer', -1);
    expect(verifyToken(token)).toBeNull();
  });

  it('respects custom TTL', async () => {
    const token = createToken('user-1', 'viewer', 7200);
    const payload = verifyToken(token);
    expect(payload).not.toBeNull();
    // exp should be ~2 hours after iat
    expect(payload!.exp - payload!.iat).toBe(7200);
  });

  it('rejects an empty string', async () => {
    expect(verifyToken('')).toBeNull();
  });

  it('rejects a totally invalid string', async () => {
    expect(verifyToken('not-a-jwt-at-all')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// API key unit tests
// ---------------------------------------------------------------------------

describe ('API Key — generate / validate / revoke / list', () => {
  beforeEach(async () => {
    await clearApiKeys();
  });

  it ('generateApiKey returns a key starting with "rk_"', async () => {
    const result = await generateApiKey('test-key', 'user-1', 'admin');
    expect(result.key).toMatch(/^rk_[a-f0-9]{64}$/);
  });

  it ('generateApiKey returns info with correct metadata', async () => {
    const result = await generateApiKey('my-key', 'user-2', 'analyst');
    expect(result.info.name).toBe('my-key');
    expect(result.info.userId).toBe('user-2');
    expect(result.info.role).toBe('analyst');
    expect(result.info.id).toBeDefined();
    expect(result.info.createdAt).toBeDefined();
    expect(result.info.lastUsedAt).toBeNull();
    expect(result.info.expiresAt).toBeNull();
  });

  it('validateApiKey returns info for a valid key', async () => {
    const { key } = await generateApiKey('test', 'user-1', 'viewer');
    const info = await validateApiKey(key);
    expect(info).not.toBeNull();
    expect(info!.name).toBe('test');
    expect(info!.role).toBe('viewer');
  });

  it('validateApiKey updates lastUsedAt on validation', async () => {
    const { key } = await generateApiKey('test', 'user-1', 'viewer');
    const info = await validateApiKey(key);
    expect(info).not.toBeNull();
    expect(info!.lastUsedAt).not.toBeNull();
  });

  it ('validateApiKey returns null for an unknown key', async () => {
    expect(await validateApiKey('rk_nonexistent')).toBeNull();
  });

  it('validateApiKey returns null for an expired key', async () => {
    // Create a key that expired in the past
    const { key } = await generateApiKey('expired', 'user-1', 'admin', '2020-01-01T00:00:00Z');
    expect(await validateApiKey(key)).toBeNull();
  });

  it('revokeApiKey returns true and removes a valid key', async () => {
    const { key, info } = await generateApiKey('to-revoke', 'user-1', 'admin');
    expect(await revokeApiKey(info.id)).toBe(true);
    expect(await validateApiKey(key)).toBeNull();
  });

  it ('revokeApiKey returns false for an unknown ID', async () => {
    expect(await revokeApiKey('nonexistent-id')).toBe(false);
  });

  it ('listApiKeys returns all keys when no userId is given', async () => {
    await generateApiKey('key-a', 'user-1', 'admin');
    await generateApiKey('key-b', 'user-2', 'viewer');
    const all = await listApiKeys();
    expect(all).toHaveLength(2);
  });

  it ('listApiKeys filters by userId', async () => {
    await generateApiKey('key-a', 'user-1', 'admin');
    await generateApiKey('key-b', 'user-2', 'viewer');
    await generateApiKey('key-c', 'user-1', 'analyst');
    const user1Keys = await listApiKeys('user-1');
    expect(user1Keys).toHaveLength(2);
    expect(user1Keys.every((k) => k.userId === 'user-1')).toBe(true);
  });

  it ('clearApiKeys removes all keys', async () => {
    await generateApiKey('key-a', 'user-1', 'admin');
    await generateApiKey('key-b', 'user-2', 'viewer');
    await clearApiKeys();
    expect(await listApiKeys()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// RBAC unit tests
// ---------------------------------------------------------------------------

describe('RBAC — role checks', () => {
  it('isValidRole accepts admin, analyst, viewer', async () => {
    expect(isValidRole('admin')).toBe(true);
    expect(isValidRole('analyst')).toBe(true);
    expect(isValidRole('viewer')).toBe(true);
  });

  it('isValidRole rejects invalid strings', async () => {
    expect(isValidRole('superadmin')).toBe(false);
    expect(isValidRole('')).toBe(false);
    expect(isValidRole('ADMIN')).toBe(false);
  });

  it('hasMinRole: admin ≥ all roles', async () => {
    expect(hasMinRole('admin', 'admin')).toBe(true);
    expect(hasMinRole('admin', 'analyst')).toBe(true);
    expect(hasMinRole('admin', 'viewer')).toBe(true);
  });

  it('hasMinRole: analyst ≥ analyst and viewer but not admin', async () => {
    expect(hasMinRole('analyst', 'analyst')).toBe(true);
    expect(hasMinRole('analyst', 'viewer')).toBe(true);
    expect(hasMinRole('analyst', 'admin')).toBe(false);
  });

  it('hasMinRole: viewer ≥ viewer only', async () => {
    expect(hasMinRole('viewer', 'viewer')).toBe(true);
    expect(hasMinRole('viewer', 'analyst')).toBe(false);
    expect(hasMinRole('viewer', 'admin')).toBe(false);
  });

  it('PERMISSIONS map is defined and contains expected keys', async () => {
    expect(PERMISSIONS).toBeDefined();
    expect(PERMISSIONS['api-keys:create']).toBe('admin');
    expect(PERMISSIONS['analysis:view']).toBe('viewer');
    expect(PERMISSIONS['analysis:trigger']).toBe('analyst');
  });
});

// ---------------------------------------------------------------------------
// Auth middleware integration tests (using a minimal Fastify server)
// ---------------------------------------------------------------------------

describe('Auth middleware — Fastify integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    // Protected route requiring auth
    app.get('/protected', {
      preHandler: authMiddleware,
    }, async (request, reply) => {
      const user = (request as typeof request & { user: AuthUser }).user;
      return reply.send({ userId: user.id, role: user.role });
    });

    // Optional auth route
    app.get('/optional', {
      preHandler: optionalAuth,
    }, async (request, reply) => {
      const user = (request as typeof request & { user?: AuthUser }).user;
      return reply.send({ authenticated: !!user, userId: user?.id ?? null });
    });

    // Admin-only route
    app.get('/admin-only', {
      preHandler: [authMiddleware, requireRole('admin')],
    }, async (_request, reply) => {
      return reply.send({ secret: 'admin-data' });
    });

    // Analyst-or-above route
    app.get('/analyst-up', {
      preHandler: [authMiddleware, requireRole('analyst')],
    }, async (_request, reply) => {
      return reply.send({ data: 'analyst-data' });
    });

    await app.ready();
  });

  afterAll (async () => {
    await app.close();
  });

  beforeEach (async () => {
    await clearApiKeys();
  });

  it ('rejects request without auth header with 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/protected' });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Unauthorized');
  });

  it ('accepts request with a valid JWT Bearer token', async () => {
    const token = createToken('user-admin', 'admin');
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.userId).toBe('user-admin');
    expect(body.role).toBe('admin');
  });

  it ('rejects request with an invalid JWT', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: 'Bearer invalid.token.here' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('accepts request with a valid API key', async () => {
    const { key } = await generateApiKey('test-key', 'user-analyst', 'analyst');
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { 'x-api-key': key },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.userId).toBe('user-analyst');
    expect(body.role).toBe('analyst');
  });

  it ('rejects request with an invalid API key', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { 'x-api-key': 'rk_invalid_key' },
    });
    expect(res.statusCode).toBe(401);
  });

  it ('optional auth passes without credentials and sets user to null', async () => {
    const res = await app.inject({ method: 'GET', url: '/optional' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.authenticated).toBe(false);
    expect(body.userId).toBeNull();
  });

  it ('optional auth decorates user when valid token is given', async () => {
    const token = createToken('user-viewer', 'viewer');
    const res = await app.inject({
      method: 'GET',
      url: '/optional',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.authenticated).toBe(true);
    expect(body.userId).toBe('user-viewer');
  });

  // RBAC integration
  it ('admin can access admin-only route', async () => {
    const token = createToken('user-admin', 'admin');
    const res = await app.inject({
      method: 'GET',
      url: '/admin-only',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.secret).toBe('admin-data');
  });

  it('viewer cannot access admin-only route (403)', async () => {
    const token = createToken('user-viewer', 'viewer');
    const res = await app.inject({
      method: 'GET',
      url: '/admin-only',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Forbidden');
  });

  it('analyst cannot access admin-only route (403)', async () => {
    const token = createToken('user-analyst', 'analyst');
    const res = await app.inject({
      method: 'GET',
      url: '/admin-only',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it ('analyst can access analyst-or-above route', async () => {
    const token = createToken('user-analyst', 'analyst');
    const res = await app.inject({
      method: 'GET',
      url: '/analyst-up',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it ('admin can access analyst-or-above route', async () => {
    const token = createToken('user-admin', 'admin');
    const res = await app.inject({
      method: 'GET',
      url: '/analyst-up',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('viewer cannot access analyst-or-above route (403)', async () => {
    const token = createToken('user-viewer', 'viewer');
    const res = await app.inject({
      method: 'GET',
      url: '/analyst-up',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it ('requireRole rejects unauthenticated request with 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin-only' });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Auth routes integration tests (login, refresh, me, API key CRUD)
// ---------------------------------------------------------------------------

describe('Auth routes — /api/v1/auth/*  and  /api/v1/api-keys/*', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await registerAuthRoutes(app);
    await app.ready();
  });

  afterAll (async () => {
    await app.close();
  });

  beforeEach (async () => {
    await clearApiKeys();
  });

  // ── Login ──────────────────────────────────────────────────────────────────

  it ('POST /api/v1/auth/login succeeds with valid admin credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'admin', password: 'admin' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data).toBeDefined();
    expect(body.data.token).toBeDefined();
    expect(body.data.user.role).toBe('admin');
    expect(body.data.user.username).toBe('admin');
  });

  it ('POST /api/v1/auth/login succeeds with analyst credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'analyst', password: 'analyst' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.user.role).toBe('analyst');
  });

  it ('POST /api/v1/auth/login rejects wrong password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'admin', password: 'wrong' },
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Unauthorized');
  });

  it ('POST /api/v1/auth/login rejects unknown user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'nobody', password: 'nothing' },
    });
    expect(res.statusCode).toBe(401);
  });

  it ('POST /api/v1/auth/login returns 400 with missing fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  // ── Refresh ────────────────────────────────────────────────────────────────

  it ('POST /api/v1/auth/refresh returns a new token', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'admin', password: 'admin' },
    });
    const loginBody = JSON.parse(loginRes.payload);
    const token = loginBody.data.token;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.token).toBeDefined();
    // Verify the refreshed token is valid and carries the right claims
    const payload = verifyToken(body.data.token);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe('user-admin');
    expect(payload!.role).toBe('admin');
  });

  it ('POST /api/v1/auth/refresh rejects without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
    });
    expect(res.statusCode).toBe(401);
  });

  // ── Me ─────────────────────────────────────────────────────────────────────

  it ('GET /api/v1/auth/me returns current user info', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'viewer', password: 'viewer' },
    });
    const loginBody = JSON.parse(loginRes.payload);
    const token = loginBody.data.token;

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.role).toBe('viewer');
    expect(body.data.username).toBe('viewer');
    expect(body.data.authMethod).toBe('jwt');
  });

  it ('GET /api/v1/auth/me rejects without auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
    });
    expect(res.statusCode).toBe(401);
  });

  // ── API key CRUD ───────────────────────────────────────────────────────────

  it('POST /api/v1/api-keys creates a key (admin)', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'admin', password: 'admin' },
    });
    const loginBody = JSON.parse(loginRes.payload);
    const token = loginBody.data.token;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/api-keys',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'CI Pipeline Key' },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.data.key).toMatch(/^rk_/);
    expect(body.data.info.name).toBe('CI Pipeline Key');
  });

  it('POST /api/v1/api-keys rejects non-admin (403)', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'viewer', password: 'viewer' },
    });
    const loginBody = JSON.parse(loginRes.payload);
    const token = loginBody.data.token;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/api-keys',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'my-key' },
    });
    expect(res.statusCode).toBe(403);
  });

  it ('POST /api/v1/api-keys returns 400 without name', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'admin', password: 'admin' },
    });
    const loginBody = JSON.parse(loginRes.payload);
    const token = loginBody.data.token;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/api-keys',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it ('GET /api/v1/api-keys lists keys for admin', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'admin', password: 'admin' },
    });
    const loginBody = JSON.parse(loginRes.payload);
    const token = loginBody.data.token;

    // Create a key first
    await app.inject({
      method: 'POST',
      url: '/api/v1/api-keys',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'list-test-key' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/api-keys',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.total).toBeGreaterThanOrEqual(1);
  });

  it ('DELETE /api/v1/api-keys/:id revokes a key', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'admin', password: 'admin' },
    });
    const loginBody = JSON.parse(loginRes.payload);
    const token = loginBody.data.token;

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/api-keys',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'to-delete' },
    });
    const createBody = JSON.parse(createRes.payload);
    const info = createBody.data.info;

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/api-keys/${info.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(deleteRes.statusCode).toBe(200);
    const body = JSON.parse(deleteRes.payload);
    expect(body.message).toBe('API key revoked');
  });

  it ('DELETE /api/v1/api-keys/:id returns 404 for unknown id', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'admin', password: 'admin' },
    });
    const loginBody = JSON.parse(loginRes.payload);
    const token = loginBody.data.token;

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/api-keys/nonexistent',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('DELETE /api/v1/api-keys/:id rejects non-admin (403)', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'analyst', password: 'analyst' },
    });
    const loginBody = JSON.parse(loginRes.payload);
    const token = loginBody.data.token;

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/api-keys/some-id',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });
});
