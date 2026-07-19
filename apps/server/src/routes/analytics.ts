/**
 * @module @recurrsive/server/routes/analytics
 *
 * Analytics routes for querying analysis trends over time and
 * top finding categories.
 *
 * Uses live analysis data from the state cache. Returns empty
 * defaults when no analysis has been run yet.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { state } from '../state.js';
import { authMiddleware } from '../middleware/auth.js';
import { computeHealthScore } from '../health-score.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single data point in the trend time series. */
export interface TrendPoint {
  date: string;
  findings: number;
  /**
   * Findings resolved as of that run. Analysis history does not record a
   * per-run resolution count, so this is always null — reporting the run's
   * opportunity count (or any other stand-in) here would be a fabricated
   * statistic.
   */
  resolved: number | null;
  health: number;
}

/** Summary analytics response. */
export interface AnalyticsSummary {
  analysis_runs: number;
  total_findings: number;
  findings_resolved: number;
  resolution_rate: number;
  /**
   * Mean of the health scores across successful analysis runs, or null when
   * no analysis has produced a score yet.
   */
  avg_health_score: number | null;
  trends: TrendPoint[];
}

/** A single finding category. */
export interface CategoryStat {
  name: string;
  count: number;
  percentage: number;
}

/** Category breakdown response. */
export interface CategoriesResponse {
  categories: CategoryStat[];
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Register analytics routes.
 *
 * @param app - Fastify instance.
 */
export async function registerAnalyticsRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/analytics/summary
   *
   * Return analysis trends over time with aggregate statistics.
   * Uses live analysis data when available, returns zeros when no analysis
   * has been run yet.
   */
  app.get<{ Querystring: { projectId?: string } }>('/api/v1/analytics/summary', { preHandler: [authMiddleware] }, async (request, reply) => {
    const projectId = request.query.projectId;
    const cache = await state.loadCacheForProject(projectId);
    const history = await state.loadHistoryForProject(projectId);

    if (cache?.findings?.length) {
      const totalFindings = cache.findings.length;

      // Real resolution lifecycle: an opportunity counts as resolved once it
      // reaches a terminal state. `proposed` / `accepted` / `in_progress` are
      // still open. NEVER count all opportunities as "resolved".
      const RESOLVED_STATUSES = new Set(['implemented', 'validated', 'rejected', 'archived']);
      const manager = await state.loadOpportunitiesForProject(projectId);
      const opportunities = manager.list({});
      const findingsResolved = opportunities.filter((o) => RESOLVED_STATUSES.has(o.status)).length;
      const resolutionRate =
        totalFindings > 0
          ? Math.round((findingsResolved / totalFindings) * 1000) / 10
          : 0;

      const trends: TrendPoint[] = history
        .filter((h) => h.status === 'success' && typeof h.healthScore === 'number')
        .map((h) => ({
          date: h.startedAt.split('T')[0]!,
          findings: h.findingCount,
          // Per-run resolution counts are not recorded — null, never the
          // opportunity count masquerading as "resolved".
          resolved: null,
          health: h.healthScore!,
        }));

      // A real average over the per-run scores. When history carries no
      // scored runs (e.g. it was pruned), fall back to the single current
      // score — an average of the one data point we actually have.
      const runScores = trends.map((t) => t.health);
      const avgHealthScore = runScores.length > 0
        ? Math.round((runScores.reduce((s, v) => s + v, 0) / runScores.length) * 10) / 10
        : computeHealthScore(cache.findings, cache.opportunities).overall;

      return reply.status(200).send({
        data: {
          analysis_runs: history.length,
          total_findings: totalFindings,
          findings_resolved: findingsResolved,
          resolution_rate: resolutionRate,
          avg_health_score: avgHealthScore,
          trends,
        },
      });
    }

    // No analysis data yet — counts are genuinely zero, but a health score of
    // 0 would be a fabricated statistic, so it is null.
    return reply.status(200).send({
      data: {
        analysis_runs: 0,
        total_findings: 0,
        findings_resolved: 0,
        resolution_rate: 0,
        avg_health_score: null,
        trends: [],
      } satisfies AnalyticsSummary,
    });
  });

  /**
   * GET /api/v1/analytics/top-categories
   *
   * Return findings broken down by category.
   * Uses live analysis data when available, returns empty array when
   * no analysis has been run yet.
   */
  app.get<{ Querystring: { projectId?: string } }>('/api/v1/analytics/top-categories', { preHandler: [authMiddleware] }, async (request, reply) => {
    const cache = await state.loadCacheForProject(request.query.projectId);

    if (cache?.findings?.length) {
      const counts: Record<string, number> = {};
      for (const f of cache.findings) {
        const cat = f.category ?? 'other';
        counts[cat] = (counts[cat] ?? 0) + 1;
      }
      const total = cache.findings.length;
      const categories = Object.entries(counts)
        .map(([name, count]) => ({
          name,
          count,
          percentage: Math.round((count / total) * 1000) / 10,
        }))
        .sort((a, b) => b.count - a.count);

      return reply.status(200).send({ data: categories });
    }

    // No analysis data yet — return empty array
    return reply.status(200).send({
      data: [] as CategoryStat[],
    });
  });
}
