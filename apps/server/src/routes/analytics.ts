/**
 * @module @recurrsive/server/routes/analytics
 *
 * Analytics routes for querying analysis trends over time and
 * top finding categories.
 *
 * Uses in-memory mock data pre-populated for the last 12 weeks.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { state } from '../state.js';

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
// Deterministic pseudo-random (matches dashboard pattern)
// ---------------------------------------------------------------------------

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ---------------------------------------------------------------------------
// Pre-populated mock data — 12 weeks of trends
// ---------------------------------------------------------------------------

function generateTrends(): TrendPoint[] {
  const points: TrendPoint[] = [];
  const baseDate = new Date('2026-04-06'); // ~12 weeks before 2026-06-30

  for (let week = 0; week < 12; week++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + week * 7);
    const dateStr = date.toISOString().slice(0, 10);

    const noise = (s: number) => seededRandom(week * 137 + s) * 8 - 4;
    const findings = Math.round(30 + week * 1.5 + noise(0));
    const resolved = Math.round(findings * (0.45 + week * 0.015 + noise(1) * 0.03));
    const health = Math.round(68 + week * 0.8 + noise(2));

    points.push({
      date: dateStr,
      findings: Math.max(findings, 10),
      resolved: Math.max(Math.min(resolved, findings), 0),
      health: Math.max(Math.min(health, 100), 50),
    });
  }

  return points;
}

const MOCK_TRENDS = generateTrends();

const MOCK_SUMMARY: AnalyticsSummary = (() => {
  const totalFindings = MOCK_TRENDS.reduce((s, t) => s + t.findings, 0);
  const totalResolved = MOCK_TRENDS.reduce((s, t) => s + t.resolved, 0);
  const avgHealth =
    Math.round(
      (MOCK_TRENDS.reduce((s, t) => s + t.health, 0) / MOCK_TRENDS.length) * 10,
    ) / 10;

  return {
    analysis_runs: 47,
    total_findings: totalFindings,
    findings_resolved: totalResolved,
    resolution_rate: Math.round((totalResolved / totalFindings) * 1000) / 10,
    avg_health_score: avgHealth,
    trends: MOCK_TRENDS,
  };
})();

const MOCK_CATEGORIES: CategoryStat[] = [
  { name: 'Security', count: 42, percentage: 13.5 },
  { name: 'Performance', count: 68, percentage: 21.8 },
  { name: 'Architecture', count: 54, percentage: 17.3 },
  { name: 'Reliability', count: 39, percentage: 12.5 },
  { name: 'Cost', count: 28, percentage: 9.0 },
  { name: 'Documentation', count: 35, percentage: 11.2 },
  { name: 'Testing', count: 26, percentage: 8.3 },
  { name: 'DevOps', count: 20, percentage: 6.4 },
];

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
   * Uses live analysis data when available, falls back to demo data.
   */
  app.get('/api/v1/analytics/summary', async (_request, reply) => {
    const cache = state.isInitialized() ? state.getAnalysisCache() : null;

    if (cache?.findings?.length) {
      const totalFindings = cache.findings.length;
      // Findings don't have a status field — all represent open observations.
      // Resolved findings are promoted to opportunities, so we approximate.
      const totalResolved = cache.opportunities?.length ?? 0;
      const resolutionRate =
        totalFindings > 0
          ? Math.round((totalResolved / totalFindings) * 1000) / 10
          : 0;

      return reply.status(200).send({
        analysis_runs: 1,
        total_findings: totalFindings,
        findings_resolved: totalResolved,
        resolution_rate: resolutionRate,
        avg_health_score: MOCK_SUMMARY.avg_health_score,
        trends: MOCK_TRENDS, // trend history requires multiple runs
      });
    }

    return reply.status(200).send(MOCK_SUMMARY);
  });

  /**
   * GET /api/v1/analytics/top-categories
   *
   * Return findings broken down by category.
   * Uses live analysis data when available, falls back to demo data.
   */
  app.get('/api/v1/analytics/top-categories', async (_request, reply) => {
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

      return reply.status(200).send({ categories });
    }

    return reply.status(200).send({
      categories: MOCK_CATEGORIES,
    });
  });
}
