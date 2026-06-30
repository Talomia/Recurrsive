/**
 * @module @recurrsive/server/routes/batch
 *
 * Batch analysis routes for submitting multiple projects for sequential
 * analysis and tracking their status.
 *
 * Uses in-memory storage — batch runs are not persisted across
 * server restarts.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Status of a single project within a batch. */
export type ProjectStatus = 'pending' | 'running' | 'completed' | 'failed';

/** Status of an entire batch run. */
export type BatchStatus = 'pending' | 'running' | 'completed' | 'partial' | 'failed';

/** A single project entry within a batch. */
export interface BatchProject {
  /** Filesystem path to the project. */
  path: string;
  /** Current analysis status. */
  status: ProjectStatus;
  /** ISO timestamp of when analysis started (null if pending). */
  started_at: string | null;
  /** ISO timestamp of when analysis completed (null if not done). */
  completed_at: string | null;
  /** Error message if analysis failed. */
  error?: string;
}

/** A batch analysis run. */
export interface BatchRun {
  /** Unique batch run ID. */
  batch_id: string;
  /** Overall batch status. */
  status: BatchStatus;
  /** Projects in the batch with individual status. */
  projects: BatchProject[];
  /** Analysis options passed at submission time. */
  options: Record<string, unknown>;
  /** ISO timestamp of when the batch was submitted. */
  created_at: string;
  /** ISO timestamp of when the batch completed (null if still running). */
  completed_at: string | null;
}

// ---------------------------------------------------------------------------
// In-memory batch store
// ---------------------------------------------------------------------------

const MAX_HISTORY = 50;
const batchRuns: Map<string, BatchRun> = new Map();
let nextBatchId = 1;

function generateBatchId(): string {
  return `batch_${String(nextBatchId++).padStart(6, '0')}`;
}

/**
 * Simulate sequential analysis of projects in a batch.
 *
 * In a real implementation, this would call the analysis engine
 * for each project. Here we simulate it with timeouts.
 */
function simulateBatchAnalysis(batchId: string): void {
  const batch = batchRuns.get(batchId);
  if (!batch) return;

  batch.status = 'running';

  let projectIndex = 0;

  function processNext(): void {
    const currentBatch = batchRuns.get(batchId);
    if (!currentBatch || projectIndex >= currentBatch.projects.length) {
      // All projects processed — determine final status
      if (currentBatch) {
        const allCompleted = currentBatch.projects.every((p) => p.status === 'completed');
        const allFailed = currentBatch.projects.every((p) => p.status === 'failed');
        currentBatch.status = allCompleted ? 'completed' : allFailed ? 'failed' : 'partial';
        currentBatch.completed_at = new Date().toISOString();
      }
      return;
    }

    const project = currentBatch.projects[projectIndex];
    if (!project) return;

    project.status = 'running';
    project.started_at = new Date().toISOString();

    // Simulate analysis taking 1-3 seconds
    const duration = 1000 + Math.random() * 2000;
    setTimeout(() => {
      // 90% success rate
      if (Math.random() > 0.1) {
        project.status = 'completed';
      } else {
        project.status = 'failed';
        project.error = 'Analysis failed: unable to parse project configuration';
      }
      project.completed_at = new Date().toISOString();
      projectIndex++;
      processNext();
    }, duration);
  }

  processNext();
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Register batch analysis routes.
 *
 * @param app - Fastify instance.
 */
export async function registerBatchRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/v1/batch/analyze
   *
   * Submit a batch of project paths for sequential analysis.
   *
   * Body:
   * - projects: string[] — non-empty array of filesystem paths (max 10)
   * - options: Record<string, unknown> (optional)
   */
  app.post<{
    Body: {
      projects: string[];
      options?: Record<string, unknown>;
    };
  }>('/api/v1/batch/analyze', async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;

    if (!body || typeof body !== 'object') {
      return reply.status(400).send({
        error: 'Invalid request',
        message: 'Request body must be a JSON object.',
      });
    }

    const projects = body['projects'];
    const options = (body['options'] as Record<string, unknown>) ?? {};

    // Validate projects field
    if (!Array.isArray(projects)) {
      return reply.status(400).send({
        error: 'Invalid request',
        message: 'projects must be an array of file paths.',
      });
    }

    if (projects.length === 0) {
      return reply.status(400).send({
        error: 'Invalid request',
        message: 'projects array must not be empty.',
      });
    }

    if (projects.length > 10) {
      return reply.status(400).send({
        error: 'Invalid request',
        message: `Too many projects: ${projects.length}. Maximum is 10.`,
      });
    }

    // Validate each project is a non-empty string
    for (let i = 0; i < projects.length; i++) {
      if (typeof projects[i] !== 'string' || (projects[i] as string).trim() === '') {
        return reply.status(400).send({
          error: 'Invalid request',
          message: `projects[${i}] must be a non-empty string.`,
        });
      }
    }

    const batchId = generateBatchId();
    const now = new Date().toISOString();

    const batchRun: BatchRun = {
      batch_id: batchId,
      status: 'pending',
      projects: projects.map((path) => ({
        path: path as string,
        status: 'pending' as ProjectStatus,
        started_at: null,
        completed_at: null,
      })),
      options,
      created_at: now,
      completed_at: null,
    };

    batchRuns.set(batchId, batchRun);

    // Enforce max history
    if (batchRuns.size > MAX_HISTORY) {
      const oldest = batchRuns.keys().next().value as string;
      batchRuns.delete(oldest);
    }

    // Start simulation asynchronously
    simulateBatchAnalysis(batchId);

    return reply.status(202).send({
      batch_id: batchId,
      status: batchRun.status,
      projects: batchRun.projects.map((p) => ({
        path: p.path,
        status: p.status,
      })),
    });
  });

  /**
   * GET /api/v1/batch/status/:id
   *
   * Get the current status of a batch run by ID.
   */
  app.get<{
    Params: { id: string };
  }>('/api/v1/batch/status/:id', async (request, reply) => {
    const { id } = request.params;
    const batch = batchRuns.get(id);

    if (!batch) {
      return reply.status(404).send({
        error: 'Not found',
        message: `Batch run ${id} not found.`,
      });
    }

    return reply.status(200).send({
      data: batch,
    });
  });

  /**
   * GET /api/v1/batch/history
   *
   * Return past batch runs, ordered newest first.
   */
  app.get('/api/v1/batch/history', async (_request, reply) => {
    const runs = Array.from(batchRuns.values())
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    return reply.status(200).send({
      data: runs,
      total: runs.length,
    });
  });
}
