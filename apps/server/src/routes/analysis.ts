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

const logger = createLogger({ context: { component: 'server:routes:analysis' } });

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

interface AnalyzeBody {
  path?: string;
  gitUrl?: string;
  analyzers?: string[];
  include_reasoning?: boolean;
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
  app.post<{ Body: AnalyzeBody }>('/api/v1/analyze', async (request, reply) => {
    const { path: projectPath, gitUrl, analyzers, include_reasoning } = request.body;

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
        return reply.status(500).send({
          error: 'Clone failed',
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
    const ALLOWED_PREFIXES = ['/app', '/tmp/recurrsive-repos/', '/home/'];
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
        await state.initialize(effectivePath);
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
    state.runAnalysis(analyzers, include_reasoning)
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
  app.get('/api/v1/analysis/status', async (_request, reply) => {
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
  app.get('/api/v1/analysis/history', async (_request, reply) => {
    const history = state.getAnalysisHistory();

    return reply.status(200).send({
      data: [...history].reverse(),
      total: history.length,
    });
  });
}
