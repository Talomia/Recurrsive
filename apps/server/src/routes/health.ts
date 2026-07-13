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
import { calculateHealthScore } from '../analysis-metrics.js';
import { resolveAnalysis, resolveAnalysisHistory, resolveProjectGraph } from '../project-analysis.js';

const logger = createLogger({ context: { component: 'server:routes:health' } });

interface ProjectHealthQuery {
  projectId?: string;
}

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
   * API prefix. Returns identical liveness-probe data.
   */
  app.get('/api/v1/health', { preHandler: [authMiddleware] }, async (_request, reply) => {
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
   * breakdown. Requires that at least one analysis has been run.
   */
  app.get<{ Querystring: ProjectHealthQuery }>('/api/v1/health-score', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { cache } = await resolveAnalysis(request);
    if (!cache) {
      return reply.status(200).send({
        data: {
          overall: 0,
          score: 0,
          overall_health: 0,
          dimensions: {},
          health_trend: 0,
          snapshot: null,
          finding_count: 0,
          opportunity_count: 0,
          analyzed_at: null,
        },
      });
    }

    const { overall, dimensions } = calculateHealthScore(cache);
    const latestSnapshot = null;

    // Compute trends from analysis history
    const history = await resolveAnalysisHistory(request);
    let healthTrend = 0;
    if (history.length >= 2) {
      const previousScore = history[history.length - 2]!.healthScore;
      const currentScore = history[history.length - 1]!.healthScore;
      if (previousScore !== null && currentScore !== null) {
        healthTrend = Math.round((currentScore - previousScore) * 10) / 10;
      }
    }

    // Compute dimension-specific scores
    const dimScores: Record<string, number> = {};
    for (const d of dimensions) {
      dimScores[d.dimension] = d.score;
    }

    return reply.status(200).send({
      data: {
        overall: overall,
        score: overall,
        overall_health: overall,
        dimensions: dimScores,
        health_trend: healthTrend,
        snapshot: latestSnapshot ?? null,
        finding_count: cache.findings.length,
        opportunity_count: cache.opportunities.length,
        analyzed_at: cache.analyzedAt,
      },
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
  app.get<{ Querystring: ProjectHealthQuery }>('/api/v1/metrics/performance', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { cache } = await resolveAnalysis(request);
    if (!cache) {
      return reply.status(404).send({
        error: 'No analysis data',
        message: 'Run POST /api/v1/analyze first to generate performance metrics.',
      });
    }

    try {
      const graph = await resolveProjectGraph(request);
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

  app.get<{ Querystring: ProjectHealthQuery }>('/api/v1/health/dashboard', { preHandler: [authMiddleware] }, async (request, reply) => {
    const requestStartedAt = performance.now();
    // Process metrics (always available)
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const memPercent = Math.round((memUsage.rss / totalMem) * 100);
    const uptimeDays = Math.round((process.uptime() / 86400) * 10) / 10;

    // Health score (requires analysis)
    const { cache } = await resolveAnalysis(request);
    const overallScore = calculateHealthScore(cache).overall;

    // Service statuses
    const now = new Date().toISOString();
    const graph = await resolveProjectGraph(request);
    const graphStats = await graph.getStats();
    const services = [
      {
        name: 'Analysis Engine',
        status: cache ? ('healthy' as const) : ('idle' as const),
        last_check: now,
      },
      {
        name: 'Knowledge Graph',
        status: graphStats.totalEntities > 0 ? ('healthy' as const) : ('idle' as const),
        last_check: now,
      },
      {
        name: 'API Server',
        status: 'healthy' as const,
        latency_ms: Math.max(1, Math.round(performance.now() - requestStartedAt)),
        last_check: now,
      },
    ];

    const cpuUsagePercent = Math.min(
      100,
      Math.round((os.loadavg()[0]! / Math.max(1, os.cpus().length)) * 100),
    );

    return reply.send({
      data: {
        overall_score: overallScore,
        api_latency_ms: Math.max(1, Math.round(performance.now() - requestStartedAt)),
        memory_usage_percent: memPercent,
        cpu_usage_percent: cpuUsagePercent,
        uptime_days: uptimeDays,
        services,
      },
    });
  });

  /**
   * GET /api/v1/health-score/history
   *
   * Return health scores recorded by completed analysis runs.
   */
  app.get<{ Querystring: ProjectHealthQuery }>('/api/v1/health-score/history', { preHandler: [authMiddleware] }, async (request, reply) => {
    const history = await resolveAnalysisHistory(request);
    const successfulRuns = history.filter(h => h.status === 'success' && h.healthScore !== null);

    const scoreHistory = successfulRuns.map(entry => {
      const score = entry.healthScore!;

      // Assign letter grade
      const grade = score >= 90 ? 'A' :
                    score >= 80 ? 'B' :
                    score >= 70 ? 'C' :
                    score >= 60 ? 'D' : 'F';

      return {
        timestamp: entry.completedAt,
        score,
        grade,
      };
    });

    return reply.status(200).send({ data: scoreHistory });
  });
}
