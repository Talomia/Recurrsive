/**
 * @module @recurrsive/server/routes/simulation
 *
 * Simulation engine and PR generation routes.
 *
 * Provides:
 * - Traffic replay simulation for impact prediction
 * - PR (pull request) generation from recommendations
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { generateId, nowISO } from '@recurrsive/core';
import { state } from '../state.js';
import { store } from '../store.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { computeHealthScore } from '../health-score.js';

// ---------------------------------------------------------------------------
// Types — Simulation Engine
// ---------------------------------------------------------------------------

interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  type: 'traffic-replay' | 'load-test' | 'failure-injection' | 'dependency-change' | 'architecture-change';
  /**
   * Parameters supplied by the caller. They are RECORDED but NOT consumed by
   * any simulation engine — no dynamic simulation exists in this build.
   */
  parameters: Record<string, unknown>;
  /**
   * `not_simulated` is the terminal status for scenarios created via this
   * API: the scenario is stored and a static, severity-derived risk
   * assessment is attached, but no dynamic simulation ever runs.
   */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'not_simulated';
  /**
   * Static risk assessment derived from current analysis findings, or null
   * when the project has never been analyzed (nothing to assess).
   */
  results: StaticRiskAssessment | null;
  createdAt: string;
  completedAt: string | null;
}

/**
 * A static, severity-derived risk assessment. This is NOT a simulation
 * outcome: every number is a heuristic prior over the project's current
 * findings, flagged as such via `is_estimate` / `basis`.
 */
interface StaticRiskAssessment {
  /** Always true — these numbers are priors, never simulated measurements. */
  is_estimate: true;
  /** All numbers derive from the current findings' severity distribution. */
  basis: 'severity_prior';
  /** Plain-language statement of what was (and was not) computed. */
  note: string;
  impactScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  findings: Array<{
    area: string;
    impact: string;
    /** Fixed severity-derived prior, not an observed frequency. */
    probability: number;
    recommendation: string;
  }>;
}

// ---------------------------------------------------------------------------
// Types — PR Generation
// ---------------------------------------------------------------------------

interface GeneratedPR {
  id: string;
  /** Source finding/opportunity ID, or null when the caller supplied none. */
  sourceId: string | null;
  title: string;
  description: string;
  branch: string;
  /** File changes. */
  changes: Array<{
    path: string;
    action: 'create' | 'modify' | 'delete';
    additions: number;
    deletions: number;
    summary: string;
  }>;
  /** Estimated impact — computed only from what the PR verifiably addresses. */
  impact: {
    /**
     * Canonical computeHealthScore(remaining) − computeHealthScore(current)
     * for the findings this PR addresses, or null when the addressed
     * findings cannot be identified (basis: 'unknown').
     */
    healthScoreChange: number | null;
    /** How healthScoreChange was derived. */
    basis: 'computed' | 'unknown';
    /** Count of findings this PR actually addresses — never "all findings". */
    findingsResolved: number;
    /** No coverage measurement exists; always null rather than a fake 0-change claim. */
    coverageChange: number | null;
  };
  status: 'draft' | 'ready' | 'submitted' | 'merged' | 'declined';
  reviewers: string[];
  labels: string[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// No seed data — simulations and PRs are created via the API.
// Intelligence packs have been moved to their own route file.
// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function registerSimulationRoutes(app: FastifyInstance): Promise<void> {
  // ── Simulation Engine ─────────────────────────────────────────────────────

  app.get('/api/v1/simulations', { preHandler: [authMiddleware] }, async (_request, reply) => {
    try {
      const all = await store.all<SimulationScenario>('simulations');
      return reply.send({ data: all, total: all.length });
    } catch (err) {
      return reply.status(500).send({ error: 'Internal server error', message: 'Operation failed.' });
    }
  });

  app.get<{ Params: { id: string } }>('/api/v1/simulations/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      const sim = await store.get<SimulationScenario>('simulations', request.params.id);
      if (!sim) return reply.status(404).send({ error: 'Not Found', message: 'Simulation not found' });
      return reply.send({ data: sim });
    } catch (err) {
      return reply.status(500).send({ error: 'Internal server error', message: 'Operation failed.' });
    }
  });

  app.post<{ Querystring: { projectId?: string } }>('/api/v1/simulations', {
    preHandler: [authMiddleware, requireRole('analyst')],
    schema: {
      body: {
        type: 'object',
        required: ['name', 'type'],
        properties: {
          name: { type: 'string', minLength: 1 },
          type: { type: 'string' },
          description: { type: 'string' },
          parameters: { type: 'object' },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const body = request.body as { name?: string; description?: string; type?: SimulationScenario['type']; parameters?: Record<string, unknown> };
    if (!body.name || !body.type) {
      return reply.status(400).send({ error: 'Bad Request', message: 'name and type are required' });
    }

    try {
      const id = generateId();

      // IMPORTANT — honesty over theater: no dynamic simulation engine exists
      // in this build. The request's `type` and `parameters` are stored on the
      // scenario record, but they do not drive any computation. What we CAN
      // honestly attach is a static risk assessment derived from the project's
      // real analysis findings, clearly labeled as a severity prior.
      const cache = await state.loadCacheForProject(request.query.projectId);

      let results: StaticRiskAssessment | null = null;
      if (cache) {
        const findings = cache.findings ?? [];
        // Derive impact score from the finding severity distribution
        const criticalCount = findings.filter(f => f.severity === 'critical').length;
        const highCount = findings.filter(f => f.severity === 'high').length;
        const impactScore = Math.round(Math.min(10, (criticalCount * 3 + highCount * 1.5 + findings.length * 0.3)) * 10) / 10;

        // Derive risk level from the actual severity distribution
        const riskLevel: 'low' | 'medium' | 'high' = criticalCount > 0 ? 'high' : highCount > 2 ? 'medium' : 'low';

        // Surface real analysis findings with fixed severity-derived priors —
        // NOT observed probabilities and NOT simulation outcomes.
        const assessedFindings = findings.slice(0, 5).map(f => ({
          area: f.category ?? 'architecture' as const,
          impact: f.description.slice(0, 80),
          probability: f.severity === 'critical' ? 0.9 : f.severity === 'high' ? 0.7 : f.severity === 'medium' ? 0.5 : 0.3,
          recommendation: f.title ?? `Address ${f.severity} finding in ${f.category ?? 'system'}`,
        }));

        results = {
          is_estimate: true,
          basis: 'severity_prior',
          note: 'Static risk assessment only: no dynamic simulation was executed. ' +
            'impactScore, riskLevel, and per-finding probability are fixed heuristic priors ' +
            'derived from the current findings\' severity distribution. The submitted type ' +
            'and parameters were recorded but not consumed by any simulation engine. ' +
            'No absolute-unit predictions (latency, cost, availability) are produced because ' +
            'there is no empirical basis for them.',
          impactScore,
          riskLevel,
          findings: assessedFindings,
        };
      }

      const sim: SimulationScenario = {
        id,
        name: body.name,
        description: body.description ?? '',
        type: body.type,
        parameters: body.parameters ?? {},
        // No dynamic simulation ran (and none will) — say so instead of
        // pretending the scenario instantly "completed".
        status: 'not_simulated',
        // results is null when the project has never been analyzed: with no
        // findings data there is nothing to assess, and emitting a "low risk"
        // default would be a fabricated statistic.
        results,
        createdAt: nowISO(),
        completedAt: null,
      };

      await store.set<SimulationScenario>('simulations', id, sim);
      return reply.status(201).send({ data: sim });
    } catch (err) {
      return reply.status(500).send({ error: 'Internal server error', message: 'Operation failed.' });
    }
  });

  // ── PR Generation ─────────────────────────────────────────────────────────

  app.get('/api/v1/pull-requests', { preHandler: [authMiddleware] }, async (_request, reply) => {
    try {
      const all = await store.all<GeneratedPR>('pull_requests');
      return reply.send({ data: all, total: all.length });
    } catch (err) {
      return reply.status(500).send({ error: 'Internal server error', message: 'Operation failed.' });
    }
  });

  app.get<{ Params: { id: string } }>('/api/v1/pull-requests/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      const pr = await store.get<GeneratedPR>('pull_requests', request.params.id);
      if (!pr) return reply.status(404).send({ error: 'Not Found', message: 'PR not found' });
      return reply.send({ data: pr });
    } catch (err) {
      return reply.status(500).send({ error: 'Internal server error', message: 'Operation failed.' });
    }
  });

  app.post<{ Querystring: { projectId?: string } }>('/api/v1/pull-requests/generate', {
    preHandler: [authMiddleware, requireRole('analyst')],
    schema: {
      body: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string', minLength: 1 },
          sourceId: { type: 'string' },
          description: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const body = request.body as { sourceId?: string; title?: string; description?: string };
    if (!body.title) {
      return reply.status(400).send({ error: 'Bad Request', message: 'title is required' });
    }

    try {
      const cache = await state.loadCacheForProject(request.query.projectId);
      const findings = cache?.findings ?? [];
      const opportunities = cache?.opportunities ?? [];
      const sourceId = body.sourceId ?? null;

      // Resolve what this PR actually addresses via sourceId. A PR generated
      // from one recommendation addresses that recommendation's findings —
      // never the project's entire findings list.
      const addressedFindings = sourceId
        ? findings.filter(f => f.id === sourceId)
        : [];
      const sourceOpportunity = sourceId
        ? opportunities.find(o => o.id === sourceId) ?? null
        : null;

      let changes: GeneratedPR['changes'];
      if (addressedFindings.length > 0) {
        changes = addressedFindings.map(f => ({
          path: f.locations?.[0]?.file ?? 'unknown',
          action: 'modify' as const,
          additions: 0,
          deletions: 0,
          summary: f.suggested_fix ?? f.description,
        }));
      } else if (sourceOpportunity) {
        changes = (sourceOpportunity.locations ?? []).map(loc => ({
          path: loc.file,
          action: 'modify' as const,
          additions: 0,
          deletions: 0,
          summary: sourceOpportunity.recommendation,
        }));
      } else {
        // Nothing verifiably addressed — an empty change list is honest;
        // listing every finding's file would fabricate the PR's scope.
        changes = [];
      }

      let impact: GeneratedPR['impact'];
      if (addressedFindings.length > 0) {
        // Canonical delta: health score with the addressed findings removed,
        // minus the current health score.
        const currentOverall = computeHealthScore(findings).overall;
        const addressedIds = new Set(addressedFindings.map(f => f.id));
        const remaining = findings.filter(f => !addressedIds.has(f.id));
        impact = {
          healthScoreChange: computeHealthScore(remaining).overall - currentOverall,
          basis: 'computed',
          findingsResolved: addressedFindings.length,
          coverageChange: null,
        };
      } else {
        // sourceId absent, or it names an opportunity whose finding mapping is
        // not tracked — the health-score effect is unknown, not zero and not
        // "findings.length * 2".
        impact = {
          healthScoreChange: null,
          basis: 'unknown',
          findingsResolved: 0,
          coverageChange: null,
        };
      }

      const id = generateId();
      const pr: GeneratedPR = {
        id,
        sourceId,
        title: body.title,
        description: body.description ?? '',
        branch: `auto/${body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`,
        changes,
        impact,
        status: 'draft',
        reviewers: [],
        labels: ['auto-generated'],
        createdAt: nowISO(),
      };

      await store.set<GeneratedPR>('pull_requests', id, pr);
      return reply.status(201).send({ data: pr });
    } catch (err) {
      return reply.status(500).send({ error: 'Internal server error', message: 'Operation failed.' });
    }
  });

  app.post<{ Params: { id: string } }>('/api/v1/pull-requests/:id/submit', { preHandler: [authMiddleware, requireRole('analyst')] }, async (request, reply) => {
    try {
      const pr = await store.get<GeneratedPR>('pull_requests', request.params.id);
      if (!pr) return reply.status(404).send({ error: 'Not Found', message: 'PR not found' });

      pr.status = 'submitted';
      await store.set<GeneratedPR>('pull_requests', pr.id, pr);
      return reply.send({ data: pr, message: 'PR submitted for review' });
    } catch (err) {
      return reply.status(500).send({ error: 'Internal server error', message: 'Operation failed.' });
    }
  });

}
