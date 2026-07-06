/**
 * @module @recurrsive/server/routes/experiments
 *
 * Experiment A/B testing routes for managing engineering experiments.
 *
 * Persists experiments in the SQLite store.
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

// No seed data — experiments are created by the user via the API.

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

let nextId = 1;

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
  app.get('/api/v1/experiments', { preHandler: [authMiddleware] }, async (request, reply) => {
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
  app.post('/api/v1/experiments', {
    preHandler: [authMiddleware],
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          hypothesis: { type: 'string' },
          variants: {
            type: 'array',
            items: { type: 'object' },
          },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
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
  app.get('/api/v1/experiments/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
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
  app.put('/api/v1/experiments/:id/status', {
    preHandler: [authMiddleware],
    schema: {
      body: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'running', 'completed', 'failed'] },
          conclusion: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
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
