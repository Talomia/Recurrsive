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
import { createLogger, generateId } from '@recurrsive/core';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { releaseAnalysisWorker, tryAcquireAnalysisWorker } from '../analysis-coordinator.js';
import { getPlatformSettings } from './config.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Status of a single project within a batch. */
export type ProjectStatus = 'pending' | 'running' | 'completed' | 'failed';

/** Status of an entire batch run. */
export type BatchStatus = 'pending' | 'running' | 'completed' | 'partial' | 'failed';

/** A single project entry within a batch. */
export interface BatchProject {
  projectId: string;
  name: string;
  repository: string;
  analyzers: string[];
  collectors: string[];
  /** Current analysis status. */
  status: ProjectStatus;
  /** ISO timestamp of when analysis started (null if pending). */
  started_at: string | null;
  /** ISO timestamp of when analysis completed (null if not done). */
  completed_at: string | null;
  /** Error message if analysis failed. */
  error?: string;
  findings_count?: number;
  opportunities_count?: number;
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
  return `batch_${generateId()}`;
}

const batchLogger = createLogger({ context: { component: 'server:routes:batch' } });

interface RegisteredProject {
  id: string;
  name: string;
  repository: string;
  settings: { analyzers: string[]; collectors: string[] };
}

/**
 * Path traversal safety check — rejects paths outside allowed prefixes.
 */
const envPrefixes = process.env['RECURRSIVE_ALLOWED_PATHS']?.split(',').map(p => p.trim()).filter(Boolean);
const ALLOWED_PREFIXES = envPrefixes ?? ['/app', '/tmp/recurrsive-repos/'];
function isSafePath(projectPath: string): boolean {
  const resolved = path.resolve(projectPath);
  return ALLOWED_PREFIXES.some((prefix) => {
    const allowed = path.resolve(prefix);
    return resolved === allowed || resolved.startsWith(`${allowed}${path.sep}`);
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
  try {
  const batch = await store.get<BatchRun>('batches', batchId);
  if (!batch) {
    releaseAnalysisWorker(batchId);
    return;
  }

  batch.status = 'running';
  await store.set<BatchRun>('batches', batchId, batch);

  for (let i = 0; i < batch.projects.length; i++) {
    const currentBatch = await store.get<BatchRun>('batches', batchId);
    if (!currentBatch) {
      releaseAnalysisWorker(batchId);
      return;
    }

    const project = currentBatch.projects[i];
    if (!project) continue;

    project.status = 'running';
    project.started_at = new Date().toISOString();
    await store.set<BatchRun>('batches', batchId, currentBatch);

    try {
      let effectivePath = project.repository;
      let clonedDir: string | null = null;
      const isGitUrl = /^https?:\/\//i.test(project.repository);
      if (isGitUrl) {
        clonedDir = await state.cloneRepo(project.repository);
        effectivePath = clonedDir;
      } else if (!isSafePath(project.repository)) {
        throw new Error(`Path "${project.repository}" is not in the allowed directories.`);
      }

      try {
        if (state.isInitialized()) await state.dispose();
        await state.initialize(effectivePath, project.name, project.projectId);
        const cache = await state.runAnalysis(
          project.analyzers,
          currentBatch.options['includeReasoning'] !== false,
          project.collectors,
        );
        project.findings_count = cache.findings.length;
        project.opportunities_count = cache.opportunities.length;
      } finally {
        if (clonedDir) await state.cleanupClone(clonedDir);
      }

      // Mark success
      const afterBatch = await store.get<BatchRun>('batches', batchId);
      if (!afterBatch) {
        releaseAnalysisWorker(batchId);
        return;
      }
      const afterProject = afterBatch.projects[i];
      if (afterProject) {
        afterProject.status = 'completed';
        afterProject.completed_at = new Date().toISOString();
        afterProject.findings_count = project.findings_count;
        afterProject.opportunities_count = project.opportunities_count;
        await store.set<BatchRun>('batches', batchId, afterBatch);
      }

      batchLogger.info(`Batch ${batchId}: project "${project.name}" completed`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      batchLogger.error(`Batch ${batchId}: project "${project.name}" failed: ${message}`);

      const afterBatch = await store.get<BatchRun>('batches', batchId);
      if (!afterBatch) {
        releaseAnalysisWorker(batchId);
        return;
      }
      const afterProject = afterBatch.projects[i];
      if (afterProject) {
        afterProject.status = 'failed';
        afterProject.completed_at = new Date().toISOString();
        afterProject.error = message;
        await store.set<BatchRun>('batches', batchId, afterBatch);
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
  } catch (error) {
    const failedBatch = await store.get<BatchRun>('batches', batchId).catch(() => null);
    if (failedBatch) {
      failedBatch.status = 'failed';
      failedBatch.completed_at = new Date().toISOString();
      for (const project of failedBatch.projects) {
        if (project.status === 'pending' || project.status === 'running') {
          project.status = 'failed';
          project.completed_at = failedBatch.completed_at;
          project.error = error instanceof Error ? error.message : 'Batch worker failed';
        }
      }
      await store.set('batches', batchId, failedBatch).catch(() => undefined);
    }
    throw error;
  } finally {
    releaseAnalysisWorker(batchId);
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
   * - projectIds: string[] — registered project IDs (max 100)
   * - options: Record<string, unknown> (optional)
   */
  app.post<{
    Body: {
      projectIds: string[];
      options?: Record<string, unknown>;
    };
  }>('/api/v1/batch/analyze', {
    preHandler: [authMiddleware, requireRole('analyst')],
    schema: {
      body: {
        type: 'object',
        required: ['projectIds'],
        properties: {
          projectIds: {
            type: 'array',
            items: { type: 'string', minLength: 1 },
            minItems: 1,
            maxItems: 100,
            uniqueItems: true,
          },
          options: {
            type: 'object',
            properties: { includeReasoning: { type: 'boolean' } },
            additionalProperties: false,
          },
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

    const projectIds = body['projectIds'];
    const requestedOptions = (body['options'] as Record<string, unknown>) ?? {};
    const platformSettings = await getPlatformSettings();
    const options: Record<string, unknown> = {
      includeReasoning: requestedOptions['includeReasoning'] ?? platformSettings.enable_reasoning,
    };

    if (!Array.isArray(projectIds)) {
      return reply.status(400).send({
        error: 'Invalid request',
        message: 'projectIds must be an array of registered project IDs.',
      });
    }

    if (projectIds.length === 0) {
      return reply.status(400).send({
        error: 'Invalid request',
        message: 'projectIds array must not be empty.',
      });
    }

    if (projectIds.length > 100) {
      return reply.status(400).send({
        error: 'Invalid request',
        message: `Too many projects: ${projectIds.length}. Maximum is 100.`,
      });
    }

    // Validate each project is a non-empty string
    for (let i = 0; i < projectIds.length; i++) {
      if (typeof projectIds[i] !== 'string' || (projectIds[i] as string).trim() === '') {
        return reply.status(400).send({
          error: 'Invalid request',
          message: `projectIds[${i}] must be a non-empty string.`,
        });
      }
    }
    if (new Set(projectIds).size !== projectIds.length) {
      return reply.status(400).send({ error: 'Invalid request', message: 'projectIds must not contain duplicates.' });
    }

    const batchId = await generateBatchId();
    if (!tryAcquireAnalysisWorker(batchId)) {
      return reply.status(409).send({ error: 'Conflict', message: 'Another analysis job is already running.' });
    }
    const now = new Date().toISOString();

    const registeredProjects: RegisteredProject[] = [];
    for (const projectId of projectIds as string[]) {
      const registered = await store.get<RegisteredProject>('projects', projectId);
      if (!registered) {
        releaseAnalysisWorker(batchId);
        return reply.status(404).send({ error: 'Not Found', message: `Project "${projectId}" was not found.` });
      }
      registeredProjects.push(registered);
    }

    const batchRun: BatchRun = {
      batch_id: batchId,
      status: 'pending',
      projects: registeredProjects.map((project) => ({
        projectId: project.id,
        name: project.name,
        repository: project.repository,
        analyzers: project.settings.analyzers,
        collectors: project.settings.collectors,
        status: 'pending' as ProjectStatus,
        started_at: null,
        completed_at: null,
      })),
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
        releaseAnalysisWorker(batchId);
      });
    });

    // Return the initial batch state immediately
    return reply.status(202).send({
      batch_id: batchId,
      status: 'pending',
      projects: batchRun.projects.map((p) => ({
        projectId: p.projectId,
        name: p.name,
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
}
