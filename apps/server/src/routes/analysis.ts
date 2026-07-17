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

const logger = createLogger({ context: { component: 'server:routes:analysis' } });

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

interface AnalyzeBody {
  path?: string;
  gitUrl?: string;
  analyzers?: string[];
  include_reasoning?: boolean;
  /** Project id to scope this analysis under (defaults to the implicit project). */
  projectId?: string;
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
    const { path: projectPath, gitUrl, analyzers, include_reasoning, projectId } = request.body;

    if (!projectPath && !gitUrl) {
      return reply.status(400).send({
        error: 'Bad request',
        message: 'Request body must include either "path" (absolute local path) or "gitUrl" (git repository URL).',
      });
    }

    // Check if an analysis is already running
    const currentStatus = state.getAnalysisStatus();
    if (
      currentStatus.phase !== 'idle' &&
      currentStatus.phase !== 'complete' &&
      currentStatus.phase !== 'error'
    ) {
      return reply.status(409).send({
        error: 'Conflict',
        message: `Analysis already in progress (phase: ${currentStatus.phase})`,
        status: currentStatus,
      });
    }

    // Mark as starting IMMEDIATELY to prevent TOCTOU race condition
    // (a second request arriving during clone would pass the check above)
    state.markAnalysisStarting();

    // Determine the effective project path
    let effectivePath = projectPath;
    let clonedDir: string | null = null;

    if (gitUrl) {
      try {
        clonedDir = await state.cloneRepo(gitUrl);
        effectivePath = clonedDir;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        state.markAnalysisError(message);
        // An invalid/unsupported gitUrl is a client input error (400); an actual
        // clone failure (network, missing repo) is a server-side 500.
        const isInputError = /only http|not a valid|invalid.*url|must be a/i.test(message);
        return reply.status(isInputError ? 400 : 500).send({
          error: isInputError ? 'Bad request' : 'Clone failed',
          message,
        });
      }
    }

    if (!effectivePath) {
      state.markAnalysisError('Could not determine project path');
      return reply.status(400).send({
        error: 'Bad request',
        message: 'Could not determine project path.',
      });
    }

    // Path traversal protection: only allow safe directories
    const resolvedPath = path.resolve(effectivePath);
    const envPrefixes = process.env['RECURRSIVE_ALLOWED_PATHS']?.split(',').map(p => p.trim()).filter(Boolean);
    const ALLOWED_PREFIXES = envPrefixes ?? ['/app', '/tmp/recurrsive-repos/'];
    const isSafePath = ALLOWED_PREFIXES.some((prefix) => resolvedPath.startsWith(prefix));
    if (!isSafePath) {
      state.markAnalysisError('Path not allowed');
      if (clonedDir) await state.cleanupClone(clonedDir);
      return reply.status(403).send({
        error: 'Forbidden',
        message: `Path "${resolvedPath}" is not in the allowed directories. ` +
          `Allowed prefixes: ${ALLOWED_PREFIXES.join(', ')}`,
      });
    }

    // Initialize if needed or if the project path changed
    if (!state.isInitialized() || state.getProjectPath() !== effectivePath) {
      try {
        if (state.isInitialized()) {
          await state.dispose();
        }
        // Derive a human-readable project name from the git URL or path
        let projectName: string | undefined;
        if (gitUrl) {
          // Extract repo name from URL: "https://github.com/Org/Repo.git" → "Repo"
          const urlPath = gitUrl.replace(/\.git$/, '');
          const lastSegment = urlPath.split('/').pop();
          if (lastSegment) projectName = lastSegment;
        }
        await state.initialize(effectivePath, projectName);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to initialize server state: ${message}`);
        state.markAnalysisError(message);
        if (clonedDir) await state.cleanupClone(clonedDir);
        return reply.status(500).send({
          error: 'Initialization failed',
          message,
        });
      }
    }

    // Fire off the analysis asynchronously
    state.runAnalysis(analyzers, include_reasoning, projectId)
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Analysis failed: ${message}`);
      })
      .finally(() => {
        // Cleanup cloned repos after analysis
        if (clonedDir) {
          state.cleanupClone(clonedDir).catch(() => {});
        }
      });

    return reply.status(202).send({
      message: 'Analysis started',
      status: state.getAnalysisStatus(),
      project: effectivePath,
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
  app.get('/api/v1/analysis/status', { preHandler: [authMiddleware] }, async (_request, reply) => {
    return reply.status(200).send({
      data: state.getAnalysisStatus(),
    });
  });

  /**
   * GET /api/v1/analysis/history
   *
   * Return the history of all analysis runs performed during this
   * server session, ordered newest-first.
   */
  app.get('/api/v1/analysis/history', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const history = state.getAnalysisHistory();

    return reply.status(200).send({
      data: [...history].reverse(),
      total: history.length,
    });
  });
}
