/**
 * @module @recurrsive/server/routes/timeline
 *
 * Evolution timeline, snapshot listing, and trend data routes.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import { requireProjectScope, resolveAnalysisHistory } from '../project-analysis.js';
import type { AnalysisHistoryEntry } from '../state.js';

function successfulHistory(history: AnalysisHistoryEntry[]) {
  return history
    .filter((entry) => entry.status === 'success' && entry.healthScore !== null)
    .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());
}

function snapshotsFromHistory(history: AnalysisHistoryEntry[]) {
  const successful = successfulHistory(history);
  return successful.map((entry, index) => {
    const previous = successful[index - 1];
    return {
      id: entry.id,
      timestamp: entry.completedAt,
      maturity_scores: [],
      overall_health: entry.healthScore!,
      opportunity_count: entry.opportunityCount,
      debt_count: 0,
      risk_count: entry.findingCount,
      top_opportunities: [],
      changes_since_last: {
        new_opportunities: Math.max(0, entry.opportunityCount - (previous?.opportunityCount ?? 0)),
        resolved_opportunities: Math.max(0, (previous?.opportunityCount ?? 0) - entry.opportunityCount),
        new_risks: Math.max(0, entry.findingCount - (previous?.findingCount ?? 0)),
        resolved_risks: Math.max(0, (previous?.findingCount ?? 0) - entry.findingCount),
        maturity_changes: [],
      },
    };
  });
}

function eventsFromHistory(history: AnalysisHistoryEntry[]) {
  return successfulHistory(history).reverse().map((entry) => ({
    id: entry.id,
    type: entry.healthScore! >= 80 ? 'milestone' : entry.healthScore! >= 50 ? 'analysis' : 'incident',
    timestamp: entry.completedAt,
    title: 'Analysis completed',
    description: `Produced ${entry.findingCount} findings and ${entry.opportunityCount} opportunities in ${Math.round(entry.durationMs / 1000)}s`,
    metadata: {
      finding_count: entry.findingCount,
      opportunity_count: entry.opportunityCount,
      duration_ms: entry.durationMs,
      health_score: entry.healthScore,
      include_reasoning: entry.includeReasoning,
    },
  }));
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Register evolution timeline routes.
 *
 * @param app - Fastify instance.
 */
export async function registerTimelineRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/timeline
   *
   * Return the full evolution timeline for the project, including all
   * snapshots and derived trend series.
   */
  app.get('/api/v1/timeline', { preHandler: [authMiddleware] }, async (request, reply) => {
    const project = await requireProjectScope(request);
    const history = await resolveAnalysisHistory(request);
    const snapshots = snapshotsFromHistory(history);
    const events = eventsFromHistory(history);

    return reply.status(200).send({
      data: {
        project_id: project.id,
        snapshots,
        trends: [{ dimension: 'overall_health', data_points: snapshots.map((snapshot) => ({ timestamp: snapshot.timestamp, value: snapshot.overall_health })) }],
        events,
      },
    });
  });

  /**
   * GET /api/v1/timeline/snapshots
   *
   * Return the list of evolution snapshots, ordered by timestamp
   * (newest first). Each snapshot captures the project's maturity
   * state at a point in time.
   */
  app.get('/api/v1/timeline/snapshots', { preHandler: [authMiddleware] }, async (request, reply) => {
    const snapshots = snapshotsFromHistory(await resolveAnalysisHistory(request)).reverse();

    return reply.status(200).send({
      data: snapshots,
      total: snapshots.length,
    });
  });

  /**
   * GET /api/v1/timeline/trends
   *
   * Return trend data series for charting maturity dimensions over
   * time. Each series contains ordered data points with timestamps
   * and values.
   */
  app.get('/api/v1/timeline/trends', { preHandler: [authMiddleware] }, async (request, reply) => {
    const snapshots = snapshotsFromHistory(await resolveAnalysisHistory(request));

    const trends = [{
      dimension: 'overall_health',
      data_points: snapshots.map((snapshot) => ({
        timestamp: snapshot.timestamp,
        value: snapshot.overall_health,
      })),
    }];

    return reply.status(200).send({
      data: trends,
      total: trends.length,
    });
  });

  /**
   * GET /api/v1/timeline/events
   *
   * Return timeline events with limit/offset pagination.
   * Events are derived from evolution snapshots and analysis history.
   */
  app.get<{ Querystring: { limit?: string; offset?: string } }>(
    '/api/v1/timeline/events',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const limit = Math.min(100, Math.max(1, parseInt(request.query.limit ?? '50', 10) || 50));
      const offset = Math.max(0, parseInt(request.query.offset ?? '0', 10) || 0);

      // Build events from analysis history
      const events = eventsFromHistory(await resolveAnalysisHistory(request));

      const total = events.length;
      const paginated = events.slice(offset, offset + limit);

      return reply.status(200).send({
        data: paginated,
        total,
        limit,
      });
    },
  );
}
