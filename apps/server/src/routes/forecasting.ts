/**
 * @module @recurrsive/server/routes/forecasting
 *
 * Forecasting and predictive intelligence routes.
 *
 * Provides endpoints for health trajectory prediction, maturity
 * forecasting, and what-if impact simulation.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { generateId, nowISO } from '@recurrsive/core';
import { state } from '../state.js';

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
function buildTimeline(baseScore: number): Array<{ date: string; score: number }> {
  if (!state.isInitialized()) {
    // No analysis has been run — return single point with today's date
    const today = new Date().toISOString().split('T')[0]!;
    return [{ date: today, score: baseScore }];
  }

  const history = state.getAnalysisHistory();
  if (history.length === 0) {
    const today = new Date().toISOString().split('T')[0]!;
    return [{ date: today, score: baseScore }];
  }

  // Map each history entry to a timeline point
  // Derive a score from finding/opportunity counts (fewer findings = higher score)
  const timeline = history
    .filter(h => h.status === 'success')
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
    .map(entry => {
      const date = new Date(entry.startedAt).toISOString().split('T')[0]!;
      // Derive health score: start at 100, subtract 2 per finding, cap at 0
      const score = Math.max(0, Math.min(100, 100 - entry.findingCount * 2 + entry.opportunityCount * 0.5));
      return { date, score: Math.round(score * 10) / 10 };
    });

  // If we have real history, add the current score as the latest point
  if (timeline.length > 0) {
    const today = new Date().toISOString().split('T')[0]!;
    const lastDate = timeline[timeline.length - 1]!.date;
    if (lastDate !== today) {
      timeline.push({ date: today, score: baseScore });
    }
  }

  return timeline.length > 0 ? timeline : [{ date: new Date().toISOString().split('T')[0]!, score: baseScore }];
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
    async (request, reply) => {
      try {
        const horizon = Math.min(180, parseInt(request.query.horizon ?? '30', 10) || 30);

        // Use real health score as baseline if analysis has been run
        const realScore = state.isInitialized() ? state.getHealthScore().overall : null;
        const baseScore = realScore ?? 0;
        const timeline = buildTimeline(baseScore);

        // Fit linear regression
        const points = timeline.map((p, i) => ({ x: i, y: p.score }));
        const regression = linearRegression(points);

        // Project forward
        const forecast: Array<{ date: string; predicted: number; lowerBound: number; upperBound: number }> = [];
        const now = Date.now();

        for (let i = 1; i <= horizon; i++) {
          const x = timeline.length + i;
          const predicted = Math.min(100, Math.max(0, regression.slope * x + regression.intercept));
          const uncertainty = Math.min(15, i * 0.25); // Grows with time
          forecast.push({
            date: new Date(now + i * 86400000).toISOString().split('T')[0]!,
            predicted: Math.round(predicted * 10) / 10,
            lowerBound: Math.round(Math.max(0, predicted - uncertainty) * 10) / 10,
            upperBound: Math.round(Math.min(100, predicted + uncertainty) * 10) / 10,
          });
        }

        // Trend classification
        const trend = regression.slope > 0.1 ? 'improving' :
                      regression.slope < -0.1 ? 'declining' : 'stable';

        // Time to target estimates
        const targets = [90, 80, 70, 60].map(target => {
          if (regression.slope <= 0) return { target, daysToReach: null, reachable: false };
          const currentScore = timeline[timeline.length - 1]!.score;
          if (currentScore >= target) return { target, daysToReach: 0, reachable: true };
          const days = Math.ceil((target - currentScore) / regression.slope);
          return { target, daysToReach: days, reachable: days <= 365 };
        });

        return reply.send({
          data: {
            currentScore: timeline[timeline.length - 1]!.score,
            trend,
            trendStrength: Math.abs(regression.slope),
            confidence: Math.round(regression.r2 * 100) / 100,
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
   * POST /api/v1/forecasting/what-if
   * Simulate the impact of proposed changes on project health.
   *
   * Body: { actions: [{ type, description, estimatedImpact }] }
   */
  app.post('/api/v1/forecasting/what-if', {
    schema: {
      body: {
        type: 'object',
        required: ['actions'],
        properties: {
          actions: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['type', 'description'],
              properties: {
                type: { type: 'string', minLength: 1 },
                description: { type: 'string', minLength: 1 },
                estimatedImpact: { type: 'number' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const body = request.body as {
        actions?: Array<{
          type: string;
          description: string;
          estimatedImpact?: number;
        }>;
      };

      if (!body.actions || body.actions.length === 0) {
        return reply.status(400).send({ error: 'Bad Request', message: 'At least one action is required' });
      }

      // Use real health score if available, otherwise use algorithmic baseline
      const realScore = state.isInitialized() ? state.getHealthScore().overall : null;
      const currentScore = realScore ?? 0;
      const results = [];
      let cumulativeImpact = 0;

      // Impact models per action type
      const impactModels: Record<string, { baseImpact: number; confidence: number; timeToRealize: number }> = {
        'fix-critical-findings': { baseImpact: 8.5, confidence: 0.90, timeToRealize: 7 },
        'add-tests': { baseImpact: 4.2, confidence: 0.85, timeToRealize: 14 },
        'upgrade-dependencies': { baseImpact: 3.8, confidence: 0.75, timeToRealize: 3 },
        'add-monitoring': { baseImpact: 5.0, confidence: 0.80, timeToRealize: 21 },
        'refactor-architecture': { baseImpact: 6.5, confidence: 0.60, timeToRealize: 30 },
        'add-documentation': { baseImpact: 2.5, confidence: 0.92, timeToRealize: 7 },
        'enable-strict-mode': { baseImpact: 3.0, confidence: 0.88, timeToRealize: 5 },
        'add-rate-limiting': { baseImpact: 2.0, confidence: 0.95, timeToRealize: 2 },
        'fix-security-issues': { baseImpact: 7.0, confidence: 0.85, timeToRealize: 5 },
        'optimize-performance': { baseImpact: 4.5, confidence: 0.70, timeToRealize: 14 },
      };

      for (const action of body.actions) {
        const model = impactModels[action.type] ?? {
          baseImpact: action.estimatedImpact ?? 3.0,
          confidence: 0.50,
          timeToRealize: 14,
        };

        const impact = action.estimatedImpact ?? model.baseImpact;
        cumulativeImpact += impact;

        results.push({
          id: generateId(),
          type: action.type,
          description: action.description,
          impact: {
            healthScoreDelta: Math.round(impact * 10) / 10,
            confidence: model.confidence,
            timeToRealize: `${model.timeToRealize} days`,
            affectedDimensions: getAffectedDimensions(action.type),
          },
        });
      }

      const projectedScore = Math.min(100, currentScore + cumulativeImpact);

      return reply.send({
        data: {
          currentScore,
          projectedScore: Math.round(projectedScore * 10) / 10,
          totalImpact: Math.round(cumulativeImpact * 10) / 10,
          actions: results,
          summary: {
            highestImpact: results.sort((a, b) => b.impact.healthScoreDelta - a.impact.healthScoreDelta)[0]?.type ?? null,
            totalActions: results.length,
            avgConfidence: Math.round(
              (results.reduce((s, r) => s + r.impact.confidence, 0) / results.length) * 100,
            ) / 100,
            recommendation: cumulativeImpact > 10
              ? 'Strong improvement potential. Prioritize the highest-confidence actions first.'
              : cumulativeImpact > 5
                ? 'Moderate improvement expected. Consider bundling these changes into a focused sprint.'
                : 'Minor improvements. These are good housekeeping tasks but won\'t dramatically change the health score.',
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
   * Get the evolution graph — track decisions, outcomes, and learning over time.
   * Auto-generated from real analysis history.
   */
  app.get('/api/v1/forecasting/evolution', async (_request, reply) => {
    try {
      // Build evolution events from real analysis history
      const history = state.isInitialized() ? state.getAnalysisHistory() : [];
      const successfulRuns = history
        .filter(h => h.status === 'success')
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
      let prevScore = 50; // baseline before any analysis

      for (let i = 0; i < successfulRuns.length; i++) {
        const run = successfulRuns[i]!;
        const currentScore = Math.max(0, Math.min(100, 100 - run.findingCount * 2 + run.opportunityCount * 0.5));
        const scoreDelta = Math.round((currentScore - prevScore) * 10) / 10;

        // Classify event type by score change
        const eventType = scoreDelta > 5 ? 'milestone' :
                          scoreDelta < -5 ? 'incident' :
                          scoreDelta > 0 ? 'decision' : 'experiment';

        const outcome = scoreDelta >= 0 ? 'positive' : 'resolved';

        // Generate meaningful description and learnings from data
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
          description: `Completed with ${run.findingCount} findings and ${run.opportunityCount} opportunities. Health score: ${Math.round(currentScore)}.`,
          outcome,
          healthImpact: Math.round(scoreDelta),
          learnings,
        });

        prevScore = currentScore;
      }

      // Calculate trajectory
      let score = 50;
      const trajectory = events.map(e => {
        score = Math.max(0, Math.min(100, score + e.healthImpact));
        return { date: e.date, score, event: e.title };
      });

      return reply.send({
        data: {
          events,
          trajectory,
          currentScore: events.length > 0 ? score : (state.isInitialized() ? state.getHealthScore().overall : 0),
          totalDecisions: events.filter(e => e.type === 'decision').length,
          totalMilestones: events.filter(e => e.type === 'milestone').length,
          totalIncidents: events.filter(e => e.type === 'incident').length,
          totalExperiments: events.filter(e => e.type === 'experiment').length,
          netHealthImpact: events.reduce((s, e) => s + e.healthImpact, 0),
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
    async (request, reply) => {
      try {
        const horizonDays = Math.min(90, parseInt(request.query.horizon ?? '30', 10) || 30);

        const realScore = state.isInitialized() ? state.getHealthScore().overall : null;
        const baseScore = realScore ?? 0;
        const timeline = buildTimeline(baseScore);

        // Fit linear regression
        const points = timeline.map((p, i) => ({ x: i, y: p.score }));
        const regression = linearRegression(points);

        const trend = regression.slope > 0.1 ? 'improving' :
                      regression.slope < -0.1 ? 'declining' : 'stable';

        // Generate predictions for key future intervals
        const intervals = [7, 14, 30, 60, 90].filter(d => d <= horizonDays);
        const predictions = intervals.map(days => {
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

        // Overall confidence from R²
        const confidence = Math.round(regression.r2 * 100) / 100;

        return reply.send({
          data: {
            predictions,
            confidence,
            horizon: `${horizonDays} days`,
            current_score: baseScore,
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAffectedDimensions(actionType: string): string[] {
  const mapping: Record<string, string[]> = {
    'fix-critical-findings': ['security', 'reliability'],
    'add-tests': ['testing', 'reliability', 'developer_experience'],
    'upgrade-dependencies': ['security', 'reliability'],
    'add-monitoring': ['operational', 'reliability'],
    'refactor-architecture': ['architecture', 'developer_experience'],
    'add-documentation': ['documentation', 'developer_experience'],
    'enable-strict-mode': ['reliability', 'developer_experience'],
    'add-rate-limiting': ['security', 'reliability'],
    'fix-security-issues': ['security'],
    'optimize-performance': ['performance', 'operational'],
  };
  return mapping[actionType] ?? ['general'];
}
