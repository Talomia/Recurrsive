/**
 * @module @recurrsive/server/routes/health
 *
 * Health check and project health score routes.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import os from 'node:os';
import { VERSION, createLogger } from '@recurrsive/core';
import { state } from '../state.js';
import { authMiddleware } from '../middleware/auth.js';
import { computeHealthScore, severityBreakdown } from '../health-score.js';

const logger = createLogger({ context: { component: 'server:routes:health' } });

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
   * GET /api/v1/health
   *
   * Alias for the root `/health` endpoint, mounted under the versioned
   * API prefix. PUBLIC (no auth) so uptime probes work.
   */
  app.get('/api/v1/health', async (_request, reply) => {
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
   * GET /api/v1/health/detailed
   *
   * Extended health check with system-level details: memory usage,
   * CPU load, OS info, and initialization state.
   */
  app.get('/api/v1/health/detailed', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const initialized = state.isInitialized();
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    return reply.status(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      initialized,
      version: VERSION,
      system: {
        platform: os.platform(),
        arch: os.arch(),
        node_version: process.version,
        cpus: os.cpus().length,
        load_average: os.loadavg(),
        total_memory: totalMem,
        free_memory: freeMem,
        memory_usage_percent: Math.round((memUsage.rss / totalMem) * 100),
      },
      process: {
        pid: process.pid,
        rss: memUsage.rss,
        heap_total: memUsage.heapTotal,
        heap_used: memUsage.heapUsed,
        external: memUsage.external,
      },
    });
  });

  /**
   * GET /api/v1/health-score
   *
   * Returns the computed project health score and per-dimension maturity
   * breakdown for the given project (`?projectId=`, defaults to the implicit
   * project). When no analysis has run, returns an explicit `not_analyzed`
   * state (overall `null`) — never a fabricated stand-in score.
   */
  app.get<{ Querystring: { projectId?: string } }>(
    '/api/v1/health-score',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const projectId = request.query.projectId;
      const cache = await state.loadCacheForProject(projectId);

      if (!cache) {
        return reply.status(200).send({
          data: {
            status: 'not_analyzed',
            overall: null,
            score: null,
            overall_health: null,
            dimensions: {},
            severity_breakdown: severityBreakdown([]),
            health_trend: null,
            finding_count: 0,
            opportunity_count: 0,
            analyzed_at: null,
          },
        });
      }

      const { overall, dimensions } = computeHealthScore(cache.findings, cache.opportunities);

      // Trend from the last two successful runs' REAL recorded health scores.
      const history = await state.loadHistoryForProject(projectId);
      const scored = history.filter((h) => h.status === 'success' && h.healthScore !== null);
      let healthTrend: number | null = null;
      if (scored.length >= 2) {
        const prev = scored[scored.length - 2]!.healthScore!;
        const current = scored[scored.length - 1]!.healthScore!;
        healthTrend = Math.round((current - prev) * 10) / 10;
      }

      const dimScores: Record<string, number> = {};
      for (const d of dimensions) {
        dimScores[d.dimension] = d.score;
      }

      return reply.status(200).send({
        data: {
          status: 'analyzed',
          overall,
          score: overall,
          overall_health: overall,
          dimensions: dimScores,
          severity_breakdown: severityBreakdown(cache.findings),
          health_trend: healthTrend,
          finding_count: cache.findings.length,
          opportunity_count: cache.opportunities.length,
          analyzed_at: cache.analyzedAt,
        },
      });
    },
  );

  /**
   * GET /api/v1/metrics/performance
   *
   * Returns derived performance metrics from the latest analysis:
   * - Analysis duration
   * - Entity density (entities per file)
   * - Issue density (findings per 1K entities)
   * - Graph coverage (relationship-to-entity ratio)
   */
  app.get<{ Querystring: { projectId?: string } }>('/api/v1/metrics/performance', { preHandler: [authMiddleware] }, async (request, reply) => {
    const cache = await state.loadCacheForProject(request.query.projectId);
    if (!cache) {
      return reply.status(404).send({
        error: 'No analysis data',
        message: 'Run POST /api/v1/analyze first to generate performance metrics.',
      });
    }

    try {
      const analysisTimeSec = (cache.durationMs / 1000).toFixed(1);
      const metrics: Array<{ label: string; value: string; unit: string; trend: null }> = [
        { label: 'Analysis Time', value: analysisTimeSec, unit: 's', trend: null },
      ];

      // Graph-derived densities are only meaningful for the currently loaded
      // project (the graph holds a single project's data). Include them when
      // available; otherwise report just the analysis-derived metric.
      if (state.isInitialized()) {
        const graph = state.getGraph();
        const stats = await graph.getStats();
        const totalEntities = stats.totalEntities;
        const totalRelationships = stats.totalRelationships;
        const fileCount = stats.entityCountsByType['file'] ?? 1;

        const entityDensity = fileCount > 0 ? (totalEntities / fileCount).toFixed(1) : '0';
        const issueDensity = totalEntities > 0
          ? ((cache.findings.length / totalEntities) * 1000).toFixed(1)
          : '0';
        const coverageRatio = totalEntities > 0
          ? (totalRelationships / totalEntities).toFixed(2)
          : '0';

        metrics.push(
          { label: 'Entity Density', value: entityDensity, unit: 'per file', trend: null },
          { label: 'Issue Density', value: issueDensity, unit: 'per 1K', trend: null },
          { label: 'Graph Coverage', value: coverageRatio, unit: 'ratio', trend: null },
        );
      }

      return reply.status(200).send({ data: metrics, total: metrics.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Failed to compute performance metrics', { error: message });
      return reply.status(500).send({
        error: 'Metrics computation failed',
        message,
      });
    }
  });

  // ── GET /api/v1/health/dashboard ─────────────────────────────────────
  // Dashboard health page — returns system health overview with
  // process metrics and service statuses.

  app.get<{ Querystring: { projectId?: string } }>('/api/v1/health/dashboard', { preHandler: [authMiddleware] }, async (request, reply) => {
    // Real process metrics only — no invented uptime/latency percentages.
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const memPercent = Math.round((memUsage.rss / totalMem) * 100);
    const uptimeSeconds = Math.round(process.uptime());

    // Overall health for the requested project — null when not analyzed.
    const cache = await state.loadCacheForProject(request.query.projectId);
    const overallScore = cache ? computeHealthScore(cache.findings, cache.opportunities).overall : null;

    // Service status reflects real initialization state: 'up' once the graph/
    // engine are initialized, otherwise 'idle'. No fabricated percentages.
    const now = new Date().toISOString();
    const engineStatus = state.isInitialized() ? ('up' as const) : ('idle' as const);
    const services = [
      { name: 'Analysis Engine', status: engineStatus, last_check: now },
      { name: 'Knowledge Graph', status: engineStatus, last_check: now },
      { name: 'API Server', status: 'up' as const, last_check: now },
    ];

    return reply.send({
      data: {
        overall_score: overallScore,
        memory: {
          rss_bytes: memUsage.rss,
          heap_total_bytes: memUsage.heapTotal,
          heap_used_bytes: memUsage.heapUsed,
          usage_percent: memPercent,
        },
        uptime_seconds: uptimeSeconds,
        services,
      },
    });
  });

  /**
   * GET /api/v1/health-score/history
   *
   * Return historical health scores using the REAL score recorded for each
   * successful run (no `100 - findingCount*2` derivation). Scoped by projectId.
   */
  app.get<{ Querystring: { projectId?: string } }>('/api/v1/health-score/history', { preHandler: [authMiddleware] }, async (request, reply) => {
    const history = await state.loadHistoryForProject(request.query.projectId);
    const scored = history.filter((h) => h.status === 'success' && h.healthScore !== null);

    const scoreHistory = scored.map((entry) => {
      const score = entry.healthScore!;
      const grade = score >= 90 ? 'A' :
                    score >= 80 ? 'B' :
                    score >= 70 ? 'C' :
                    score >= 60 ? 'D' : 'F';
      return { timestamp: entry.completedAt, score, grade };
    });

    return reply.status(200).send({ data: scoreHistory, total: scoreHistory.length });
  });
}
