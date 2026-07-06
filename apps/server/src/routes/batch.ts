/**
 * @module @recurrsive/server/routes/batch
 *
 * Batch analysis routes for submitting multiple projects for sequential
 * analysis and tracking their status.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import { store } from '../store.js';
import { state } from '../state.js';
import { createLogger } from '@recurrsive/core';
import { authMiddleware } from '../middleware/auth.js';

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
// Constants
// ---------------------------------------------------------------------------

const MAX_HISTORY = 50;

function generateBatchId(): string {
  const count = store.count('batches') + 1;
  return `batch_${String(count).padStart(6, '0')}`;
}

const batchLogger = createLogger({ context: { component: 'server:routes:batch' } });

/**
 * Path traversal safety check — rejects paths outside allowed prefixes.
 */
const ALLOWED_PREFIXES = ['/app', '/tmp/recurrsive-repos/', '/home/'];
function isSafePath(projectPath: string): boolean {
  const resolved = path.resolve(projectPath);
  return ALLOWED_PREFIXES.some((prefix) => resolved.startsWith(prefix));
}

/**
 * Run real sequential analysis on each project in a batch.
 *
 * For each project:
 * 1. Validate the path
 * 2. Initialize a fresh server state for that project
 * 3. Run the full analysis pipeline
 * 4. Update per-project status in the store
 *
 * After all projects complete, set the final batch status.
 */
async function runBatchAnalysis(batchId: string): Promise<void> {
  const batch = store.get<BatchRun>('batches', batchId);
  if (!batch) return;

  batch.status = 'running';
  store.set<BatchRun>('batches', batchId, batch);

  for (let i = 0; i < batch.projects.length; i++) {
    const currentBatch = store.get<BatchRun>('batches', batchId);
    if (!currentBatch) return;

    const project = currentBatch.projects[i];
    if (!project) continue;

    project.status = 'running';
    project.started_at = new Date().toISOString();
    store.set<BatchRun>('batches', batchId, currentBatch);

    try {
      // Validate path safety
      if (!isSafePath(project.path)) {
        throw new Error(`Path "${project.path}" is not in the allowed directories.`);
      }

      // Initialize state for this project and run analysis
      if (state.isInitialized()) {
        await state.dispose();
      }
      await state.initialize(project.path);
      await state.runAnalysis();

      // Mark success
      const afterBatch = store.get<BatchRun>('batches', batchId);
      if (!afterBatch) return;
      const afterProject = afterBatch.projects[i];
      if (afterProject) {
        afterProject.status = 'completed';
        afterProject.completed_at = new Date().toISOString();
        store.set<BatchRun>('batches', batchId, afterBatch);
      }

      batchLogger.info(`Batch ${batchId}: project "${project.path}" completed`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      batchLogger.error(`Batch ${batchId}: project "${project.path}" failed: ${message}`);

      const afterBatch = store.get<BatchRun>('batches', batchId);
      if (!afterBatch) return;
      const afterProject = afterBatch.projects[i];
      if (afterProject) {
        afterProject.status = 'failed';
        afterProject.completed_at = new Date().toISOString();
        afterProject.error = message;
        store.set<BatchRun>('batches', batchId, afterBatch);
      }
    }
  }

  // Determine final batch status
  const finalBatch = store.get<BatchRun>('batches', batchId);
  if (finalBatch) {
    const allCompleted = finalBatch.projects.every((p) => p.status === 'completed');
    const allFailed = finalBatch.projects.every((p) => p.status === 'failed');
    finalBatch.status = allCompleted ? 'completed' : allFailed ? 'failed' : 'partial';
    finalBatch.completed_at = new Date().toISOString();
    store.set<BatchRun>('batches', batchId, finalBatch);
    batchLogger.info(`Batch ${batchId}: ${finalBatch.status} (${finalBatch.projects.length} projects)`);
  }
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
  }>('/api/v1/batch/analyze', { preHandler: [authMiddleware] }, async (request, reply) => {
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

    store.set<BatchRun>('batches', batchId, batchRun);

    // Enforce max history
    store.trim('batches', MAX_HISTORY);

    // Start real batch analysis asynchronously (runs in background)
    // Use setImmediate to ensure the response is sent before analysis starts
    setImmediate(() => {
      runBatchAnalysis(batchId).catch((err) => {
        batchLogger.error(`Batch ${batchId} failed: ${err instanceof Error ? err.message : String(err)}`);
      });
    });

    // Return the initial batch state immediately
    return reply.status(202).send({
      batch_id: batchId,
      status: 'pending',
      projects: batchRun.projects.map((p) => ({
        path: p.path,
        status: p.status,
      })),
    });
  });

  /**
   * GET /api/v1/batch/status
   *
   * Return the current batch processing status — whether any batch is
   * actively running and a summary of recent/active jobs. The dashboard
   * polls this endpoint to display batch activity state.
   */
  app.get('/api/v1/batch/status', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const runs = store.recent<BatchRun>('batches');
    const activeRuns = runs.filter((r) => r.status === 'pending' || r.status === 'running');
    const active = activeRuns.length > 0;

    const jobs = runs.slice(0, 10).map((r) => ({
      batch_id: r.batch_id,
      status: r.status,
      project_count: r.projects.length,
      completed: r.projects.filter((p) => p.status === 'completed').length,
      failed: r.projects.filter((p) => p.status === 'failed').length,
      created_at: r.created_at,
      completed_at: r.completed_at,
    }));

    return reply.status(200).send({
      data: {
        active,
        jobs,
      },
    });
  });

  /**
   * GET /api/v1/batch/status/:id
   *
   * Get the current status of a batch run by ID.
   */
  app.get<{
    Params: { id: string };
  }>('/api/v1/batch/status/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params;
    const batch = store.get<BatchRun>('batches', id);

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
  app.get('/api/v1/batch/history', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const runs = store.recent<BatchRun>('batches');

    return reply.status(200).send({
      data: runs,
      total: runs.length,
    });
  });
}
