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

/** Secret used for HMAC-SHA256 signing. */
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'recurrsive-dev-secret';

const INSECURE_JWT_SECRETS = new Set([
  '',
  'recurrsive-dev-secret',
  'change-me-in-production',
  'SET_IN_EASYPANEL_SECRET_MINIMUM_32_CHARACTERS',
  'changeme',
  'secret',
]);

/**
 * Reject unsafe authentication configuration before a production server starts.
 * Keeping this as an explicit assertion makes the invariant testable and avoids
 * terminating the process while modules are being imported.
 */
export function assertProductionAuthConfig(): void {
  if (process.env['NODE_ENV'] !== 'production') {
    if (INSECURE_JWT_SECRETS.has(JWT_SECRET)) {
      logger.warn('JWT_SECRET is using a development-only value.');
    }
    return;
  }

  if (INSECURE_JWT_SECRETS.has(JWT_SECRET) || JWT_SECRET.length < 32) {
    throw new Error(
      'Refusing to start in production: JWT_SECRET must be a unique random value of at least 32 characters.',
    );
  }

  if (process.env['ALLOW_DEMO_USERS'] === 'true') {
    throw new Error('Refusing to start in production: demo users cannot be enabled.');
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
  /** Optional username (present for local/SSO users, absent for API keys). */
  username?: string;
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

  const tokenPayload: TokenPayload = { sub: userId, role, iat: now, exp };
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
async function authenticateRequest(request: FastifyRequest): Promise<AuthUser | null> {
  // 1. Try Bearer token
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (payload) {
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
async function requireAuthentication(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
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
}

export const authMiddleware: preHandlerHookHandler = requireAuthentication;

/**
 * Public endpoints are intentionally enumerated. Every other HTTP route is
 * authenticated by default, including routes added in the future.
 */
export function isPublicRoute(method: string, pathname: string): boolean {
  if (method === 'OPTIONS') return true;
  const exact = `${method} ${pathname}`;
  if (
    exact === 'GET /health' ||
    exact === 'GET /api/v1/setup/status' ||
    exact === 'POST /api/v1/setup' ||
    exact === 'POST /api/v1/auth/login' ||
    exact === 'POST /api/v1/contact' ||
    exact === 'GET /api/v1/openapi.json' ||
    exact === 'GET /api/docs' ||
    exact === 'GET /ws'
  ) {
    return true;
  }

  // SSO initiation and the identity-provider callback must be reachable before
  // a Recurrsive session exists. Invite recipients likewise need to validate
  // and accept their one-time token before they have a session. Provider and
  // invite administration remain protected.
  return (
    method === 'GET' && /^\/api\/v1\/sso\/login\/[^/]+$/.test(pathname)
  ) || (
    method === 'POST' && /^\/api\/v1\/sso\/callback\/[^/]+$/.test(pathname)
  ) || (
    method === 'GET' && /^\/api\/v1\/invites\/[^/]+\/validate$/.test(pathname)
  ) || (
    method === 'POST' && /^\/api\/v1\/invites\/[^/]+\/accept$/.test(pathname)
  );
}

export function isPublicRequest(request: FastifyRequest): boolean {
  return isPublicRoute(request.method, request.url.split('?')[0] ?? request.url);
}

/** Global default-deny authentication hook. */
export const defaultAuthMiddleware: preHandlerHookHandler = async (request, reply) => {
  if (isPublicRequest(request)) return;
  await requireAuthentication(request, reply);
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
