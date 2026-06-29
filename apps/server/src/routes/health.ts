/**
 * @module @recurrsive/server/routes/health
 *
 * Health check and project health score routes.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { state } from '../state.js';

/**
 * Register health check routes.
 *
 * @param app - Fastify instance.
 */
export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /health
   *
   * Basic liveness probe. Always returns 200 if the server is running.
   */
  app.get('/health', async (_request, reply) => {
    const initialized = state.isInitialized();

    return reply.status(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      initialized,
      version: '0.1.0',
    });
  });

  /**
   * GET /api/v1/health-score
   *
   * Returns the computed project health score and per-dimension maturity
   * breakdown. Requires that at least one analysis has been run.
   */
  app.get('/api/v1/health-score', async (_request, reply) => {
    if (!state.isInitialized()) {
      return reply.status(503).send({
        error: 'Server not initialized',
        message: 'Run POST /api/v1/analyze with a project path first.',
      });
    }

    const cache = state.getAnalysisCache();
    if (!cache) {
      return reply.status(404).send({
        error: 'No analysis data',
        message: 'No analysis has been run yet. Trigger one via POST /api/v1/analyze.',
      });
    }

    const { overall, dimensions } = state.getHealthScore();
    const timeline = state.getEvolutionTimeline();
    const latestSnapshot = timeline.snapshots[timeline.snapshots.length - 1];

    return reply.status(200).send({
      overall_health: overall,
      dimensions,
      snapshot: latestSnapshot ?? null,
      finding_count: cache.findings.length,
      opportunity_count: cache.opportunities.length,
      analyzed_at: cache.analyzedAt,
    });
  });
}
