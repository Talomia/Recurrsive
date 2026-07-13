/**
 * @module @recurrsive/server/routes/users
 *
 * User CRUD routes for admin-only user management.
 *
 * Provides endpoints for listing, creating, updating, and deleting
 * user accounts. All endpoints require authentication with the
 * `admin` role.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { createLogger } from '@recurrsive/core';
import { authMiddleware } from '../middleware/auth.js';
import type { AuthUser } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import {
  createUser,
  findUserById,
  listUsers,
  updateUser,
  deleteUser,
  resetUserPassword,
} from '../middleware/users.js';
import type { CreateUserInput, UpdateUserInput } from '../middleware/users.js';

const logger = createLogger({ context: { component: 'server:routes:users' } });

// ---------------------------------------------------------------------------
// Request body/param types
// ---------------------------------------------------------------------------

interface CreateUserBody {
  username: string;
  email: string;
  password: string;
  role?: 'admin' | 'analyst' | 'viewer';
  displayName?: string;
}

interface UpdateUserBody {
  username?: string;
  email?: string;
  password?: string;
  role?: 'admin' | 'analyst' | 'viewer';
  displayName?: string;
  status?: 'active' | 'disabled' | 'pending';
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Register user management CRUD routes.
 *
 * All endpoints require `admin` role authentication.
 *
 * @param app - Fastify instance.
 */
export async function registerUserRoutes(app: FastifyInstance): Promise<void> {
  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/v1/users
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * List all users.
   *
   * Requires admin role. Returns public user records (no password fields).
   */
  app.get('/api/v1/users', {
    preHandler: [authMiddleware, requireRole('admin')],
  }, async (_request, reply) => {
    const users = await listUsers();
    return reply.status(200).send({
      data: users,
      total: users.length,
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/v1/users/:id
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get a user by ID.
   *
   * Requires admin role. Returns a public user record.
   */
  app.get<{ Params: { id: string } }>('/api/v1/users/:id', {
    preHandler: [authMiddleware, requireRole('admin')],
  }, async (request, reply) => {
    const user = await findUserById(request.params.id);
    if (!user) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    // Strip password fields for response
    const { passwordHash: _h, passwordSalt: _s, ...publicUser } = user;
    return reply.status(200).send({ data: publicUser });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/v1/users
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a new user.
   *
   * Requires admin role. Body: { username, email, password, role?, displayName? }
   */
  app.post<{ Body: CreateUserBody }>('/api/v1/users', {
    preHandler: [authMiddleware, requireRole('admin')],
  }, async (request, reply) => {
    const { username, email, password, role, displayName } = request.body ?? {};

    if (!username || !email || !password) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: '"username", "email", and "password" are required',
      });
    }
    if (!/^[A-Za-z0-9._-]{3,64}$/.test(username) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Username, email, or password does not meet validation requirements.',
      });
    }

    try {
      const input: CreateUserInput = { username, email, password, role, displayName };
      const user = await createUser(input);

      logger.info(`Admin created user '${username}'`);
      return reply.status(201).send({ data: user });
    } catch (err) {
      if (err instanceof Error && err.message.includes('already taken')) {
        return reply.status(409).send({
          error: 'Conflict',
          message: err.message,
        });
      }
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: err instanceof Error ? err.message : 'Failed to create user',
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PUT /api/v1/users/:id
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Update a user.
   *
   * Requires admin role. Body: partial { username, email, password, role, displayName, status }
   * If password is included, it will be re-hashed.
   */
  app.put<{ Params: { id: string }; Body: UpdateUserBody }>('/api/v1/users/:id', {
    preHandler: [authMiddleware, requireRole('admin')],
    schema: {
      body: {
        type: 'object',
        properties: {
          username: { type: 'string' },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 12 },
          role: { type: 'string', enum: ['admin', 'analyst', 'viewer'] },
          displayName: { type: 'string' },
          status: { type: 'string', enum: ['active', 'disabled', 'pending'] },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const updates = request.body as Partial<UpdateUserInput>;
      const actor = (request as typeof request & { user: AuthUser }).user;
      const existing = await findUserById(id);
      if (!existing) {
        return reply.status(404).send({ error: 'Not Found', message: 'User not found' });
      }
      if (actor.id === id && ((updates.role && updates.role !== 'admin') || (updates.status && updates.status !== 'active'))) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Administrators cannot remove their own administrative access or disable their own account.',
        });
      }
      const removesActiveAdmin = existing.role === 'admin' && existing.status === 'active' &&
        ((updates.role !== undefined && updates.role !== 'admin') || (updates.status !== undefined && updates.status !== 'active'));
      if (removesActiveAdmin) {
        const activeAdmins = (await listUsers()).filter((user) => user.role === 'admin' && user.status === 'active').length;
        if (activeAdmins <= 1) {
          return reply.status(409).send({ error: 'Conflict', message: 'At least one active administrator is required.' });
        }
      }

      const user = await updateUser(id, updates);
      if (!user) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'User not found',
        });
      }

      logger.info(`Admin updated user '${id}'`);
      return reply.status(200).send({ data: user });
    } catch (err) {
      logger.error('Failed to update user', { error: err });
      const message = err instanceof Error ? err.message : 'Failed to update user.';
      const status = /already|registered/.test(message) ? 409 : 400;
      return reply.status(status).send({ error: status === 409 ? 'Conflict' : 'Bad Request', message });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE /api/v1/users/:id
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Soft-delete a user (set status to 'disabled').
   *
   * Requires admin role.
   */
  app.delete<{ Params: { id: string } }>('/api/v1/users/:id', {
    preHandler: [authMiddleware, requireRole('admin')],
  }, async (request, reply) => {
    const { id } = request.params;
    const actor = (request as typeof request & { user: AuthUser }).user;
    if (actor.id === id) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Administrators cannot disable their own account.' });
    }
    const existing = await findUserById(id);
    if (existing?.role === 'admin' && existing.status === 'active') {
      const activeAdmins = (await listUsers()).filter((user) => user.role === 'admin' && user.status === 'active').length;
      if (activeAdmins <= 1) {
        return reply.status(409).send({ error: 'Conflict', message: 'At least one active administrator is required.' });
      }
    }
    const deleted = await deleteUser(id);

    if (!deleted) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    logger.info(`Admin disabled user '${id}'`);
    return reply.status(200).send({
      data: { id },
      message: 'User has been disabled',
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PUT /api/v1/users/:id/reset-password
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Reset a user's password (admin only).
   *
   * Since no email service is available, admins can directly reset
   * a user's password. Body: `{ password }`.
   */
  app.put<{ Params: { id: string }; Body: { password: string } }>('/api/v1/users/:id/reset-password', {
    preHandler: [authMiddleware, requireRole('admin')],
  }, async (request, reply) => {
    const { id } = request.params;
    const { password } = request.body ?? {};

    if (!password || typeof password !== 'string' || password.length < 12) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Password must be at least 12 characters',
      });
    }

    let user;
    try {
      user = await resetUserPassword(id, password);
    } catch (error) {
      return reply.status(400).send({ error: 'Bad Request', message: error instanceof Error ? error.message : 'Password reset failed' });
    }
    if (!user) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    logger.info(`Admin reset password for user '${id}'`);
    return reply.status(200).send({ data: user, message: 'Password has been reset' });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/v1/users/roles
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Return available user roles with their permissions.
   *
   * Requires admin role.
   */
  app.get('/api/v1/users/roles', {
    preHandler: [authMiddleware, requireRole('admin')],
  }, async (_request, reply) => {
    const roles = [
      {
        id: 'admin',
        name: 'Administrator',
        permissions: [
          'users:read', 'users:write', 'users:delete',
          'analysis:read', 'analysis:write',
          'config:read', 'config:write',
          'audit:read',
          'api-keys:read', 'api-keys:write',
          'export:read', 'export:write',
        ],
      },
      {
        id: 'analyst',
        name: 'Analyst',
        permissions: [
          'analysis:read', 'analysis:write',
          'config:read',
          'audit:read',
          'export:read', 'export:write',
        ],
      },
      {
        id: 'viewer',
        name: 'Viewer',
        permissions: [
          'analysis:read',
          'config:read',
          'export:read',
        ],
      },
    ];

    return reply.status(200).send({ data: roles });
  });
}
