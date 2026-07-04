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

/** Generate synthetic timeline for demo. */
function generateTimeline(days: number, baseScore: number): Array<{ date: string; score: number }> {
  const timeline: Array<{ date: string; score: number }> = [];
  const now = Date.now();
  let score = baseScore - days * 0.15;

  for (let i = days; i >= 0; i--) {
    const date = new Date(now - i * 86400000).toISOString().split('T')[0]!;
    score = Math.min(100, Math.max(0, score + (Math.random() - 0.45) * 3));
    timeline.push({ date, score: Math.round(score * 10) / 10 });
  }
  return timeline;
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
      const horizon = Math.min(180, parseInt(request.query.horizon ?? '30', 10) || 30);
      const historyDays = Math.min(365, parseInt(request.query.history ?? '90', 10) || 90);

      // Generate synthetic historical data
      const timeline = generateTimeline(historyDays, 72);

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
    },
  );

  /**
   * POST /api/v1/forecasting/what-if
   * Simulate the impact of proposed changes on project health.
   *
   * Body: { actions: [{ type, description, estimatedImpact }] }
   */
  app.post('/api/v1/forecasting/what-if', async (request, reply) => {
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

    const currentScore = 78; // Synthetic baseline
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
  });

  /**
   * GET /api/v1/forecasting/evolution
   * Get the evolution graph — track decisions, outcomes, and learning over time.
   */
  app.get('/api/v1/forecasting/evolution', async (_request, reply) => {
    // Synthetic evolution data
    const events = [
      {
        id: generateId(),
        date: '2026-01-15',
        type: 'decision',
        title: 'Adopt multi-agent reasoning architecture',
        description: 'Replaced single-pass analysis with 19-specialist debate engine.',
        outcome: 'positive',
        healthImpact: 12,
        learnings: ['Debate protocol significantly improved finding accuracy', 'Specialist diversity matters more than count'],
      },
      {
        id: generateId(),
        date: '2026-02-20',
        type: 'milestone',
        title: 'Knowledge graph migration to dual-backend',
        description: 'Added SQLite alongside Apache AGE for development workflows.',
        outcome: 'positive',
        healthImpact: 5,
        learnings: ['SQLite backend eliminates PostgreSQL dependency for dev', 'Query interface abstraction was key to clean migration'],
      },
      {
        id: generateId(),
        date: '2026-03-10',
        type: 'incident',
        title: 'Dependency vulnerability in oauth-lib v3',
        description: 'OWASP A07:2021 flagged during automated scan.',
        outcome: 'resolved',
        healthImpact: -8,
        learnings: ['Automated dependency scanning caught this early', 'Need policy for mandatory lockfile updates'],
      },
      {
        id: generateId(),
        date: '2026-04-05',
        type: 'decision',
        title: 'Add JWT auth + RBAC to REST API',
        description: 'Enterprise-grade authentication with role-based access control.',
        outcome: 'positive',
        healthImpact: 7,
        learnings: ['API key support essential for CI/CD integration', 'Three-tier RBAC (admin/analyst/viewer) covers most use cases'],
      },
      {
        id: generateId(),
        date: '2026-05-15',
        type: 'experiment',
        title: 'TypeScript strict mode trial',
        description: 'Enabled strict mode in @recurrsive/core as a pilot.',
        outcome: 'positive',
        healthImpact: 3,
        learnings: ['Found 12 type-safety issues', 'strictNullChecks was the highest-value flag'],
      },
      {
        id: generateId(),
        date: '2026-06-01',
        type: 'decision',
        title: 'Expand collectors to GitLab + telemetry',
        description: 'Added GitLab CI/CD and OpenTelemetry data collection.',
        outcome: 'positive',
        healthImpact: 6,
        learnings: ['Collector interface abstraction makes new integrations fast', 'Governance filtering is critical for enterprise adoption'],
      },
      {
        id: generateId(),
        date: '2026-06-20',
        type: 'milestone',
        title: 'Dashboard executive intelligence view',
        description: 'Added KPI dashboards, risk assessment, and trend visualization.',
        outcome: 'positive',
        healthImpact: 4,
        learnings: ['Executive stakeholders need different data than engineers', 'Health score trend is the single most-watched metric'],
      },
    ];

    // Calculate trajectory
    let score = 55;
    const trajectory = events.map(e => {
      score = Math.max(0, Math.min(100, score + e.healthImpact));
      return { date: e.date, score, event: e.title };
    });

    return reply.send({
      data: {
        events,
        trajectory,
        currentScore: score,
        totalDecisions: events.filter(e => e.type === 'decision').length,
        totalMilestones: events.filter(e => e.type === 'milestone').length,
        totalIncidents: events.filter(e => e.type === 'incident').length,
        totalExperiments: events.filter(e => e.type === 'experiment').length,
        netHealthImpact: events.reduce((s, e) => s + e.healthImpact, 0),
        allLearnings: events.flatMap(e => e.learnings),
      },
      generatedAt: nowISO(),
    });
  });
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
