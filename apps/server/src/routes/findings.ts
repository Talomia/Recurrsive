/**
 * @module @recurrsive/server/routes/findings
 *
 * Findings query and detail routes.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { state } from '../state.js';
import { createLogger } from '@recurrsive/core';

const logger = createLogger({ context: { component: 'server:routes:findings' } });

// ---------------------------------------------------------------------------
// Query types
// ---------------------------------------------------------------------------

interface FindingsQuery {
  severity?: string;
  category?: string;
  analyzer?: string;
  limit?: number;
  offset?: number;
}

interface FindingParams {
  id: string;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Register findings query routes.
 *
 * @param app - Fastify instance.
 */
export async function registerFindingsRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/findings
   *
   * List all findings from the latest analysis with optional filtering
   * by severity, category, and analyzer.
   */
  app.get<{ Querystring: FindingsQuery }>(
    '/api/v1/findings',
    async (request, reply) => {
      const cache = state.getAnalysisCache();
      if (!cache) {
        return reply.code(404).send({
          error: 'No analysis results available',
          message: 'Run an analysis first via POST /api/v1/analyze',
        });
      }

      let findings = [...cache.findings];
      const { severity, category, analyzer, limit = 50, offset = 0 } = request.query;

      // Apply filters
      if (severity) {
        findings = findings.filter((f) => f.severity === severity);
      }
      if (category) {
        findings = findings.filter((f) => f.category === category);
      }
      if (analyzer) {
        findings = findings.filter((f) => f.analyzer_id === analyzer);
      }

      const total = findings.length;
      const paginated = findings.slice(offset, offset + limit);

      logger.debug(`Returning ${paginated.length} of ${total} findings`);

      return reply.send({
        total,
        offset,
        limit,
        findings: paginated,
      });
    },
  );

  /**
   * GET /api/v1/findings/:id
   *
   * Get a specific finding by its ID.
   */
  app.get<{ Params: FindingParams }>(
    '/api/v1/findings/:id',
    async (request, reply) => {
      const cache = state.getAnalysisCache();
      if (!cache) {
        return reply.code(404).send({
          error: 'No analysis results available',
        });
      }

      const finding = cache.findings.find((f) => f.id === request.params.id);

      if (!finding) {
        return reply.code(404).send({
          error: 'Finding not found',
          message: `No finding with ID "${request.params.id}"`,
        });
      }

      return reply.send(finding);
    },
  );

  /**
   * GET /api/v1/findings/summary
   *
   * Get a summary of findings grouped by severity and category.
   */
  app.get('/api/v1/findings/summary', async (_request, reply) => {
    const cache = state.getAnalysisCache();
    if (!cache) {
      return reply.code(404).send({
        error: 'No analysis results available',
      });
    }

    const { findings } = cache;

    // Group by severity
    const bySeverity: Record<string, number> = {};
    for (const f of findings) {
      bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
    }

    // Group by category
    const byCategory: Record<string, number> = {};
    for (const f of findings) {
      byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
    }

    // Group by analyzer
    const byAnalyzer: Record<string, number> = {};
    for (const f of findings) {
      byAnalyzer[f.analyzer_id] = (byAnalyzer[f.analyzer_id] ?? 0) + 1;
    }

    return reply.send({
      total: findings.length,
      by_severity: bySeverity,
      by_category: byCategory,
      by_analyzer: byAnalyzer,
    });
  });
}
