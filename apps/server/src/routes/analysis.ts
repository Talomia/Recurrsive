/**
 * @module @recurrsive/server/routes/analysis
 *
 * Analysis trigger, status, and history routes.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import { state } from '../state.js';
import { createLogger } from '@recurrsive/core';
import { validateBody, ANALYZE_REQUEST_FIELDS } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { store } from '../store.js';
import { resolveAnalysisHistory } from '../project-analysis.js';
import { randomUUID } from 'node:crypto';
import { releaseAnalysisWorker, tryAcquireAnalysisWorker } from '../analysis-coordinator.js';

const logger = createLogger({ context: { component: 'server:routes:analysis' } });

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

interface AnalyzeBody {
  projectId?: string;
  path?: string;
  gitUrl?: string;
  analyzers?: string[];
  include_reasoning?: boolean;
}

interface ProjectRecord {
  id: string;
  name: string;
  repository: string;
}

function isAllowedLocalPath(candidate: string): boolean {
  const resolved = path.resolve(candidate);
  const configured = process.env['RECURRSIVE_ALLOWED_PATHS']
    ?.split(',')
    .map((prefix) => prefix.trim())
    .filter(Boolean);
  const prefixes = configured?.length ? configured : ['/app', '/tmp/recurrsive-repos'];
  return prefixes.some((prefix) => {
    const allowed = path.resolve(prefix);
    return resolved === allowed || resolved.startsWith(`${allowed}${path.sep}`);
  });
}

async function executeAnalysisJob(input: {
  jobId: string;
  projectId: string | null;
  projectName?: string;
  projectPath?: string;
  gitUrl?: string;
  analyzers?: string[];
  includeReasoning?: boolean;
}): Promise<void> {
  let effectivePath = input.projectPath;
  let clonedDir: string | null = null;

  try {
    if (input.gitUrl) {
      clonedDir = await state.cloneRepo(input.gitUrl);
      effectivePath = clonedDir;
    }
    if (!effectivePath) throw new Error('Could not determine project path');

    if (state.isInitialized()) await state.dispose();
    await state.initialize(effectivePath, input.projectName, input.projectId ?? undefined);
    await state.runAnalysis(input.analyzers, input.includeReasoning);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Analysis job failed: ${message}`);
    state.markAnalysisError(message);
  } finally {
    if (clonedDir) await state.cleanupClone(clonedDir);
    releaseAnalysisWorker(input.jobId);
  }
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Register analysis management routes.
 *
 * @param app - Fastify instance.
 */
export async function registerAnalysisRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/v1/analyze
   *
   * Trigger a new analysis run on the specified project path. Initializes
   * the server state if not already initialized, then runs the full
   * collect → analyze → (optionally) reason pipeline.
   *
   * The analysis runs asynchronously; progress is available via the
   * /api/v1/analysis/status endpoint or WebSocket events.
   */
  app.post<{ Body: AnalyzeBody }>('/api/v1/analyze', {
    preHandler: [authMiddleware, requireRole('analyst'), validateBody(ANALYZE_REQUEST_FIELDS)],
  }, async (request, reply) => {
    const { projectId, path: requestedPath, gitUrl: requestedGitUrl, analyzers, include_reasoning } = request.body;

    let project: ProjectRecord | null = null;
    if (projectId) {
      project = await store.get<ProjectRecord>('projects', projectId);
      if (!project) {
        return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
      }
    }

    const registeredSource = project?.repository;
    if (registeredSource && requestedPath && requestedPath !== registeredSource) {
      return reply.status(409).send({ error: 'Conflict', message: 'Requested path does not match the registered project.' });
    }
    if (registeredSource && requestedGitUrl && requestedGitUrl !== registeredSource) {
      return reply.status(409).send({ error: 'Conflict', message: 'Requested Git URL does not match the registered project.' });
    }

    const source = registeredSource ?? requestedGitUrl ?? requestedPath;
    const sourceIsGit = Boolean(source && /^https?:\/\//i.test(source));
    const projectPath = sourceIsGit ? undefined : source;
    const gitUrl = sourceIsGit ? source : undefined;

    if (!projectPath && !gitUrl) {
      return reply.status(400).send({
        error: 'Bad request',
        message: 'Request body must include either "path" (absolute local path) or "gitUrl" (git repository URL).',
      });
    }

    if (gitUrl && !projectId) {
      return reply.status(400).send({
        error: 'Bad request',
        message: 'Remote repositories must first be registered as a project and analyzed with projectId.',
      });
    }

    if (projectPath && !isAllowedLocalPath(projectPath)) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Project path is outside RECURRSIVE_ALLOWED_PATHS.' });
    }

    const jobId = randomUUID();
    if (!tryAcquireAnalysisWorker(jobId)) {
      const currentStatus = state.getAnalysisStatus();
      return reply.status(409).send({
        error: 'Conflict',
        message: `Analysis already in progress (phase: ${currentStatus.phase})`,
        status: currentStatus,
      });
    }

    // Mark as starting IMMEDIATELY to prevent TOCTOU race condition
    // (a second request arriving during clone would pass the check above)
    const persistedSettings = await store.get<{ enable_reasoning?: boolean }>('settings_overrides', 'default');
    state.markAnalysisStarting(projectId);
    void executeAnalysisJob({
      jobId,
      projectId: projectId ?? null,
      projectName: project?.name,
      projectPath,
      gitUrl,
      analyzers,
      includeReasoning: include_reasoning ?? persistedSettings?.enable_reasoning ?? true,
    });

    return reply.status(202).send({
      message: 'Analysis started',
      status: state.getAnalysisStatus(),
      projectId: projectId ?? null,
      project: projectPath,
      gitUrl: gitUrl || undefined,
      endpoints: {
        status: '/api/v1/analysis/status',
        history: '/api/v1/analysis/history',
        opportunities: '/api/v1/opportunities',
      },
    });
  });

  /**
   * GET /api/v1/analysis/status
   *
   * Return the current status of the analysis pipeline, including
   * phase, progress percentage, and any error information.
   */
  app.get<{ Querystring: { projectId?: string } }>('/api/v1/analysis/status', {
    preHandler: [authMiddleware],
    schema: { querystring: { type: 'object', properties: { projectId: { type: 'string' } } } },
  }, async (request, reply) => {
    const projectId = request.query.projectId;
    const current = state.getAnalysisStatus();
    const status = projectId && current.projectId !== projectId
      ? await store.get<typeof current>('analysis_status', projectId) ?? {
          projectId,
          phase: 'idle' as const,
          progress: 0,
          message: 'No analysis has run for this project',
          startedAt: null,
          completedAt: null,
          error: null,
        }
      : current;
    return reply.status(200).send({
      data: status,
    });
  });

  /**
   * GET /api/v1/analysis/history
   *
   * Return the history of all analysis runs performed during this
   * server session, ordered newest-first.
   */
  app.get('/api/v1/analysis/history', {
    preHandler: [authMiddleware],
    schema: { querystring: { type: 'object', properties: { projectId: { type: 'string' } } } },
  }, async (request, reply) => {
    const history = await resolveAnalysisHistory(request);

    return reply.status(200).send({
      data: [...history].reverse(),
      total: history.length,
    });
  });
}
