/**
 * @module @recurrsive/server/routes/forecasting
 *
 * Forecasting and predictive intelligence routes.
 *
 * Provides endpoints for transparent linear health-trend projection and
 * recorded analysis history.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { nowISO } from '@recurrsive/core';
import { state } from '../state.js';
import { authMiddleware } from '../middleware/auth.js';

// ---------------------------------------------------------------------------
// Forecasting utilities
// ---------------------------------------------------------------------------

/** Linear regression on (x, y) pairs. Returns { slope, intercept, r2 }. */
function linearRegression(points: Array<{ x: number; y: number }>): {
  slope: number;
  intercept: number;
  r2: number;
} {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0, r2: 0 };

  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // R² calculation
  const meanY = sumY / n;
  const ssRes = points.reduce((s, p) => s + (p.y - (slope * p.x + intercept)) ** 2, 0);
  const ssTot = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { slope, intercept, r2 };
}

/**
 * Build historical timeline from real analysis runs.
 * Falls back to a single-point timeline from the current health score
 * when insufficient history is available.
 */
function buildTimeline(): Array<{ date: string; score: number }> {
  if (!state.isInitialized()) return [];
  return state.getAnalysisHistory()
    .filter((entry) => entry.status === 'success' && entry.healthScore !== null)
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
    .map((entry) => ({
      date: new Date(entry.completedAt).toISOString().split('T')[0]!,
      score: entry.healthScore!,
    }));
}

function toRegressionPoints(timeline: Array<{ date: string; score: number }>): Array<{ x: number; y: number }> {
  if (timeline.length === 0) return [];
  const origin = new Date(timeline[0]!.date).getTime();
  return timeline.map((point) => ({
    x: Math.max(0, (new Date(point.date).getTime() - origin) / 86_400_000),
    y: point.score,
  }));
}

function residualStandardError(
  points: Array<{ x: number; y: number }>,
  regression: { slope: number; intercept: number },
): number {
  if (points.length < 3) return 0;
  const residualSum = points.reduce(
    (sum, point) => sum + (point.y - (regression.slope * point.x + regression.intercept)) ** 2,
    0,
  );
  return Math.sqrt(residualSum / (points.length - 2));
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function registerForecastingRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/forecasting/health
   * Predict health score trajectory for the next N days.
   *
   * Query params:
   *   - horizon: number of days to forecast (default: 30, max: 180)
   *   - history: number of historical days to use (default: 90)
   */
  app.get<{ Querystring: { horizon?: string; history?: string } }>(
    '/api/v1/forecasting/health',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      try {
        const horizon = Math.min(180, parseInt(request.query.horizon ?? '30', 10) || 30);

        // Use real health score as baseline if analysis has been run
        const currentScore = state.isInitialized() ? state.getHealthScore().overall : 0;
        const timeline = buildTimeline();
        const available = timeline.length >= 3;

        const points = toRegressionPoints(timeline);
        const regression = linearRegression(points);
        const standardError = residualStandardError(points, regression);

        const forecast: Array<{ date: string; predicted: number; lowerBound: number; upperBound: number }> = [];
        const now = Date.now();

        for (let i = 1; available && i <= horizon; i++) {
          const x = (points.at(-1)?.x ?? 0) + i;
          const predicted = Math.min(100, Math.max(0, regression.slope * x + regression.intercept));
          const uncertainty = 1.96 * standardError * Math.sqrt(1 + i / points.length);
          forecast.push({
            date: new Date(now + i * 86400000).toISOString().split('T')[0]!,
            predicted: Math.round(predicted * 10) / 10,
            lowerBound: Math.round(Math.max(0, predicted - uncertainty) * 10) / 10,
            upperBound: Math.round(Math.min(100, predicted + uncertainty) * 10) / 10,
          });
        }

        // Trend classification
        const trend = !available ? 'insufficient-data' : regression.slope > 0.1 ? 'improving' :
                      regression.slope < -0.1 ? 'declining' : 'stable';

        // Time to target estimates
        const targets = [90, 80, 70, 60].map(target => {
          if (!available || regression.slope <= 0) return { target, daysToReach: null, reachable: false };
          if (currentScore >= target) return { target, daysToReach: 0, reachable: true };
          const days = Math.ceil((target - currentScore) / regression.slope);
          return { target, daysToReach: days, reachable: days <= 365 };
        });

        return reply.send({
          data: {
            available,
            requiredHistoryPoints: 3,
            currentScore,
            trend,
            trendStrength: Math.abs(regression.slope),
            confidence: available ? Math.round(regression.r2 * 100) / 100 : 0,
            history: timeline.slice(-30),
            forecast: forecast.slice(0, 30),
            targets,
            regression: {
              slope: Math.round(regression.slope * 1000) / 1000,
              intercept: Math.round(regression.intercept * 100) / 100,
              r2: Math.round(regression.r2 * 1000) / 1000,
            },
          },
          generatedAt: nowISO(),
        });
      } catch (err) {
        return reply.status(500).send({ error: 'Internal server error', message: (err as Error).message });
      }
    },
  );

  /**
   * GET /api/v1/forecasting/evolution
   * Return recorded analysis runs and their actual health-score changes.
   */
  app.get('/api/v1/forecasting/evolution', { preHandler: [authMiddleware] }, async (_request, reply) => {
    try {
      // Build evolution events from real analysis history
      const history = state.isInitialized() ? state.getAnalysisHistory() : [];
      const successfulRuns = history
        .filter((run) => run.status === 'success' && run.healthScore !== null)
        .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

      interface EvolutionEvent {
        id: string;
        date: string;
        type: string;
        title: string;
        description: string;
        healthImpact: number;
        learnings: string[];
      }

      const events: EvolutionEvent[] = [];
      let previousScore: number | null = null;

      for (let i = 0; i < successfulRuns.length; i++) {
        const run = successfulRuns[i]!;
        const currentScore = run.healthScore!;
        const scoreDelta = previousScore === null ? 0 : Math.round((currentScore - previousScore) * 10) / 10;

        // Generate meaningful description and learnings from data
        const learnings: string[] = [];
        if (run.findingCount > 0) learnings.push(`${run.findingCount} finding(s) detected`);
        if (run.opportunityCount > 0) learnings.push(`${run.opportunityCount} improvement opportunity(ies) identified`);
        if (run.durationMs > 0) learnings.push(`Analysis completed in ${Math.round(run.durationMs / 1000)}s`);
        if (run.includeReasoning) learnings.push('Multi-agent reasoning was applied');

        events.push({
          id: run.id,
          date: new Date(run.startedAt).toISOString().split('T')[0]!,
          type: 'analysis',
          title: `Analysis run #${i + 1}`,
          description: `Completed with ${run.findingCount} findings and ${run.opportunityCount} opportunities. Health score: ${Math.round(currentScore)}.`,
          healthImpact: scoreDelta,
          learnings,
        });

        previousScore = currentScore;
      }

      const trajectory = successfulRuns.map((run, index) => ({
        date: new Date(run.completedAt).toISOString().split('T')[0]!,
        score: run.healthScore!,
        event: `Analysis run #${index + 1}`,
      }));
      const firstScore = trajectory[0]?.score;
      const lastScore = trajectory.at(-1)?.score;

      return reply.send({
        data: {
          events,
          trajectory,
          currentScore: state.isInitialized() ? state.getHealthScore().overall : 0,
          totalAnalyses: events.length,
          netHealthChange: firstScore === undefined || lastScore === undefined
            ? 0
            : Math.round((lastScore - firstScore) * 10) / 10,
          allLearnings: events.flatMap(e => e.learnings),
        },
        generatedAt: nowISO(),
      });
    } catch (err) {
      return reply.status(500).send({ error: 'Internal server error', message: (err as Error).message });
    }
  });

  /**
   * GET /api/v1/forecasting/predictions
   *
   * Return forecasting predictions based on analysis history.
   * Uses linear regression on health trajectory to predict
   * future scores and generate actionable predictions.
   */
  app.get<{ Querystring: { horizon?: string } }>(
    '/api/v1/forecasting/predictions',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      try {
        const horizonDays = Math.min(90, parseInt(request.query.horizon ?? '30', 10) || 30);

        const currentScore = state.isInitialized() ? state.getHealthScore().overall : 0;
        const timeline = buildTimeline();
        const available = timeline.length >= 3;

        const points = toRegressionPoints(timeline);
        const regression = linearRegression(points);
        const standardError = residualStandardError(points, regression);

        const trend = !available ? 'insufficient-data' : regression.slope > 0.1 ? 'improving' :
                      regression.slope < -0.1 ? 'declining' : 'stable';

        // Generate predictions for key future intervals
        const intervals = [7, 14, 30, 60, 90].filter(d => d <= horizonDays);
        const predictions = available ? intervals.map(days => {
          const x = (points.at(-1)?.x ?? 0) + days;
          const predicted = Math.min(100, Math.max(0, regression.slope * x + regression.intercept));
          const uncertainty = 1.96 * standardError * Math.sqrt(1 + days / points.length);
          return {
            days_ahead: days,
            date: new Date(Date.now() + days * 86400000).toISOString().split('T')[0]!,
            predicted_score: Math.round(predicted * 10) / 10,
            lower_bound: Math.round(Math.max(0, predicted - uncertainty) * 10) / 10,
            upper_bound: Math.round(Math.min(100, predicted + uncertainty) * 10) / 10,
            trend,
          };
        }) : [];

        // Overall confidence from R²
        const confidence = available ? Math.round(regression.r2 * 100) / 100 : 0;

        return reply.send({
          data: {
            predictions,
            available,
            required_data_points: 3,
            confidence,
            horizon: `${horizonDays} days`,
            current_score: currentScore,
            trend,
            data_points: timeline.length,
          },
          generatedAt: nowISO(),
        });
      } catch (err) {
        return reply.status(500).send({ error: 'Internal server error', message: (err as Error).message });
      }
    },
  );
}
