/**
 * @module @recurrsive/server/routes/setup
 *
 * First-run setup wizard routes.
 *
 * Provides endpoints for checking setup status and creating the initial
 * admin user. These routes require NO authentication — they are only
 * functional when the system has zero users (first-run state).
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { createLogger } from '@recurrsive/core';
import { createToken } from '../middleware/auth.js';
import { createUser, countUsers } from '../middleware/users.js';

const logger = createLogger({ context: { component: 'server:routes:setup' } });

// ---------------------------------------------------------------------------
// Request body types
// ---------------------------------------------------------------------------

interface SetupBody {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Register setup wizard routes.
 *
 * These routes are always available (no auth required) but only perform
 * actions when the system has no users (initial setup).
 *
 * @param app - Fastify instance.
 */
export async function registerSetupRoutes(app: FastifyInstance): Promise<void> {
  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/v1/setup/status
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check whether initial setup is required.
   *
   * Returns whether the system has any users and whether setup is needed.
   * No authentication required.
   */
  app.get('/api/v1/setup/status', async (_request, reply) => {
    const userCount = countUsers();
    return reply.status(200).send({
      data: {
        setupRequired: userCount === 0,
        hasUsers: userCount > 0,
      },
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/v1/setup
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create the first admin user (initial setup).
   *
   * Only works when the system has zero users. After the first admin is
   * created, subsequent calls return 409 Conflict.
   */
  app.post<{ Body: SetupBody }>('/api/v1/setup', async (request, reply) => {
    // Check if setup is already complete
    if (countUsers() > 0) {
      return reply.status(409).send({
        error: 'Conflict',
        message: 'Setup has already been completed. Use the admin panel to manage users.',
      });
    }

    const { username, email, password, displayName } = request.body ?? {};

    if (!username || !email || !password) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: '"username", "email", and "password" are required for initial setup',
      });
    }

    try {
      const user = await createUser({
        username,
        email,
        password,
        role: 'admin',
        displayName: displayName ?? username,
      });

      const token = createToken(user.id, 'admin', undefined, user.username);

      logger.info(`Initial setup completed — admin user '${username}' created`);

      return reply.status(201).send({
        data: {
          token,
          user,
        },
        message: 'Setup complete — first admin user created',
      });
    } catch (err) {
      logger.error(`Setup failed: ${err instanceof Error ? err.message : String(err)}`);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: err instanceof Error ? err.message : 'Failed to create admin user',
      });
    }
  });
}
