/**
 * @module @recurrsive/server/routes/invites
 *
 * Team invite system for the Recurrsive API server.
 *
 * Allows admins to invite new users by email. Invited users receive a
 * unique token they can use to accept the invite and create their own
 * account with a chosen username and password.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'node:crypto';
import { createLogger, generateId, nowISO } from '@recurrsive/core';
import { authMiddleware, createToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { store } from '../store.js';
import { createUser, findUserByEmail, findUserByUsername } from '../middleware/users.js';

const logger = createLogger({ context: { component: 'server:routes:invites' } });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** An invite record stored in the database. */
interface Invite {
  id: string;
  email: string;
  role: 'admin' | 'analyst' | 'viewer';
  invitedBy: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired';
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
}

/** Store table name for invite records. */
const INVITES_TABLE = 'invites';

/** Invite expiration period: 7 days in milliseconds. */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Minimum password length, matching the rest of the server. */
const MIN_PASSWORD_LENGTH = 8;

// ---------------------------------------------------------------------------
// Request body types
// ---------------------------------------------------------------------------

interface CreateInviteBody {
  email: string;
  role: 'admin' | 'analyst' | 'viewer';
}

interface AcceptInviteBody {
  username: string;
  password: string;
  displayName?: string;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Register team invite routes.
 *
 * Provides endpoints for creating, listing, cancelling, validating,
 * and accepting invites.
 *
 * @param app - Fastify instance.
 */
export async function registerInviteRoutes(app: FastifyInstance): Promise<void> {
  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/v1/invites
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a new invite (admin only).
   *
   * Body: `{ email, role }`. Returns the invite with token.
   */
  app.post<{ Body: CreateInviteBody }>('/api/v1/invites', {
    preHandler: [authMiddleware, requireRole('admin')],
  }, async (request, reply) => {
    const user = (request as typeof request & { user: { id: string } }).user;
    const { email, role } = request.body ?? {};

    if (!email || !role) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: '"email" and "role" are required',
      });
    }

    const validRoles = ['admin', 'analyst', 'viewer'];
    if (!validRoles.includes(role)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
      });
    }

    // Check if user with this email already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return reply.status(409).send({
        error: 'Conflict',
        message: `A user with email '${email}' already exists`,
      });
    }

    // Check for existing pending invite for this email
    const allInvites = await store.all<Invite>(INVITES_TABLE);
    const existingInvite = allInvites.find(
      (i) => i.email === email && i.status === 'pending',
    );
    if (existingInvite) {
      return reply.status(409).send({
        error: 'Conflict',
        message: `A pending invite for '${email}' already exists`,
      });
    }

    const now = nowISO();
    const invite: Invite = {
      id: generateId(),
      email,
      role,
      invitedBy: user.id,
      token: randomBytes(32).toString('hex'),
      status: 'pending',
      createdAt: now,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
    };

    await store.set<Invite>(INVITES_TABLE, invite.id, invite);

    logger.info(`Admin '${user.id}' created invite for '${email}' with role '${role}'`);
    return reply.status(201).send({ data: invite });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/v1/invites
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * List all invites (admin only).
   */
  app.get('/api/v1/invites', {
    preHandler: [authMiddleware, requireRole('admin')],
  }, async (_request, reply) => {
    const invites = await store.all<Invite>(INVITES_TABLE);
    return reply.status(200).send({
      data: invites,
      total: invites.length,
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE /api/v1/invites/:id
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Cancel a pending invite (admin only).
   */
  app.delete<{ Params: { id: string } }>('/api/v1/invites/:id', {
    preHandler: [authMiddleware, requireRole('admin')],
  }, async (request, reply) => {
    const { id } = request.params;
    const invite = await store.get<Invite>(INVITES_TABLE, id);

    if (!invite) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Invite not found',
      });
    }

    if (invite.status !== 'pending') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Cannot cancel invite with status '${invite.status}'`,
      });
    }

    await store.delete(INVITES_TABLE, id);
    logger.info(`Admin cancelled invite '${id}'`);
    return reply.status(200).send({
      data: { id },
      message: 'Invite cancelled',
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/v1/invites/:token/validate
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Validate an invite token (public — no auth required).
   *
   * Returns the invite info (email, role) if the token is valid
   * and not expired.
   */
  app.get<{ Params: { token: string } }>('/api/v1/invites/:token/validate', async (request, reply) => {
    const { token } = request.params;

    const allInvites = await store.all<Invite>(INVITES_TABLE);
    const invite = allInvites.find((i) => i.token === token);

    if (!invite) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Invalid invite token',
      });
    }

    // Check expiration
    if (new Date(invite.expiresAt) < new Date()) {
      invite.status = 'expired';
      await store.set<Invite>(INVITES_TABLE, invite.id, invite);
      return reply.status(410).send({
        error: 'Gone',
        message: 'Invite has expired',
      });
    }

    if (invite.status !== 'pending') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Invite has already been ${invite.status}`,
      });
    }

    return reply.status(200).send({
      data: {
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
      },
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/v1/invites/:token/accept
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Accept an invite and create a user account (public — no auth required).
   *
   * Body: `{ username, password, displayName }`.
   * Returns a JWT token for the newly created user.
   */
  app.post<{ Params: { token: string }; Body: AcceptInviteBody }>('/api/v1/invites/:token/accept', async (request, reply) => {
    const { token } = request.params;
    const { username, password, displayName } = request.body ?? {};

    if (!username || !password) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: '"username" and "password" are required',
      });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }

    // Find the invite by token
    const allInvites = await store.all<Invite>(INVITES_TABLE);
    const invite = allInvites.find((i) => i.token === token);

    if (!invite) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Invalid invite token',
      });
    }

    // Check expiration
    if (new Date(invite.expiresAt) < new Date()) {
      invite.status = 'expired';
      await store.set<Invite>(INVITES_TABLE, invite.id, invite);
      return reply.status(410).send({
        error: 'Gone',
        message: 'Invite has expired',
      });
    }

    if (invite.status !== 'pending') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Invite has already been ${invite.status}`,
      });
    }

    // Check username availability
    const existingUser = await findUserByUsername(username);
    if (existingUser) {
      return reply.status(409).send({
        error: 'Conflict',
        message: `Username '${username}' is already taken`,
      });
    }

    try {
      // Create the user
      const newUser = await createUser({
        username,
        email: invite.email,
        password,
        role: invite.role,
        displayName: displayName ?? username,
      });

      // Mark invite as accepted
      invite.status = 'accepted';
      invite.acceptedAt = nowISO();
      await store.set<Invite>(INVITES_TABLE, invite.id, invite);

      // Generate a JWT token for the new user
      const jwtToken = createToken(newUser.id, invite.role, undefined, username);

      logger.info(`Invite '${invite.id}' accepted by '${username}'`);
      return reply.status(201).send({
        data: {
          token: jwtToken,
          user: newUser,
        },
      });
    } catch (err) {
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: err instanceof Error ? err.message : 'Failed to create user',
      });
    }
  });
}
