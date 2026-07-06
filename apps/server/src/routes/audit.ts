/**
 * @module @recurrsive/server/routes/audit
 *
 * Enhanced audit trail routes for querying audit log events and statistics.
 *
 * Replaces the original stub with endpoints backed by the audit middleware's
 * in-memory circular buffer. Both routes require authentication with at least
 * `analyst` role.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import {
  getAuditEvents,
  getAuditStats,
} from '../middleware/audit.js';
import type {
  AuditAction,
  AuditEventFilter,
} from '../middleware/audit.js';

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Register enhanced audit trail routes.
 *
 * Routes:
 * - `GET /api/v1/audit` — List audit events with optional filters.
 * - `GET /api/v1/audit/stats` — Aggregated audit statistics.
 *
 * Both routes require `analyst` role or above.
 *
 * @param app - Fastify instance.
 */
export async function registerAuditRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/audit
   *
   * List audit events with optional filters and pagination.
   *
   * Query parameters:
   * - `action` — Filter by action: `read`, `write`, `delete`, `auth`, `admin`.
   * - `userId` — Filter by user ID.
   * - `method` — Filter by HTTP method: `GET`, `POST`, `PUT`, `DELETE`, etc.
   * - `status` — Filter by status group: `2xx`, `4xx`, `5xx`.
   * - `from` — ISO-8601 timestamp, include events on or after this time.
   * - `to` — ISO-8601 timestamp, include events on or before this time.
   * - `limit` — Max events to return (default 100, max 1000).
   * - `offset` — Pagination offset (default 0).
   */
  app.get<{
    Querystring: {
      action?: string;
      userId?: string;
      method?: string;
      status?: string;
      from?: string;
      to?: string;
      limit?: string;
      offset?: string;
    };
  }>('/api/v1/audit', {
    preHandler: [authMiddleware, requireRole('analyst')],
  }, async (request, reply) => {
    const query = request.query;

    const filters: AuditEventFilter = {};

    // Validate action filter
    if (query.action) {
      const validActions: AuditAction[] = ['read', 'write', 'delete', 'auth', 'admin'];
      if (validActions.includes(query.action as AuditAction)) {
        filters.action = query.action as AuditAction;
      } else {
        return reply.status(400).send({
          error: 'Invalid filter',
          message: `Invalid action '${query.action}'. Valid values: ${validActions.join(', ')}`,
        });
      }
    }

    if (query.userId) {
      filters.userId = query.userId;
    }

    if (query.method) {
      filters.method = query.method;
    }

    // Validate status filter
    if (query.status) {
      const validStatuses = ['2xx', '3xx', '4xx', '5xx'];
      if (validStatuses.includes(query.status)) {
        filters.status = query.status;
      } else {
        return reply.status(400).send({
          error: 'Invalid filter',
          message: `Invalid status '${query.status}'. Valid values: ${validStatuses.join(', ')}`,
        });
      }
    }

    if (query.from) {
      filters.from = query.from;
    }

    if (query.to) {
      filters.to = query.to;
    }

    if (query.limit) {
      const parsed = parseInt(query.limit, 10);
      if (!isNaN(parsed)) {
        filters.limit = parsed;
      }
    }

    if (query.offset) {
      const parsed = parseInt(query.offset, 10);
      if (!isNaN(parsed)) {
        filters.offset = parsed;
      }
    }

    const { events, total } = getAuditEvents(filters);

    return reply.status(200).send({
      data: events,
      total,
      limit: filters.limit ?? 100,
      offset: filters.offset ?? 0,
    });
  });

  /**
   * GET /api/v1/audit/stats
   *
   * Return aggregated audit statistics including totals by action,
   * user, status group, and recent errors.
   */
  app.get('/api/v1/audit/stats', {
    preHandler: [authMiddleware, requireRole('analyst')],
  }, async (_request, reply) => {
    const stats = getAuditStats();

    return reply.status(200).send({
      data: stats,
    });
  });

  /**
   * GET /api/v1/audit/summary
   *
   * Return summary statistics of audit events.
   * Derived from the same data as /audit/stats but in a simplified shape.
   */
  app.get('/api/v1/audit/summary', {
    preHandler: [authMiddleware, requireRole('analyst')],
  }, async (_request, reply) => {
    const stats = getAuditStats();

    // Count recent events (last 24 hours)
    const { events: allEvents } = getAuditEvents({ limit: 1000 });
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentCount = allEvents.filter(e => e.timestamp >= oneDayAgo).length;

    return reply.status(200).send({
      data: {
        total_events: stats.total,
        by_action: stats.byAction,
        recent_count: recentCount,
      },
    });
  });
}
