/**
 * @module @recurrsive/server/routes/auth
 *
 * Authentication and API key management routes.
 *
 * Provides login, token refresh, logout, and user info endpoints, plus CRUD
 * operations for API keys. Authentication is exclusively against real,
 * store-backed users — there are NO demo/built-in accounts. The first admin
 * is created via `POST /api/v1/setup`; further users are invite-only.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { createLogger } from '@recurrsive/core';
import { createToken, authMiddleware, verifyToken, revokeToken } from '../middleware/auth.js';
import type { AuthUser } from '../middleware/auth.js';
import { generateApiKey, listApiKeys, revokeApiKey } from '../middleware/api-keys.js';
import { requireRole } from '../middleware/rbac.js';
import type { Role } from '../middleware/rbac.js';
import { authenticateUser, findUserById } from '../middleware/users.js';
import { hashPassword, verifyPassword } from '../middleware/passwords.js';
import { store } from '../store.js';
import type { User } from '../middleware/users.js';

const logger = createLogger({ context: { component: 'server:routes:auth' } });

/** Minimum password length enforced consistently across the server. */
const MIN_PASSWORD_LENGTH = 8;

// ---------------------------------------------------------------------------
// Request body types
// ---------------------------------------------------------------------------

interface LoginBody {
  username: string;
  password: string;
}

interface CreateApiKeyBody {
  name: string;
  expiresAt?: string | null;
}

// ---------------------------------------------------------------------------
// Login throttling
// ---------------------------------------------------------------------------

/** Max failed login attempts per username within the window. */
const LOGIN_MAX_FAILURES = 5;
/**
 * Max failed login attempts per client IP within the window.
 *
 * Higher than the per-username cap so a shared NAT/proxy isn't locked out by
 * one noisy user, but low enough to stop password-spraying (one guess against
 * many usernames), which the username-scoped cap alone cannot see.
 */
const LOGIN_MAX_FAILURES_PER_IP = 20;
/** Sliding-window length for failed-attempt counting. */
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

interface FailureRecord {
  count: number;
  windowStartedAt: number;
}

const loginFailures = new Map<string, FailureRecord>();

/** Prune expired windows so the map cannot grow unboundedly under attack. */
function pruneLoginFailures(now: number): void {
  if (loginFailures.size < 10_000) return;
  for (const [key, rec] of loginFailures) {
    if (now - rec.windowStartedAt > LOGIN_WINDOW_MS) loginFailures.delete(key);
  }
}

/** Whether this key is currently locked out, with retry-after seconds. */
function loginThrottleState(key: string, now: number, max: number): { blocked: boolean; retryAfterSec: number } {
  const rec = loginFailures.get(key);
  if (!rec || now - rec.windowStartedAt > LOGIN_WINDOW_MS) {
    return { blocked: false, retryAfterSec: 0 };
  }
  if (rec.count >= max) {
    return { blocked: true, retryAfterSec: Math.ceil((rec.windowStartedAt + LOGIN_WINDOW_MS - now) / 1000) };
  }
  return { blocked: false, retryAfterSec: 0 };
}

function recordLoginFailure(key: string, now: number): void {
  pruneLoginFailures(now);
  const rec = loginFailures.get(key);
  if (!rec || now - rec.windowStartedAt > LOGIN_WINDOW_MS) {
    loginFailures.set(key, { count: 1, windowStartedAt: now });
  } else {
    rec.count += 1;
  }
}

/**
 * Test-only helper: clear all login-throttle state.
 *
 * Exists so integration tests exercising the IP-scoped cap (which counts
 * failures across usernames for the shared test-client IP) can reset the
 * window without waiting 15 minutes. Not used by production code.
 */
export function resetLoginThrottleForTests(): void {
  loginFailures.clear();
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Register authentication and API key management routes.
 *
 * @param app - Fastify instance.
 */
export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  // ───────────────────────────────────────────────────────────────────────────
  // POST /api/v1/auth/login
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Authenticate with username/password and receive a JWT token.
   *
   * Authenticates ONLY against real, store-backed users. Create the first
   * admin via `POST /api/v1/setup`; add further users via invites.
   */
  app.post<{ Body: LoginBody }>('/api/v1/auth/login', async (request, reply) => {
    const { username, password } = request.body ?? {};

    if (!username || !password) {
      return reply.status(400).send({
        error: 'Bad request',
        message: 'Both "username" and "password" are required',
      });
    }

    // Brute-force throttle, on two independent axes:
    //
    // 1. Per-username (LOGIN_MAX_FAILURES): account-scoped lockout, the
    //    correct defense against credential stuffing of a single account.
    // 2. Per-client-IP (LOGIN_MAX_FAILURES_PER_IP): caps password-spraying —
    //    one guess against many usernames — which the username cap alone
    //    cannot see. `request.ip` is Fastify's resolved client IP (trustProxy
    //    derives it from X-Forwarded-For behind the reverse proxy).
    //
    // Either cap being exceeded rejects with 429 before touching the
    // credential check. A successful login clears the username window (the
    // lockout is self-healing); the IP window only ever counts failures.
    const now = Date.now();
    const usernameKey = `user:${username.toLowerCase()}`;
    const ipKey = `ip:${request.ip}`;
    const usernameThrottle = loginThrottleState(usernameKey, now, LOGIN_MAX_FAILURES);
    const ipThrottle = loginThrottleState(ipKey, now, LOGIN_MAX_FAILURES_PER_IP);
    if (usernameThrottle.blocked || ipThrottle.blocked) {
      const retryAfterSec = Math.max(usernameThrottle.retryAfterSec, ipThrottle.retryAfterSec);
      logger.warn(`Login throttled for '${username}' from ${request.ip}`);
      reply.header('Retry-After', retryAfterSec);
      return reply.status(429).send({
        error: 'Too Many Requests',
        message: `Too many failed login attempts. Try again in ${retryAfterSec} seconds.`,
      });
    }

    const realUser = await authenticateUser(username, password);
    if (realUser) {
      loginFailures.delete(usernameKey);
      const token = createToken(realUser.id, realUser.role as Role, undefined, realUser.username);
      logger.info(`User '${realUser.username}' logged in successfully`);
      return reply.status(200).send({
        data: {
          token,
          user: realUser,
        },
      });
    }

    recordLoginFailure(usernameKey, now);
    recordLoginFailure(ipKey, now);
    logger.info(`Failed login attempt for username '${username}'`);
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid username or password',
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // POST /api/v1/auth/logout
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Log out by revoking the presented token's `jti`. The token cannot be used
   * again, even though it has not yet expired. Requires authentication.
   */
  app.post('/api/v1/auth/logout', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const payload = verifyToken(authHeader.slice(7));
      if (payload) {
        await revokeToken(payload);
        logger.info(`User '${payload.sub}' logged out (token revoked)`);
      }
    }
    return reply.status(200).send({ message: 'Logged out — token revoked' });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // POST /api/v1/auth/refresh
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Refresh an existing JWT token.
   *
   * Accepts a valid (non-expired) token and issues a fresh one
   * with a new `iat` and `exp`.
   */
  app.post('/api/v1/auth/refresh', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const user = (request as typeof request & { user: AuthUser }).user;

    const token = createToken(user.id, user.role, undefined, user.username);

    return reply.status(200).send({
      data: {
        token,
        user: {
          id: user.id,
          role: user.role,
        },
      },
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/v1/auth/me
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Return the current authenticated user's information.
   */
  app.get('/api/v1/auth/me', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const user = (request as typeof request & { user: AuthUser }).user;

    // Look up real user from store first
    const storeUser = await findUserById(user.id);
    if (storeUser) {
      return reply.status(200).send({
        data: {
          id: storeUser.id,
          role: storeUser.role,
          authMethod: user.authMethod,
          displayName: storeUser.displayName,
          username: storeUser.username,
          email: storeUser.email,
        },
      });
    }

    // No store-backed user (e.g. API-key principal) — return token-derived info.
    return reply.status(200).send({
      data: {
        id: user.id,
        role: user.role,
        authMethod: user.authMethod,
        displayName: user.username ?? user.id,
        username: user.username ?? user.id,
      },
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // POST /api/v1/api-keys
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Create a new API key.
   *
   * Requires `admin` role. The raw key is returned only once.
   */
  app.post<{ Body: CreateApiKeyBody }>('/api/v1/api-keys', {
    preHandler: [authMiddleware, requireRole('admin')],
  }, async (request, reply) => {
    const user = (request as typeof request & { user: AuthUser }).user;
    const { name, expiresAt } = request.body ?? {};

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return reply.status(400).send({
        error: 'Bad request',
        message: '"name" is required and must be a non-empty string',
      });
    }

    const result = await generateApiKey(name.trim(), user.id, user.role, expiresAt);

    return reply.status(201).send({
      data: {
        id: result.info.id,
        key: result.key,
        info: result.info,
      },
      message: 'API key created — store the key securely, it will not be shown again',
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/v1/api-keys
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * List API key metadata.
   *
   * Admins see all keys; other roles see only their own.
   */
  app.get('/api/v1/api-keys', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const user = (request as typeof request & { user: AuthUser }).user;

    const keys = user.role === 'admin'
      ? await listApiKeys()
      : await listApiKeys(user.id);

    return reply.status(200).send({
      data: keys,
      total: keys.length,
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // DELETE /api/v1/api-keys/:id
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Revoke an API key by its ID.
   *
   * Requires `admin` role.
   */
  app.delete<{ Params: { id: string } }>('/api/v1/api-keys/:id', {
    preHandler: [authMiddleware, requireRole('admin')],
  }, async (request, reply) => {
    const { id } = request.params;

    const revoked = await revokeApiKey(id);

    if (!revoked) {
      return reply.status(404).send({
        error: 'Not found',
        message: `API key with id '${id}' not found`,
      });
    }

    return reply.status(200).send({
      data: { id },
      message: 'API key revoked',
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // PUT /api/v1/auth/change-password
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Change the current user's password.
   *
   * Requires authentication. Verifies the current password before
   * updating to the new one.
   */
  app.put<{ Body: { currentPassword: string; newPassword: string } }>('/api/v1/auth/change-password', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const user = (request as typeof request & { user: AuthUser }).user;
    const { currentPassword, newPassword } = request.body ?? {};

    if (!currentPassword || !newPassword) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Both "currentPassword" and "newPassword" are required',
      });
    }

    if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `New password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }

    // Look up the store-backed user
    const storeUser = await findUserById(user.id);
    if (!storeUser) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'User not found in store',
      });
    }

    // Verify the current password
    const valid = await verifyPassword(currentPassword, storeUser.passwordHash, storeUser.passwordSalt);
    if (!valid) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Current password is incorrect',
      });
    }

    // Hash and save the new password
    const { hash, salt } = await hashPassword(newPassword);
    storeUser.passwordHash = hash;
    storeUser.passwordSalt = salt;
    storeUser.updatedAt = new Date().toISOString();
    await store.set<User>('users', storeUser.id, storeUser);

    logger.info(`User '${user.id}' changed their password`);
    return reply.status(200).send({
      message: 'Password changed successfully',
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/v1/auth/sessions
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Return active sessions for the current user.
   *
   * Since the server uses stateless JWT tokens, the current request
   * represents the only "session." This endpoint returns a single
   * entry representing the active session.
   */
  app.get('/api/v1/auth/sessions', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const user = (request as typeof request & { user: AuthUser }).user;
    const now = new Date().toISOString();

    // Derive session info from the current request
    const sessions = [
      {
        id: `session_${user.id}_current`,
        created_at: now,
        ip_address: request.ip ?? '127.0.0.1',
        user_agent: request.headers['user-agent'] ?? 'unknown',
        current: true,
      },
    ];

    return reply.status(200).send({ data: sessions });
  });
}
