/**
 * @module @recurrsive/server/middleware/auth
 *
 * JWT and API key authentication middleware for the Recurrsive API server.
 *
 * JWT tokens are created and verified using HMAC-SHA256 via Node.js
 * `crypto` — no external JWT library is used. API key authentication
 * delegates to the {@link @recurrsive/server/middleware/api-keys} module.
 *
 * Two authentication methods are supported:
 * 1. `Authorization: Bearer <jwt-token>`
 * 2. `X-API-Key: <api-key>`
 *
 * @packageDocumentation
 */

import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import type { FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';
import { createLogger } from '@recurrsive/core';
import type { Role } from './rbac.js';
import { validateApiKey } from './api-keys.js';
import { store } from '../store.js';

const logger = createLogger({ context: { component: 'server:middleware:auth' } });

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Secret used for HMAC-SHA256 signing. Never rotated in dev mode. */
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'recurrsive-dev-secret';

/**
 * Insecure placeholder secrets that must never be used in production. This
 * includes the dev default and the deployment-template placeholder that
 * easypanel.json ships with, which forces the operator to set a real secret.
 */
const INSECURE_SECRETS = new Set([
  'recurrsive-dev-secret',
  'REPLACE_WITH_STRONG_SECRET',
  // The placeholder the docker-compose file and .env.example ship with — the
  // server must refuse to start in production while still using it, otherwise
  // the whole guard is defeated by the project's own default config.
  'change-me-in-production',
  'changeme',
  'secret',
]);

if (INSECURE_SECRETS.has(JWT_SECRET)) {
  if (process.env['NODE_ENV'] === 'production') {
    logger.error(
      'CRITICAL: JWT_SECRET is using an insecure placeholder value in production. ' +
      'Set a strong, unique JWT_SECRET environment variable before deploying.',
    );
    process.exit(1);
  } else {
    logger.warn('JWT_SECRET is using an insecure placeholder value. Set JWT_SECRET in production.');
  }
}

/** Store table holding revoked JWT ids (jti → expiry unix seconds). */
const REVOKED_TOKENS_TABLE = 'revoked_tokens';

/** Default token lifetime in seconds (1 hour). */
const TOKEN_TTL_SECONDS = 3600;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Payload embedded within a JWT token. */
export interface TokenPayload {
  /** Subject — the user ID. */
  sub: string;
  /** The user's role. */
  role: Role;
  /** Issued-at timestamp (Unix seconds). */
  iat: number;
  /** Expiry timestamp (Unix seconds). */
  exp: number;
  /** Optional username (present for local/SSO users, absent for API keys). */
  username?: string;
  /** Unique token id, used for revocation. */
  jti: string;
}

/** Shape of the `user` object decorated onto Fastify requests. */
export interface AuthUser {
  /** User ID (from `sub` claim or API key owner). */
  id: string;
  /** Role derived from the token or API key. */
  role: Role;
  /** Authentication method used. */
  authMethod: 'jwt' | 'api-key';
  /** Username (present when authenticated via JWT with a username claim). */
  username?: string;
}

// ---------------------------------------------------------------------------
// Base64-URL helpers
// ---------------------------------------------------------------------------

/**
 * Encode a buffer or string to base64url (no padding).
 *
 * @param input - Data to encode.
 * @returns Base64url-encoded string.
 */
function base64UrlEncode(input: string | Buffer): string {
  const b64 = Buffer.from(input).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode a base64url string to a UTF-8 string.
 *
 * @param input - Base64url-encoded string.
 * @returns Decoded UTF-8 string.
 */
function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64').toString('utf-8');
}

// ---------------------------------------------------------------------------
// HMAC-SHA256 JWT implementation
// ---------------------------------------------------------------------------

/**
 * Sign a JWT header+payload pair.
 *
 * @param headerPayload - The `header.payload` portion to sign.
 * @returns The HMAC-SHA256 signature as a base64url string.
 */
function sign(headerPayload: string): string {
  const sig = createHmac('sha256', JWT_SECRET).update(headerPayload).digest();
  return base64UrlEncode(sig);
}

/**
 * Create a signed JWT token.
 *
 * @param userId - User identifier (`sub` claim).
 * @param role - Role to embed in the token.
 * @param ttlSeconds - Token time-to-live in seconds (default: 3600).
 * @param username - Optional username to embed in the token.
 * @returns A signed `header.payload.signature` JWT string.
 */
export function createToken(userId: string, role: Role, ttlSeconds?: number, username?: string): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (ttlSeconds ?? TOKEN_TTL_SECONDS);

  const tokenPayload: TokenPayload = { sub: userId, role, iat: now, exp, jti: randomUUID() };
  if (username) {
    tokenPayload.username = username;
  }

  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify(tokenPayload));

  const signature = sign(`${header}.${payload}`);
  return `${header}.${payload}.${signature}`;
}

/**
 * Verify and decode a JWT token.
 *
 * Checks the HMAC-SHA256 signature using timing-safe comparison,
 * then verifies the `exp` claim.
 *
 * @param token - The raw JWT string.
 * @returns The decoded {@link TokenPayload} or `null` if invalid/expired.
 */
export function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [header, payload, signature] = parts as [string, string, string];

  // Validate the header algorithm BEFORE trusting the signature. Reject any
  // token that does not explicitly declare HS256 (defends against `alg: none`
  // and algorithm-confusion attacks).
  try {
    const decodedHeader = JSON.parse(base64UrlDecode(header)) as { alg?: unknown; typ?: unknown };
    if (decodedHeader.alg !== 'HS256') {
      return null;
    }
  } catch {
    return null;
  }

  // Verify signature
  const expectedSig = sign(`${header}.${payload}`);

  // Timing-safe comparison
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  // Decode payload
  try {
    const decoded = JSON.parse(base64UrlDecode(payload)) as TokenPayload;

    // Validate required fields
    if (
      typeof decoded.sub !== 'string' ||
      typeof decoded.role !== 'string' ||
      typeof decoded.iat !== 'number' ||
      typeof decoded.exp !== 'number'
    ) {
      return null;
    }

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp <= now) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Token revocation (store-backed)
// ---------------------------------------------------------------------------

/**
 * Revoke a token by recording its `jti` (with expiry) in the store. Once
 * revoked, {@link isTokenRevoked} returns true until the token would have
 * expired anyway, at which point the record is pruned lazily.
 *
 * @param payload - The decoded payload of the token to revoke.
 */
export async function revokeToken(payload: TokenPayload): Promise<void> {
  if (!payload.jti) return;
  try {
    await store.set<{ exp: number }>(REVOKED_TOKENS_TABLE, payload.jti, { exp: payload.exp });
  } catch (err) {
    logger.warn(`Failed to persist token revocation: ${err instanceof Error ? err.message : err}`);
  }
}

/**
 * Check whether a token id has been revoked. Expired revocation records are
 * pruned lazily on read.
 *
 * @param jti - The token id to check.
 * @returns `true` if the token is revoked and still within its lifetime.
 */
export async function isTokenRevoked(jti: string | undefined): Promise<boolean> {
  if (!jti) return false;
  try {
    const record = await store.get<{ exp: number }>(REVOKED_TOKENS_TABLE, jti);
    if (!record) return false;
    const now = Math.floor(Date.now() / 1000);
    if (record.exp <= now) {
      // Already expired — no longer needs to be tracked.
      await store.delete(REVOKED_TOKENS_TABLE, jti);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Request authentication helpers
// ---------------------------------------------------------------------------

/**
 * Extract auth credentials from a Fastify request.
 *
 * @param request - The incoming Fastify request.
 * @returns An {@link AuthUser} or `null` if no valid credentials found.
 */
async function authenticateRequest(request: FastifyRequest): Promise<AuthUser | null> {
  // 1. Try Bearer token
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (payload) {
      // Reject tokens that have been explicitly revoked (e.g. via logout).
      if (await isTokenRevoked(payload.jti)) {
        return null;
      }
      const user: AuthUser = {
        id: payload.sub,
        role: payload.role,
        authMethod: 'jwt',
      };
      if (payload.username) {
        user.username = payload.username;
      }
      return user;
    }
    // Invalid token — fall through (don't try API key if Bearer was provided)
    return null;
  }

  // 2. Try API key
  const apiKey = request.headers['x-api-key'];
  if (typeof apiKey === 'string' && apiKey.length > 0) {
    const keyInfo = await validateApiKey(apiKey);
    if (keyInfo) {
      return {
        id: keyInfo.userId,
        role: keyInfo.role,
        authMethod: 'api-key',
      };
    }
    return null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Fastify preHandler hooks
// ---------------------------------------------------------------------------

/**
 * Mandatory authentication middleware.
 *
 * Decorates `request.user` with an {@link AuthUser} on success.
 * Responds with 401 Unauthorized on failure.
 *
 * @example
 * ```ts
 * app.get('/api/v1/me', { preHandler: authMiddleware }, handler);
 * ```
 */
export const authMiddleware: preHandlerHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const user = await authenticateRequest(request);

  if (!user) {
    logger.debug(`Authentication failed for ${request.method} ${request.url}`);
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Valid authentication required — use Authorization: Bearer <token> or X-API-Key header',
    });
    return;
  }

  // Decorate the request
  (request as FastifyRequest & { user: AuthUser }).user = user;
};

/**
 * Optional authentication middleware.
 *
 * Decorates `request.user` with an {@link AuthUser} if valid credentials
 * are present, but does **not** reject the request if they are absent
 * or invalid.
 *
 * @example
 * ```ts
 * app.get('/api/v1/public', { preHandler: optionalAuth }, handler);
 * ```
 */
export const optionalAuth: preHandlerHookHandler = async (
  request: FastifyRequest,
  _reply: FastifyReply,
) => {
  const user = await authenticateRequest(request);

  if (user) {
    (request as FastifyRequest & { user: AuthUser }).user = user;
  }
};
