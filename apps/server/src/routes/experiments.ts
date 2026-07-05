/**
 * @module @recurrsive/server/routes/experiments
 *
 * Experiment A/B testing routes for managing engineering experiments.
 *
 * Persists experiments in the SQLite store, seeding 5 initial experiments on first run.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import { store } from '../store.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A variant (treatment or control) within an experiment. */
export interface ExperimentVariant {
  name: string;
  config: Record<string, unknown>;
}

/** A metric comparison between variants. */
export interface ExperimentMetricResult {
  name: string;
  variant_a: number;
  variant_b: number;
  improvement: number;
}

/** Full experiment shape. */
export interface Experiment {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  hypothesis: string;
  variants: ExperimentVariant[];
  metrics: ExperimentMetricResult[];
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  conclusion: string | null;
}

// ---------------------------------------------------------------------------
// Seed data (runs once on first startup with empty DB)
// ---------------------------------------------------------------------------

function seedIfEmpty(): void {
  if (store.count('experiments') > 0) return;

  const seedExperiments: Experiment[] = [
    {
      id: 'exp_001',
      name: 'Strict Import Rules',
      description: 'Test whether enforcing strict import rules improves overall codebase health scores by reducing circular dependencies and unused imports.',
      status: 'completed',
      hypothesis: 'Enforcing strict import rules will improve health scores by reducing circular dependencies.',
      variants: [
        { name: 'Control', config: { strict_imports: false } },
        { name: 'Strict Mode', config: { strict_imports: true, ban_circular: true } },
      ],
      metrics: [
        { name: 'Health Score', variant_a: 78, variant_b: 90, improvement: 12 },
        { name: 'Circular Deps', variant_a: 14, variant_b: 3, improvement: -78.6 },
        { name: 'Build Time', variant_a: 45, variant_b: 42, improvement: -6.7 },
      ],
      created_at: '2026-06-10T08:00:00Z',
      started_at: '2026-06-10T09:00:00Z',
      completed_at: '2026-06-18T17:00:00Z',
      conclusion: 'Positive result: +12% health score improvement. Strict import rules significantly reduced circular dependencies with minimal build time impact. Recommended for adoption.',
    },
    {
      id: 'exp_002',
      name: 'Auto-Fix Security',
      description: 'Evaluate automatic security vulnerability fixing using AI-generated patches compared to manual review.',
      status: 'running',
      hypothesis: 'Automated security fixes will reduce mean-time-to-remediation by 60% without introducing regressions.',
      variants: [
        { name: 'Manual Review', config: { auto_fix: false, review_required: true } },
        { name: 'AI Auto-Fix', config: { auto_fix: true, confidence_threshold: 0.85 } },
      ],
      metrics: [
        { name: 'MTTR (hours)', variant_a: 48, variant_b: 19.2, improvement: -60 },
        { name: 'Fix Rate', variant_a: 72, variant_b: 89, improvement: 23.6 },
        { name: 'Regression Rate', variant_a: 2.1, variant_b: 3.4, improvement: 61.9 },
      ],
      created_at: '2026-06-20T10:00:00Z',
      started_at: '2026-06-20T12:00:00Z',
      completed_at: null,
      conclusion: null,
    },
    {
      id: 'exp_003',
      name: 'Parallel Analyzers',
      description: 'Test running code analyzers in parallel vs sequential to measure impact on analysis accuracy and speed.',
      status: 'completed',
      hypothesis: 'Running analyzers in parallel will reduce total analysis time by 50% without sacrificing accuracy.',
      variants: [
        { name: 'Sequential', config: { parallel: false, max_workers: 1 } },
        { name: 'Parallel (4x)', config: { parallel: true, max_workers: 4 } },
      ],
      metrics: [
        { name: 'Analysis Time (s)', variant_a: 120, variant_b: 58, improvement: -51.7 },
        { name: 'Findings Detected', variant_a: 47, variant_b: 46, improvement: -2.1 },
        { name: 'Memory Usage (MB)', variant_a: 256, variant_b: 512, improvement: 100 },
      ],
      created_at: '2026-06-05T14:00:00Z',
      started_at: '2026-06-05T15:00:00Z',
      completed_at: '2026-06-12T16:00:00Z',
      conclusion: 'Neutral result: 52% speed improvement but doubled memory usage. Findings accuracy was equivalent. Recommend parallel mode for CI environments with sufficient resources.',
    },
    {
      id: 'exp_004',
      name: 'Batch Scheduling',
      description: 'Evaluate different scheduling strategies for batch analysis of multiple repositories.',
      status: 'pending',
      hypothesis: 'Priority-based scheduling will improve resource utilization by 30% compared to FIFO ordering.',
      variants: [
        { name: 'FIFO', config: { scheduler: 'fifo' } },
        { name: 'Priority Queue', config: { scheduler: 'priority', weight_by: 'last_analysis_age' } },
      ],
      metrics: [],
      created_at: '2026-06-28T09:00:00Z',
      started_at: null,
      completed_at: null,
      conclusion: null,
    },
    {
      id: 'exp_005',
      name: 'Custom Policies',
      description: 'Test whether team-customizable policy rules improve compliance rates compared to the default built-in policy set.',
      status: 'completed',
      hypothesis: 'Custom policies tailored to team conventions will increase compliance rates by at least 10%.',
      variants: [
        { name: 'Built-in Only', config: { custom_policies: false } },
        { name: 'Custom + Built-in', config: { custom_policies: true, team_rules: 12 } },
      ],
      metrics: [
        { name: 'Compliance Rate', variant_a: 75, variant_b: 83, improvement: 8 },
        { name: 'False Positives', variant_a: 15, variant_b: 8, improvement: -46.7 },
        { name: 'Policy Violations', variant_a: 23, variant_b: 12, improvement: -47.8 },
      ],
      created_at: '2026-06-01T10:00:00Z',
      started_at: '2026-06-01T11:00:00Z',
      completed_at: '2026-06-08T18:00:00Z',
      conclusion: 'Positive result: +8% compliance improvement with 47% fewer false positives. Custom policies allow teams to encode domain-specific rules that built-in analyzers miss.',
    },
  ];

  for (const exp of seedExperiments) {
    store.set('experiments', exp.id, exp);
  }
}

seedIfEmpty();

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

let nextId = 6;

function generateExperimentId(): string {
  const id = `exp_${String(store.count('experiments') + nextId).padStart(3, '0')}`;
  nextId++;
  return id;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Register experiment routes.
 *
 * @param app - Fastify instance.
 */
export async function registerExperimentRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/experiments
   *
   * Return list of experiments.
   */
  app.get('/api/v1/experiments', async (request, reply) => {
    const { status } = request.query as { status?: string };

    let filtered = store.all<Experiment>('experiments');
    if (status) {
      filtered = filtered.filter((e) => e.status === status);
    }

    return reply.status(200).send({
      data: filtered,
      total: filtered.length,
    });
  });

  /**
   * POST /api/v1/experiments
   *
   * Create a new experiment.
   */
  app.post('/api/v1/experiments', { preHandler: [authMiddleware] }, async (request, reply) => {
    const body = request.body as {
      name?: string;
      description?: string;
      hypothesis?: string;
      variants?: ExperimentVariant[];
    };

    if (!body.name) {
      return reply.status(400).send({ error: 'Bad Request', message: 'name is required' });
    }

    const id = generateExperimentId();
    const experiment: Experiment = {
      id,
      name: body.name,
      description: body.description ?? '',
      status: 'pending',
      hypothesis: body.hypothesis ?? '',
      variants: body.variants ?? [],
      metrics: [],
      created_at: new Date().toISOString(),
      started_at: null,
      completed_at: null,
      conclusion: null,
    };

    store.set('experiments', id, experiment);

    return reply.status(201).send({ data: experiment });
  });

  /**
   * GET /api/v1/experiments/:id
   *
   * Return single experiment details.
   */
  app.get('/api/v1/experiments/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const experiment = store.get<Experiment>('experiments', id);

    if (!experiment) {
      return reply.status(404).send({ error: 'Not Found', message: `Experiment ${id} not found` });
    }

    return reply.status(200).send({ data: experiment });
  });

  /**
   * PUT /api/v1/experiments/:id/status
   *
   * Update experiment status (start/complete/abort).
   */
  app.put('/api/v1/experiments/:id/status', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { status?: string; conclusion?: string };

    const experiment = store.get<Experiment>('experiments', id);

    if (!experiment) {
      return reply.status(404).send({ error: 'Not Found', message: `Experiment ${id} not found` });
    }

    if (!body.status) {
      return reply.status(400).send({ error: 'Bad Request', message: 'status is required' });
    }

    const validStatuses = ['pending', 'running', 'completed', 'failed'];
    if (!validStatuses.includes(body.status)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    experiment.status = body.status as Experiment['status'];

    if (body.status === 'running' && !experiment.started_at) {
      experiment.started_at = new Date().toISOString();
    }

    if (body.status === 'completed' || body.status === 'failed') {
      experiment.completed_at = new Date().toISOString();
    }

    if (body.conclusion) {
      experiment.conclusion = body.conclusion;
    }

    store.set('experiments', id, experiment);

    return reply.status(200).send({ data: experiment });
  });
}
