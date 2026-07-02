/**
 * @module @recurrsive/server/routes/health
 *
 * Health check and project health score routes.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { VERSION } from '@recurrsive/core';
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
      version: VERSION,
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

    // Compute trends from analysis history
    const history = state.getAnalysisHistory();
    let healthTrend = 0;
    if (history.length >= 2) {
      const prev = history[history.length - 2]!;
      const current = history[history.length - 1]!;
      healthTrend = current.findingCount < prev.findingCount
        ? Math.round((1 - current.findingCount / Math.max(1, prev.findingCount)) * 100) / 10
        : -Math.round((current.findingCount / Math.max(1, prev.findingCount) - 1) * 100) / 10;
    }

    // Compute dimension-specific scores
    const dimScores: Record<string, number> = {};
    for (const d of dimensions) {
      dimScores[d.dimension] = d.score;
    }

    // Estimate tech debt: ~3K per finding, weighted by severity
    const techDebt = cache.findings.reduce((sum, f) => {
      const cost: Record<string, number> = { critical: 12000, high: 6000, medium: 3000, low: 1000, info: 0 };
      return sum + (cost[f.severity] ?? 3000);
    }, 0);

    return reply.status(200).send({
      overall_health: overall,
      dimensions: dimScores,
      health_trend: healthTrend,
      tech_debt: techDebt,
      snapshot: latestSnapshot ?? null,
      finding_count: cache.findings.length,
      opportunity_count: cache.opportunities.length,
      analyzed_at: cache.analyzedAt,
    });
  });

  /**
   * GET /api/v1/metrics/performance
   *
   * Returns derived performance metrics from the latest analysis:
   * - Analysis duration
   * - Entity density (entities per file)
   * - Issue density (findings per 1K entities)
   * - Graph coverage (relationship-to-entity ratio)
   */
  app.get('/api/v1/metrics/performance', async (_request, reply) => {
    const cache = state.getAnalysisCache();
    if (!cache) {
      return reply.status(404).send({
        error: 'No analysis data',
        message: 'No analysis has been run yet.',
      });
    }

    const graph = state.getGraph();
    const stats = await graph.getStats();
    const totalEntities = stats.totalEntities;
    const totalRelationships = stats.totalRelationships;
    const fileCount = stats.entityCountsByType['file'] ?? 1;

    const analysisTimeSec = (cache.durationMs / 1000).toFixed(1);
    const entityDensity = fileCount > 0 ? (totalEntities / fileCount).toFixed(1) : '0';
    const issueDensity = totalEntities > 0
      ? ((cache.findings.length / totalEntities) * 1000).toFixed(1)
      : '0';
    const coverageRatio = totalEntities > 0
      ? (totalRelationships / totalEntities).toFixed(2)
      : '0';

    const metrics = [
      {
        label: 'Analysis Time',
        value: analysisTimeSec,
        unit: 's',
        trend: 0,
        data: [{ value: parseFloat(analysisTimeSec) }],
      },
      {
        label: 'Entity Density',
        value: entityDensity,
        unit: 'per file',
        trend: 0,
        data: [{ value: parseFloat(entityDensity) }],
      },
      {
        label: 'Issue Density',
        value: issueDensity,
        unit: 'per 1K',
        trend: 0,
        data: [{ value: parseFloat(issueDensity) }],
      },
      {
        label: 'Graph Coverage',
        value: coverageRatio,
        unit: 'ratio',
        trend: 0,
        data: [{ value: parseFloat(coverageRatio) }],
      },
    ];

    return reply.status(200).send({ data: metrics });
  });
}
