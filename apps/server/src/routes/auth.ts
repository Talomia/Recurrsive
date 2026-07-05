/**
 * @module @recurrsive/server/routes/auth
 *
 * Authentication and API key management routes.
 *
 * Provides login, token refresh, and user info endpoints, plus CRUD
 * operations for API keys. Demo users available for development
 * (disabled in production unless ALLOW_DEMO_USERS=true).
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { createLogger } from '@recurrsive/core';
import { createToken, authMiddleware } from '../middleware/auth.js';
import type { AuthUser } from '../middleware/auth.js';
import { generateApiKey, listApiKeys, revokeApiKey } from '../middleware/api-keys.js';
import { requireRole } from '../middleware/rbac.js';
import type { Role } from '../middleware/rbac.js';
import { authenticateUser, findUserById } from '../middleware/users.js';
import { hashPassword, verifyPassword } from '../middleware/passwords.js';
import { store } from '../store.js';
import type { User } from '../middleware/users.js';

const logger = createLogger({ context: { component: 'server:routes:auth' } });

// ---------------------------------------------------------------------------
// Demo users (hardcoded — never for production)
// ---------------------------------------------------------------------------

interface DemoUser {
  id: string;
  username: string;
  password: string;
  role: Role;
  displayName: string;
}

const _ALL_DEMO_USERS: DemoUser[] = [
  { id: 'user-admin', username: 'admin', password: 'admin', role: 'admin', displayName: 'Admin User' },
  { id: 'user-analyst', username: 'analyst', password: 'analyst', role: 'analyst', displayName: 'Analyst User' },
  { id: 'user-viewer', username: 'viewer', password: 'viewer', role: 'viewer', displayName: 'Viewer User' },
];

/**
 * In production, demo users are disabled unless ALLOW_DEMO_USERS=true.
 * This prevents trivial credential-based access to production deployments.
 */
const DEMO_USERS: DemoUser[] =
  process.env['NODE_ENV'] === 'production' && process.env['ALLOW_DEMO_USERS'] !== 'true'
    ? []
    : _ALL_DEMO_USERS;

if (DEMO_USERS.length === 0) {
  console.warn('[AUTH] Demo users disabled in production. Set ALLOW_DEMO_USERS=true to override.');
} else if (process.env['NODE_ENV'] === 'production') {
  console.warn('[AUTH] WARNING: Demo users are enabled in production (ALLOW_DEMO_USERS=true).');
}

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
   * Authenticates using built-in accounts (admin/admin, analyst/analyst, viewer/viewer).
   * Demo users are disabled in production unless ALLOW_DEMO_USERS=true.
   */
  app.post<{ Body: LoginBody }>('/api/v1/auth/login', async (request, reply) => {
    const { username, password } = request.body ?? {};

    if (!username || !password) {
      return reply.status(400).send({
        error: 'Bad request',
        message: 'Both "username" and "password" are required',
      });
    }

    // 1. Try real (store-backed) users first
    const realUser = await authenticateUser(username, password);
    if (realUser) {
      const token = createToken(realUser.id, realUser.role as Role, undefined, realUser.username);
      logger.info(`User '${realUser.username}' logged in successfully (store)`);
      return reply.status(200).send({
        data: {
          token,
          user: realUser,
        },
      });
    }

    // 2. Fall back to demo users (dev/test mode only)
    const demo = DEMO_USERS.find(
      (u) => u.username === username && u.password === password,
    );

    if (demo) {
      const token = createToken(demo.id, demo.role, undefined, demo.username);
      logger.info(`User '${demo.username}' logged in successfully (demo)`);
      return reply.status(200).send({
        data: {
          token,
          user: {
            id: demo.id,
            username: demo.username,
            role: demo.role,
            displayName: demo.displayName,
          },
        },
      });
    }

    logger.info(`Failed login attempt for username '${username}'`);
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid username or password',
    });
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
    const storeUser = findUserById(user.id);
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

    // Fall back to demo users
    const demo = DEMO_USERS.find((u) => u.id === user.id);

    return reply.status(200).send({
      data: {
        id: user.id,
        role: user.role,
        authMethod: user.authMethod,
        displayName: demo?.displayName ?? user.id,
        username: demo?.username ?? user.id,
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

    const result = generateApiKey(name.trim(), user.id, user.role, expiresAt);

    return reply.status(201).send({
      data: {
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
      ? listApiKeys()
      : listApiKeys(user.id);

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

    const revoked = revokeApiKey(id);

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

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'New password must be at least 6 characters',
      });
    }

    // Look up the store-backed user
    const storeUser = findUserById(user.id);
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
    store.set<User>('users', storeUser.id, storeUser);

    logger.info(`User '${user.id}' changed their password`);
    return reply.status(200).send({
      message: 'Password changed successfully',
    });
  });
}
