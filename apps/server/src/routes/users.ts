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
import { requireRole } from '../middleware/rbac.js';
import {
  createUser,
  findUserById,
  listUsers,
  updateUser,
  deleteUser,
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
    const users = listUsers();
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
    const user = findUserById(request.params.id);
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
  }, async (request, reply) => {
    const { id } = request.params;
    const updates = request.body as Partial<UpdateUserInput>;

    const user = await updateUser(id, updates);
    if (!user) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    logger.info(`Admin updated user '${id}'`);
    return reply.status(200).send({ data: user });
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
    const deleted = deleteUser(id);

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
}
