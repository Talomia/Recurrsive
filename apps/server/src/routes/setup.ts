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

/** Minimum password length, matching the rest of the server. */
const MIN_PASSWORD_LENGTH = 8;

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
// First-admin creation lock
// ---------------------------------------------------------------------------

/**
 * Serializes the `countUsers() === 0` check and the subsequent
 * `createUser(admin)` so they execute as one atomic step per process.
 *
 * Without this, two concurrent POST /api/v1/setup requests can both observe
 * zero users and both create an admin account (classic TOCTOU). The promise
 * chain guarantees the check-and-create critical sections run strictly one
 * after another, so exactly one request wins and every other sees the created
 * user and gets 409.
 *
 * NOTE: this is an in-process lock. It is fully correct for the supported
 * single-process deployment; a horizontally scaled deployment sharing one
 * PostgreSQL store would additionally need a DB-level guard (e.g. a unique
 * sentinel row) to be race-free across processes.
 */
let setupLock: Promise<unknown> = Promise.resolve();

function withSetupLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = setupLock.then(fn);
  // Keep the chain alive even when fn rejects, so one failed attempt does not
  // wedge or reject subsequent setup requests.
  setupLock = run.catch(() => undefined);
  return run;
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
    const userCount = await countUsers();
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
    // Fast-path rejection when setup is already complete. This check is
    // advisory only — the authoritative, race-free check happens inside
    // withSetupLock() below.
    if ((await countUsers()) > 0) {
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

    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }

    try {
      // Atomic create-if-zero: the user count is re-checked and the admin is
      // created inside the lock, so two concurrent first-run requests cannot
      // both become admin.
      const user = await withSetupLock(async () => {
        if ((await countUsers()) > 0) return null;
        return createUser({
          username,
          email,
          password,
          role: 'admin',
          displayName: displayName ?? username,
        });
      });

      if (!user) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'Setup has already been completed. Use the admin panel to manage users.',
        });
      }

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
