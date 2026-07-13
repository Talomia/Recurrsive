/**
 * @module @recurrsive/server/routes/findings
 *
 * Findings query and detail routes.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { createLogger, nowISO } from '@recurrsive/core';
import { authMiddleware } from '../middleware/auth.js';
import {
  persistFindingStates,
  rethrowProjectScopeError,
  resolveAnalysis,
  resolveFindingStates,
} from '../project-analysis.js';

const logger = createLogger({ context: { component: 'server:routes:findings' } });

// ---------------------------------------------------------------------------
// Query types
// ---------------------------------------------------------------------------

interface FindingsQuery {
  projectId?: string;
  severity?: string;
  category?: string;
  analyzer?: string;
  limit?: string;
  offset?: string;
}

interface FindingParams {
  id: string;
}

interface UpdateFindingBody {
  status?: 'open' | 'resolved' | 'suppressed';
  assignee?: string;
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
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      try {
        const { cache } = await resolveAnalysis(request);
        if (!cache) {
          return reply.status(404).send({
            error: 'No analysis results available',
            message: 'Run an analysis first via POST /api/v1/analyze',
          });
        }

        let findings = [...cache.findings];
        const { severity, category, analyzer } = request.query;
        const limit = Math.max(1, Math.min(Number(request.query.limit) || 50, 500));
        const offset = Math.max(0, Number(request.query.offset) || 0);

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

        return reply.status(200).send({
          data: paginated,
          total,
          offset,
          limit,
        });
      } catch (err) {
        rethrowProjectScopeError(err);
        logger.error('Failed to list findings', { error: err });
        return reply.status(500).send({
          error: 'Internal server error',
          message: 'Failed to retrieve findings.',
        });
      }
    },
  );

  // ── Static sub-paths MUST be registered BEFORE the parametric `:id` route ──
  // Fastify matches parametric routes first if registered first, so
  // `/api/v1/findings/summary` would match `:id = "summary"` if `:id`
  // is registered before the static path.

  /**
   * GET /api/v1/findings/summary
   *
   * Get a summary of findings grouped by severity and category.
   */
  app.get<{ Querystring: FindingsQuery }>('/api/v1/findings/summary', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      const { cache } = await resolveAnalysis(request);
      if (!cache) {
        return reply.status(404).send({
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

      return reply.status(200).send({
        data: {
          total: findings.length,
          by_severity: bySeverity,
          by_category: byCategory,
          by_analyzer: byAnalyzer,
        },
      });
    } catch (err) {
      rethrowProjectScopeError(err);
      logger.error('Failed to generate findings summary', { error: err });
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to generate findings summary.',
      });
    }
  });

  // ── GET /api/v1/findings/page ──────────────────────────────────────────
  // Dashboard findings page — returns findings with severity stats.
  // Maps core Finding objects to the FindingsPageItem shape.

  app.get<{ Querystring: FindingsQuery }>('/api/v1/findings/page', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      const resolved = await resolveAnalysis(request);
      const { cache } = resolved;
      if (!cache) {
        return reply.status(200).send({
          data: {
            analyzed: false,
            findings: [],
            stats: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
          },
        });
      }

      const { findings } = cache;
      const states = await resolveFindingStates(resolved);

      const items = findings.map((f) => ({
        id: f.id,
        title: f.title,
        severity: f.severity,
        category: f.category,
        status: states[f.id]?.status ?? ('open' as const),
        assignee: states[f.id]?.assignee ?? '',
        created_at: f.created_at ?? cache.analyzedAt,
      }));

      const stats = {
        total: findings.length,
        critical: findings.filter((f) => f.severity === 'critical').length,
        high: findings.filter((f) => f.severity === 'high').length,
        medium: findings.filter((f) => f.severity === 'medium').length,
        low: findings.filter((f) => f.severity === 'low').length,
      };

      return reply.status(200).send({ data: { analyzed: true, findings: items, stats } });
    } catch (err) {
      rethrowProjectScopeError(err);
      logger.error('Failed to generate findings page', { error: err });
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to generate findings page data.',
      });
    }
  });

  /**
   * GET /api/v1/findings/categories
   *
   * Return categories of findings with counts and highest severity per category.
   */
  app.get<{ Querystring: FindingsQuery }>('/api/v1/findings/categories', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      const { cache } = await resolveAnalysis(request);
      if (!cache) {
        return reply.status(200).send({ data: [], total: 0 });
      }

      const { findings } = cache;

      // Aggregate by category: count + track highest severity
      const severityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
      const categoryMap = new Map<string, { count: number; severity: string; severityRank: number }>();

      for (const f of findings) {
        const existing = categoryMap.get(f.category);
        const rank = severityOrder[f.severity] ?? 0;

        if (existing) {
          existing.count += 1;
          if (rank > existing.severityRank) {
            existing.severity = f.severity;
            existing.severityRank = rank;
          }
        } else {
          categoryMap.set(f.category, { count: 1, severity: f.severity, severityRank: rank });
        }
      }

      const categories = Array.from(categoryMap.entries())
        .map(([name, { count, severity }]) => ({ name, count, severity }))
        .sort((a, b) => b.count - a.count);

      return reply.status(200).send({ data: categories, total: categories.length });
    } catch (err) {
      rethrowProjectScopeError(err);
      logger.error('Failed to generate findings categories', { error: err });
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to generate findings categories.',
      });
    }
  });

  /**
   * GET /api/v1/findings/:id
   *
   * Get a specific finding by its ID.
   *
   * NOTE: This parametric route MUST be registered AFTER all static
   * sub-path routes (summary, page, categories) to prevent Fastify
   * from matching literal paths like "summary" as `:id`.
   */
  app.get<{ Params: FindingParams; Querystring: FindingsQuery }>(
    '/api/v1/findings/:id',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      try {
        const resolved = await resolveAnalysis(request);
        const { cache } = resolved;
        if (!cache) {
          return reply.status(404).send({
            error: 'No analysis results available',
          });
        }

        const finding = cache.findings.find((f) => f.id === request.params.id);

        if (!finding) {
          return reply.status(404).send({
            error: 'Finding not found',
            message: `No finding with ID "${request.params.id}"`,
          });
        }

        const states = await resolveFindingStates(resolved);
        const workflow = states[finding.id] ?? { status: 'open', assignee: '' };
        const firstLocation = finding.locations[0];
        return reply.status(200).send({
          data: {
            ...finding,
            ...workflow,
            file_path: firstLocation?.file,
            line_start: firstLocation?.start_line,
            line_end: firstLocation?.end_line,
          },
        });
      } catch (err) {
        rethrowProjectScopeError(err);
        logger.error('Failed to get finding', { error: err });
        return reply.status(500).send({
          error: 'Internal server error',
          message: 'Failed to retrieve finding.',
        });
      }
    },
  );

  app.patch<{
    Params: FindingParams;
    Querystring: FindingsQuery;
    Body: UpdateFindingBody;
  }>(
    '/api/v1/findings/:id',
    {
      preHandler: [authMiddleware],
      schema: {
        body: {
          type: 'object',
          minProperties: 1,
          properties: {
            status: { type: 'string', enum: ['open', 'resolved', 'suppressed'] },
            assignee: { type: 'string', maxLength: 120 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const resolved = await resolveAnalysis(request);
      const finding = resolved.cache?.findings.find((item) => item.id === request.params.id);
      if (!finding) return reply.status(404).send({ error: 'Finding not found' });

      const states = await resolveFindingStates(resolved);
      const previous = states[finding.id] ?? { status: 'open' as const, assignee: '', updatedAt: nowISO() };
      const updated = {
        status: request.body.status ?? previous.status,
        assignee: request.body.assignee?.trim() ?? previous.assignee,
        updatedAt: nowISO(),
      };
      states[finding.id] = updated;
      await persistFindingStates(resolved, states);
      return reply.send({ data: { ...finding, ...updated } });
    },
  );
}
