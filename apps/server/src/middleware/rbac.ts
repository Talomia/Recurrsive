/**
 * @module @recurrsive/server/middleware/rbac
 *
 * Role-based access control (RBAC) middleware for the Recurrsive API server.
 *
 * Defines a three-tier role hierarchy (`admin > analyst > viewer`) and
 * provides a Fastify preHandler hook factory that gates route access
 * based on a minimum required role.
 *
 * @packageDocumentation
 */

import type { FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';
import { isPublicRequest } from './auth.js';

// ---------------------------------------------------------------------------
// Role definitions
// ---------------------------------------------------------------------------

/** Supported RBAC roles, ordered from most to least privileged. */
export type Role = 'admin' | 'analyst' | 'viewer';

/**
 * Numeric privilege level per role.
 * Higher numbers mean more permissions.
 */
const ROLE_LEVELS: Record<Role, number> = {
  admin: 3,
  analyst: 2,
  viewer: 1,
} as const;

/**
 * Permission map documenting which roles can perform which actions.
 *
 * This is informational — actual enforcement happens via {@link requireRole}.
 */
export const PERMISSIONS: Record<string, Role> = {
  // Analysis
  'analysis:trigger': 'analyst',
  'analysis:view': 'viewer',
  'analysis:history': 'viewer',

  // API keys
  'api-keys:create': 'admin',
  'api-keys:list': 'viewer',
  'api-keys:revoke': 'admin',

  // Graph
  'graph:read': 'viewer',

  // Opportunities
  'opportunities:read': 'viewer',
  'opportunities:update': 'analyst',
  'opportunities:export': 'viewer',

  // Reports
  'reports:read': 'viewer',
  'reports:generate': 'analyst',

  // Policies
  'policies:read': 'viewer',
  'policies:evaluate': 'analyst',

  // Configuration
  'config:read': 'viewer',
  'config:write': 'admin',

  // Webhooks
  'webhooks:read': 'viewer',
  'webhooks:manage': 'admin',

  // Server admin
  'server:admin': 'admin',
} as const;

// ---------------------------------------------------------------------------
// Role check helpers
// ---------------------------------------------------------------------------

/**
 * Check whether a role string is a valid {@link Role}.
 *
 * @param role - Value to test.
 * @returns `true` if `role` is `'admin'`, `'analyst'`, or `'viewer'`.
 */
export function isValidRole(role: string): role is Role {
  return role === 'admin' || role === 'analyst' || role === 'viewer';
}

/**
 * Check whether `userRole` has at least the privilege level of `minRole`.
 *
 * @param userRole - The authenticated user's role.
 * @param minRole - The minimum role required for access.
 * @returns `true` if the user's role level ≥ the required level.
 */
export function hasMinRole(userRole: Role, minRole: Role): boolean {
  return ROLE_LEVELS[userRole] >= ROLE_LEVELS[minRole];
}

// ---------------------------------------------------------------------------
// Fastify preHandler hook
// ---------------------------------------------------------------------------

/**
 * Create a Fastify preHandler hook that enforces a minimum role.
 *
 * The hook expects `request.user` to be populated (by the auth middleware)
 * with an object that has a `role` property. If the user's role does
 * not meet the minimum, a 403 Forbidden response is sent.
 *
 * @param minRole - Minimum role required to access the route.
 * @returns A Fastify preHandler hook function.
 *
 * @example
 * ```ts
 * app.post('/api/v1/admin/action', {
 *   preHandler: [authMiddleware, requireRole('admin')],
 * }, handler);
 * ```
 */
export function requireRole(minRole: Role): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as FastifyRequest & { user?: { role?: string } }).user;

    if (!user) {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const userRole = user.role;

    if (!userRole || !isValidRole(userRole)) {
      reply.code(403).send({
        error: 'Forbidden',
        message: 'Invalid or missing role',
      });
      return;
    }

    if (!hasMinRole(userRole, minRole)) {
      reply.code(403).send({
        error: 'Forbidden',
        message: `Requires '${minRole}' role or higher (you have '${userRole}')`,
      });
      return;
    }
  };
}

const ADMIN_MUTATION_PREFIXES = [
  '/api/v1/api-keys',
  '/api/v1/auth/users',
  '/api/v1/config',
  '/api/v1/data-masking',
  '/api/v1/notifications',
  '/api/v1/secrets',
  '/api/v1/sso',
  '/api/v1/webhooks',
] as const;

/**
 * Global least-privilege baseline: viewers are read-only, analysts may mutate
 * ordinary project data, and security/identity/configuration mutations require
 * an administrator. Route-level checks may impose stricter requirements.
 */
export const defaultAuthorizationMiddleware: preHandlerHookHandler = async (request, reply) => {
  if (isPublicRequest(request)) return;

  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;

  const pathname = request.url.split('?')[0] ?? request.url;
  const selfService = pathname === '/api/v1/auth/change-password' ||
    pathname === '/api/v1/auth/refresh' ||
    pathname === '/api/v1/auth/logout';
  const minimum: Role = selfService
    ? 'viewer'
    : ADMIN_MUTATION_PREFIXES.some((prefix) =>
        pathname === prefix || pathname.startsWith(`${prefix}/`),
      ) ? 'admin' : 'analyst';
  const user = (request as FastifyRequest & { user?: { role?: string } }).user;
  if (!user?.role || !isValidRole(user.role) || !hasMinRole(user.role, minimum)) {
    reply.code(403).send({
      error: 'Forbidden',
      message: `Requires '${minimum}' role or higher`,
    });
  }
};
