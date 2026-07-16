/**
 * @module @recurrsive/server/routes/timeline
 *
 * Evolution timeline, snapshot listing, and trend data routes.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { state } from '../state.js';
import { authMiddleware } from '../middleware/auth.js';

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
  app.get('/api/v1/timeline', { preHandler: [authMiddleware] }, async (_request, reply) => {
    if (!state.isInitialized()) {
      return reply.status(503).send({
        error: 'Server not initialized',
        message: 'Run POST /api/v1/analyze first.',
      });
    }

    const timeline = state.getEvolutionTimeline();

    // Derive events from real analysis history using each run's recorded score.
    const history = state.getAnalysisHistory();
    const events = history
      .filter(h => h.status === 'success' && typeof h.healthScore === 'number')
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .map(entry => {
        const score = entry.healthScore!;
        return {
          id: entry.id,
          type: score >= 80 ? 'milestone' : score >= 50 ? 'analysis' : 'incident',
          timestamp: entry.completedAt,
          title: `Analysis completed`,
          description: `Produced ${entry.findingCount} findings and ${entry.opportunityCount} opportunities in ${Math.round(entry.durationMs / 1000)}s`,
          metadata: {
            finding_count: entry.findingCount,
            opportunity_count: entry.opportunityCount,
            duration_ms: entry.durationMs,
            health_score: score,
            include_reasoning: entry.includeReasoning,
          },
        };
      });

    return reply.status(200).send({
      data: {
        ...timeline,
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
  app.get('/api/v1/timeline/snapshots', { preHandler: [authMiddleware] }, async (_request, reply) => {
    if (!state.isInitialized()) {
      return reply.status(503).send({
        error: 'Server not initialized',
        message: 'Run POST /api/v1/analyze first.',
      });
    }

    const timeline = state.getEvolutionTimeline();
    const snapshots = [...timeline.snapshots].reverse();

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
  app.get('/api/v1/timeline/trends', { preHandler: [authMiddleware] }, async (_request, reply) => {
    if (!state.isInitialized()) {
      return reply.status(503).send({
        error: 'Server not initialized',
        message: 'Run POST /api/v1/analyze first.',
      });
    }

    const timeline = state.getEvolutionTimeline();

    // If no pre-computed trends, derive them from snapshots
    if (timeline.trends.length > 0) {
      return reply.status(200).send({
        data: timeline.trends,
        total: timeline.trends.length,
      });
    }

    // Derive trend series from snapshot maturity scores
    const dimensionMap = new Map<string, Array<{ timestamp: string; value: number }>>();

    for (const snapshot of timeline.snapshots) {
      for (const score of snapshot.maturity_scores) {
        let points = dimensionMap.get(score.dimension);
        if (!points) {
          points = [];
          dimensionMap.set(score.dimension, points);
        }
        points.push({
          timestamp: snapshot.timestamp,
          value: score.score,
        });
      }

      // Also add overall health as a trend
      let healthPoints = dimensionMap.get('overall_health');
      if (!healthPoints) {
        healthPoints = [];
        dimensionMap.set('overall_health', healthPoints);
      }
      healthPoints.push({
        timestamp: snapshot.timestamp,
        value: snapshot.overall_health,
      });
    }

    const trends = Array.from(dimensionMap.entries()).map(([dimension, data_points]) => ({
      dimension,
      data_points,
    }));

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
      if (!state.isInitialized()) {
        return reply.status(503).send({
          error: 'Server not initialized',
          message: 'Run POST /api/v1/analyze first.',
        });
      }

      const limit = Math.min(100, Math.max(1, parseInt(request.query.limit ?? '50', 10) || 50));
      const offset = Math.max(0, parseInt(request.query.offset ?? '0', 10) || 0);

      // Build events from analysis history using each run's recorded score.
      const history = state.getAnalysisHistory();
      const events = history
        .filter(h => h.status === 'success' && typeof h.healthScore === 'number')
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        .map(entry => {
          const score = entry.healthScore!;
          return {
            id: entry.id,
            type: score >= 80 ? 'milestone' : score >= 50 ? 'analysis' : 'incident',
            timestamp: entry.completedAt,
            title: `Analysis completed`,
            description: `Produced ${entry.findingCount} findings and ${entry.opportunityCount} opportunities in ${Math.round(entry.durationMs / 1000)}s`,
            metadata: {
              finding_count: entry.findingCount,
              opportunity_count: entry.opportunityCount,
              duration_ms: entry.durationMs,
              health_score: score,
              include_reasoning: entry.includeReasoning,
            },
          };
        });

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
