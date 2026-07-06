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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single data point in the trend time series. */
export interface TrendPoint {
  date: string;
  findings: number;
  resolved: number;
  health: number;
}

/** Summary analytics response. */
export interface AnalyticsSummary {
  analysis_runs: number;
  total_findings: number;
  findings_resolved: number;
  resolution_rate: number;
  avg_health_score: number;
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
  app.get('/api/v1/analytics/summary', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const cache = state.isInitialized() ? state.getAnalysisCache() : null;
    const healthScore = state.isInitialized() ? state.getHealthScore() : null;

    if (cache?.findings?.length) {
      const totalFindings = cache.findings.length;
      const totalResolved = cache.opportunities?.length ?? 0;
      const resolutionRate =
        totalFindings > 0
          ? Math.round((totalResolved / totalFindings) * 1000) / 10
          : 0;

      const history = state.getAnalysisHistory();
      const trends: TrendPoint[] = history
        .filter(h => h.status === 'success')
        .map(h => ({
          date: h.startedAt.split('T')[0]!,
          findings: h.findingCount,
          resolved: h.opportunityCount,
          health: healthScore?.overall ?? 0,
        }));

      return reply.status(200).send({
        data: {
          analysis_runs: history.length,
          total_findings: totalFindings,
          findings_resolved: totalResolved,
          resolution_rate: resolutionRate,
          avg_health_score: healthScore?.overall ?? 0,
          trends,
        },
      });
    }

    // No analysis data yet — return empty defaults
    return reply.status(200).send({
      data: {
        analysis_runs: 0,
        total_findings: 0,
        findings_resolved: 0,
        resolution_rate: 0,
        avg_health_score: 0,
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
  app.get('/api/v1/analytics/top-categories', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const cache = state.isInitialized() ? state.getAnalysisCache() : null;

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
