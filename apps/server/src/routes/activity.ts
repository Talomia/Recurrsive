/**
 * @module @recurrsive/server/routes/activity
 *
 * Activity feed and statistics routes.
 *
 * Provides a unified activity feed aggregating analysis runs,
 * configuration changes, and user actions, plus activity statistics.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { createLogger, nowISO } from '@recurrsive/core';
import { state } from '../state.js';
import { authMiddleware } from '../middleware/auth.js';
import { getAuditEvents } from '../middleware/audit.js';

const logger = createLogger({ context: { component: 'server:routes:activity' } });

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Register activity feed and statistics routes.
 *
 * @param app - Fastify instance.
 */
export async function registerActivityRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/activity/feed
   *
   * Return recent activity feed aggregating analysis runs,
   * audit events, and system actions.
   *
   * Query params:
   * - limit: max items (default: 50, max: 200)
   * - offset: pagination offset (default: 0)
   * - type: filter by activity type (analysis, config, user, system)
   */
  app.get<{ Querystring: { limit?: string; offset?: string; type?: string } }>(
    '/api/v1/activity/feed',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const limit = Math.min(200, Math.max(1, parseInt(request.query.limit ?? '50', 10) || 50));
      const offset = Math.max(0, parseInt(request.query.offset ?? '0', 10) || 0);
      const typeFilter = request.query.type;

      interface ActivityItem {
        id: string;
        type: string;
        action: string;
        description: string;
        timestamp: string;
        metadata: Record<string, unknown>;
      }

      const activities: ActivityItem[] = [];

      // 1. Analysis runs
      if (!typeFilter || typeFilter === 'analysis') {
        const history = state.isInitialized() ? state.getAnalysisHistory() : [];
        for (const entry of history) {
          activities.push({
            id: `activity_analysis_${entry.id}`,
            type: 'analysis',
            action: entry.status === 'success' ? 'analysis_completed' : 'analysis_failed',
            description: entry.status === 'success'
              ? `Analysis completed with ${entry.findingCount} findings and ${entry.opportunityCount} opportunities`
              : `Analysis failed: ${entry.error ?? 'unknown error'}`,
            timestamp: entry.completedAt,
            metadata: {
              finding_count: entry.findingCount,
              opportunity_count: entry.opportunityCount,
              duration_ms: entry.durationMs,
              include_reasoning: entry.includeReasoning,
            },
          });
        }
      }

      // 2. Audit events (config changes, user actions)
      if (!typeFilter || typeFilter === 'config' || typeFilter === 'user') {
        try {
          const { events: auditEvents } = getAuditEvents({ limit: 100 });
          for (const event of auditEvents) {
            const activityType = event.action === 'auth' ? 'user' :
                                 event.action === 'admin' ? 'config' : 'system';

            if (typeFilter && activityType !== typeFilter) continue;

            activities.push({
              id: `activity_audit_${event.id}`,
              type: activityType,
              action: `${event.method} ${event.url}`,
              description: `${event.method} ${event.url} — ${event.statusCode}`,
              timestamp: event.timestamp,
              metadata: {
                user_id: event.userId,
                method: event.method,
                url: event.url,
                status_code: event.statusCode,
              },
            });
          }
        } catch {
          // Audit events may not be available
        }
      }

      // Sort by timestamp descending
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const total = activities.length;
      const paginated = activities.slice(offset, offset + limit);

      logger.debug(`Returning ${paginated.length} of ${total} activity items`);

      return reply.status(200).send({
        data: paginated,
        total,
        limit,
        offset,
      });
    },
  );

  /**
   * GET /api/v1/activity/stats
   *
   * Return activity statistics: counts by type, recent activity rate,
   * and peak activity periods.
   */
  app.get('/api/v1/activity/stats', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const history = state.isInitialized() ? state.getAnalysisHistory() : [];
    const successfulRuns = history.filter(h => h.status === 'success');
    const failedRuns = history.filter(h => h.status === 'error');

    // Activity in last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentRuns = history.filter(h => h.completedAt >= oneDayAgo);

    // Activity in last 7 days
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const weeklyRuns = history.filter(h => h.completedAt >= oneWeekAgo);

    // Audit event counts
    let auditTotal = 0;
    let recentAuditCount = 0;
    try {
      const { events: auditEvents } = getAuditEvents({ limit: 1000 });
      auditTotal = auditEvents.length;
      recentAuditCount = auditEvents.filter(e => e.timestamp >= oneDayAgo).length;
    } catch {
      // Audit not available
    }

    return reply.status(200).send({
      data: {
        total_analysis_runs: history.length,
        successful_runs: successfulRuns.length,
        failed_runs: failedRuns.length,
        total_audit_events: auditTotal,
        recent_24h: {
          analysis_runs: recentRuns.length,
          audit_events: recentAuditCount,
        },
        recent_7d: {
          analysis_runs: weeklyRuns.length,
        },
        avg_findings_per_run: successfulRuns.length > 0
          ? Math.round(successfulRuns.reduce((s, r) => s + r.findingCount, 0) / successfulRuns.length)
          : 0,
        avg_duration_ms: successfulRuns.length > 0
          ? Math.round(successfulRuns.reduce((s, r) => s + r.durationMs, 0) / successfulRuns.length)
          : 0,
      },
      generatedAt: nowISO(),
    });
  });
}
