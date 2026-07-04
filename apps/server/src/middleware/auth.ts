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

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';
import { createLogger } from '@recurrsive/core';
import type { Role } from './rbac.js';
import { validateApiKey } from './api-keys.js';

const logger = createLogger({ context: { component: 'server:middleware:auth' } });

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Secret used for HMAC-SHA256 signing. Never rotated in dev mode. */
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'recurrsive-dev-secret';

if (JWT_SECRET === 'recurrsive-dev-secret') {
  if (process.env['NODE_ENV'] === 'production') {
    console.error(
      '[SECURITY] CRITICAL: JWT_SECRET is using the default insecure value in production. ' +
      'Set a strong JWT_SECRET environment variable before deploying.',
    );
  } else {
    console.warn('[SECURITY] JWT_SECRET is using the default dev-only value. Set JWT_SECRET in production.');
  }
}

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
}

/** Shape of the `user` object decorated onto Fastify requests. */
export interface AuthUser {
  /** User ID (from `sub` claim or API key owner). */
  id: string;
  /** Role derived from the token or API key. */
  role: Role;
  /** Authentication method used. */
  authMethod: 'jwt' | 'api-key';
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
 * @returns A signed `header.payload.signature` JWT string.
 */
export function createToken(userId: string, role: Role, ttlSeconds?: number): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (ttlSeconds ?? TOKEN_TTL_SECONDS);

  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({ sub: userId, role, iat: now, exp } satisfies TokenPayload),
  );

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
// Request authentication helpers
// ---------------------------------------------------------------------------

/**
 * Extract auth credentials from a Fastify request.
 *
 * @param request - The incoming Fastify request.
 * @returns An {@link AuthUser} or `null` if no valid credentials found.
 */
function authenticateRequest(request: FastifyRequest): AuthUser | null {
  // 1. Try Bearer token
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (payload) {
      return {
        id: payload.sub,
        role: payload.role,
        authMethod: 'jwt',
      };
    }
    // Invalid token — fall through (don't try API key if Bearer was provided)
    return null;
  }

  // 2. Try API key
  const apiKey = request.headers['x-api-key'];
  if (typeof apiKey === 'string' && apiKey.length > 0) {
    const keyInfo = validateApiKey(apiKey);
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
  const user = authenticateRequest(request);

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
  const user = authenticateRequest(request);

  if (user) {
    (request as FastifyRequest & { user: AuthUser }).user = user;
  }
};
