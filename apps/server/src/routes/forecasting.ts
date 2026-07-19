/**
 * @module @recurrsive/server/routes/forecasting
 *
 * Forecasting and predictive intelligence routes.
 *
 * Forecasts are produced ONLY from real analysis snapshots (each successful
 * run's recorded health score). With fewer than two snapshots there is no
 * trend to fit, so the endpoints return an explicit `insufficient_data` state
 * rather than projecting off a single synthetic point. What-if impact is
 * derived from the project's actual findings — removing findings and
 * recomputing the canonical health score — not a hardcoded impact table.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import type { Finding } from '@recurrsive/core';
import { generateId, nowISO } from '@recurrsive/core';
import { state } from '../state.js';
import { authMiddleware } from '../middleware/auth.js';
import { computeHealthScore } from '../health-score.js';

// ---------------------------------------------------------------------------
// Forecasting utilities
// ---------------------------------------------------------------------------

/** Result of an OLS fit including everything needed for honest intervals. */
interface RegressionFit {
  slope: number;
  intercept: number;
  r2: number;
  /** Number of points fitted. */
  n: number;
  /** Mean of x. */
  meanX: number;
  /** Σ(x - x̄)² — the x sum of squares. */
  sxx: number;
  /** Residual standard error s = sqrt(SSres / (n - 2)); null when df < 1 or the fit is degenerate. */
  residualStdError: number | null;
}

/** Linear regression on (x, y) pairs. */
function linearRegression(points: Array<{ x: number; y: number }>): RegressionFit {
  const n = points.length;
  if (n < 2) {
    return { slope: 0, intercept: points[0]?.y ?? 0, r2: 0, n, meanX: points[0]?.x ?? 0, sxx: 0, residualStdError: null };
  }

  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const meanX = sumX / n;
  const sxx = sumX2 - n * meanX * meanX;

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) {
    return { slope: 0, intercept: sumY / n, r2: 0, n, meanX, sxx: 0, residualStdError: null };
  }

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  const meanY = sumY / n;
  const ssRes = points.reduce((s, p) => s + (p.y - (slope * p.x + intercept)) ** 2, 0);
  const ssTot = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  const df = n - 2;
  const residualStdError = df >= 1 ? Math.sqrt(Math.max(0, ssRes) / df) : null;

  return { slope, intercept, r2, n, meanX, sxx, residualStdError };
}

/** Two-sided 95% Student-t critical values by degrees of freedom. */
function tCritical95(df: number): number {
  const table: Array<[number, number]> = [
    [1, 12.706], [2, 4.303], [3, 3.182], [4, 2.776], [5, 2.571],
    [6, 2.447], [7, 2.365], [8, 2.306], [9, 2.262], [10, 2.228],
    [12, 2.179], [15, 2.131], [20, 2.086], [30, 2.042], [60, 2.0],
  ];
  for (const [d, t] of table) {
    if (df <= d) return t;
  }
  return 1.96;
}

/**
 * 95% prediction-interval half-width at x, derived from the fit's residual
 * standard error: t · s · sqrt(1 + 1/n + (x - x̄)²/Sxx).
 * Returns null when the fit cannot support an interval (df < 1, Sxx = 0).
 */
function predictionIntervalHalfWidth(fit: RegressionFit, x: number): number | null {
  if (fit.residualStdError === null || fit.sxx <= 0) return null;
  const t = tCritical95(fit.n - 2);
  return t * fit.residualStdError * Math.sqrt(1 + 1 / fit.n + ((x - fit.meanX) ** 2) / fit.sxx);
}

/**
 * Adjusted R² — penalizes tiny samples instead of reporting a raw r² that is
 * trivially 1.0 for small n. Clamped to [0, 1].
 */
function adjustedR2(fit: RegressionFit): number {
  if (fit.n < 3) return 0;
  const adj = 1 - (1 - fit.r2) * (fit.n - 1) / (fit.n - 2);
  return Math.min(1, Math.max(0, adj));
}

/** Minimum snapshots required to fit a trend (2 points always fit r²=1). */
const MIN_SNAPSHOTS = 3;

/** Sample size below which forecasts carry an explicit small-sample warning. */
const SMALL_SAMPLE_THRESHOLD = 10;

/**
 * Build a health-score timeline from REAL analysis snapshots for a project.
 * Each point is a successful run's recorded health score — no synthetic
 * points, no baseline fill-in. `t` is the snapshot's epoch milliseconds so
 * regressions run on real time, not on array indices.
 */
async function buildRealTimeline(projectId?: string): Promise<Array<{ date: string; score: number; t: number }>> {
  const history = await state.loadHistoryForProject(projectId);
  return history
    .filter((h) => h.status === 'success' && typeof h.healthScore === 'number')
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
    .map((entry) => ({
      date: new Date(entry.startedAt).toISOString().split('T')[0]!,
      score: entry.healthScore!,
      t: new Date(entry.startedAt).getTime(),
    }));
}

const MS_PER_DAY = 86400000;

/** Map timeline snapshots to regression points with x = days since first snapshot. */
function toRegressionPoints(timeline: Array<{ score: number; t: number }>): Array<{ x: number; y: number }> {
  const t0 = timeline[0]!.t;
  return timeline.map((p) => ({ x: (p.t - t0) / MS_PER_DAY, y: p.score }));
}

/** Findings a proposed action would remove, derived from real findings. */
function findingsRemovedBy(
  action: { type: string; severity?: string; category?: string },
  findings: Finding[],
): Finding[] {
  if (action.severity) return findings.filter((f) => f.severity === action.severity);
  if (action.category) return findings.filter((f) => f.category === action.category);

  const severityMatch = /^fix-(critical|high|medium|low)-findings$/.exec(action.type);
  if (severityMatch) return findings.filter((f) => f.severity === severityMatch[1]);
  if (action.type === 'fix-security-issues') return findings.filter((f) => f.category === 'security');
  return [];
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function registerForecastingRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/forecasting/health
   * Predict the health-score trajectory. Requires >= 2 real snapshots.
   */
  app.get<{ Querystring: { horizon?: string; projectId?: string } }>(
    '/api/v1/forecasting/health',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      try {
        const horizon = Math.min(180, parseInt(request.query.horizon ?? '30', 10) || 30);
        const timeline = await buildRealTimeline(request.query.projectId);

        if (timeline.length < MIN_SNAPSHOTS) {
          return reply.send({
            data: {
              status: 'insufficient_data',
              message: `At least ${MIN_SNAPSHOTS} analysis snapshots are required to fit a trend (two points always fit perfectly and would report false certainty).`,
              snapshotsAvailable: timeline.length,
            },
            generatedAt: nowISO(),
          });
        }

        // Regress on REAL time (days since the first snapshot), not array index,
        // so the slope is a genuine per-day rate and extrapolation uses the same
        // unit. Forecasts continue from the last observed x.
        const points = toRegressionPoints(timeline);
        const regression = linearRegression(points);
        const lastX = points[points.length - 1]!.x;

        const forecast: Array<{ date: string; predicted: number; lowerBound: number | null; upperBound: number | null }> = [];
        const now = Date.now();
        for (let i = 1; i <= horizon; i++) {
          const x = lastX + i;
          const predicted = Math.min(100, Math.max(0, regression.slope * x + regression.intercept));
          // 95% prediction interval from the fit's residual standard error —
          // wider when the data actually fit poorly, null when the fit cannot
          // support an interval (rather than a fabricated fixed width).
          const halfWidth = predictionIntervalHalfWidth(regression, x);
          forecast.push({
            date: new Date(now + i * MS_PER_DAY).toISOString().split('T')[0]!,
            predicted: Math.round(predicted * 10) / 10,
            lowerBound: halfWidth === null ? null : Math.round(Math.max(0, predicted - halfWidth) * 10) / 10,
            upperBound: halfWidth === null ? null : Math.round(Math.min(100, predicted + halfWidth) * 10) / 10,
          });
        }

        const trend = regression.slope > 0.1 ? 'improving' :
                      regression.slope < -0.1 ? 'declining' : 'stable';

        const currentScore = timeline[timeline.length - 1]!.score;
        const targets = [90, 80, 70, 60].map((target) => {
          if (regression.slope <= 0) return { target, daysToReach: null, reachable: false };
          if (currentScore >= target) return { target, daysToReach: 0, reachable: true };
          // slope is per-day, so this division is now dimensionally correct.
          const days = Math.ceil((target - currentScore) / regression.slope);
          return { target, daysToReach: days, reachable: days <= 365 };
        });

        return reply.send({
          data: {
            status: 'forecast',
            estimate: true,
            currentScore,
            trend,
            trendStrength: Math.abs(regression.slope),
            // Adjusted R² penalizes tiny samples; raw r² is ~1.0 for any small n
            // and would overstate certainty. n and a small-sample flag are
            // reported so the consumer can weigh it honestly.
            confidence: Math.round(adjustedR2(regression) * 100) / 100,
            sampleSize: regression.n,
            smallSample: regression.n < SMALL_SAMPLE_THRESHOLD,
            history: timeline.slice(-30),
            forecast: forecast.slice(0, 30),
            targets,
            regression: {
              slopePerDay: Math.round(regression.slope * 1000) / 1000,
              intercept: Math.round(regression.intercept * 100) / 100,
              r2: Math.round(regression.r2 * 1000) / 1000,
              adjustedR2: Math.round(adjustedR2(regression) * 1000) / 1000,
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
   * POST /api/v1/forecasting/what-if
   * Simulate the impact of proposed changes by removing the matching findings
   * from the project's real analysis and recomputing the canonical score.
   */
  app.post<{ Querystring: { projectId?: string } }>('/api/v1/forecasting/what-if', {
    preHandler: [authMiddleware],
    schema: {
      body: {
        type: 'object',
        properties: {
          actions: {
            type: 'array',
            items: {
              type: 'object',
              required: ['type'],
              properties: {
                type: { type: 'string', minLength: 1 },
                description: { type: 'string' },
                severity: { type: 'string' },
                category: { type: 'string' },
              },
            },
          },
          changes: {
            type: 'array',
            items: {
              type: 'object',
              required: ['type'],
              properties: {
                type: { type: 'string', minLength: 1 },
                name: { type: 'string' },
                description: { type: 'string' },
                severity: { type: 'string' },
                category: { type: 'string' },
              },
            },
          },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    try {
      const body = request.body as {
        actions?: Array<{ type: string; description?: string; severity?: string; category?: string }>;
        changes?: Array<{ type: string; name?: string; description?: string; severity?: string; category?: string }>;
      };

      const rawActions = body.actions ?? body.changes;
      if (!rawActions || rawActions.length === 0) {
        return reply.status(400).send({ error: 'Bad Request', message: 'At least one action is required' });
      }

      const cache = await state.loadCacheForProject(request.query.projectId);
      if (!cache) {
        return reply.send({
          data: {
            status: 'not_analyzed',
            message: 'Run an analysis first — what-if impact is derived from the project\'s actual findings.',
          },
          generatedAt: nowISO(),
        });
      }

      const actions = rawActions.map((act) => ({
        type: act.type,
        description: act.description ?? ('name' in act ? act.name : undefined) ?? act.type,
        severity: act.severity,
        category: act.category,
      }));

      const findings = cache.findings;
      const currentScore = computeHealthScore(findings, cache.opportunities).overall;

      // Union of findings removed across all actions → projected score.
      const removedIds = new Set<string>();
      const results = actions.map((action) => {
        const removed = findingsRemovedBy(action, findings);
        for (const f of removed) removedIds.add(f.id);
        // Marginal impact of this action alone.
        const withoutThis = findings.filter((f) => !removed.some((r) => r.id === f.id));
        const marginalScore = computeHealthScore(withoutThis).overall;
        return {
          id: generateId(),
          type: action.type,
          description: action.description,
          impact: {
            healthScoreDelta: Math.round((marginalScore - currentScore) * 10) / 10,
            findingsResolved: removed.length,
            basis: removed.length > 0 ? 'measured' : 'no_matching_findings',
          },
        };
      });

      const remaining = findings.filter((f) => !removedIds.has(f.id));
      const projectedScore = computeHealthScore(remaining).overall;

      return reply.send({
        data: {
          status: 'analyzed',
          estimate: true,
          assumption: 'Assumes each action fully resolves the matching findings; recomputed via the canonical health score.',
          currentScore,
          projectedScore,
          totalImpact: Math.round((projectedScore - currentScore) * 10) / 10,
          actions: results,
          summary: {
            highestImpact: [...results].sort((a, b) => b.impact.healthScoreDelta - a.impact.healthScoreDelta)[0]?.type ?? null,
            totalActions: results.length,
            findingsResolved: removedIds.size,
          },
        },
        generatedAt: nowISO(),
      });
    } catch (err) {
      return reply.status(500).send({ error: 'Internal server error', message: (err as Error).message });
    }
  });

  /**
   * GET /api/v1/forecasting/evolution
   * Evolution graph built from real analysis history using each run's
   * recorded health score.
   */
  app.get<{ Querystring: { projectId?: string } }>('/api/v1/forecasting/evolution', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      const history = await state.loadHistoryForProject(request.query.projectId);
      const successfulRuns = history
        .filter((h) => h.status === 'success' && typeof h.healthScore === 'number')
        .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

      interface EvolutionEvent {
        id: string;
        date: string;
        type: string;
        title: string;
        description: string;
        outcome: string;
        healthImpact: number;
        learnings: string[];
      }

      const events: EvolutionEvent[] = [];
      let prevScore: number | null = null;

      for (let i = 0; i < successfulRuns.length; i++) {
        const run = successfulRuns[i]!;
        const currentScore = run.healthScore!;
        // First run has no prior point → impact 0 (no fabricated baseline).
        const scoreDelta = prevScore === null ? 0 : Math.round((currentScore - prevScore) * 10) / 10;

        // Every point here is a real analysis run — nothing more is known. We do
        // NOT relabel score deltas as "decisions"/"experiments"/"incidents":
        // those are organizational events that never occurred. The only honest
        // classification is the measured direction of the health delta.
        const eventType = 'analysis_run';
        const outcome = prevScore === null ? 'baseline' :
                        scoreDelta > 0 ? 'improved' :
                        scoreDelta < 0 ? 'declined' : 'unchanged';

        const learnings: string[] = [];
        if (run.findingCount > 0) learnings.push(`${run.findingCount} finding(s) detected`);
        if (run.opportunityCount > 0) learnings.push(`${run.opportunityCount} improvement opportunity(ies) identified`);
        if (run.durationMs > 0) learnings.push(`Analysis completed in ${Math.round(run.durationMs / 1000)}s`);
        if (run.includeReasoning) learnings.push('Multi-agent reasoning was applied');

        events.push({
          id: run.id,
          date: new Date(run.startedAt).toISOString().split('T')[0]!,
          type: eventType,
          title: `Analysis run #${i + 1}`,
          description: `Completed with ${run.findingCount} findings and ${run.opportunityCount} opportunities. Health score: ${currentScore}.`,
          outcome,
          healthImpact: scoreDelta,
          learnings,
        });

        prevScore = currentScore;
      }

      const trajectory = successfulRuns.map((run, i) => ({
        date: new Date(run.startedAt).toISOString().split('T')[0]!,
        score: run.healthScore!,
        event: `Analysis run #${i + 1}`,
      }));

      const currentScore = successfulRuns.length > 0
        ? successfulRuns[successfulRuns.length - 1]!.healthScore!
        : null;

      return reply.send({
        data: {
          events,
          trajectory,
          currentScore,
          totalRuns: events.length,
          runsImproved: events.filter((e) => e.outcome === 'improved').length,
          runsDeclined: events.filter((e) => e.outcome === 'declined').length,
          netHealthImpact: events.reduce((s, e) => s + e.healthImpact, 0),
          allLearnings: events.flatMap((e) => e.learnings),
        },
        generatedAt: nowISO(),
      });
    } catch (err) {
      return reply.status(500).send({ error: 'Internal server error', message: (err as Error).message });
    }
  });

  /**
   * GET /api/v1/forecasting/predictions
   * Interval predictions from real snapshots. Requires >= 2 snapshots.
   */
  app.get<{ Querystring: { horizon?: string; projectId?: string } }>(
    '/api/v1/forecasting/predictions',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      try {
        const horizonDays = Math.min(90, parseInt(request.query.horizon ?? '30', 10) || 30);
        const timeline = await buildRealTimeline(request.query.projectId);

        if (timeline.length < 2) {
          return reply.send({
            data: {
              status: 'insufficient_data',
              message: 'At least 2 analysis snapshots are required to generate predictions.',
              snapshotsAvailable: timeline.length,
            },
            generatedAt: nowISO(),
          });
        }

        const points = timeline.map((p, i) => ({ x: i, y: p.score }));
        const regression = linearRegression(points);
        const trend = regression.slope > 0.1 ? 'improving' :
                      regression.slope < -0.1 ? 'declining' : 'stable';

        const intervals = [7, 14, 30, 60, 90].filter((d) => d <= horizonDays);
        const predictions = intervals.map((days) => {
          const x = timeline.length + days;
          const predicted = Math.min(100, Math.max(0, regression.slope * x + regression.intercept));
          const uncertainty = Math.min(20, days * 0.3);
          return {
            days_ahead: days,
            date: new Date(Date.now() + days * 86400000).toISOString().split('T')[0]!,
            predicted_score: Math.round(predicted * 10) / 10,
            lower_bound: Math.round(Math.max(0, predicted - uncertainty) * 10) / 10,
            upper_bound: Math.round(Math.min(100, predicted + uncertainty) * 10) / 10,
            trend,
          };
        });

        return reply.send({
          data: {
            status: 'forecast',
            estimate: true,
            predictions,
            confidence: Math.round(regression.r2 * 100) / 100,
            horizon: `${horizonDays} days`,
            current_score: timeline[timeline.length - 1]!.score,
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
