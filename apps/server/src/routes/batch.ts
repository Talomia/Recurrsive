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
import { requireRole } from '../middleware/rbac.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Status of a single project within a batch. */
export type ProjectStatus = 'pending' | 'running' | 'completed' | 'failed';

/** Status of an entire batch run. */
export type BatchStatus = 'pending' | 'running' | 'completed' | 'partial' | 'failed';

/** A single project entry within a batch. */
export interface BatchProject {
  /** Filesystem path to the project (used when no gitUrl is given). */
  path: string;
  /** Git repository URL to clone and analyze (preferred for server projects). */
  gitUrl?: string;
  /** Project id to scope the analysis results to. */
  projectId?: string;
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

async function generateBatchId(): Promise<string> {
  const count = await store.count('batches') + 1;
  return `batch_${String(count).padStart(6, '0')}`;
}

const batchLogger = createLogger({ context: { component: 'server:routes:batch' } });

/**
 * Path traversal safety check — rejects paths outside allowed prefixes.
 */
const envPrefixes = process.env['RECURRSIVE_ALLOWED_PATHS']?.split(',').map(p => p.trim()).filter(Boolean);
const ALLOWED_PREFIXES = envPrefixes ?? ['/app', '/tmp/recurrsive-repos/'];
function isSafePath(projectPath: string): boolean {
  const resolved = path.resolve(projectPath);
  // Match on a path-segment boundary so `/app` does not admit `/app-private`.
  return ALLOWED_PREFIXES.some((prefix) => {
    const base = prefix.endsWith(path.sep) ? prefix.slice(0, -1) : prefix;
    return resolved === base || resolved.startsWith(base + path.sep);
  });
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
  const batch = await store.get<BatchRun>('batches', batchId);
  if (!batch) return;

  batch.status = 'running';
  await store.set<BatchRun>('batches', batchId, batch);

  for (let i = 0; i < batch.projects.length; i++) {
    const currentBatch = await store.get<BatchRun>('batches', batchId);
    if (!currentBatch) return;

    const project = currentBatch.projects[i];
    if (!project) continue;

    project.status = 'running';
    project.started_at = new Date().toISOString();
    await store.set<BatchRun>('batches', batchId, currentBatch);

    let clonedDir: string | null = null;
    try {
      // Resolve the target path: clone the git URL if given, otherwise use the
      // filesystem path (path-guarded). This lets the batch analyze the same
      // remote repos the single-project analyze endpoint accepts.
      let effectivePath = project.path;
      if (project.gitUrl) {
        clonedDir = await state.cloneRepo(project.gitUrl);
        effectivePath = clonedDir;
      } else if (!isSafePath(project.path)) {
        throw new Error(`Path "${project.path}" is not in the allowed directories.`);
      }

      // Initialize state for this project and run analysis, scoped to its
      // project id so results land on the right project (not the default bucket).
      if (state.isInitialized()) {
        await state.dispose();
      }
      await state.initialize(effectivePath);
      await state.runAnalysis(undefined, undefined, project.projectId);

      // Mark success
      const afterBatch = await store.get<BatchRun>('batches', batchId);
      if (!afterBatch) return;
      const afterProject = afterBatch.projects[i];
      if (afterProject) {
        afterProject.status = 'completed';
        afterProject.completed_at = new Date().toISOString();
        await store.set<BatchRun>('batches', batchId, afterBatch);
      }

      batchLogger.info(`Batch ${batchId}: project "${project.path}" completed`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      batchLogger.error(`Batch ${batchId}: project "${project.path}" failed: ${message}`);

      const afterBatch = await store.get<BatchRun>('batches', batchId);
      if (!afterBatch) return;
      const afterProject = afterBatch.projects[i];
      if (afterProject) {
        afterProject.status = 'failed';
        afterProject.completed_at = new Date().toISOString();
        afterProject.error = message;
        await store.set<BatchRun>('batches', batchId, afterBatch);
      }
    } finally {
      // Remove any repo cloned for this item to reclaim disk.
      if (clonedDir) {
        try { await state.cleanupClone(clonedDir); } catch { /* best-effort */ }
      }
    }
  }

  // Determine final batch status
  const finalBatch = await store.get<BatchRun>('batches', batchId);
  if (finalBatch) {
    const allCompleted = finalBatch.projects.every((p) => p.status === 'completed');
    const allFailed = finalBatch.projects.every((p) => p.status === 'failed');
    finalBatch.status = allCompleted ? 'completed' : allFailed ? 'failed' : 'partial';
    finalBatch.completed_at = new Date().toISOString();
    await store.set<BatchRun>('batches', batchId, finalBatch);
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
   * Submit a batch of projects for sequential analysis.
   *
   * Body:
   * - projects: array (max 10) of either a filesystem-path string OR an object
   *   `{ path?, gitUrl?, projectId? }` (gitUrl is cloned; projectId scopes
   *   results). Mixed forms are allowed.
   * - options: Record<string, unknown> (optional)
   */
  app.post<{
    Body: {
      projects: Array<string | { path?: string; gitUrl?: string; projectId?: string }>;
      options?: Record<string, unknown>;
    };
  }>('/api/v1/batch/analyze', {
    preHandler: [authMiddleware, requireRole('analyst')],
    schema: {
      body: {
        type: 'object',
        required: ['projects'],
        properties: {
          projects: {
            type: 'array',
            items: {
              anyOf: [
                { type: 'string', minLength: 1 },
                {
                  type: 'object',
                  properties: {
                    path: { type: 'string' },
                    gitUrl: { type: 'string' },
                    projectId: { type: 'string' },
                  },
                  additionalProperties: false,
                },
              ],
            },
            minItems: 1,
            maxItems: 10,
          },
          options: { type: 'object' },
        },
      },
    },
  }, async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;

    if (!body || typeof body !== 'object') {
      return reply.status(400).send({
        error: 'Invalid request',
        message: 'Request body must be a JSON object.',
      });
    }

    const projects = body['projects'];
    const options = (body['options'] as Record<string, unknown>) ?? {};

    if (!Array.isArray(projects)) {
      return reply.status(400).send({
        error: 'Invalid request',
        message: 'projects must be an array.',
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

    // Normalize each item to a BatchProject; every item must carry either a
    // path or a gitUrl.
    const normalized: BatchProject[] = [];
    for (let i = 0; i < projects.length; i++) {
      const item = projects[i];
      let entry: { path: string; gitUrl?: string; projectId?: string };
      if (typeof item === 'string') {
        if (item.trim() === '') {
          return reply.status(400).send({ error: 'Invalid request', message: `projects[${i}] must be a non-empty string.` });
        }
        entry = { path: item };
      } else if (item && typeof item === 'object') {
        const obj = item as { path?: string; gitUrl?: string; projectId?: string };
        if (!obj.gitUrl && !obj.path) {
          return reply.status(400).send({ error: 'Invalid request', message: `projects[${i}] must include a path or gitUrl.` });
        }
        entry = { path: obj.path ?? '', gitUrl: obj.gitUrl, projectId: obj.projectId };
      } else {
        return reply.status(400).send({ error: 'Invalid request', message: `projects[${i}] must be a string or an object.` });
      }
      normalized.push({
        path: entry.path,
        ...(entry.gitUrl ? { gitUrl: entry.gitUrl } : {}),
        ...(entry.projectId ? { projectId: entry.projectId } : {}),
        status: 'pending' as ProjectStatus,
        started_at: null,
        completed_at: null,
      });
    }

    const batchId = await generateBatchId();
    const now = new Date().toISOString();

    const batchRun: BatchRun = {
      batch_id: batchId,
      status: 'pending',
      projects: normalized,
      options,
      created_at: now,
      completed_at: null,
    };

    await store.set<BatchRun>('batches', batchId, batchRun);

    // Enforce max history
    await store.trim('batches', MAX_HISTORY);

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
        path: p.gitUrl || p.path,
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
    const runs = await store.recent<BatchRun>('batches');
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
    const batch = await store.get<BatchRun>('batches', id);

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
    const runs = await store.recent<BatchRun>('batches');

    return reply.status(200).send({
      data: runs,
      total: runs.length,
    });
  });

  /**
   * GET /api/v1/batch/:id
   *
   * Batch detail by id — the same record as `/batch/status/:id`, provided as
   * a canonical detail endpoint for consumers. Registered after the static
   * `/batch/status`, `/batch/history`, and `/batch/analyze` paths so those
   * are not shadowed by the `:id` parameter.
   */
  app.get<{ Params: { id: string } }>('/api/v1/batch/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params;
    const batch = await store.get<BatchRun>('batches', id);

    if (!batch) {
      return reply.status(404).send({
        error: 'Not found',
        message: `Batch run ${id} not found.`,
      });
    }

    return reply.status(200).send({ data: batch });
  });
}
